# torch.compile 架构设计详解

## 一、整体架构概览

```
Python 代码
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                    torch.compile()                              │
│                    (入口 + 协调层)                                │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌────────────────────┐   ┌────────────────────┐
│    TorchDynamo     │ → │    AOTAutograd     │
│  (前端: 字节码分析)  │   │  (反向图捕获)        │
└────────────────────┘   └────────────────────┘
    ↓ FX Graph              ↓ FX Graph (forward+backward)
┌─────────────────────────────────────────────────────────────────┐
│                    TorchInductor                                 │
│                  (后端: 代码生成)                                 │
└─────────────────────────────────────────────────────────────────┘
    ↓                       ↓
┌──────────────────┐  ┌──────────────────┐
│   Triton         │  │   C++           │
│ (GPU 内核)        │  │ (CPU 内核)       │
└──────────────────┘  └──────────────────┘
    ↓                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                     CUDA / CPU Runtime                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、TorchDynamo — 前端字节码编译器

### 2.1 核心原理：挂钩 CPython Frame Evaluation API

Dynamo 借助 **PEP 523** (`_PyFrameEvalFunction`)，在 CPython 执行字节码之前插入一个中间层，用 Python 实现了自己的解释器。

```
┌──────────────┐    PEP 523 Hook     ┌─────────────────┐
│ Python 源码   │  ───────────────→  │ TorchDynamo     │
│              │                    │ (字节码重写引擎)  │
└──────────────┘                     └─────────────────┘
    ↓ bytecode                              ↓
┌──────────────┐                     ┌─────────────────┐
│ 字节码        │  ───────────────→  │ PyTorch 运算图   │
│              │                     │ (FX Graph)      │
└──────────────┘                     └─────────────────┘
```

### 2.2 读取什么？— Python 字节码

Dynamo 并不直接读取 Python 源代码，而是接收 **Python 字节码**。每个字节码指令包含：

| 字段 | 含义 |
|------|------|
| `opcode` | 操作码（如 `LOAD_FAST`, `BINARY_ADD`） |
| `arg` | 参数 |
| `argval` | 实际值引用 |

Dynamo 的核心是一个 **字节码解释器**，对每条指令进行符号化求值：

```python
# Dynamo 伪代码解释器逻辑
def eval_bytecode(instructions, inputs):
    graph = FXGraph()
    stack = []
    locals = {}
    
    for instr in instructions:
        if instr.opcode == "LOAD_FAST":
            stack.append(locals[instr.arg])
        elif instr.opcode == "BINARY_ADD":
            a, b = stack.pop(), stack.pop()
            # 关键：如果 a, b 是 torch.Tensor，记录到图中
            if is_tensor(a) and is_tensor(b):
                graph.append_node(torch.add(a, b))
            else:
                # 非 tensor 操作 → 图断裂
                graph_break()
```

### 2.3 图捕获过程

Dynamo 遍历字节码时，维护一个 **FX Graph**（`torch.fx.Graph`），遇到 PyTorch 操作就追加节点：

```python
@torch.compile
def forward(x):
    a = torch.sin(x)       # → graph.append_node("sin")
    b = torch.cos(x)       # → graph.append_node("cos")
    return a + b           # → graph.append_node("add")
```

生成的 FX Graph：

```
x (input)
  ↓
sin(x)
  ↓
cos(x)
  ↓
add(sin, cos)
  ↓
output
```

### 2.4 图断裂 (Graph Breaks)

Dynamo 遇到无法用 PyTorch 运算表示的 Python 代码时，必须断裂：

| 触发图断裂的情况 | 例子 |
|----------------|------|
| Python 控制流（data-dependent） | `if tensor.item() < 0:` |
| Python 内置函数 | `print(x)`, `len(tensor)` |
| NumPy 调用 | `np.sum(x)` |
| Python 类型检查 | `isinstance(x, int)` |
| 副作用操作 | `tensor.tolist()` |

**图断裂的处理策略**：Dynamo 把原来的字节码替换成函数调用序列：

```
原始字节码:
  LOAD_FAST x
  LOAD_FAST y
  BINARY_ADD          ← Dynamo: 这里捕获到 PyTorch op

图断裂示例 (data-dependent if):
原代码: if x.sum() < 0: a = x * 2  else: a = x * 3

Dynamo 改写后的字节码:
  0 LOAD_GLOBAL __compiled_fn_1    ← 调用编译后的图 (x.sum() < 0)
  2 LOAD_FAST x
  4 CALL_FUNCTION 1
  6 UNPACK_SEQUENCE 2              ← 分支结果
  8 STORE_FAST c
 10 POP_JUMP_IF_FALSE 22           ← 数据依赖的分支
 12 LOAD_GLOBAL __resume_at_16_2   ← 走 true 分支的 resume
 14 CALL_FUNCTION 1
 16 RETURN_VALUE
  >> 22 LOAD_GLOBAL __resume_at_24_3  ← 走 false 分支的 resume
```

> **关键理解**：不是先改写字节码再捕获图，而是 Dynamo 通过字节码解释来捕获图，然后用编译后的函数调用替换原本的字节码区域。

### 2.5 Guards（守卫条件）

每次编译都生成一组 **Guards**，检查下次运行时是否可以复用已编译的图：

```python
# Guard 条件示例（伪代码）
guards = [
    "type(x) == torch.Tensor",           # 类型检查
    "x.shape[0] == 5",                   # 形状 specialization
    "x.stride[0] == 5",                  # 内存布局
    "x.dtype == torch.float32",          # 数据类型
    "f == <function at 0x...>",          # 函数身份
]
```

```python
# 实际查看 guards
import torch

@torch.compile
def f(x):
    return x * 2

# 通过内部接口查看 guards
print(torch._dynamo.eval_frame.captured_guards(f))
```

---

## 三、AOTAutograd — 反向图捕获

### 3.1 作用

Dynamo 只捕获了**前向计算图**，但 `torch.compile` 需要同时优化反向传播。AOTAutograd 的作用是：

```
Forward Graph:  x → op1 → y → op2 → loss
                      ↓
Backprop        ← ← ← ← ← ← ← ← ← ←
                      ↓
Backward Graph:  dL/dx = dL/dy · dy/dx
```

### 3.2 工作原理

AOTAutograd 利用 PyTorch 的 autograd engine，通过 **joint forward-backward 分析** 一次性捕获完整的计算图：

```python
# AOTAutograd 生成的代码结构
def compiled_forward(*args):
    # 前向计算，同时记录 backward 所需的中间张量
    outputs, fw_metadata = forward_and_grad_function(*args)
    # 保存反向图信息，供 backward 时使用
    return outputs

def forward_and_grad_function(*args):
    # 使用 functionalize + decomposition
    # 将所有前向 op 分解为更细粒度的 ATen 操作
    return functionalized_graph, saved_tensors
```

### 3.3 Decomposition（算子分解）

AOTAutograd 将高级 PyTorch 算子分解为更底层的 ATen 操作：

```python
# 输入
torch.layer_norm(x, ...)     # 一个高层 op

# 分解后（ATen 级别）
# mean = x.mean(dim)
# x_norm = (x - mean) / sqrt(var + eps)
# output = weight * x_norm + bias
```

这是为了让 Inductor 有更大的优化空间。

---

## 四、TorchInductor — 后端代码生成

### 4.1 整体流程

```
FX Graph (ATen ops)
       ↓
  Graph Lowering         (433 个算子的 lowering)
       ↓
  Define-by-Run IR       (Loop-level 中间表示)
       ↓
  Scheduling             (融合决策、tiling)
       ↓
  Fusion                 (算子融合)
       ↓
  Codegen                (生成 Triton / C++)
       ↓
  优化后的 GPU/CPU 内核
```

### 4.2 Define-by-Run IR

Inductor 使用一种逐节点构建的 IR，IR 包含：

- **Buffer** — 张量的内存描述
- **Store** — 写入操作
- **Compute** — 计算表达式
- **Reduction** — 归约操作（如 sum, max）

### 4.3 核心优化：算子融合 (Fusion)

**为什么要融合？** 减少显存访问（HBM 带宽是 GPU 性能瓶颈）

```python
# 融合前: 4 个 kernel
y = x + 1      # kernel 1: 读x, 写y
z = y * 2      # kernel 2: 读y, 写z
w = z + 3      # kernel 3: 读z, 写w
u = w.sin()    # kernel 4: 读w, 写u

# 融合后: 1 个 fused kernel
u = ((((x + 1) * 2) + 3)).sin()  # 一次性完成，只读x，只写u
```

**Scheduler 决策**：Inductor 评估每个可融合对，给出评分：

```python
# Scheduler.can_fuse(buf0, buf1)
# 返回: (可融合?, 融合类型, 预估节省的带宽, 图中距离)
(True, True, 33554432, -1)
#  ↑  pointwise + pointwise
#     节省 33554432 bytes 的带宽
```

### 4.4 Triton 代码生成 (GPU)

Inductor 将 IR 转换为 **Triton DSL**：

```python
# 生成的 Triton 代码（简化）
import triton
import triton.language as tl

@triton.autotune(configs=[
    triton.Config({'BLOCK_M': 128, 'BLOCK_N': 256}),
], key=['M', 'N'])
@triton.jit
def kernel(in_ptr, out_ptr, M, N, BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr):
    pid = tl.program_id(axis=0)
    rm = pid * BLOCK_M + tl.arange(0, BLOCK_M)
    rn = tl.arange(0, BLOCK_N)
    # ... 向量化加载、计算、存储
```

**Triton 特点**：
- Python 风格的 GPU 编程
- 自动处理 tiling、shared memory、memory coalescing
- JIT 编译到 PTX → SASS

### 4.5 C++ 代码生成 (CPU)

对于 CPU，Inductor 生成优化的 C++ 代码：

```cpp
// 生成的 C++ 代码（简化）
extern "C" void kernel(float* __restrict__ out, 
                       const float* __restrict__ in, 
                       int64_t n) {
    #pragma omp parallel for
    for (int64_t i = 0; i < n; i++) {
        out[i] = sinf(in[i]) + cosf(in[i]);
    }
}
```

---

## 五、Guards 与编译产物的绑定关系

### 5.1 整体对象关系

```
┌─────────────────────────────────────────────────────────────────┐
│                      DynamoCache                                │
│  (torch._dynamo.eval_frame 模块级缓存)                            │
│                                                                  │
│  key: (codeobj, guards) → value: CompiledFn                     │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                            │ 存放
                            │
┌─────────────────────────────────────────────────────────────────┐
│                    CompiledFn                                    │
│  • graph:        FX Graph（捕获的计算图）                         │
│  • compiled_fn:  后端编译产物（inductor Triton kernel等）         │
│  • guards:       Guard 列表                                      │
│  • source_refs:  引用的全局变量和闭包引用                        │
└─────────────────────────────────────────────────────────────────┘
```

**Guards 与编译产物（CompiledFn）绑定**，三者（FX Graph、Guards、compiled_fn）是一个整体。

### 5.2 运行时检查流程

```python
# torch/_dynamo/convert_frame.py 伪代码
def convert_frame(frame, compile_id):
    # 1. 生成 guards（基于当前输入的 shape/dtype/stride 等）
    guards = produce_guards(frame, fake_inputs)
    
    # 2. 用 guards 作为 key 的一部分去缓存查找
    cache_key = (frame.f_code, build_guard_fn(guards))
    
    if cached := dynamo_cache.get(cache_key):
        # 3. Guard 检查：传入真实输入，验证 guards 是否仍然成立
        if cached.guards.check(REAL_INPUTS):
            return cached.compiled_fn  # ✅ Guard 通过，复用编译产物
        else:
            # Guard 失败 → 重新编译
            pass
    
    # 4. 执行完整编译
    output_graph = backend(output_graph)
    compiled_fn = output_graph.code
    
    # 5. Guard + 编译产物 一起存入缓存
    dynamo_cache[cache_key] = CompiledFn(
        graph=output_graph.graph,
        compiled_fn=compiled_fn,
        guards=guards,
        source_refs=output_graph.source_refs,
    )
    return compiled_fn
```

### 5.3 区分两个不同层次

| 概念 | 位置 | 作用 |
|------|------|------|
| **FX Graph** | Dynamo 输出 | 捕获"计算结构"（哪些 op、如何连接） |
| **Guards** | Dynamo 输出 | 捕获"运行条件"（输入 shape、类型等） |
| **Compiled Fn** | Inductor 输出 | Triton kernel / C++ function（实际机器码） |
| **FXGraphCache** | Inductor 层 | 缓存：key = (graph_hash, input_metadata) |
| **TritonCache** | Inductor 层 | 缓存：key = (kernel_hash, config) |

### 5.4 多级缓存架构

```
运行时查找顺序：
1. DynamoCache (key = codeobj + guards)
       ↓ miss
2. FXGraphCache (key = FX graph hash + input metadata)
       ↓ miss
3. AOTAutogradCache (key = joint graph hash)
       ↓ miss
4. InductorCodegen → Triton/C++
       ↓
5. AutotuningCache (key = kernel + tiling_config)
```

---

## 六、重新编译与 FX Graph 重新捕获

### 6.1 Guard 失败 → 完整重编译

Guards 是 **DynamoCache** 的查找 key 的一部分。当输入的 shape/dtype 等发生变化时，Guards 不匹配，**整条链路重新执行**：

```
Guard 失败
    ↓
Dynamo 重新 trace ──→ 生成新的 FX Graph (可能 shape 不同)
    ↓
AOTAutograd ──→ 新的 joint graph
    ↓
Inductor ──→ 新的 Triton/C++ kernel
    ↓
存入 DynamoCache (以新的 guards 为 key)
```

### 6.2 举个例子

```python
@torch.compile
def f(x):
    return x * 2

# 第 1 次: x.shape = (4,)
f(torch.randn(4))    # Guard: x.shape[0] == 4  → 生成图 A

# 第 2 次: x.shape = (4,) 相同
f(torch.randn(4))    # Guard 命中 → 复用图 A ✅

# 第 3 次: x.shape = (8,) 不同
f(torch.randn(8))    # Guard 失败 → 重新 trace → 生成图 B
```

### 6.3 性能影响总结

| Guard 状态 | FX Graph 重新捕获？ | Inductor 重新 codegen？ | 速度 |
|-----------|-------------------|----------------------|------|
| **命中** | ❌ 否 | ❌ 否 | 最快（直接返回 compiled_fn） |
| **失败 + 图结构相同** | ✅ 是（但可能 reuse same graph hash） | ❌ FXGraphCache 可能命中 | 较快 |
| **失败 + 图结构不同** | ✅ 是 | ✅ 是 | 最慢（完整重编译） |

> **关键理解**：Guard 失败意味着"这个 compiled_fn 不能用了"，必须重新走完整编译链路。Inductor 层的缓存只是让链路中某些环节（如 codegen、autotuning）可以复用，但 Dynamo trace 这个最重的步骤无法跳过。

---

## 七、关键设计决策

| 设计点 | 决策 | 原因 |
|--------|------|------|
| JIT 而非 AOT | Dynamo 动态拦截 | 支持动态形状、动态控制流 |
| Guards | 缓存 + 条件检查 | 避免重复编译开销 |
| 图断裂 | 容错设计 | 不支持的 Python 代码 → 解释执行 |
| Triton | GPU codegen | 自动 tiling，比 TVM 更少调参 |
| Define-by-Run IR | 动态构建 | 避免静态分析开销 |
| FakeTensor | 符号化 shape | 支持 dynamic shape，避免真实 tensor 创建 |

---

## 参考资料

- [Dynamo Deep-Dive — PyTorch Docs](https://docs.pytorch.org/docs/stable/user_guide/torch_compiler/torch.compiler_dynamo_deepdive.html)
- [UW PLSE: How does torch.compile work?](https://uwplse.org/2025/04/28/torchdynamo.html)
- [TorchInductor: Define-by-Run IR](https://dev-discuss.pytorch.org/t/torchinductor-a-pytorch-native-compiler-with-define-by-run-ir-and-symbolic-shapes/747)
- [PyTorch 2.0 Architecture (Hot Chips 2023)](https://www.hc2023.hotchips.org/assets/program/tutorials/ml/PyTorch%202.0.pdf)
- [A Walk Through torch.compile — depyf](https://depyf.readthedocs.io/en/latest/walk_through.html)
- [Compile Time Caching — PyTorch Tutorials](https://docs.pytorch.org/tutorials/recipes/torch_compile_caching_tutorial.html)
