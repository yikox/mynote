# RegionE: Adaptive Region-Aware Generation for Efficient Image Editing

> 📌 **TL;DR** — 一个**训练免费**的图像编辑加速框架。通过**三阶段推理 + 区域感知生成**，将 IIE（Instruction-based Image Editing）速度提升 **2.06-2.57 倍**，PSNR 仅下降 0.2-0.3 dB，**几乎无损**。
>
> **核心思想**：编辑任务中大部分像素其实没变 → 把图分成"编辑区 / 非编辑区"分开算 → 空间维度用 KV Cache 注入被丢弃的全局信息 → 时间维度用速度衰减跳步。

| 属性     | 信息                                                                    |
| ------ | --------------------------------------------------------------------- |
| **标题** | RegionE: Adaptive Region-Aware Generation for Efficient Image Editing |
| **作者** | Pengtao Chen 等 · 复旦大学                                                 |
| **会议** | ICLR 2026                                                             |
| **代码** | [Peyton-Chen/RegionE](https://github.com/Peyton-Chen/RegionE)         |
| **论文** | [arXiv:2510.25590](https://arxiv.org/abs/2510.25590)                  |

## 📑 目录

1. [问题与动机](#1-问题与动机)
2. [三阶段架构](#2-三阶段架构)
3. [三大核心组件](#3-三大核心组件)

   * 3.1 [ARP — 区域划分](#31-adaptive-region-partition-arp--区域划分)

   * 3.2 [RIKVCache — 空间冗余优化](#32-region-instruction-kv-cache-rikvcache--空间冗余优化)

   * 3.3 [AVDCache — 时间冗余优化](#33-adaptive-velocity-decay-cache-avdcache--时间冗余优化)
4. [DiT 中的具体修改点](#4-dit-模型中的具体修改点)
5. [实验效果](#5-实验效果与消融分析)
6. [与现有工作的区别](#6-与现有工作的区别)
7. [总结](#7-总结)

***

## 1. 问题与动机

### 🎯 核心痛点

现有的 **Instruction-based Image Editing (IIE)** 模型存在严重的计算效率问题：

* 即使只修改图像的局部区域，模型也会对**整个图像**进行统一的去噪生成

* 编辑区域和非编辑区域在**生成难度**和**计算冗余**上差异巨大

* 现有方法忽略这种差异，浪费大量算力在"不需要变"的部分

### 💡 三个关键观察

> **观察 1（非编辑区）**：去噪轨迹近似直线 → 可以在单步中推断多步预测
>
> **观察 2（编辑区）**：相邻时间步的速度方向高度一致 → 可以利用缓存跳步
>
> **观察 3（区域差异）**：编辑区/非编辑区难度本质不同 → 应区分处理

***

## 2. 三阶段架构

RegionE 将去噪过程分为三个阶段，分别处理不同粒度的冗余：

```mermaid
flowchart LR
    A["🟦 Stage 1: STS<br/>Stabilization<br/><br/>t ∈ T, 16<br/>6 步 · 无加速<br/>缓存所有 KV"]
    B["🟨 Stage 2: RAGS<br/>Region-Aware Generation<br/><br/>t ∈ 16, 2<br/>ARP + RIKVCache + AVDCache<br/>step 16 强制刷新一次"]
    C["🟩 Stage 3: SMS<br/>Smooth<br/><br/>t ∈ 2, 0<br/>2 步 · 完整去噪<br/>质量恢复"]
    A -->|step 16 后切换| B
    B -->|step 2 后切换| C
    C -->|输出 X₀| D[编辑结果]

    style A fill:#e3f2fd,stroke:#1976d2
    style B fill:#fff9c4,stroke:#f57c00
    style C fill:#e8f5e9,stroke:#388e3c
    style D fill:#f3e5f5,stroke:#7b1fa2
```

### 阶段参数（所有模型通用）

| 阶段       | 步数范围         | 步数     | 关键操作                                |
| -------- | ------------ | ------ | ----------------------------------- |
| **STS**  | t ∈ \[T, 16] | 6      | 标准去噪 + 缓存所有 KV                      |
| **RAGS** | t ∈ (16, 2]  | 14     | 区域感知 + KV Cache + 跳步 + step 16 强制刷新 |
| **SMS**  | t ∈ \[2, 0]  | 2      | 完整去噪（质量恢复）                          |
| **总计**   | —            | **22** | （原 28 步）                            |

### 模型特定超参

| 模型              | 分割阈值 η (ARP) | 决策阈值 δ (AVDCache) |
| --------------- | ------------ | ----------------- |
| Step1X-Edit     | 0.88         | 0.02              |
| FLUX.1 Kontext  | 0.93         | 0.04              |
| Qwen-Image-Edit | 0.80         | 0.03              |

***

## 3. 三大核心组件

### 3.1 Adaptive Region Partition (ARP) — 区域划分

**核心思想**：在 STS 阶段末（step 16），对最终图像做单步估计，比较其与原始图像的相似度，把图像分成"编辑区"和"非编辑区"两个 mask。

**分割规则**：

```python
mask[i] = 1 if |X_final[i] - X_ref[i]| > η else 0
#         ↑ 编辑区              ↑ 非编辑区
```

* `η` 是分割阈值（不同模型不同，见上表）

* 分割只发生一次（step 16），后续 RAGS 阶段复用

---

#### 📌 ARP 核心原理图解：「速度一致」是未编辑区的**内在属性**

> **核心逻辑链条**（从观察到方法）：
>
> 观察到的事实：未编辑区的轨迹是直线（论文图 1 / 2f）
> 　　↓ 推出的性质
> 未编辑区在 t=16 处的速度 v，和未来任意时刻的速度近似相等
> 　　↓ 推出的方法
> 用 t=16 的 v 一次性外推到 t=0，误差小
> 　　↓ 推出的判据
> `|X̂_0 − X_ref|` 小 → mask = 0（未编辑）

```mermaid
flowchart TB
    subgraph unedited["✅ 未编辑区（轨迹：直线）"]
        direction LR
        A1["t = T: X_T"] -->|"v_t ≈ 恒定"| A2["t = 16: X_t16"]
        A2 -->|"v_t16 一阶欧拉外推"| A3["t = 0: X̂_0 ≈ X_ref ✓"]
        A2 -.->|"真实去噪路径"| A4["t = 0: X_ref"]
    end

    subgraph edited["❌ 编辑区（轨迹：曲线）"]
        direction LR
        B1["t = T: X_T"] -->|"v_t 在变化"| B2["t = 16: X_t16"]
        B2 -->|"v_t16 一阶外推"| B3["t = 0: X̂_0 ≠ X_ref ✗"]
        B2 -.->|"真实去噪路径"| B4["t = 0: X_ref"]
    end

    style unedited fill:#e8f5e9,stroke:#388e3c
    style edited   fill:#ffebee,stroke:#d32f2f
    style A3 fill:#c8e6c9,stroke:#2e7d32
    style A4 fill:#c8e6c9,stroke:#2e7d32
    style B3 fill:#ffcdd2,stroke:#c62828
    style B4 fill:#ffcdd2,stroke:#c62828
```

**图说**：

- 🟢 **未编辑区**：`v_t` 全程几乎不变（绿箭头方向大小一致），从 t=16 用 `v_t16` 一步外推得到的 `X̂_0` 和真实 `X_ref` 几乎重合。差异小 → mask = 0。
- 🔴 **编辑区**：`v_t` 方向在旋转（红箭头方向不同），用 t=16 的 `v_t16` 线性外推会偏离真实曲线，导致 `X̂_0` 落在远离 `X_ref` 的位置。差异大 → mask = 1。

#### 关键细节：v 是**向量**

| 维度       | 未编辑区                | 编辑区             |
| -------- | ------------------- | --------------- |
| **方向**   | 近似恒定（轨迹是直线）         | 持续旋转（轨迹是曲线）    |
| **大小**   | 很小（"没什么要降噪的"）       | 较大（"要动很多"）      |
| **外推结果** | ΔX 小，`X̂_0` 落在 `X_ref` 附近 | ΔX 大且方向偏，`X̂_0` 飞出去 |

> 「差异小」= **方向对 + 步幅小**，两个因素**叠加**的结果，不是单一原因。

#### 自监督的副产品

这种「误差即定位」是**自监督**的——没有 ground truth mask，**预测误差本身**就把 mask 标出来了。所以论文 Figure 5 说 ARP 划出来的区域 "closely match human perception"——**编辑区 = 模型预测不准的区域**，两者是同一回事。

---



### 3.2 Region-Instruction KV Cache (RIKVCache) — 空间冗余优化

**问题**：编辑时把 DiT 输入从 `[X_P, X_t, X_I]` 改成 `[X_P, X_E_t]`，**完全丢弃**了非编辑区 `X_U` 和指令图 `X_I`。但 DiT 的 attention 是全局 token 交互的，丢弃会导致编辑区缺乏上下文、偏差累积。

#### 🧩 A. 核心设计：RIKVCache 的"三件套"

RIKVCache 的精髓**不是单纯的"用 cache"**，而是把整个 RAGS 步的 DiT 前向**重新设计**成了三件套：

**设计一：只跑编辑区**（最关键，决定 cache 必要性）

```
正常 DiT:   x_full → DiT(x_full)            # 跑全部 N 个 token
RegionE:    x_e    → DiT(x_e)                # 只跑 rN 个 token（r = 编辑区占比）
```

只跑 x_e 之后，**编辑区自然就"看不到"非编辑区了** —— 这是 cache 存在的前提。

**设计二：一次性建 cache**（节省的是"重算"成本）

```
t=16 强制刷新步（必须全量 forward 一次）:
    K_C^U, V_C^U, K_C^I, V_C^I = KV_noedit(x_full)[noedit_mask]   
                                       # 截取非编辑区对应的 K, V 存下来
                                       # 后续 RAGS 步不再算
```

这一步是不可省略的"建索引"成本，但**只发生一次**。

**设计三：attn 时拼接注入**（让 x_e "看得到"非编辑区）

```text
A = softmax([Q_P, Q_E] · [K_P, K_E, K_C^U, K_C^I]ᵀ / √d) · [V_P, V_E, V_C^U, V_C^I]
```

这一行就是**整个 RIKVCache 算法的灵魂**。

**三件套的逻辑闭环**：

```
设计一（只跑 x_e）
    │  问题：编辑区看不到非编辑区 → 生成不连贯
    ↓
设计二（建 cache 存 K_C, V_C）
    │  问题：怎么让 x_e 看到非编辑区？
    ↓
设计三（attn 拼接）→ 形成闭环
```

#### 📦 B. Cache 里到底存什么 —— 四 token 视角

DiT 在编辑任务中涉及**四类 token**，cache 的内容是**精确选择**的结果：

| Token | 含义 | 在 cache 吗 | 为什么 |
| --- | --- | --- | --- |
| **P** | Prompt（文字指令）| ❌ | 文字 prompt 参与 Q 计算但不存 |
| **E** | Edited region（编辑区）| ❌ | **每步都在变化**（去噪过程），缓存没意义 |
| **U** | Unedited region（非编辑区）| ✅ **K_C^U, V_C^U** | 空间邻接上下文（边缘延伸、纹理连续、阴影一致）|
| **I** | Instruction image（指令图 / 原图）| ✅ **K_C^I, V_C^I** | **全局风格锚点**（整体色彩、构图、风格保持）|

**为什么 I 也存**：编辑区只跑 x_e 后，会丢失"原图整体长啥样"的参考。比如把一只猫改成狗，只看 U（猫周围的草地）可能生成一只写实狗，但原图是卡通风格 → 应该生成卡通狗。I 提供了这个"全局风格锚点"。

> 这一点**之前的笔记漏掉了**。论文公式 6 明示了 I 的存在，是 RegionE 设计中容易被忽略但关键的一环。

#### 🧭 C. 位置编码适配性 —— "训练免费"能 work 的隐藏前提

DiT 用 RoPE（旋转位置编码），K 矩阵里**嵌入了相对位置**。K_C^U、V_C^U、K_C^I、V_C^I 都保留原图 token 的**原始位置信息**。

当拼接做 attention 时：

- Q_E（编辑区当前位置）· K_C^U（非编辑区原位置）→ 相对距离**自动算出**
- **不需要任何位置对齐处理**

| 位置编码方式 | 在 K_V 里的体现 | 拼接时是否需要处理 |
| --- | --- | --- |
| **RoPE**（现代 DiT 主流）| K 矩阵里嵌入了相对位置 | ❌ 不需要 |
| **2D 正弦 / Learned PE** | 加在 token embedding 上 | ❌ 不需要 |
| **ALiBi**（线性偏置）| attention score 后加偏置 | ⚠️ 需要扩展 bias 表 |

> 现代 DiT（FLUX、Qwen、Step1X）几乎都用 RoPE，所以 RegionE 不用特殊处理位置编码 —— **这是它能"训练免费"的隐藏前提**。

#### 🔄 D. Cache 刷新机制

cache **不是永久有效**，RAGS 阶段需要周期性刷新：

| 阶段 | 缓存操作 | 说明 |
| --- | --- | --- |
| **STS 末（t=16）** | **建 cache**（首次） | 强制刷新步，全量 forward，截取 U/I 的 KV |
| **RAGS 加速步（t=15, 14, ...）** | **用 cache** | 只跑 x_e，拼接 K_C^U、K_C^I |
| **RAGS 强制刷新点** | **刷新 cache** | 论文 Figure 3 复数标注"forced update"，防漂移 |
| **SMS（t=1, 0）** | **抛弃 cache** | 全量 forward，消除分块痕迹 |

```mermaid
flowchart LR
    A["STS 末<br/>t=16 强制刷新"] -->|"建 cache<br/>K_C^U, V_C^U<br/>K_C^I, V_C^I"| B["RAGS<br/>t=15, 14, ...<br/>加速步"]
    B -->|"强制刷新点<br/>(防 cache 漂移)"| A
    B --> C["SMS<br/>t=1, 0<br/>全量 forward"]

    style A fill:#e3f2fd
    style B fill:#fff9c4
    style C fill:#e8f5e9
```

**为什么要周期性刷新**：编辑区在去噪过程中 K_V 会缓慢变化，cache 用久了会"漂移"。强制刷新点相当于"重置" cache 到当前真实状态。

**刷新频率论文没明说**，但根据"高质量"目标，密度不会太低（推测每 2-3 步一次）。

#### 💾 E. 显存开销估算

cache 显存占用（理论值，未压缩）：

```text
per_layer  = 2 (K+V) × (N_U + N_I) × num_heads × head_dim × dtype_bytes
total      = per_layer × num_layers
```

以 FLUX-Kontext 为例（粗估）：

| 参数 | 值 |
| --- | --- |
| num_layers | ~60（双 block + 单 block）|
| N_U + N_I | 1024 token（=32×32 latent）|
| num_heads × head_dim | d_kv ≈ 4096（FLUX）|
| dtype | bf16 = 2 bytes |

```text
per_layer = 2 × 1024 × 4096 × 2 = 16 MB
total     = 16 MB × 60 = ~1 GB
```

**Qwen-Image-Edit / Step1X 类似量级，~0.5-1 GB**。
这是 RegionE 唯一的"额外显存开销"，相比 FLUX 模型本身的 24 GB 权重可以接受。

> ⚠️ 实际可能有量化（fp8/int8）能减半。具体看代码实现（待确认）。

#### 📌 数据流总览

```mermaid
flowchart TB
    Input["输入 [X_P, X_E_t]"]
    Input -->|"Linear"| Q["Q_P, Q_E"]
    Cache["Cached KV<br/>(STS 阶段)"]
    Cache -->|"K_C^U, V_C^U"| Concat
    Cache -->|"K_C^I, V_C^I"| Concat
    Q --> Concat["concat K, V"]
    Concat --> Attn["Attention<br/>softmax(QKᵀ/√d)·V"]
    Attn --> Out["v_E_t<br/>编辑区速度"]

    style Cache fill:#fff9c4
    style Out fill:#e8f5e9
```

### 3.3 Adaptive Velocity Decay Cache (AVDCache) — 时间冗余优化

**问题**：编辑区虽然轨迹是曲线（需要迭代），但**相邻时间步的速度方向几乎一致**（余弦相似度 → 1），只有大小在衰减。能不能直接跳几步？

**核心公式**：

```text
速度衰减关系（公式 7）：
  ‖v_ti‖ / ‖v_ti+1‖ = (1 - Δt_ti+1,ti) · γ_ti

跳步预测（公式 5）：
  v_tj = v_ti · (1 - Δt_tj,ti) · γ_ti
  其中 Δt_tj,ti = t_j − t_i
```

**决策机制**：

```python
if |v_ti - v_ti+1| / |v_ti| < δ:
    skip_step()                # 速度变化小 → 跳步
else:
    compute_step()             # 速度变化大 → 正常算
```

**跳步示意**：

```mermaid
flowchart LR
    A["t = T"] -->|"v_T"| B["t = 0.9"]
    B -.->|"跳过 (预测)"| C["t = 0.8"]
    C -.->|"跳过 (预测)"| D["t = 0.6"]
    D -->|"v_0.6"| E["..."]

    style B fill:#fff9c4
    style C fill:#fff9c4
    style D fill:#fff9c4
```

> 🟡 黄色节点表示"被跳过、速度由前一步推算"。

***

## 4. DiT 模型中的具体修改点

### 修改层级

RegionE 的修改集中在 DiT 的 **Attention 层** 和 **输入处理层**：

```mermaid
flowchart TB
    subgraph Input["输入层 (Input Embedding)"]
        A[Patchify + Linear]
        B[timestep emb]
        C[instruction emb]
    end

    subgraph DiT["DiT Blocks (×N)"]
        D[Norm]
        E["⚙️ Modified Attention<br/>Q·concat K, K_C, V, V_C"]
        F[Norm]
        G[FFN]
    end

    subgraph Out["输出层"]
        H[predict velocity v_t]
    end

    A --> D --> E --> F --> G --> H
    B -.-> D
    C -.-> D

    style E fill:#fff9c4
```

### Gather / Scatter 操作

```mermaid
flowchart LR
    A["X_full (H×W×D)<br/>U U U │ E E E │ U U U U U"]
    A -->|"gather(edited_mask)"| B["X_E<br/>E E E E E E"]
    A -->|"cached"| C["X_U (KV cache)<br/>K_C^U, V_C^U"]
    A -->|"cached"| D["X_I (KV cache)<br/>K_C^I, V_C^I"]
    B --> E["Attention<br/>concat(K_E, K_C^U, K_C^I)"]
    C --> E
    D --> E
    E --> F["scatter 写回 X_full"]

    style E fill:#fff9c4
```

**关键点**：

* `X_U` 和 `X_I` **不参与这次前向计算**，但它们的 KV 仍然被 attention 查询

* 这样编辑区在算 attention 时仍然能看到全局上下文

***

## 5. 实验效果与消融分析

### 5.1 整体性能（3 个模型 vs vanilla）

| 模型              | 延迟 (s)            | 加速比

... (已截断，原始长度 10015 B, hash 8937f0ed)