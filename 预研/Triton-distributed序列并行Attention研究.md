# Triton-distributed 深度研究：序列并行 Attention 通信 Kernel 设计

> 研究日期：2025-07-16
> 目标：设计带通信的 kernel，近期目标为 attention 的序列并行（Ring Attention）

---

## 一、Triton-distributed 是什么

**Triton-distributed** 是字节跳动 Seed 团队在 OpenAI Triton 编译器基础上构建的分布式编译器扩展，2025 年开源（MLSys 2025 论文）。核心价值主张：

> 用纯 Python 写出「计算 + 通信」融合的单 kernel，编译器自动调度细粒度的 compute-communication overlap，性能媲美甚至超越手写 CUDA/NCCL。

```
传统方案（算子级 overlap）：
  GPU Stream 1: [████ Compute ████] ─等待─ [████ Compute ████]
  GPU Stream 2:                    [████ NCCL  ████]

Triton-distributed（tile 级 overlap）：
  Tile 0: [Comm: get KV₀][Compute: Q·KV₀]
  Tile 1:                  [Comm: get KV₁][Compute: Q·KV₁]
  ↑ 通信和计算在 tile 粒度上流水线执行，GPU 几乎无空闲
```

核心性能数据：
- 相比 NCCL/RCCL 加速 **1.09× ~ 44.97×**（取决于 workload）
- Low-latency AllToAll 在 32×H800 上 **137μs**（DeepEP 为 182μs）
- Distributed Flash-Decode 从 1 GPU 到 32 GPU 的 near-linear scaling

> 来源：[arXiv 2504.19442](https://arxiv.org/html/2504.19442v1) · [GitHub](https://github.com/ByteDance-Seed/Triton-distributed)

---

## 二、架构：计算与通信如何融合

### 2.1 整体编译流

```
@triton.jit 标注的 Python kernel
        │
        ▼
┌──────────────────────────────────────┐
│  Triton IR (TTIR / TTGIR)            │
│  ┌─────────────┐ ┌─────────────────┐ │
│  │  计算部分    │ │  通信原语调用    │ │
│  └──────┬──────┘ └───────┬─────────┘ │
│         │                │           │
│         ▼                ▼           │
│  LLVM IR ◄── 链接 ── OpenSHMEM       │
│         │         bitcode 库          │
│         ▼                            │
│  PTX / AMDGPU 二进制                  │
└──────────────────────────────────────┘
```

底层实现：NVIDIA GPU 走 NVSHMEM，AMD GPU 走 ROCSHMEM。

### 2.2 两种原语体系

| 类别 | 原语 | 来源 |
|------|------|------|
| **OpenSHMEM 原语** | `putmem`, `getmem`, `putmem_nbi`, `getmem_nbi`, `putmem_signal_nbi`, `signal_op`, `signal_wait_until`, `broadcastmem`, `sync_all`, `fence`, `quiet` | NVSHMEM / ROCSHMEM 标准 API |
| **非 OpenSHMEM 原语** | `wait`, `consume_token`, `notify`, `atomic_cas`, `atomic_add`, `ld_acquire`, `red_release`, `multimem_ld_reduce`, `multimem_st` | Triton-distributed 自定义，用于编译器流水线优化 |

> 来源：[Triton-distributed API 文档](https://triton-distributed.readthedocs.io/en/latest/python-api/triton-dist.language.html)

### 2.3 关键概念：Symmetric Memory（对称内存）

每个 rank 分配一块相同大小的 GPU 内存，所有 rank 可以单边直接读写其他 rank 的这块内存（通过 NVSHMEM put/get），无需对方 CPU 参与。

```
Rank 0 GPU                 Rank 1 GPU
┌──────────────┐          ┌──────────────┐
│ Symmetric    │◄─ get ───│ Symmetric    │
│ Buffer       │─── put ──►│ Buffer       │
│ + signal     │          │ + signal     │
└──────────────┘          └──────────────┘
```

定位远程内存：`tdl.symm_at(ptr, rank)`。

---

## 三、核心 API

### 3.1 通信原语（当前可用）

```python
import triton.distributed.language as tdl

tdl.putmem(dest, src, bytes, pe)           # 阻塞 put
tdl.putmem_nbi(dest, src, bytes, pe)       # 非阻塞 put
tdl.getmem(dest, source, bytes, pe)        # 阻塞 get
tdl.getmem_nbi(dest, source, bytes, pe)    # 非阻塞 get

# 带信号的 put：传输完成后自动通知对方
tdl.putmem_signal_nbi(dest, src, bytes, sig_addr, signal, sig_op, pe)

# 信号操作
tdl.signal_op(sig_addr, signal, sig_op, pe)
tdl.signal_wait_until(sig_addr, cmp_, cmp_val)

# 上下文
tdl.rank()        # 当前 rank ID
tdl.num_ranks()   # 总 rank 数
```

### 3.2 细粒度同步原语（编译器流水线核心）

```python
token = tdl.wait(signal_ptr, wait_value)    # 等待信号，返回 token
value = tdl.consume_token(token)             # 将 token 与后续 MMA 建立数据依赖
tdl.notify(ptr, rank, signal=1, sig_op='set', comm_scope='inter_node')
```

**`wait` + `consume_token` 是 tile 级 overlap 的核心机制**：每个 tile 的 MMA 通过 `consume_token` 绑定到对应通信完成信号上，编译器（LLVM）在指令调度时让不同 tile 的等待和计算交错执行。

### 3.3 高级原语（规划中，尚未发布）

自动 tiling 的 `all_gather`、`reduce_scatter`、`all_to_all` 等集合操作尚未开放，目前需用低层 put/get 手动拼装。

---

## 四、Ring Attention 算法

### 4.1 动机

标准 Attention 显存复杂度 O(s²)。s=128K 时单个 attention score 矩阵约 32GB（fp16）。序列并行将 Q/K/V 沿序列维度切分到 N 个 GPU。

### 4.2 核心流程

```
初始（4 GPU）：GPUᵢ 持有 Qᵢ, Kᵢ, Vᵢ

Round 0（本地）：每卡计算 attention(Qᵢ, Kᵢ, Vᵢ)，异步发送 Kᵢ, Vᵢ 给邻居
Round 1..N-1：收到邻居 KV → 计算 attention → online rescale 合并 → 转发 KV

结果：每个 GPUᵢ 拥有完整的 Oᵢ = attention(Qᵢ, 所有 KV)
```

### 4.3 Online Rescaling

```
lse_new = max(lse_old, rowmax(S_new))
O_new = (exp(lse_old-lse_new)·O_old + exp(rowmax(S_new)-lse_new)·Σexp(S_new-rowmax)·V_new)
      / (exp(lse_old-lse_new)·sum_exp_old + exp(rowmax(S_new)-lse_new)·sum_exp_new)
```

### 4.4 方法全景对比

| 方法 | 通信模式 | 通信量 | 扩展性 | 适用场景 |
|------|----------|--------|--------|----------|
| **Ring Attention** | Ring P2P | O(M·N) | 不受 head 数限制 | 通用 |
| **Ulysses Attention** | All-to-All | O(M) | 受 head 数限制 | head 多时 |
| **USP (Hybrid)** | Ring + Ulysses 2D | 组合 | 最好 | 大规模 |
| **TASP** | Multi-Ring AlltoAll | - | 不受限 | NVSwitch 集群 |
| **ZeCO** | All-Scan | O(M/N) | 最小通信量 | 极长序列 |

---

## 五、Kernel 设计方案

### 5.1 Round 级 Overlap

```python
@triton.jit
def ring_attention_kernel(Q_ptr, K_ptr, V_ptr, O_ptr, sym_buf_ptr, signal_send, signal_recv, ...):
    rank = tdl.rank()
    world_size = tdl.num_ranks()
    next_rank = (rank + 1) % world_size

    # Round 0：本地 KV + 异步发送
    acc_o, lse = flash_attn_tile(Q_tile, K_local, V_local)
    tdl.putmem_nbi(tdl.symm_at(sym_buf_ptr, next_rank), K_ptr, K_bytes, next_rank)
    tdl.signal_op(signal_send, 1, 'set', next_rank)

    # Rounds 1..N-1
    for round in range(1, world_size):
        tdl.signal_wait_until(signal_recv, 'eq', round)
        K_remote, V_remote = load_from_sym_buf(sym_buf_ptr)
        tile_o, tile_lse = flash_attn_tile(Q_tile, K_remote, V_remote)
        acc_o, lse = online_rescale(acc_o, lse, tile_o, tile_lse)
        tdl.putmem_nbi(tdl.symm_at(sym_buf_ptr, next_rank), sym_buf_ptr, KV_bytes, next_rank)
        tdl.signal_op(signal_send, round + 1, 'set', next_rank)

    tl.store(O_ptr + offsets, acc_o)
```

### 5.2 Tile 级 Overlap（双 kernel 架构）

```python
# Stream A: 通信 kernel
@triton.jit
def comm_kernel(...):
    for round in range(world_size):
        tdl.putmem_signal_nbi(dest, src, bytes, signal_addr, round, 'set', next_rank)

# Stream B: 计算 kernel，每个 tile 独立 wait
@triton.jit
def compute_kernel(...):
    for round in range(world_size):
        token = tdl.wait(signal_addr, round)
        kv_tile = tdl.consume_token(token)
        # ... Flash Attention tile 计算 + rescale ...
```

这是 **TileLink** 论文中的 tile-centric primitive 方法——通信与计算解耦为独立 tile 流，通过 signal token 建立依赖图。

---

## 六、已有参考实现

### 6.1 Triton-distributed 官方示例

| 示例 | 说明 |
|------|------|
| **flash_decode.py** | 1 query 多 GPU 解码，1→32 GPU near-linear scaling |
| **AllGather + GEMM** | 经典 compute-comm overlap 展示 |
| **Low-latency AllToAll** | 137μs vs DeepEP 182μs（32 H800） |

### 6.2 ring-flash-attention（zhuzilin）

基于 FlashAttention kernel + NCCL P2P 的 Ring Attention 最佳参考实现。8×H800 上 zigzag 达到理论 FA 上限的 85%（fwd）/ 90%（fwd+bwd）。

### 6.3 其他关键工作

| 工作 | 核心思路 |
|------|----------|
| **TASP** (2025) | AlltoAll 替代 Ring AllGather，利用 NVSwitch 全互联拓扑 |
| **USP/YunChang** | Ulysses + Ring Attention 2D hybrid，已集成 TransformerEngine |
| **ZeCO** (2025) | All-Scan 原语，通信量最小化 |

---

## 七、行动路线图

### Phase 1：熟悉基础

```bash
pip install triton-dist
git clone https://github.com/ByteDance-Seed/Triton-distributed
# 研读 python/triton_dist/kernels/flash_decode.py 和 test/
```

### Phase 2：设计 Ring Attention Kernel

```
Host 端：分配 symmetric memory → 切分 Q/K/V → 多 stream launch → 管理同步
  ├── Stream A: comm_kernel（环形 P2P put + signal）
  └── Stream B: attn_kernel（tile 级 wait → Flash Attention → rescale）
```

### Phase 3：关键设计决策

| 决策点 | 选项 | 考量 |
|--------|------|------|
| KV 传输粒度 | 整块 vs tile 流式 | tile 流式 overlap 更好但 signal 开销大 |
| Ring vs AlltoAll | Ring P2P vs 全互联 | NVSwitch 环境 AlltoAll 可能更好（参考 TASP） |
| 单 kernel vs 双 kernel | 合一 vs 分离 | 合一更难写但 overlap 最优 |
| Causal mask | Zigzag vs Striped | 取决于是否 causal attention |
| Backward 支持 | 需要 vs 仅 forward | backward 通信量翻倍 |

### Phase 4：常见坑

1. Symmetric memory 需容纳 K_chunk + V_chunk + signal，tile 流式需双缓冲
2. Signal 协议用 round counter 最简，注意 reset
3. 通信和计算 kernel 放不同 stream，用 `cudaStreamWaitEvent` 同步
4. 注意 CUDA/Triton 版本兼容性
5. 用 Nsight Systems 确认 compute 和 comm 确实在 overlap
6. 通信 kernel 通过 `num_warps` 控制 SM 占用

---

## 八、核心论文与资源索引

| 论文/项目 | 链接 | 重点 |
|-----------|------|------|
| **Triton-distributed** (MLSys 2025) | [arxiv 2504.19442](https://arxiv.org/abs/2504.19442) | 编译器架构、原语设计、性能数据 |
| **Triton-distributed GitHub** | [GitHub](https://github.com/ByteDance-Seed/Triton-distributed) | 源码、示例、安装指南 |
| **Triton-distributed API 文档** | [ReadTheDocs](https://triton-distributed.readthedocs.io/en/latest/) | 完整 API 参考 |
| **TileLink** (2025) | [arxiv 2503.20313](https://arxiv.org/abs/2503.20313) | Tile-centric 原语编译，理论基础 |
| **Ring Attention** (Liu et al., 2023) | [arxiv 2310.01889](https://arxiv.org/abs/2310.01889) | Ring Attention 原始算法 |
| **ring-flash-attention** | [GitHub](https://github.com/zhuzilin/ring-flash-attention) | Ring Attention + FA 最佳参考实现 |
| **TASP** (2025) | [arxiv 2509.26541](https://arxiv.org/abs/2509.26541) | 拓扑感知序列并行 |
| **AMD ROCm Triton-distributed** | [AMD Blog](https://rocm.blogs.amd.com/software-tools-optimization/triton-distributed-c/README.html) | AMD GPU 使用指南 |

---

## 九、与 CUDA/NCCL 生态的关系定位

```
┌─────────────────────────────────────────────────┐
│            GPU 编程生态全景                       │
│                                                 │
│  计算层              通信层                       │
│  ┌──────────┐       ┌──────────────┐            │
│  │ cuBLAS   │       │ NCCL         │ ← 传统支柱  │
│  │ cuDNN    │       │ (集合通信)    │            │
│  │ CUTLASS  │       ├──────────────┤            │
│  │ Triton   │       │ NVSHMEM      │ ← 单边通信  │
│  │ (单GPU)  │       │ (put/get)    │            │
│  └──────────┘       ├──────────────┤            │
│                     │ Triton-dist  │ ← 编译器融合│
│                     │ (计算+通信)   │   新范式    │
│                     └──────────────┘            │
│                                                 │
│  工程决策：先用 NCCL → 不够时用 NVSHMEM          │
│           → 需要极致 overlap 时用 Triton-dist     │
└─────────────────────────────────────────────────┘
```

---

## 十、现状小结与风险评估

项目自 2025 年 5 月开源至今（241 commits），核心团队持续迭代，已有 AMD ROCm 官方合作支持，并衍生出 DITRON（ICML 2026）、UniEP（HPDC 2026）等后续工作。字节跳动内部 50+ 产品间接验证了其技术路线。但目前仅开放底层原语，高层集合通信 API 尚未发布，vLLM、PyTorch 等主流框架未集成，外部社区采用仍处早期（~1,500 stars）。关键技术风险包括 API 未稳定、上游 Triton 态度不明、以及 cuTile Python 等 NVIDIA 官方方案的潜在竞争。**适合做前沿研究与技术储备；若追求生产落地，现阶段 ring-flash-attention + NCCL 更为稳妥。**
