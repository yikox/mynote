# RegionE: Adaptive Region-Aware Generation for Efficient Image Editing

## 论文概览

| 属性   | 信息                                                                    |
| ---- | --------------------------------------------------------------------- |
| 标题   | RegionE: Adaptive Region-Aware Generation for Efficient Image Editing |
| 作者   | Pengtao Chen 等，复旦大学                                                   |
| 发表   | **ICLR 2026**                                                         |
| 开源代码 | [Peyton-Chen/RegionE](https://github.com/Peyton-Chen/RegionE)         |
| 论文链接 | [arXiv:2510.25590](https://arxiv.org/abs/2510.25590)                  |

***

## 1. 问题动机

### 核心痛点

现有的 **Instruction-based Image Editing (IIE)** 模型存在严重的计算效率问题：

* 即使只修改图像的局部区域，模型也会对**整个图像**进行统一的去噪生成

* 编辑区域和非编辑区域在生成难度和计算冗余上**差异巨大**

* 现有方法忽略了这种差异，浪费大量算力在不需要变化的部分

### 关键观察

1. **非编辑区域的轨迹是直的**：可以在单步中推断多步去噪预测
2. **编辑区域的相邻时间步表现出强速度相似性**：可以利用缓存加速
3. 不同区域在生成难度上有本质区别，应该区分处理

***

## 2. 完整实现架构

### 2.1 三阶段框架

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RegionE 推理流程                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ Stage 1: STS │    │ Stage 2: RAGS │    │ Stage 3: SMS │              │
│  │ Stabilization│───▶│ Region-Aware  │───▶│ Smooth       │              │
│  │ Stage        │    │ Generation    │    │ Stage        │              │
│  │              │    │ Stage         │    │              │              │
│  │ • t ∈ [T, 16]│    │ • t ∈ (16, 2] │    │ • t ∈ [2, 0] │              │
│  │ • 无加速      │    │ • ARP 区域划分│    │ • 完整去噪    │              │
│  │ • 缓存 KV    │    │ • RIKVCache  │    │ • 质量恢复    │              │
│  │              │    │ • AVDCache   │    │              │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**阶段参数配置（所有模型通用）：**

* STS: 6 步 (t ∈ \[T, 16])

* RAGS: 在 step 16 强制更新一次

* SMS: 2 步 (t ∈ \[2, 0])

**模型特定阈值：**

| 模型              | 分割阈值 η (ARP) | 决策阈值 δ (AVDCache) |
| --------------- | ------------ | ----------------- |
| Step1X-Edit     | 0.88         | 0.02              |
| FLUX.1 Kontext  | 0.93         | 0.04              |
| Qwen-Image-Edit | 0.80         | 0.03              |

***

## 3. 核心组件详细设计

### 3.1 Adaptive Region Partition (ARP) - 区域划分

#### 原理

在**早期去噪阶段**（STS），对最终图像做单步估计，比较其与参考（指令）图像的相似度：

```
┌─────────────────────────────────────────────────────────┐
│              RegionE 算法伪代码（简化版）                   │
├─────────────────────────────────────────────────────────┤
│  Input: 带噪图像 X_T, 原始图像 X_ref, 指令图像 X_I         │
│                                                         │
│  1. for t = T to 2:                                      │
│  2.   if t > 16 (STS):                                   │
│  3.       # 标准去噪，无加速                               │
│  4.       v_t = DiT([X_p, X_t, X_I])                     │
│  5.       X_{t-1} = X_t - Δt_t · v_t                     │
│  6.       if t == 16: C_KV = cache_KV(C_KV, v_t)        │
│  7.   else if 2 < t ≤ 16 (RAGS):                         │
│  8.       # 区域感知生成                                   │
│  9.       if is_first_iteration:                         │
│  10.          X_final = DiT_one_step(X_t)  # 单步估计    │
│  11.          mask = compute_region_mask(X_final, X_ref) │
│  12.      X_edited, X_unedited = split_by_mask(X_t, mask)│
│  13.      if is_forced_update_step(t):                   │
│  14.          # 强制更新：聚合全图刷新 RIKVCache           │
│  15.          v_t, C_KV = full_compute(X_t, C_KV)        │
│  16.      else:                                          │
│  17.          v_E = DiT_region([X_p, X_E_t], C_KV)       │
│  18.          v_U = one_step_predict(v_t)               │
│  19.          v_t = merge(v_E, v_U, mask)               │
│  20.      X_{t-1} = X_t - Δt_t · v_t                     │
│  21.  else (SMS):                                        │
│  22.      # 平滑阶段：完整去噪                             │
│  23.      v_t = DiT([X_p, X_{t-1}, X_I])                 │
│  24.      X_t = X_t - Δt_t · v_t                         │
│  25. return X_0                                          │
└─────────────────────────────────────────────────────────┘
```

#### 分割策略

```
mask[i] = {
    0 (unedited): if |X_final[i] - X_ref[i]| < η
    1 (edited):   otherwise
}
```

* `η` 是分割阈值，通过实验调优

* 分割发生在 **step 16**（进入 RAGS 前）

***

### 3.2 Region-Instruction KV Cache (RIKVCache) - 空间冗余优化

#### 问题背景

编辑区域的迭代生成过程中：

1. DiT 输入从 `[X_p, X_t, X_I]` 变为 `[X_p, X_E_t]`
2. 完全丢弃 `X_I` 和未编辑区域 `X_U_t`
3. 但 DiT 的 attention 层有全局 token 交互，丢弃会导致偏差累积

#### 解决方案

**保留 KV cache 来注入全局信息**，核心公式：

```
# DiT attention 层修改后的计算
Attention = softmax([Q_P, Q_E] · [K_P, K_E, K_C^U, K_C^I]^T / √d) · [V_P, V_E, V_C^U, V_C^I]

其中：
• Q_P, Q_E: 来自当前输入的 query（主图像 patch + 编辑区域）
• K_C^U, V_C^U: 未编辑区域的 cached KV（从 STS 阶段缓存）
• K_C^I, V_C^I: 指令图像的 cached KV（从 STS 阶段缓存）
```

#### 实现位置

在 **DiT 的每个 Attention 层**内修改：

```
┌─────────────────────────────────────────────────────────┐
│             DiT Block (修改后)                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   Input: [X_P, X_E_t] + C_KV (缓存的 K^U, V^U, K^I, V^I) │
│                                                          │
│   ┌─────────┐                                           │
│   │ Patchify │──▶ Linear ──▶ Q_P, Q_E                  │
│   └─────────┘         │                                 │
│                       │                                 │
│                       ▼                                 │
│               ┌───────────────┐                        │
│               │   Cached KV    │──▶ K_C^U, V_C^U        │
│               │  (STS 阶段)     │     K_C^I, V_C^I      │
│               └───────────────┘                        │
│                       │                                 │
│                       ▼                                 │
│            ┌────────────────────┐                       │
│            │  Attention 计算   │                       │
│            │ softmax(Q·[K,KC]ᵀ)│                       │
│            │    · [V,VC]       │                       │
│            └────────────────────┘                       │
│                       │                                 │
│                       ▼                                 │
│            ┌────────────────────┐                       │
│            │  Cross-region      │                       │
│            │  Information Flow  │                       │
│            └────────────────────┘                       │
│                       │                                 │
│                       ▼                                 │
│   Output: v_E_t (编辑区域 velocity)                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 缓存更新策略

* **STS 阶段**：缓存所有 KV 值

* **RAGS 阶段**：

  * 正常步：使用 RIKVCache

  * **强制更新步 (step 16)**：执行全图 DiT 计算，刷新缓存

***

### 3.3 Adaptive Velocity Decay Cache (AVDCache) - 时间冗余优化

#### 问题背景

编辑区域虽然轨迹是曲线（需要迭代生成），但**相邻时间步的速度方向高度一致**：

* 速度方向：几乎相同（余弦相似度 → 1）

* 速度大小：随时间步逐渐衰减，衰减率依赖于时间步

#### 核心公式

**速度衰减关系（公式 7）：**

```
‖v_ti‖ / ‖v_ti+1‖ = (1 - Δt_ti+1,ti) · γ_ti
```

**跳步预测（公式 5）：**

```
# 给定 v_ti，预测 t_j 时刻的速度
v_tj = v_ti · (1 - Δt_tj,ti) · γ_ti

# 其中 Δt_tj,ti = t_j - t_i (时间差)
# γ_ti 是衰减因子（与模型和时间步相关）
```

#### 决策机制

```
if |v_ti - v_ti+1| / |v_ti| < δ:
    # 跳过当前步，使用预测的 v_ti+1
    skip_step()
else:
    # 正常计算
    compute_step()
```

#### 时序图示

```
┌─────────────────────────────────────────────────────────────────┐
│                 AVDCache 跳步机制示意                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  标准去噪:  t=T ─── v_T ─── v_0.9 ─── v_0.8 ─── v_0.7 ─── ...   │
│                                                                  │
│  AVDCache:  t=T ─── v_T ─── v_0.8 ────── v_0.6 ────── ...      │
│                            ↑      ↑                             │
│                          跳过    跳过                            │
│                          (预测)  (预测)                          │
│                                                                  │
│  v_0.8_predicted = v_0.9 · (1 - Δt_0.8,0.9) · γ_0.9             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

***

## 4. DiT 模型中的具体修改点

### 4.1 修改的模块层级

```
DiT Architecture (以 FLUX.1 / Step1X-Edit / Qwen-Image-Edit 为例)
│
├── Input Embedding
│   ├── Patchify (图像分块)
│   ├── timestep embedding
│   └── instruction embedding
│
├── DiT Blocks (×N 层)
│   ├── ┌─────────────────────────────────────────┐
│   │  │         MODIFIED ATTENTION              │
│   │  │                                          │
│   │  │  # 原始:                                 │
│   │  │  x = attention(Q, K, V)                  │
│   │  │                                          │
│   │  │  # RegionE 修改:                         │
│   │  │  Q = compute_query(x)                   │
│   │  │  K_full = concat(K_current, K_cached)   │
│   │  │  V_full = concat(V_current, V_cached)   │
│   │  │  x = attention(Q, K_full, V_full)       │
│   │  │                                          │
│   │  │  # Gather/Scatter 操作:                  │
│   │  │  # X_U = scatter(X_full, unedited_mask) │
│   │  │  # X_E = scatter(X_full, edited_mask)    │
│   │  └─────────────────────────────────────────┘
│   │
│   └── FeedForward
│
└── Output Layer
    └── predict velocity v_t
```

### 4.2 Gather/Scatter 操作

```
┌─────────────────────────────────────────────────────────────────┐
│              Gather-Scatter 操作示意                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  输入完整特征 X_full (H×W×D):                                   │
│  ┌─────────────────────────────────────────┐                    │
│  │  U  U  U  │  E  E  E  │  U  U  U  U  U  │                    │
│  │  U  U  U  │  E  E  E  │  U  U  U  U  U  │                    │
│  │  U  U  U  │  E  E  E  │  U  U  U  U  U  │                    │
│  └─────────────────────────────────────────┘                    │
│      ↑ 编辑区域   ↑ 非编辑区域                                    │
│                                                                  │
│  Gather (提取编辑区域):                                          │
│  X_E = gather(X_full, edited_mask)  →  [E, E, E, E, E, E]       │
│                                                                  │
│  Scatter (写回):                                                │
│  X_full = scatter(X_full, X_E, edited_mask)                     │
│                                                                  │
│  全局信息注入:                                                    │
│  K/V 需要拼接:                                                   │
│  K_concat = concat(K_E, K_C^U, K_C^I)                           │
│  V_concat = concat(V_E, V_C^U, V_C^I)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

***

## 5. 实验效果与消融分析

### 5.1 整体性能

| 模型                            | 延迟 (s)    | 加速比       | PSNR      | SSIM     | LPIPS     |
| ----------------------------- | --------- | --------- | --------- | -------- | --------- |
| Step1X-Edit (vanilla)         | 27.95     | 1.00×     | 31.08     | 0.94     | 0.055     |
| **Step1X-Edit + RegionE**     | **10.87** | **2.57×** | **30.52** | **0.94** | **0.054** |
| FLUX.1 Kontext (vanilla)      | 19.87     | 1.00×     | 32.43     | 0.95     | 0.038     |
| **FLUX.1 Kontext + RegionE**  | **8.25**  | **2.41×** | **32.13** | **0.95** | **0.038** |
| Qwen-Image-Edit (vanilla)     | 17.51     | 1.00×     | 31.35     | 0.94     | 0.046     |
| **Qwen-Image-Edit + RegionE** | **8.50**  | **2.06×** | **31.12** | **0.94** | **0.045** |

### 5.2 消融实验（Step1X-Edit）

| 组件              | PSNR↑ | SSIM↑ | LPIPS↓ | G-SC↑ | 延迟(s)↓ | 加速比↑  |
| --------------- | ----- | ----- | ------ | ----- | ------ | ----- |
| **完整 RegionE**  | 30.52 | 0.94  | 0.054  | 7.55  | 10.87  | 2.57× |
| w/o RIKVCache   | 22.87 | 0.82  | 0.207  | 6.00  | 10.22  | 2.73× |
| w/o AVDCache    | 31.14 | 0.95  | 0.046  | 7.57  | 16.12  | 1.73× |
| w/o STS         | 21.44 | 0.81  | 0.161  | 7.05  | 7.15   | 3.91× |
| w/o SMS         | 28.86 | 0.90  | 0.085  | 7.46  | 9.77   | 2.86× |
| w/o Forced Step | 28.45 | 0.92  | 0.080  | 7.54  | 10.20  | 2.74× |

**关键结论：**

* **RIKVCache 至关重要**：去掉后 PSNR 骤降 7.65，LPIPS 暴涨 4 倍

* **AVDCache 提供 47% 额外加速**（1.73× → 2.57×）

* **三阶段设计必要**：去掉 SMS 或 STS 都会显著降低质量

***

## 6. 与现有工作的区别

| 方法   | 策略           | RegionE 的优势  |
| ---- | ------------ | ------------ |
| RAS  | 只更新语义连贯区域    | 同时处理空间+时间冗余  |
| ToCa | 动态更新部分 token | 利用 IIE 轨迹特性  |
| DuCa | token 敏感度感知  | 训练-free，即插即用 |

RegionE 的独特性：

1. **利用 IIE 任务的轨迹特性**（非编辑区域直线轨迹）
2. **同时解决空间和时间冗余**
3. **完全训练-free**

***

## 7. 总结

### 核心贡献

1. **Adaptive Region Partition (ARP)**：早期预测划分编辑/非编辑区域
2. **Region-Instruction KV Cache (RIKVCache)**：解决局部生成的信息缺失问题
3. **Adaptive Velocity Decay Cache (AVDCache)**：利用速度相似性跳步加速

### 实现的三个层次

1. **模型输入层**：修改 DiT 的输入从 `[X_p, X_t, X_I]` → `[X_p, X_E_t]`
2. **Attention 层**：拼接 cached KV 到 K, V，支持 cross-region 信息流动
3. **去噪调度层**：三阶段策略 + 自适应跳步决策

### 关键公式

```
1. 区域划分: mask = (|X_final - X_ref| > η)
2. RIKVCache: A = softmax(Q · [K, K_C]^T/√d) · [V, V_C]
3. AVDCache:  ‖v_ti‖/‖v_ti+1‖ = (1 - Δt_ti+1,ti) · γ_ti
```

***

## 参考资料

* 论文：<https://arxiv.org/abs/2510.25590>

* 代码：<https://github.com/Peyton-Chen/RegionE>

* OpenReview：<https://openreview.net/forum?id=I6j5fLdH80>

