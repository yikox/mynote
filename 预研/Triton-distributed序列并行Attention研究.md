# Triton-distributed 深度研究：序列并行 Attention 通信 Kernel 设计

> 研究日期：2025-07-16
> 目标：设计带通信的 kernel，近期目标为 attention 的序列并行（Ring Attention）

---

## 一、Triton-distributed 是什么

**Triton-distributed** 是字节跳动 Seed 团队在 OpenAI Triton 编译器基础上构建的**分布式编译器扩展**，2025 年开源（MLSys 2025 论文）。核心价值主张：

> **用纯 Python 写出「计算 + 通信」融合的单 kernel，编译器自动调度细粒度的 compute-communication overlap，性能媲美甚至超越手写 CUDA/NCCL。**

```
传统方案（算子级 overlap）：
  GPU Stream 1: [████ Compute ████] ─等待─ [████ Compute ████]
  GPU Stream 2:                    [████ NCCL  ████]

Triton-distributed（tile 级 overlap）：
  同一个 kernel 内：
  Tile 0: [Comm: get KV₀][Compute: Q·KV₀]
  Tile 1:                  [Comm: get KV₁][Compute: Q·KV₁]
  Tile 2:                                  [Comm: get KV₂][Compute: Q·KV₂]
  ↑ 通信和计算在 tile 粒度上流水线执行，GPU 几乎无空闲
```

### 核心性能数据

- 相比 NCCL/RCCL 整体加速 **1.09× ~ 44.97×**（取决于 workload）
- Low-latency AllToAll 在 32×H800 上 **137μs**（DeepEP 为 182μs）
- Distributed Flash-Decode 从 1 GPU 到 32 GPU 的 near-linear scaling
- 延迟优化 AllGather 小消息场景相比 NCCL-inplace 快 **3.11×**

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
│  │  (原 Triton) │ │  (新增扩展)     │ │
│  └──────┬──────┘ └───────┬─────────┘ │
│         │                │           │
│         ▼                ▼           │
│  LLVM IR ◄── 链接 ── OpenSHMEM       │
│         │         bitcode 库          │
│         ▼                            │
│  PTX / AMDGPU 二进制                  │
└──────────────────────────────────────┘
```

通信原语的底层实现：
- **NVIDIA GPU**：NVSHMEM（基于 NVLink/NVSwitch 的单边通信）
- **AMD GPU**：ROCSHMEM
- 编译器自动将 `put`/`get`/`signal` 等映射到对应硬件指令

### 2.2 两种原语体系

| 类别 | 原语 | 来源 |
|------|------|------|
| **OpenSHMEM 原语** | `putmem`, `getmem`, `putmem_nbi`, `getmem_nbi`, `putmem_signal_nbi`, `signal_op`, `signal_wait_until`, `broadcastmem`, `sync_all`, `fence`, `quiet` | NVSHMEM / ROCSHMEM 标准 API |
| **非 OpenSHMEM 原语** | `wait`, `consume_token`, `notify`, `atomic_cas`, `atomic_add`, `ld_acquire`, `red_release`, `multimem_ld_reduce`, `multimem_st` | Triton-distributed 自定义，用于编译器流水线优化 |

> 来源：[Triton-distributed API 文档](https://triton-distributed.readthedocs.io/en/latest/python-api/triton-dist.language.html)

### 2.3 关键概念：Symmetric Memory（对称内存）

Triton-distributed 的核心前提是 **symmetric memory**——每个 rank 分配一块相同大小的 GPU 内存，所有 rank 可以**单边直接读写**其他 rank 的这块内存（通过 NVSHMEM put/get），无需对方 CPU 参与。

```
Rank 0 GPU                 Rank 1 GPU                 Rank 2 GPU
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│ Symmetric    │◄─ get ───│ Symmetric    │◄─ get ───│ Symmetric    │
│ Buffer       │─── put ──►│ Buffer       │─── put ──►│ Buffer       │
│ [local data] │          │ [local data] │          │ [local data] │
│ + signal     │          │ + signal     │          │ + signal     │
└──────────────┘          └──────────────┘          └──────────────┘
```

定位远程内存：`tdl.symm_at(ptr, rank)` ——给定本地对称 buffer 指针和目标 rank，返回指向远程 rank 对应地址的指针。

---

## 三、核心 API：低层原语详解

### 3.1 通信原语（当前可用）

```python
import triton.distributed.language as tdl

# ===== 点对点数据传输 =====
# 阻塞 put：把 src 的 bytes 字节写到 rank=pe 的 dest
tdl.putmem(dest, src, bytes, pe)

# 非阻塞 put（nbi = non-blocking immediate）
tdl.putmem_nbi(dest, src, bytes, pe)

# 阻塞 get：从 rank=pe 的 source 读取 bytes 到 dest
tdl.getmem(dest, source, bytes, pe)

# 非阻塞 get
tdl.getmem_nbi(dest, source, bytes, pe)

# ===== 带信号的 put（关键！）=====
# 把数据 put 到对方的 sig_addr 地址，完成后自动写入 signal 值
tdl.putmem_signal_nbi(dest, src, bytes, sig_addr, signal, sig_op, pe)

# ===== 信号操作 =====
# 向 rank=pe 的 sig_addr 写入 signal（set/add/...）
tdl.signal_op(sig_addr, signal, sig_op, pe)

# 等待本地 sig_addr 满足条件
tdl.signal_wait_until(sig_addr, cmp_, cmp_val)

# ===== 上下文查询 =====
tdl.rank()        # 当前 rank ID
tdl.num_ranks()   # 总 rank 数
```

### 3.2 细粒度同步原语（编译器流水线核心）

```python
# wait：等待本地 signal 达到指定值，返回 token
token = tdl.wait(signal_ptr, wait_value)

# consume_token：将 token 与后续计算操作建立数据依赖
# 编译器据此判断"这个 MMA 操作必须等对应通信完成才能开始"
value = tdl.consume_token(token)

# notify：向远程 rank 发信号（可用于构建自定义同步协议）
tdl.notify(ptr, rank, signal=1, sig_op='set', comm_scope='inter_node')
```

**`wait` + `consume_token` 是 Triton-distributed 实现 tile 级 overlap 的核心机制**：每个 tile 的 MMA（矩阵乘累加）通过 `consume_token` 绑定到对应的通信完成信号上。编译器（LLVM）在指令调度时让不同 tile 的通信等待和计算交错执行——Tile 0 等待的数据到了就立即开始算，同时 Tile 1 的数据还在传输中。

### 3.3 高级原语（规划中，尚未发布）

论文中提到但当前版本未开放的高级原语包括：自动 tiling 的 `all_gather`、`reduce_scatter`、`all_to_all` 等集合操作。目前需要用低层 put/get 手动拼装。

---

## 四、Ring Attention 算法：序列并行的通信模型

### 4.1 为什么需要序列并行 Attention

标准 Attention 的显存复杂度是 O(s²)，s 为序列长度。当 s=128K 时，单个 attention score 矩阵就有 16B 元素（fp16 下约 32GB）。序列并行的思路：**把 Q/K/V 沿序列维度切分到 N 个 GPU，每张卡只算自己那一段**。

### 4.2 Ring Attention 核心流程

```
初始状态（4 GPU，序列被切成 4 段）：
  GPU₀ 持有: Q₀, K₀, V₀
  GPU₁ 持有: Q₁, K₁, V₁
  GPU₂ 持有: Q₂, K₂, V₂
  GPU₃ 持有: Q₃, K₃, V₃

Step 0（本地）：
  每卡计算 attention(Qᵢ, Kᵢ, Vᵢ)，得到部分输出 Oᵢ_partial
  同时，每卡把 Kᵢ, Vᵢ 发给下一个邻居（异步 P2P send）

Step 1（收到邻居的 KV）：
  GPUᵢ 收到 Kᵢ₋₁, Vᵢ₋₁
  计算 attention(Qᵢ, Kᵢ₋₁, Vᵢ₋₁)，累加到 Oᵢ_partial
  转发 Kᵢ₋₁, Vᵢ₋₁ 给下一个邻居

... 重复 N-1 步 ...

最终：每个 GPUᵢ 拥有完整的 Oᵢ = attention(Qᵢ, 所有 KV)
```

```
KV 流转圈数（以 rank 0 的视角）：
  Round 0: 本地 KV₀              → 计算 Q₀·KV₀
  Round 1: 收到 KV₃（从 rank 3） → 计算 Q₀·KV₃
  Round 2: 收到 KV₂（转发来的）  → 计算 Q₀·KV₂
  Round 3: 收到 KV₁              → 计算 Q₀·KV₁

每次计算都使用 Flash Attention 的 online softmax rescaling 来正确合并。
```

### 4.3 关键：online rescaling（online softmax）

这是 Ring Attention 正确性的数学基础：

```
已知部分结果 O_old = Σ exp(S_old) · V_old / Σ exp(S_old)
新 KV 块产生 S_new = Q · K_new

合并公式（Blockwise Flash Attention）：
  lse_new = max(lse_old, rowmax(S_new))
  O_new = (exp(lse_old - lse_new) · O_old
           + exp(rowmax(S_new) - lse_new) · Σ exp(S_new - rowmax(S_new)) · V_new)
         / (exp(lse_old - lse_new) · sum_exp_old
            + exp(rowmax(S_new) - lse_new) · sum_exp_new)
```

Triton-distributed 中每个 tile 独立做这个 rescaling，配合 `wait`/`consume_token` 等通信数据到达。

> 来源：[Ring Attention 原论文](https://arxiv.org/abs/2310.01889) · [ring-flash-attention](https://github.com/zhuzilin/ring-flash-attention)

### 4.4 变体：Zigzag Ring Attention（因果 mask 优化）

对于 causal attention（只关注之前的 token），naive Ring Attention 中每个 rank 需要处理所有 KV chunk，但实际上 causal 意味着只需要前面的。**Zigzag** 策略通过重新排列 chunk 顺序，让 causal ratio 更高（即更多计算是"有效"的），减少浪费的无效计算。

### 4.5 序列并行方法全景对比

| 方法 | 通信模式 | 通信量（per block） | 扩展性 | 适用场景 |
|------|----------|---------------------|--------|----------|
| **Ring Attention** | Ring P2P (AllGather) | O(M·N) | 不受 head 数限制 | 通用 |
| **Ulysses Attention** | All-to-All | O(M) | 受 head 数限制 | head 数多时 |
| **USP (Hybrid)** | Ring + Ulysses 2D | 两者组合 | 最好 | 大规模 |
| **TASP** | Multi-Ring AlltoAll | 利用全互联拓扑 | 不受限 | NVSwitch 集群 |
| **ZeCO** | All-Scan 原语 | O(M/N) | 最小通信量 | 极长序列 |

---

## 五、用 Triton-distributed 设计序列并行 Attention Kernel

### 5.1 Round 级 Overlap 方案

```python
import triton
import triton.distributed.language as tdl

@triton.jit
def ring_attention_kernel(
    Q_ptr,          # 本地 Q 块
    K_ptr,          # 本地 K 块（对称内存）
    V_ptr,          # 本地 V 块（对称内存）
    O_ptr,          # 输出
    sym_buf_ptr,    # 对称 buffer（用于接收邻居的 KV）
    signal_send,    # 发送完成信号
    signal_recv,    # 接收完成信号
    ...
):
    pid = tl.program_id(0)
    rank = tdl.rank()
    world_size = tdl.num_ranks()
    next_rank = (rank + 1) % world_size
    prev_rank = (rank - 1) % world_size

    # ===== Round 0：本地 KV =====
    acc_o = compute_flash_attention_tile(Q_tile, K_local, V_local)
    lse = ...  # log-sum-exp for rescaling

    # 发送本地 KV 给下一个 rank（非阻塞）
    tdl.putmem_nbi(
        tdl.symm_at(sym_buf_ptr, next_rank),  # dest：下一 rank 的对称 buffer
        K_ptr,                                   # src：本地 K
        K_bytes,
        next_rank
    )
    tdl.signal_op(signal_send, 1, 'set', next_rank)  # 通知对方数据已就绪

    # ===== Rounds 1..N-1：接收 + 计算 + 转发 =====
    for round in range(1, world_size):
        # 等待上一 rank 发来的数据
        tdl.signal_wait_until(signal_recv, 'eq', round)

        # 从对称 buffer 读取邻居的 KV
        K_remote = load_from_sym_buf(sym_buf_ptr)
        V_remote = load_from_sym_buf(sym_buf_ptr)

        # 计算 attention 并 rescale
        tile_o, tile_lse = compute_flash_attention_tile(Q_tile, K_remote, V_remote)
        acc_o, lse = online_rescale(acc_o, lse, tile_o, tile_lse)

        # 转发给下一个 rank（非阻塞）
        tdl.putmem_nbi(
            tdl.symm_at(sym_buf_ptr, next_rank),
            sym_buf_ptr,
            KV_bytes,
            next_rank
        )
        tdl.signal_op(signal_send, round + 1, 'set', next_rank)

    # 写回最终结果
    tl.store(O_ptr + offsets, acc_o)
```

### 5.2 Tile 级 Overlap 方案（更激进）

将 Q 进一步切为多个 tile，每个 tile 独立等待自己的通信信号：

```
  Q_tile₀: [wait KV₀][compute][wait KV₁][compute][wait KV₂][compute]...
  Q_tile₁:           [wait KV₀][compute][wait KV₁][compute]...
  Q_tile₂:                      [wait KV₀][compute]...

  关键：Q_tile₁ 在 compute 时，Q_tile₀ 可能在 wait 远程 KV——
        GPU SM 上的 warp scheduler 自动切换，实现细粒度 overlap
```

实现方式（双 kernel 架构）：

```python
# 通信 kernel（单独 stream）：
#   负责 put/get KV 数据，完成后写 signal
@triton.jit
def comm_kernel(...):
    for round in range(world_size):
        tdl.putmem_signal_nbi(dest, src, bytes, signal_addr, round, 'set', next_rank)

# 计算 kernel（主 stream）：
#   每个 tile 用 wait/consume_token 绑定到通信信号
@triton.jit
def compute_kernel(...):
    pid = tl.program_id(0)
    for round in range(world_size):
        token = tdl.wait(signal_addr, round)      # 等 KV_round 到达
        kv_tile = tdl.consume_token(token)         # 建立依赖
        # ... 用 kv_tile 做 attention 计算 ...
```

这本质上就是 **TileLink** 论文中描述的"tile-centric primitive"方法——将通信和计算解耦为独立的 tile 流，通过 signal token 建立依赖图，编译器在 LLVM 层面做流水线调度。

> 来源：[TileLink arxiv 2503.20313](https://arxiv.org/abs/2503.20313)

---

## 六、已有参考实现

### 6.1 Triton-distributed 官方示例

GitHub 仓库 `python/triton_dist/kernels/` 下提供：

| 示例 | 文件 | 说明 |
|------|------|------|
| **Distributed Flash-Decode** | `flash_decode.py` | 1 query 多 GPU 解码，batch=1 时从 1 GPU 到 32 GPU 的 scaling |
| **AllGather + GEMM** | 仓库内含 | 经典的 computation-communication overlap 展示 |
| **GEMM + ReduceScatter** | 仓库内含 | 分布式矩阵乘+规约 |
| **Low-latency AllToAll** | 仓库内含 | 137μs vs DeepEP 182μs（32 H800） |

**Flash-Decode 示例尤其值得深入研读**：它本质上就是序列并行的一种特殊形式（batch=1 的解码场景），KV 分布在多 GPU 上，query 单 GPU 发起。

### 6.2 ring-flash-attention（zhuzilin）

虽然不是 Triton-distributed 实现，但它是理解 Ring Attention 的最佳代码参考。使用标准 FlashAttention kernel + NCCL P2P send/recv：

```
GitHub: zhuzilin/ring-flash-attention
├── ring_flash_attn/
│   ├── ring_flash_attn_func.py    # 核心：用 FA kernel + P2P 通信
│   ├── zigzag_ring_flash_attn.py  # Zigzag 变体
│   └── stripe_flash_attn.py      # Striped Attention
```

性能在 8×H800 上：zigzag ring attention 能达到理论 FA 上限的 **85%（fwd only）/ 90%（fwd+bwd）**。

> 来源：[ring-flash-attention GitHub](https://github.com/zhuzilin/ring-flash-attention)

### 6.3 其他关键工作

| 工作 | 核心思路 | 与 Triton-distributed 的关系 |
|------|----------|---------------------------|
| **TASP** (2025) | 用 AlltoAll 替代 Ring AllGather，充分利用 NVSwitch 全互联拓扑 | 通信模式启发性强，可参考其拓扑感知策略 |
| **USP/YunChang** | Ulysses + Ring Attention 的 2D hybrid | 已在 TransformerEngine 中集成 |
| **ZeCO** (2025) | All-Scan 原语，通信量极小 | 展示了自定义通信原语的威力 |
| **LASP-2** | Linear Attention 的序列并行 | 特殊 attention 变种的通信优化 |

---

## 七、行动路线图

### Phase 1：熟悉 Triton-distributed 基础

```bash
# 安装
pip install triton-dist

# 跑通示例
git clone https://github.com/ByteDance-Seed/Triton-distributed
cd Triton-distributed
# 研读 python/triton_dist/kernels/flash_decode.py
# 研读 test/ 下的测试用例
```

重点理解：
1. symmetric memory 的分配和使用（`tdl.symm_at`）
2. `putmem_nbi` + `signal_op` 的 send 模式
3. `signal_wait_until` 的 recv 模式
4. `wait` + `consume_token` 如何构建 tile 级依赖

### Phase 2：设计 Ring Attention Kernel

```
建议结构：
┌─────────────────────────────────────────┐
│  Host 端（Python）                       │
│  1. 分配 symmetric memory               │
│  2. 切分 Q/K/V 沿序列维度                │
│  3. 在多个 CUDA stream 上 launch：       │
│     - Stream A: comm_kernel（纯通信）     │
│     - Stream B: attn_kernel（计算+同步）  │
│  4. 管理多 round 的同步                   │
├─────────────────────────────────────────┤
│  comm_kernel (Triton-distributed)       │
│  - 管理环形 P2P put                      │
│  - 完成后写 signal                       │
├─────────────────────────────────────────┤
│  attn_kernel (Triton-distributed)       │
│  - 每个 tile 独立 wait signal            │
│  - Flash Attention tile 计算 + rescale  │
│  - consume_token 绑定通信完成            │
└─────────────────────────────────────────┘
```

### Phase 3：关键设计决策

| 决策点 | 选项 | 考量 |
|--------|------|------|
| **KV 传输粒度** | 整块传输 vs tile 流式 | tile 流式 overlap 更好但 signal 开销大 |
| **Ring vs AlltoAll** | Ring（P2P）vs AlltoAll（全互联） | NVSwitch 环境 AlltoAll 可能更好（参考 TASP） |
| **单 kernel vs 双 kernel** | 计算+通信合一 vs 两个独立 kernel | 合一更难写但 overlap 最优 |
| **Causal mask 策略** | Zigzag vs Striped | 取决于是否是 causal attention |
| **Backward 支持** | 需要 vs 只需 forward | backward 的通信量翻倍，overlap 设计更复杂 |

### Phase 4：需要注意的坑

1. **Symmetric memory 大小**：至少需要容纳 `K_chunk + V_chunk + signal`，如果 tile 级流式则需要双缓冲
2. **Signal 协议设计**：最简单的是 round counter（signal=round_number），但要注意 reset 逻辑
3. **多 stream 调度**：通信 kernel 和计算 kernel 放不同 stream，需要用 `cudaStreamWaitEvent` 做最终同步
4. **编译器版本兼容性**：当前 Triton-distributed 对 CUDA 版本和 Triton 版本有依赖，使用前 check 兼容性矩阵
5. **性能调试**：用 Nsight Systems 看 timeline，确认 compute 和 comm 确实在 overlap（不能出现 compute 等待 comm 的空白 gap）
6. **SM 资源分配**：通信 kernel 只需少量 SM，需通过 `num_warps` 等参数控制 SM 占用，避免和计算 kernel 争抢

---

## 八、核心论文与资源索引

| 论文/项目 | 链接 | 重点 |
|-----------|------|------|
| **Triton-distributed** (MLSys 2025) | [arxiv 2504.19442](https://arxiv.org/abs/2504.19442) | 编译器架构、原语设计、性能数据 |
| **Triton-distributed GitHub** | [GitHub](https://github.com/ByteDance-Seed/Triton-distributed) | 源码、示例 kernel、安装指南 |
| **Triton-distributed API 文档** | [ReadTheDocs](https://triton-distributed.readthedocs.io/en/latest/) | 完整 API 参考 |
| **TileLink** (2025) | [arxiv 2503.20313](https://arxiv.org/abs/2503.20313) | Tile-centric 原语编译方法，Triton-distributed 理论基础 |
| **Ring Attention** (Liu et al., 2023) | [arxiv 2310.01889](https://arxiv.org/abs/2310.01889) | Ring Attention 原始算法 |
| **ring-flash-attention** | [GitHub](https://github.com/zhuzilin/ring-flash-attention) | Ring Attention + FlashAttention 最佳参考实现 |
| **TASP** (2025) | [arxiv 2509.26541](https://arxiv.org/abs/2509.26541) | 拓扑感知序列并行，AlltoAll 替代 Ring |
| **USP / YunChang** | [GitHub](https://github.com/feifeibear/long-context-attention) | Ulysses + Ring hybrid，已集成 TransformerEngine |
| **FlashAttention-3** | [arxiv](https://arxiv.org/abs/2407.08608) | Hopper 架构 Flash Attention，Triton 实现参考 |
| **ZeCO** (2025) | EmergentMind 收录 | All-Scan 原语，minimal communication |
| **AMD ROCm Triton-distributed** | [AMD Blog](https://rocm.blogs.amd.com/software-tools-optimization/triton-distributed-c/README.html) | AMD GPU 上的使用指南 |

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
│  工程决策：先用 NCCL  →  不够时用 NVSHMEM        │
│            →  需要极致 overlap 时用 Triton-dist   │
└─────────────────────────────────────────────────┘
```
