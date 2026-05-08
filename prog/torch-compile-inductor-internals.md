# TorchInductor 内部实现详解

## 一、整体架构概览

```
FX Graph (from Dynamo/AOTAutograd)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Pre-grad Passes（预处理）                                      │
│     • 算子分解 (decompositions)                                   │
│     • view 消除 / broadcasting 规范化                              │
│     • 索引化简 (index simplify)                                   │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Joint-graph Passes（前后向联合优化）                            │
│     • 前后向图一起优化                                             │
│     • 共享计算消除                                                │
│     • 算子融合（需要同时看前向和反向）                               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Graph Lowering（ATen → Inductor IR）                          │
│     • 433 个算子的 lowering 函数 (@register_lowering)            │
│     • 分解为 Pointwise / Reduction / Scan 三类核心 IR            │
│     • view / stride 规范化                                        │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Post-grad Passes（后处理优化）                                 │
│     • PatternMatcher 融合（softmax rewrite 等）                   │
│     • 内存布局优化                                                 │
│     • rematerialization 决策                                      │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Scheduling（调度决策）                                        │
│     • 算子融合（horizontal / vertical）                            │
│     • Tiling（分块）                                              │
│     • 内存规划 / buffer reuse                                      │
│     • Persistent reduction 选择                                  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Codegen（代码生成）                                          │
│     • Triton（GPU）: Kernel template + Autotune                  │
│     • C++（CPU）: OpenMP + SIMD (AVX2/AVX-512)                   │
│     • Wrapper Codegen                                             │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
 优化后的 Kernel（compiled_fn）
```

---

## 二、TorchInductor 的输入

### 2.1 完整输入列表

| 输入 | 来源 | 作用 |
|------|------|------|
| **FX Graph** (`GraphModule`) | TorchDynamo | ATen 算子组成的数据流图 |
| **Example Inputs** (真实 tensor 或 FakeTensor) | 用户 | shape/dtype/device 元信息，用于生成符号化尺寸 |
| **Decompositions** | AOTAutograd | 经过算子分解后的更细粒度 ATen op 图 |
| **Shape Env / SymPy 表达式** | Dynamo guards 派生 | 符号化 shape 约束（如 `s0 * s1 = 4096`） |
| **Config** | `torch._inductor.config` | 各种编译选项（tiling、autotune、cpp_wrapper 等） |

### 2.2 核心输入：FX Graph + Example Inputs

```python
# torch._inductor.compile_fx 入口
def compile_fx(model: GraphModule, example_inputs, config_patches=None):
    # 1. 将真实 tensor 转为 FakeTensor（支持动态 shape）
    fake_inputs = FakeTensorProp(model).propagate(example_inputs)
    
    # 2. 调用 compile_fx_impl
    return compile_fx_impl(model_, fake_inputs_, config_patches)
```

### 2.3 FakeTensor 的关键作用

把具体的 `size=1024` 替换成符号 `s0`，这样编译出的代码可以参数化适配不同的 shape：

```python
# FakeTensor 将 concrete size 转为 symbolic size
tensor.size()    # 1024  concrete
# ↓
symbolic_size     # s0    symbolic (SymInt)
```

---

## 三、各阶段详细解析

### 3.1 Pre-grad Passes（预处理）

发生在 graph lowering 之前，处理 **AOTAutograd 分解后的原始 FX Graph**：

```
# 关键文件: torch/_inductor/fx_passes/pre_grad.py

passes:
  1. decomposition        # 确保所有 op 分解到 ATen 级别
  2. normalization        # 去除冗余 view / simplify indexing
  3. batched_embedding    # 特定 pattern 优化（如 embedding lookup）
  4. remove_split_with_cat  # 消除无意义的 split+cat 模式
```

### 3.2 Joint-graph Passes（前后向联合优化）

发生在 forward + backward 图同时存在时，基于 **normalized ATen IR**：

```
# 关键文件: torch/_inductor/fx_passes/joint_graph.py

# 优化类型：
# 1. 前后向共享算子消除（如 forward 的 weight 梯度计算）
# 2. 前向图和反向图之间的融合机会
# 3. 常量折叠
```

### 3.3 Graph Lowering（ATen → Inductor IR）

这是最核心的转换阶段。Inductor 定义了 **三类核心 IR 原语**：

```python
# torch/_inductor/ir.py

@register_lowering(aten.add, broadcast=True)
def add(a, b):
    return Pointwise.create(
        device=a.get_device(),
        dtype=a.get_dtype(),
        inner_fn=lambda x, y: x + y,
        ranges=broadcast_shapes(a.get_size(), b.get_size()),
        inputs=[a, b],
    )

@register_lowering(aten.sum)
def sum(x):
    return Reduction.create(
        device=x.get_device(),
        dtype=x.get_dtype(),
        inner_fn=lambda x: x,
        reduction_fn="sum",
        ranges=x.get_size(),
    )
```

| IR 类型 | 含义 | 例子 |
|--------|------|------|
| **Pointwise** | 逐元素操作（可融合成一体） | `add`, `relu`, `exp` |
| **Reduction** | 归约操作 | `sum`, `max`, `softmax` |
| **Scan** | 扫描操作 | `cumsum`, `prefix_sum` |

**Lowering 核心步骤**：

```python
# 对 FX Graph 中每个 aten 节点调用 lowering 函数
for node in fx_graph.nodes:
    if node.op == "call_function":
        op = node.target
        if op in lowering_registry:
            inductor_node = lowering_registry[op](*args)  # → Pointwise/Reduction
```

### 3.4 Post-grad Passes（后处理优化）

发生在图已经 lowering 到 Inductor IR 之后，在 **functionalized + 分解后的 normalized ATen IR** 上做 pattern matching：

```python
# torch/_inductor/fx_passes/post_grad.py

# Pattern Matcher 注册融合规则
@register_replacement(prepare_softmax_pattern, prepare_softmax_replacement)
def softmax_pattern(x):
    ...

# Inductor 迭代所有注册的 pattern，逐个尝试匹配和替换
for patterns in pass_patterns:
    GraphTransformObserver(gm, f"pass_pattern_{i}").apply_graph_pass(
        patterns.apply
    )
```

**常见的 post-grad 融合 patterns**：

| Pattern | 描述 | 融合前 | 融合后 |
|---------|------|--------|--------|
| **Pointwise fusion** | 多个逐元素操作合并 | `x+1` → `x*2` → `x-3` | 单个 fused kernel |
| **Softmax rewrite** | 分解的 softmax 替换为高效实现 | `amax-sub-exp-sum-div` | `aten._softmax` kernel |
| **Linear prepack** | weight 预打包 | 每次 forward 重新 layout | 一次打包多次使用 |
| **Conv+BN folding** | Conv 和 BN 参数合并 | 分开的 Conv 和 BN | 合并后的 Conv |

### 3.5 Scheduling（调度决策）

**Scheduler** 是 Inductor 的核心决策引擎：

```python
# torch/_inductor/scheduler.py

# 1. 将所有 IR 节点组织成调度计划
scheduler = Scheduler(buffers)

# 2. 评估每对可融合的节点
can_fuse(buf0, buf1) → bool
score_fusion(buf0, buf1) → (category, bandwidth_saved, distance)

# 3. 决定融合决策
scheduler.fuse_nodes()
```

**融合评分系统**：

```python
# scheduler.score_fusion 的返回结构
(True, True, 33554432, -1)
#  ↑        ↑           ↑        ↑
# 可融合?   类型        预估节省   图中距离
#         (pw+pw)     带宽(bytes)
```

**融合类型**：

| 类型 | 说明 | 例子 |
|------|------|------|
| **Pointwise + Pointwise** | 逐元素操作合并 | `relu(add(x,y))` |
| **Pointwise + Reduction** | 融合reduction到结尾 | `sum(sin(x))` |
| **Reduction + Pointwise** | 融合reduction后的element-wise | `softmax(x) * 2` |
| **BCE + Sigmoid** | 数值稳定的 sigmoid fuse | `binary_cross_entropy(sigmoid(...))` |

**Tiling 决策**：

```python
# scheduler 对每个节点决定 tile 大小
tiling = choose_tile_size(node, max_tile=128)
# 决策依据：
# 1. GPU shared memory 容量 (48KB for A100)
# 2. 内存访问模式
# 3. 线程块利用率
```

**Persistent Reduction**：

```python
# 对于小尺寸 reduction 使用 persistent kernel
# 避免显式循环，直接在寄存器中完成 reduction
if reduction_size <= 1024 and config.triton.persistent_reductions:
    use_persistent_reduction = True  # 更快但更耗 register
```

---

## 四、Codegen（代码生成）

### 4.1 Triton 代码生成 (GPU)

**工作流程**：

```python
# torch/_inductor/codegen/triton.py

# 1. 为每个 fusion group 生成 Triton kernel
for node_group in scheduler.fused_nodes:
    kernel_code = TritonKernelTemplate.render(
        node_group=node_group,
        signature=generate_signature(node_group),
        heuristics=generate_heuristics(node_group),
    )

# 2. Autotuning 搜索最优配置
@triton.autotune(
    configs=[
        Config({'BLOCK_M': 64, 'BLOCK_N': 64}),
        Config({'BLOCK_M': 128, 'BLOCK_N': 128}),
        Config({'BLOCK_M': 256, 'BLOCK_N': 64}),
    ],
    key=['M', 'N'],
)
def triton_kernel(in_ptr, out_ptr, M, N, ...):
    ...
```

**生成的 Triton 代码结构**：

```python
import triton
import triton.language as tl

@triton.autotune(configs=[...], key=['M', 'N'])
@triton.jit
def triton_kernel(
    in_ptr,          # 输入指针
    out_ptr,         # 输出指针
    M, N,            # 符号化尺寸
    BLOCK_M: tl.constexpr,
    BLOCK_N: tl.constexpr,
):
    # 1. 计算 thread id 和 tile 范围
    pid = tl.program_id(axis=0)
    rm = pid * BLOCK_M + tl.arange(0, BLOCK_M)
    rn = tl.arange(0, BLOCK_N)
    
    # 2. 向量化加载（memory coalescing）
    a = tl.load(in_ptr + rm * stride, mask=rm < M)
    
    # 3. 计算
    c = tl.sin(a) + tl.cos(a)  # 融合后的操作
    
    # 4. 向量化存储
    tl.store(out_ptr + rm, c, mask=rm < M)
```

**Triton 的关键优化**：

| 优化 | 说明 |
|------|------|
| **Tiling** | 将数据分块加载到 shared memory |
| **Memory Coalescing** | 相邻线程访问连续内存 |
| **Autotune** | 自动搜索最优 tile 大小 |
| **Persistent Kernel** | 小尺寸 reduction 常驻 SM |

### 4.2 C++ 代码生成 (CPU)

**生成的 C++ 结构**：

```cpp
// torch/_inductor/codegen/cpp.py

extern "C" void kernel(
    const float __restrict__ in_ptr0,
    const float __restrict__ in_ptr1,
    float __restrict__ out_ptr0,
    const long ks0, const long ks1
) {
    #pragma omp parallel for simd  // OpenMP 并行 + 向量化
    for (int64_t i = 0; i < ks0; i++) {
        out_ptr0[i] = in_ptr0[i] + in_ptr1[i];
    }
}
```

**CPU 后端的关键优化**：

| 优化 | 说明 |
|------|------|
| **OpenMP 并行** | 多核并行 `#pragma omp parallel for` |
| **SIMD 向量化** | AVX2 (256-bit) / AVX-512 (512-bit) |
| **oneDNN 集成** | Conv/GEMM 使用 oneDNN 库 |
| **Weight Prepack** | 一次性 layout 转换，多次使用 |
| **Post-op Fusion** | Conv 后融合 element-wise 操作 |

**硬件感知的代码生成**：

```python
# Inductor 检测 CPU 特性，选择最优向量宽度
if has_avx512:
    vector_width = 512  # 16 float32
    isa_flags = "-mavx512f -mavx512dq"
elif has_avx2:
    vector_width = 256  # 8 float32
    isa_flags = "-mavx2"
```

### 4.3 Wrapper Codegen

Wrapper 负责生成 **调用 kernels 的外层代码**：

```python
# Python wrapper (默认)
def call(*args):
    buf0 = allocate([...])          # 内存分配
    triton_kernel_0(in_ptr, buf0)    # kernel 1
    triton_kernel_1(buf0, out_ptr)   # kernel 2
    return out_ptr

# C++ wrapper（可选，减少 Python 开销）
extern "C" void inductor_entry(...) {  // 完全 C++ 调用
    allocate(...);
    kernel_0(...);
    kernel_1(...);
}
```

---

## 五、完整的 Pass 序列

```
┌──────────────────────────────────────────────────────────────────┐
│ Input: FX Graph (GraphModule from Dynamo/AOTAutograd)            │
└──────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────────┐               ┌───────────────────────────┐
│ Pre-grad Passes        │               │ Joint-graph Passes        │
│ (pre_grad.py)          │               │ (joint_graph.py)          │
│                        │               │                            │
│ 1. decomposition       │               │ 1. joint pattern matching │
│ 2. batched_embedding   │               │ 2. fwd/bwd shared compute │
│ 3. normalize          │               │ 3. constant fold           │
└───────────────────────┘               └───────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Graph Lowering: ATen ops → Inductor IR (Pointwise/Reduction)    │
│ torch/_inductor/graph.py: compile_to_module()                     │
│ torch/_inductor/ir.py: 433 @register_lowering 函数                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Post-grad Passes (post_grad.py)                                  │
│                                                                  │
│ 1. pattern_matcher 融合规则（softmax, layer_norm 等）            │
│ 2. remove_split_with_cat                                         │
│ 3. mkldnn_modules_pattern                                        │
│ 4. register_replacement 规则                                     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Scheduling (scheduler.py)                                       │
│                                                                  │
│ 1. fuse_nodes() → horizontal/vertical fusion                    │
│ 2. create_tasks() → 调度任务                                      │
│ 3. pending_nodes → 依赖分析                                      │
│ 4. tile sizes → tiling 决策                                      │
│ 5. buffer reuse → 内存规划                                        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────┐  ┌───────────────────────────────────────┐
│ Wrapper Codegen      │  │ Backend Codegen                       │
│ (wrapper.py)         │  │ (triton.py / cpp.py)                   │
│                      │  │                                      │
│ • kernel 调用顺序    │  │ • Triton: Kernel template + autotune  │
│ • 内存分配           │  │ • C++: OpenMP + SIMD + oneDNN         │
│ • 替换 interpreter   │  │                                      │
└──────────────────────┘  └───────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Output: 优化后的 compiled_fn (Triton kernel / C++ function)     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 六、核心设计总结

| 组件 | 实现位置 | 核心职责 |
|------|---------|---------|
| **Lowering** | `torch/_inductor/ir.py` | 433 个算子的 ATen→IR 映射 |
| **Pattern Matcher** | `torch/_inductor/fx_passes/` | 图级别的融合规则 |
| **Scheduler** | `torch/_inductor/scheduler.py` | 融合决策、tiling、内存规划 |
| **Triton Codegen** | `torch/_inductor/codegen/triton.py` | GPU kernel 生成 + autotune |
| **C++ Codegen** | `torch/_inductor/codegen/cpp.py` | CPU kernel 生成 + SIMD |
| **Wrapper Codegen** | `torch/_inductor/codegen/wrapper.py` | 调用 kernels 的外层代码 |

---

## 七、调试工具

TorchInductor 提供了详细的调试输出：

```bash
# 设置 TORCH_COMPILE_DEBUG=1 可以查看完整编译过程
TORCH_COMPILE_DEBUG=1 python your_model.py
```

**生成的文件**：

| 文件 | 内容 |
|------|------|
| `fx_graph_readable.py` | ATen 算子组成的 FX 图 |
| `fx_graph_runnable.py` | 可独立运行的图代码 |
| `fx_graph_transformed.py` | 经过中间转换后的图 |
| `ir_pre_fusion.txt` | Inductor IR（融合前） |
| `ir_post_fusion.txt` | Inductor IR（融合后） |
| `output_code.py` | 最终生成的 Triton/C++ 代码 |

---

## 参考资料

- [Inductor Passes — PyTorch Dev Discuss](https://dev-discuss.pytorch.org/t/inductor-passes/2742)
- [TorchInductor: Define-by-Run IR](https://dev-discuss.pytorch.org/t/torchinductor-a-pytorch-native-compiler-with-define-by-run-ir-and-symbolic-shapes/747)
- [Accelerated CPU Inference with PyTorch Inductor — PyTorch Blog](https://pytorch.org/blog/accelerated-cpu-inference/)
- [Learn by doing: TorchInductor Pattern Matcher](https://karthick.ai/blog/2026/Learn-By-Doing-Torchinductor-Pattern-Matcher/)
- [Learn by doing: TorchInductor Reduction Kernels](https://karthick.ai/blog/2025/Learn-By-Doing-Torchinductor-Reduction/)
- [PyTorch 2.0 Architecture (Hot Chips 2023)](https://www.hc2023.hotchips.org/assets/program/tutorials/ml/PyTorch%202.0.pdf)
