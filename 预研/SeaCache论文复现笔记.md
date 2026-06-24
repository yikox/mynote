# SeaCache 论文复现笔记

> 论文: SeaCache: Spectral-Evolution-Aware Cache for Accelerating Diffusion Models
> 作者: Jiwoo Chung, Sangeek Hyun, MinKyu Lee, Byeongju Han, Geonho Cha, Dongyoon Wee, Youngjun Hong, Jae-Pil Heo (SKKU VCLab)
> 发表: CVPR 2026 **Oral**, **Best Paper Finalist**
> arXiv: https://arxiv.org/abs/2602.18993
> 代码: https://github.com/jiwoogit/SeaCache

---

## 一、论文特色与亮点

### 1.1 核心洞察：频谱演化（Spectral Evolution）

扩散模型的去噪过程存在**频谱演化规律**：

| 阶段 | 时间步特征 | 频谱表现 |
|------|-----------|----------|
| **早期** (高噪声) | 构建整体结构、布局、轮廓 | **低频**分量先出现并趋于稳定 |
| **后期** (低噪声) | 精炼纹理、边缘、细节 | **高频**分量逐渐浮现 |

已有缓存方法（TeaCache、TaylorSeer 等）用**原始特征**的 L1 距离来判断相邻时间步是否可复用 —— 问题在于原始特征把**内容信号和噪声纠缠在一起**，早期高噪声步的「特征差异」大部分来自噪声波动而非内容变化，导致缓存决策不精准。

### 1.2 方法直觉

> 不是改变「要不要跳过」的判断逻辑，而是在判断之前，先给特征做一次聪明的**频域滤波**，让距离度量只关注内容信号、忽略噪声。

### 1.3 突出特点

| 特点 | 说明 |
|------|------|
| ✅ **Training-Free** | 不需要训练、微调、蒸馏，零额外训练成本 |
| ✅ **Plug-and-Play** | 不修改模型架构，只插入一步 FFT→滤波→iFFT |
| ✅ **网络无关** | 适用于 DiT、U-Net 等各类扩散 backbone |
| ✅ **采样器无关** | 适用于 DDIM、Euler、Rectified-Flow 等各类采样器 |
| ✅ **开销极小** | SEA 滤波仅占端到端时间的 0.4%~0.6% |
| ✅ **即插即用** | 可附加到现有缓存策略（如 TeaCache），只替换距离度量 |
| ✅ **无需复杂调参** | 只有一个超参数 δ（阈值），论文声称不需要复杂的逐模型调优 |

### 1.4 与以往方法的本质区别

|                      | 以往缓存方案 (TeaCache 等)  | SeaCache                         |
| -------------------- | --------------------------- | -------------------------------- |
| 距离计算基础         | 原始特征（内容 + 噪声混杂） | SEA 滤波后特征（内容信号为主）   |
| 是否利用频谱先验     | ❌                           | ✅ 首次将显式频率先验注入缓存决策 |
| 跨时间步距离可比性   | 受噪声干扰，不稳定          | 增益归一化保证均值一致           |
| 对高噪声早期步的处理 | 噪声波动被误判为内容变化    | 噪声被抑制，距离信号更可靠       |


---

## 二、方法详解

### 2.1 整体流程（Fig.3）

```
输入特征 I_t, I_{t+1}（扩散模型某中间层的特征，形状 H×W×C）
      │
      ▼
  ┌──────────┐
  │   FFT    │  空间域 → 频域（复数谱）
  └──────────┘
      │
      ▼
  ┌─────────────────┐
  │ × G_norm_t(f)   │  频域逐元素乘实数权重（按径向频率查表）
  └─────────────────┘
      │
      ▼
  ┌──────────┐
  │  iFFT    │  频域 → 空间域
  └──────────┘
      │
      ▼
  P(G_norm_t, I_t)  → 频谱对齐后的特征（内容信号被放大，噪声被抑制）
      │
      ▼
  L1_rel(P_t, P_{t+1})  → 计算相对 L1 距离 Δ̃_t
      │
      ▼
  累积 Δ̃_t  →  < δ ? Skip（复用缓存） : Refresh（执行前向 + 更新缓存 + 重置累积）
```

### 2.2 SEA 滤波器的理论推导

#### 线性去噪器视角（Linear Denoiser View）

扩散模型在频域的去噪行为可近似为逐频率的增益函数 **G_t(f)**：

- **f** = 径向频率（radial frequency），即频域中离 DC（零频）的距离
- 离散径向频率集合 **F = {f_0, f_1, ..., f_{L-1}}**，共 L 个 bin，由特征空间分辨率 H×W 决定
- 不同时间步 t，G_t(f) 形状不同 → 这就是「频谱演化」的数学表达

#### G_t(f) 的物理含义

- **低频（f 小）**：G_t(f) 较高 → 信号分量，在所有时间步都重要
- **高频（f 大）**：G_t(f) 随时间步演进而变化 → 早期低（噪声主导），后期高（细节内容）

### 2.3 增益归一化（Gain Normalization）—— 公式 (7)

**问题**：不同时间步的 G_t(f) 整体能量不同，直接用来滤波会导致跨时间步特征不可比。

**解决方案**：密度归一化（density normalization），强制所有时间步的滤波器在径向频率上的均值恒为 1。

```
ν_t = (1/L · Σ_{f_ℓ∈F} G_t(f_ℓ))^(−1)     —— 归一化因子

G_norm_t(f) = ν_t · G_t(f)                  —— 最终使用的 SEA 滤波器
```

**效果**：G_norm_t 在所有径向频率上的均值恒为 1，与 t 无关。保证跨时间步滤波后特征能量一致，L1 距离可比。

### 2.4 频谱重加权算子 P

```
输入: I_t ∈ R^{H×W×C}（中间层特征）

步骤:
  1. FFT:  I_t → ̂I_t                        (空间域 → 频域复数谱)
  2. 乘滤波器: ̂I_t(f) × G_norm_t(f)          (按径向频率逐元素乘实数权重)
  3. iFFT: 加权频谱 → P(G_norm_t, I_t)       (频域 → 空间域)

输出: P(G_norm_t, I_t) —— 频谱对齐后的特征
```

> 注：对图像特征用 2D FFT，对视频特征用 3D FFT（空间维 + 时间维）。

### 2.5 频谱感知距离度量 —— 公式 (8)

```
Δ̃_t = L1_rel( P(G_norm_t, I_t),  P(G_norm_{t+1}, I_{t+1}) )
```

其中 L1_rel 是**相对 L1 距离**（用相对距离消除不同输入幅值差异）：

```
L1_rel(a, b) = ||a - b||₁ / ||a||₁
```

### 2.6 动态缓存调度规则

```
算法:
  输入: 阈值 δ, 总步数 T
  初始化: accumulated = 0

  for t = 0, 1, ..., T-1:
      计算 I_t 和 I_{t+1}（当前步和下一步的中间层特征）
      Δ̃_t = L1_rel( P(G_norm_t, I_t), P(G_norm_{t+1}, I_{t+1}) )
      accumulated += Δ̃_t

      if accumulated < δ:
          reuse cached output    # Skip：复用缓存去噪结果，不执行模型前向
      else:
          run denoiser forward   # Refresh：正常前向计算
          update cache           # 更新缓存的输出去噪结果
          accumulated = 0        # 重置累积距离
```

**直观理解**：
- 连续时间步之间 SEA 滤波特征越相似 → Δ̃_t 越小 → 累积越慢 → 能连续跳过更多步
- 特征累积变化超过 δ → 说明内容发生了足够大的变化 → 必须刷新
- **δ 越大** → 越激进地跳过 → 速度越快但质量越低（反之亦然）

---

## 三、核心实验结果（期望复现的指标）

### 3.1 FLUX.1-dev 文生图（50 步，RTX PRO 6000 Blackwell）

| Method | Latency (s) | TFLOPs | PSNR ↑ | LPIPS ↓ | SSIM ↑ |
|--------|-------------|--------|--------|---------|--------|
| Original (50 steps) | 20.9 | 2976 | — | — | — |
| Vanilla 25 steps | 10.5 | 1487 | 15.553 | 0.409 | 0.668 |
| Vanilla 15 steps | 6.4 | 892 | 17.842 | 0.305 | 0.740 |
| TeaCache (δ=0.3) | 11.4 | 1547 | 20.762 | 0.211 | 0.810 |
| TaylorSeer (S=3) | 9.8 | 1191 | 22.783 | 0.163 | 0.828 |
| **SeaCache (δ=0.3)** ⭐ | **9.4** | **1098** | **26.285** | **0.106** | **0.893** |
| TeaCache (δ=0.6) | 7.1 | 892 | 17.214 | 0.348 | 0.714 |
| TaylorSeer (S=5) | 7.5 | 834 | 19.972 | 0.236 | 0.762 |
| **SeaCache (δ=0.6)** ⭐ | **6.4** | **773** | **21.332** | **0.226** | **0.798** |

> 在 ~50% Refresh Ratio 下，SeaCache 比 TeaCache 快 17%、PSNR 高 5.5dB。
> 在 ~30% Refresh Ratio 下，SeaCache 最快且各项指标均碾压所有 baseline。

### 3.2 Wan2.1 1.3B 文生视频（50 步）

| Method | Latency (s) | TFLOPs | PSNR ↑ | LPIPS ↓ | SSIM ↑ |
|--------|-------------|--------|--------|---------|--------|
| Original (50 steps) | 176.3 | 8214 | — | — | — |
| TeaCache (δ=0.09) | 86.6 | 4107 | 20.84 | 0.171 | 0.721 |
| TaylorSeer (S=2) | 93.1 | 4189 | 16.15 | 0.336 | 0.543 |
| **SeaCache (δ=0.2)** ⭐ | **83.9** | **3942** | **26.60** | **0.075** | **0.873** |
| TeaCache (δ=0.15) | 63.6 | 2957 | 18.88 | 0.245 | 0.645 |
| TaylorSeer (S=3) | 67.1 | 2956 | 14.18 | 0.455 | 0.453 |
| **SeaCache (δ=0.35)** ⭐ | **56.6** | **2793** | **21.78** | **0.170** | **0.740** |

### 3.3 HunyuanVideo 文生视频

| Method | Latency (s) | TFLOPs | PSNR ↑ | LPIPS ↓ | SSIM ↑ |
|--------|-------------|--------|--------|---------|--------|
| Original (50 steps) | 182.6 | 14038 | — | — | — |
| Vanilla 25 steps | 93.7 | 7019 | 19.97 | 0.263 | 0.731 |
| TeaCache (δ=0.12) | 98.5 | 6994 | 23.40 | 0.133 | 0.805 |
| TaylorSeer (S=2) | 96.9 | 7299 | 24.14 | 0.152 | 0.820 |
| **SeaCache (δ=0.19)** ⭐ | **90.8** | **6747** | **32.39** | **0.047** | **0.932** |
| TeaCache (δ=0.2) | 64.4 | 4794 | 20.42 | 0.172 | 0.734 |
| TaylorSeer (S=3) | 68.8 | 5053 | 20.42 | 0.242 | 0.733 |
| **SeaCache (δ=0.35)** ⭐ | **58.1** | **4598** | **26.46** | **0.133** | **0.857** |

### 3.4 VBench 排名

| 模型 | SeaCache 排名 (≈50%) | SeaCache 排名 (≈30%) |
|------|----------------------|----------------------|
| HunyuanVideo | **第 1 名** (1.91 vs 第二名 2.03) | **第 1 名** (1.75 vs 第二名 2.09) |
| Wan2.1 1.3B | 第 2 名 (1.97 vs 第一名 1.91) | 第 2 名 (2.13 vs 第一名 1.53) |

### 3.5 SEA 滤波器开销验证

| 模型 | 单样本滤波耗时 | 总延迟 | 开销占比 |
|------|---------------|--------|---------|
| FLUX | 0.058 s | 9.4 s | **0.6%** |
| HunyuanVideo | 0.362 s | 90.8 s | **0.4%** |

> 结论：SEA 滤波开销几乎可忽略不计。

### 3.6 与 MagCache 的对比（补充实验，Appendix）

| 模型 | 方法 | Refresh Ratio | PSNR ↑ | LPIPS ↓ |
|------|------|:---:|--------|---------|
| FLUX 52% | MagCache (δ=0.04) | 52% | 29.96 | 0.056 |
| FLUX 52% | **SeaCache (δ=0.215)** | 52% | **30.37** | **0.053** |
| FLUX 34% | MagCache (δ=0.15) | 34% | 24.73 | 0.126 |
| FLUX 34% | **SeaCache (δ=0.4)** | 34% | **24.97** | **0.123** |
| Wan2.1 50% | MagCache (δ=0.055) | 50% | 25.55 | 0.079 |
| Wan2.1 50% | **SeaCache (δ=0.25)** | 50% | **25.97** | **0.077** |

---

## 四、核心研究型复现实验

> 本节是**研究型复现**的核心：不满足于跑代码对比指标，而是逐项验证论文的**核心主张、理论推导、实验设计**。每条实验含「要验证的 claim」→「实验设计」→「预期结果」→「结果解读方式」→「你的记录」。

---

### 4.1 实验零：理解 G_t(f) 的理论推导（纸笔 + 代码）

#### 4.1.1 要验证的 claim

> 论文 Eq.(5)：在线性去噪假设下，最优 MMSE 估计器的频域响应是 Wiener-filter 形式。

#### 4.1.2 推导过程

**第 1 步：线性混合模型**

扩散/流模型的前向过程可写为：
```
x_t = a_t · x_0 + b_t · ε，  ε ~ N(0, I)
```
其中 a_t, b_t 由噪声 schedule 决定（DPM 和 RF 的 a_t/b_t 定义不同，但形式兼容）。

- 对 DPM（如 DDIM）：a_t = √(ᾱ_t)，b_t = √(1 - ᾱ_t)
- 对 Rectified Flow：a_t = 1 - t，b_t = t（t ∈ [0,1]）

频域版本（Fourier 变换的线性性）：
```
𝒳_t(f) = a_t · 𝒳_0(f) + b_t · ℰ(f)
```

**第 2 步：最优线性去噪（Wiener 滤波）**

假设一个线性去噪滤波器 h_t，其频域响应为 H_t(f)，使得：
```
x̂_0 = h_t ∗ x_t   ⇔   𝒳̂_0(f) = H_t(f) · 𝒳_t(f)
```

最小化 MSE：min E[‖x̂_0 - x_0‖²]

由 Wiener 滤波理论，最优解（假设 x_0 和 ε 独立）：
```
H_t^⋆(f) = a_t · S_x(f) / (a_t² · S_x(f) + b_t²)
```

其中 S_x(f) = E[|𝒳_0(f)|²] 是干净信号 x_0 的功率谱密度。

论文定义 G_t(f) ≜ H_t^⋆(f) —— 这就是 SEA 滤波器的理论基础。

**第 3 步：代入自然图像功率谱先验**

自然图像/视频的功率谱近似遵循幂律：
```
S_x(f) ≃ A · |f|^(-β)
```
- 图像：论文用 β = 2，A = 1
- 视频：论文用 β = 3，A = 1

代入得：
```
G_t(f) = a_t · |f|^(-β) / (a_t² · |f|^(-β) + b_t²)
```

**第 4 步：分析 G_t(f) 的形状**

关键观察——对固定 t，G_t(f) 是 f 的函数：

- 当 |f| → 0（低频/DC）：|f|^(-β) → ∞，因此 G_t(f) → 1/a_t（放大低频信号）
- 当 |f| → ∞（高频极限）：|f|^(-β) → 0，因此 G_t(f) → 0（抑制高频噪声）

但 a_t 随 t 变化（去噪过程中 a_t 递增）：
- **早期（t 大，a_t 小）**：G_t(f) 在低频也很小（因为 a_t 小），只有极低频有微弱响应 → 只恢复最粗的结构
- **后期（t 小，a_t 大）**：G_t(f) 在高频也逐渐增大 → 逐步恢复细节纹理

**→ 这就是"频谱演化"的数学本质。**

#### 4.1.3 你的验证任务

- [ ] 在 paper 上逐行推导 Eq.(4) → Eq.(5)
- [ ] 用 Python 实现对给定 a_t, b_t schedule 的 G_t(f) 计算和可视化
- [ ] 验证：改变 β 值（1.5, 2.0, 2.5, 3.0）会如何改变 G_t(f) 的形状？
- [ ] 验证：DPM schedule vs RF schedule 的 G_t(f) 形状是否如论文所说「nearly identical」？

#### 4.1.4 代码骨架

```python
import numpy as np
import matplotlib.pyplot as plt

def compute_G_t(freqs, a_t, b_t, beta=2.0, A=1.0):
    """
    计算给定径向频率集合上的 G_t(f)
    freqs: shape (L,) 归一化径向频率 [0, 1]
    返回: shape (L,) 的 G_t(f)
    """
    S_x = A * (freqs + 1e-8) ** (-beta)  # 避免除零
    G_t = a_t * S_x / (a_t**2 * S_x + b_t**2)
    return G_t

# 示例：DPM cosine schedule 的 a_t, b_t
# 你需要根据具体模型的 noise scheduler 计算
T = 50
timesteps = np.arange(T)
# TODO: 替换为实际模型的 a_t, b_t
a_ts = np.sqrt(np.linspace(0.001, 0.999, T))  # 示例，非真实值
b_ts = np.sqrt(1 - a_ts**2)

freqs = np.linspace(0, 1, 256)  # 256 个径向频率 bin

plt.figure(figsize=(12, 5))

# 左图: 原始 G_t(f)
plt.subplot(1, 2, 1)
for t in [0, 10, 20, 30, 40, 49]:
    G = compute_G_t(freqs, a_ts[t], b_ts[t])
    plt.plot(freqs, G, label=f't={t} (a_t={a_ts[t]:.2f})')
plt.xlabel('Normalized Radial Frequency f')
plt.ylabel('G_t(f)')
plt.title('Optimal Linear Denoising Response (Fig.4a)')
plt.legend()
plt.grid(True, alpha=0.3)

# 右图: 归一化 G_norm_t(f)
plt.subplot(1, 2, 2)
for t in [0, 10, 20, 30, 40, 49]:
    G = compute_G_t(freqs, a_ts[t], b_ts[t])
    nu = 1.0 / np.mean(G)
    G_norm = nu * G
    plt.plot(freqs, G_norm, label=f't={t}')
plt.xlabel('Normalized Radial Frequency f')
plt.ylabel('G_norm_t(f)')
plt.title('Normalized SEA Filter (Fig.4b)')
plt.legend()
plt.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('G_t_analysis.png', dpi=150)
```

---

### 4.2 实验一：实证测量——去噪轨迹中「频谱演化」到底长什么样？（Fig.1 下半部分）

#### 4.2.1 要验证的 claim

> 「Early steps build low-frequency structure, later steps refine high-frequency detail.」

这绝不是一个显而易见的事实。我们需要**量化**它。

#### 4.2.2 实验设计

**核心思路**：在完整 50 步去噪过程中，每步记录中间特征（或解码到像素），用 FFT 分析其频谱能量分布，追踪低频/高频能量随时间步的演化。

**步骤**：

```
1. 用 FLUX.1-dev / SD 等模型，对固定 prompt 做完整 50 步去噪
2. 「钩子」注册：在每个 denoising step 后，捕获:
   (a) 中间层特征 I_t（论文中实际用来做缓存判断的那层）
   (b) 解码后的图像 x̂_0^t（可选，更直观）
3. 对每步的 I_t 做 2D FFT，按径向频率 bin 聚合能量:
   - 计算每个 (u,v) 的频率距离 r = sqrt(u² + v²)
   - 将 r 量化为 L 个 bin（如 L=128）
   - 每个 bin 的能量 = Σ |FFT(I_t)[u,v]|² for all (u,v) within bin
4. 可视化:
   - 方法 A: 热力图，y 轴=时间步, x 轴=径向频率 bin, 颜色=log 能量
   - 方法 B: 选取 t=0, 10, 20, 30, 40, 49 六条曲线，画径向功率谱
   - 方法 C: 将频谱分成 LF(0-20%)、MF(20-60%)、HF(60-100%) 三带，画三相能量比随 t 的变化
```

#### 4.2.3 预期结果

| 预期 | 具体表现 |
|------|---------|
| **低频能量早期就位** | t 较大的步（如 t=49,40），低频 bin 能量已经接近最终值 |
| **高频能量逐步浮现** | t 越小的步（如 t=10,0），高频 bin 能量越高 |
| **能量"迁移"方向** | 从低频向高频逐步展开，而非同时提升 |
| **稳定时间点** | 存在一个"临界频段"：超过某频率 f_crit 后，早期步能量几乎不增长 |

#### 4.2.4 结果解读

如果观察到：
- ✅ 低频在所有 t 的功率谱中都很高 → 支持"低频早期稳定"
- ✅ 高频功率在后期明显上升 → 支持"高频后期浮现"
- ❌ 所有频率同步增长 → **频谱演化不成立**，论文核心假设有问题

这个实验的结果本身就是很好的可视化素材，复现论文 Fig.1 下半部分的去噪轨迹演示。

#### 4.2.5 代码骨架

```python
import torch
import torch.fft
import numpy as np

def compute_radial_power_spectrum(feature_map, n_bins=128):
    """
    feature_map: (H, W, C) 或 (C, H, W) numpy/torch tensor
    返回: (n_bins,) 的径向平均功率谱
    """
    if isinstance(feature_map, torch.Tensor):
        feature_map = feature_map.detach().cpu().numpy()
    
    # 对每个 channel 做 2D FFT
    if feature_map.shape[0] < feature_map[1]:  # C 在前
        feature_map = np.moveaxis(feature_map, 0, -1)  # -> H,W,C
    
    H, W, C = feature_map.shape
    fft = np.fft.fft2(feature_map, axes=(0, 1))
    fft_shifted = np.fft.fftshift(fft, axes=(0, 1))
    power = np.abs(fft_shifted) ** 2  # (H, W, C)
    
    # 径向 bin 索引
    u = np.arange(H) - H // 2
    v = np.arange(W) - W // 2
    U, V = np.meshgrid(u, v, indexing='ij')
    r = np.sqrt(U**2 + V**2)  # (H, W)
    
    max_r = np.sqrt((H//2)**2 + (W//2)**2)
    bin_edges = np.linspace(0, max_r, n_bins + 1)
    
    radial_power = np.zeros(n_bins)
    for i in range(n_bins):
        mask = (r >= bin_edges[i]) & (r < bin_edges[i+1])
        if mask.sum() > 0:
            radial_power[i] = power[mask].mean()
    
    return radial_power

# 主循环：记录每个 step 的功率谱
power_spectra_over_time = []
for t in range(T):
    # ... 执行一步去噪 ...
    # feature = denoiser(...)
    feat = get_intermediate_feature(model, layer_name='some_layer')  # TODO
    ps = compute_radial_power_spectrum(feat, n_bins=128)
    power_spectra_over_time.append(ps)

power_spectra_over_time = np.stack(power_spectra_over_time)  # (T, 128)

# 可视化：热力图
import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.imshow(np.log1p(power_spectra_over_time.T), 
           aspect='auto', origin='lower',
           extent=[0, T-1, 0, 128],
           cmap='inferno')
plt.colorbar(label='log(1 + power)')
plt.xlabel('Timestep t')
plt.ylabel('Radial Frequency Bin (0=low, 127=high)')
plt.title('Spectral Evolution: Power Spectrum vs Denoising Step')
plt.gca().invert_xaxis()  # 早期在右，晚期在左（与论文一致）
plt.tight_layout()
plt.savefig('spectral_evolution_heatmap.png', dpi=150)
```

---

### 4.3 实验二：G_t(f) 的实证提取——从真实模型中测量频域去噪响应

#### 4.3.1 要验证的 claim

> 论文 Eq.(5) 的 Wiener-filter 形式 G_t(f) 能**准确近似**真实扩散模型的频域行为。

论文的 G_t(f) 是**理论推导**的——基于"线性去噪器"的简化假设。真实扩散模型是非线性的（带 attention、MLP 等），这个近似到底有多好？

#### 4.3.2 实验设计

**核心思路**：对真实模型，通过"输入一个纯净频率分量，测量输出"来经验性地测量模型在每个时间步、每个频率上的增益。

**方法一：合成频率探针（最直接但开销大）**

```
1. 构造 N 个"纯频率"输入 x_0^(k)，每个只含一个窄频带分量
   例如：用带通滤波白噪声，或直接用逆 FFT 合成
2. 对每个频率，走完整 50 步去噪，记录 denoiser 输出的频率响应
3. 对比：理论 G_t(f) vs 实测 G_t(f) —— 画散点图
```

这个方法计算量大（N×50 次前向），不适合高分辨率模型。以下方法更实用。

**方法二：白噪声响应法（推荐）**

```
1. 选一个固定 x_0（如自然图像），加噪声到不同 t 得到 x_t
2. 对 x_t 做 FFT，记录 |𝒳_t(f)|，作为输入能量谱
3. 用模型预测 ε̂_θ(x_t, t)，再通过 Tweedie 公式估计 x̂_0
4. 对 x̂_0 做 FFT，记录 |𝒳̂_0(f)|
5. 实测增益：G_empirical_t(f) = |𝒳̂_0(f)| / |𝒳_t(f)|
6. 对多个 x_0 取平均，得到经验 G_t(f)
7. 与理论 Eq.(5) 对比
```

**方法三：denoiser 响应法（最接近论文逻辑）**

```
1. 对中间层特征 I_t（而非最终输出），直接分析其频域行为
2. 注册 hook 获取 I_t
3. 对 I_t 做 FFT，分析不同频率分量的能量随时间步的变化
4. 定义"相对增益"：G_rel(f) = E_t[|I_t(f)|] / max_t E_t[|I_t(f)|]
5. 与理论 G_norm_t(f) 对比形状
```

#### 4.3.3 预期结果

| 维度 | 理论预测 | 实证检验 |
|------|---------|---------|
| G_t(f) 形状 | 单调递减（低通） | 实测 ≈ 单调递减，但可能有 ripple |
| 早期 t 的低通程度 | cutoff 频率很低 | 实测 cutoff 是否匹配 |
| 非线性效应 | 不存在 | 观察实测是否有理论无法解释的偏差 |
| DPM vs RF 一致性 | "nearly identical" | 实测两种模型的 G_t(f) 是否确实相似 |

#### 4.3.4 结果解读

- 如果实测 G_t(f) 与理论吻合良好 → 线性去噪近似成立，SEA 滤波器理论基础坚实
- 如果存在系统性偏差（如实测高频响应高于理论） → 说明非线性去噪有额外机制恢复了高频，SEA 滤波器可能需要修正
- 这本身就是一篇 workshop/short paper 的素材

#### 4.3.5 代码骨架

```python
def extract_empirical_G_t(model, pipe, x_0, timesteps, scheduler):
    """
    对单一 x_0，在所有 t 上测量经验 G_t(f)
    
    返回: dict {t: G_t(f) array of shape (n_bins,)}
    """
    empirical_G = {}
    
    for t in timesteps:
        # 构造 x_t = a_t * x_0 + b_t * noise
        a_t, b_t = get_coefficients(scheduler, t)
        noise = torch.randn_like(x_0)
        x_t = a_t * x_0 + b_t * noise
        
        # 模型预测噪声
        with torch.no_grad():
            eps_pred = model(x_t, t)
        
        # Tweedie 公式估计 x̂_0
        x_0_hat = (x_t - b_t * eps_pred) / a_t
        
        # FFT 分析
        fft_input = torch.fft.fft2(x_t)
        fft_output = torch.fft.fft2(x_0_hat)
        
        # 径向功率谱
        ps_input = compute_radial_power_spectrum_from_fft(fft_input)
        ps_output = compute_radial_power_spectrum_from_fft(fft_output)
        
        # 经验增益
        G_emp = ps_output / (ps_input + 1e-8)
        empirical_G[t.item()] = G_emp
    
    return empirical_G

# 对比理论 G_t(f) 和实测 G_t(f)
# 画图: x 轴径向频率, y 轴 G_t(f), 多条曲线 = 不同 t,
#       实线=理论, 虚线=实测
```

---

### 4.4 实验三：增益归一化的必要性验证

#### 4.4.1 要验证的 claim

> 原始 G_t(f) 在不同时间步的整体能量差异很大，不做归一化会导致跨时间步特征能量不一致、L1 距离不可比；密度归一化（Eq.7）解决了这个问题。

#### 4.4.2 实验设计

```
1. 用理论公式（或实测）计算所有 t 的 G_t(f)
2. 对每个 t，计算 G_t 在径向频率上的均值 μ_t
3. 画 μ_t 随 t 的变化曲线 → 预期：μ_t 在不同 t 之间波动很大
4. 计算 G_norm_t（密度归一化后），验证所有 t 的均值都 = 1
5. 验证「非归一化滤波器」带来的特征能量不匹配:
   - 取 I_t 和 I_{t+1}（从真实去噪轨迹中）
   - 分别用 G_t 和 G_norm_t 滤波
   - 比较滤波后特征的 ‖·‖₂ 比率: ‖P(G_t, I_t)‖ / ‖P(G_{t+1}, I_{t+1})‖
   - 归一化后这个比率应接近 1.0
```

#### 4.4.3 预期结果

| 指标 | 未归一化 | 归一化后 |
|------|---------|---------|
| E[G_t(f)] 的跨 t 方差 | 很大 | 0（全部=1） |
| 滤波后特征能量比（跨相邻步） | 偏离 1.0 明显 | 接近 1.0 |
| L1 距离的跨 t 可比性 | 差（混杂能量变化） | 好（只反映内容变化） |

---

### 4.5 实验四：核心消融——Raw L1 vs SEA-filtered L1 的距离质量对比

#### 4.5.1 要验证的 claim

> 这是 SeaCache 最核心的 claim：**SEA 滤波后的 L1 距离比原始特征的 L1 距离更能反映"内容变化"而非"噪声波动"。**

#### 4.5.2 实验设计

```
1. 运行完整 50 步去噪，记录每一步的:
   - 中间层特征 I_t（如 FLUX 的某个 transformer block 输出）
   - 解码图像 x̂_t（只用于分析，不参与距离计算）

2. 对每个相邻步对 (t, t+1)，计算:
   - d_raw_t = L1_rel(I_t, I_{t+1})           # 原始特征 L1
   - d_sea_t = L1_rel(P(G_norm_t, I_t),       # SEA 滤波后 L1
                       P(G_norm_{t+1}, I_{t+1}))

3. 定义「真实内容变化」的代理（ground-truth proxy）:
   - Δ_image_t = LPIPS(x̂_t, x̂_{t+1})  或  PSNR(x̂_t, x̂_{t+1})
   - 解码图像的变化应该反映实际视觉内容的变化

4. 计算相关性:
   - Pearson_corr(d_raw, Δ_image)   # 预期：弱相关（早期受噪声干扰）
   - Pearson_corr(d_sea, Δ_image)   # 预期：强相关

5. 分阶段分析:
   - 早期（t > 30）：高噪声步
   - 中期（15 < t ≤ 30）
   - 后期（t ≤ 15）：低噪声步
   - 按阶段分别算相关性

6. 可视化:
   - 双 y 轴图：x 轴 = t，y1 = d_raw & d_sea（两条曲线），y2 = Δ_image
   - 散点图：x = 特征距离，y = Δ_image，两种颜色（raw vs sea）
```

#### 4.5.3 预期结果

| 阶段 | Raw L1 与内容变化的相关性 | SEA L1 与内容变化的相关性 |
|------|:---:|:---:|
| 早期（高噪声）| **弱**（噪声主导距离） | **中等偏强**（噪声被抑制） |
| 中期 | 中等 | **强** |
| 后期（低噪声）| 强 | **强**（两者接近） |
| **整体** | 中等 | **高** |

**关键预期**：在高噪声早期步，d_raw 显著大于 d_sea（因为 raw 把噪声波动也算进去了），但 Δ_image 其实不大（图像还没开始变化）。这意味着 raw distance 会在不该 refresh 的时候误触发 refresh。

#### 4.5.4 结果解读

- ✅ SEA L1 在所有阶段与内容变化的相关性都 ≥ raw L1 → SEA 滤波器有效
- ✅ 早期差距最大 → 支持"噪声抑制"的 claim
- ❌ SEA L1 不如 raw L1（比如早期相关性反而下降） → SEA 滤波器可能有问题
- ❌ 两者相关性都很弱 → 说明 L1 距离（无论滤波与否）可能不是好的冗余度量

#### 4.5.5 代码骨架

```python
def run_ablation_distance_quality(pipe, prompt, T=50):
    """
    运行一次完整去噪，收集 raw L1 和 SEA L1 距离序列
    """
    d_raw_list = []
    d_sea_list = []
    delta_image_list = []
    
    # 初始化
    latents = pipe.prepare_latents(...)
    
    # 注册 hook 获取中间特征
    features = {}
    def hook_fn(module, input, output):
        features['current'] = output.detach().clone()
    # register_hook_on_target_layer(model, hook_fn)
    
    prev_feat = None
    prev_image = None
    
    for t in timesteps:
        # 执行去噪步
        latents = scheduler_step(pipe, latents, t)
        
        # 获取当前特征
        curr_feat = features['current']  # (C, H, W) 或 (B, C, H, W)
        
        if prev_feat is not None:
            # Raw L1
            d_raw = L1_rel(prev_feat, curr_feat)
            d_raw_list.append(d_raw)
            
            # SEA L1
            prev_feat_sea = apply_SEA_filter(prev_feat, G_norm_table[t_prev])
            curr_feat_sea = apply_SEA_filter(curr_feat, G_norm_table[t])
            d_sea = L1_rel(prev_feat_sea, curr_feat_sea)
            d_sea_list.append(d_sea)
            
            # 解码图像距离
            img_prev = decode(pipe, prev_latent)
            img_curr = decode(pipe, latents)
            delta_img = LPIPS(img_prev, img_curr)  # 或 PSNR
            delta_image_list.append(delta_img)
        
        prev_feat = curr_feat
        prev_latent = latents.clone()
        t_prev = t
    
    return {
        'd_raw': np.array(d_raw_list),
        'd_sea': np.array(d_sea_list),
        'delta_image': np.array(delta_image_list),
    }

def L1_rel(a, b):
    return torch.norm(a - b, p=1) / (torch.norm(a, p=1) + 1e-8)
```

---

### 4.6 实验五：缓存决策行为的对比——为什么 SEA 能做出更好的 skip/refresh 决策？

#### 4.6.1 要验证的 claim

> 在相同的 Refresh Ratio 约束下，SEA 滤波引导的缓存策略比 raw L1 策略选择跳过的步更合理（跳过噪声变化大的步、保留内容变化大的步）。

#### 4.6.2 实验设计

```
1. 对同一个 prompt，运行三个版本:
   (A) 无缓存（original 50 步，作为 ground truth）
   (B) Raw L1 缓存（调节 δ 使 Refresh Ratio ≈ 50%）
   (C) SEA L1 缓存（调节 δ 使 Refresh Ratio ≈ 50%）

2. 记录每个版本在每个时间步的决策:
   - 'skip' 或 'refresh'
   - 累积距离 accumulated

3. 分析:
   - 两个版本在哪些时间步的决策不同？
   - 分歧步中，哪个版本更"正确"？（用解码图像变化做参考）
   - 画出决策热力图：x=时间步, y={B, C}, 颜色=refresh(红) / skip(蓝)

4. 定量指标:
   - 「误 skip 率」：skip 了但内容实际在变化的步 / 总 skip 步
   - 「误 refresh 率」：refresh 了但内容几乎不变的步 / 总 refresh 步
   - (A) 作为 ground truth，定义"真正需要 refresh"的步为 Δ_image_t > threshold
```

#### 4.6.3 预期结果

| 指标 | Raw L1 缓存 | SEA L1 缓存 |
|------|:---:|:---:|
| 误 skip 率 | 较高（早期噪声步被跳过，但内容也在变） | **低** |
| 误 refresh 率 | **高**（噪声波动触发不必要的 refresh） | 低 |
| Refresh 分布 | 随机/均匀 | 集中在内容变化大的步 |

---

### 4.7 实验六：中间层选择的影响

#### 4.7.1 背景

论文未详述选择模型哪一层的特征来计算距离。不同层的特征可能处于不同的抽象级别，频谱演化模式可能不同。这一步对于理解方法适用范围很重要。

#### 4.7.2 实验设计

```
1. 选取 FLUX transformer 的 3-5 个不同深度的层（浅层/中层/深层）
2. 对每一层，重复实验一（频谱演化可视化）和实验四（距离质量）
3. 对比:
   - 哪一层的频谱演化最明显？
   - 哪一层的 SEA 滤波改善最大？
   - 浅层 vs 深层的 G_t(f) 是否需要不同的 β？
```

#### 4.7.3 预期观察

- 浅层：更接近像素级信息，频谱演化可能更明显，β 接近 2
- 深层：更抽象语义，频谱概念可能弱化
- 论文可能选择了频谱演化最明显的那层

---

### 4.8 实验七：β 参数的敏感性分析

#### 4.8.1 要验证的 claim

> 论文声称 β=2（图像）/ β=3（视频）是合理的自然图像功率谱先验，且方法对 β 选择不敏感。

#### 4.8.2 实验设计

```
1. 固定其他条件（模型、中间层、δ），变化 β ∈ {1.0, 1.5, 2.0, 2.5, 3.0, 3.5}
2. 对每个 β：
   - 重新计算 G_t(f) 和 G_norm_t(f)
   - 重复实验四（距离质量）
   - 记录与内容变化的相关性
3. 画 β vs 相关性曲线
4. 同时评估：β 变化对最终加速比和图像质量的影响
```

#### 4.8.3 预期结果

- 相关性在 β=2 附近达到峰值（对自然图像）
- β 在 [1.5, 2.5] 范围内性能下降不明显 → 方法鲁棒

---

## 五、环境配置与代码获取

### 5.1 获取代码

```bash
git clone https://github.com/jiwoogit/SeaCache.git
cd SeaCache
```

### 5.2 硬件要求

| 模型 | 最低显存 | 推荐 GPU |
|------|---------|---------|
| FLUX.1-dev | ~24 GB | RTX 4090 / A100 / RTX PRO 6000 |
| Wan2.1 1.3B | ~16 GB | RTX 4090 / A100 |
| HunyuanVideo | ~45+ GB | A100 80GB / H100 |

> 大部分研究型实验（4.1-4.7）可在 RTX 4090 上用 FLUX.1-dev 完成。

### 5.3 软件环境

```bash
Python >= 3.10
PyTorch >= 2.0
CUDA >= 11.8

pip install torch torchvision
pip install diffusers transformers accelerate
pip install opencv-python scipy numpy matplotlib
pip install lpips  # 用于 LPIPS 计算
pip install imageio[ffmpeg]  # 视频相关
```

### 5.4 模型权重

| 模型 | HuggingFace 路径 |
|------|-----------------|
| FLUX.1-dev | `black-forest-labs/FLUX.1-dev` |
| Wan2.1 T2V 1.3B | `Wan-AI/Wan2.1-T2V-1.3B` |
| HunyuanVideo | `tencent/HunyuanVideo` |

---

## 六、实验执行顺序与优先级

建议按以下顺序执行：

| 优先级 | 实验 | 依赖 | 预计耗时 | 产出类型 |
|:---:|------|------|:---:|------|
| 🔴 P0 | 4.1 G_t(f) 理论推导与可视化 | 无 | 2h | 理解 + 图 |
| 🔴 P0 | 4.2 频谱演化实证测量 | 需要跑模型 | 4h | 核心实验证据 |
| 🟡 P1 | 4.4 增益归一化验证 | 4.1 | 1h | 消融证据 |
| 🟡 P1 | 4.5 Raw vs SEA 距离质量 | 4.2 + 4.4 | 6h | **最重要消融** |
| 🟢 P2 | 4.3 G_t(f) 实证提取 | 4.1 + 4.2 | 8h | 深入验证 |
| 🟢 P2 | 4.6 缓存决策行为对比 | 4.5 | 4h | 定性分析 |
| ⚪ P3 | 4.7 中间层选择 | 4.5 | 6h | 辅助分析 |
| ⚪ P3 | 4.8 β 敏感性 | 4.5 | 4h | 鲁棒性验证 |

---

## 七、完整验证清单

复现完成后逐项确认：

**理论理解**
- [ ] 能从头推导 Eq.(4) → Eq.(5)（Wiener 滤波在扩散模型频域的应用）
- [ ] 能解释为什么 G_t(f) 的形状随 t 从"尖锐低通"变为"接近全通"
- [ ] 能解释密度归一化为什么必要（跨时间步能量一致性）

**实证验证**
- [ ] 频谱演化热力图（实验 4.2）：低频先稳定、高频后浮现，能量迁移清晰可见
- [ ] G_t(f) 理论曲线（实验 4.1）：与论文 Fig.4a 一致
- [ ] G_norm_t(f) 归一化曲线（实验 4.4）：所有 t 均值=1，与论文 Fig.4b 一致
- [ ] Raw vs SEA L1 相关性对比（实验 4.5）：SEA 与内容变化相关性显著更高
- [ ] 早期高噪声步：Raw L1 显著大于 SEA L1（噪声被抑制的直接证据）
- [ ] 误 skip / 误 refresh 率（实验 4.6）：SEA 版本更低

**工程复现（可选）**
- [ ] FLUX.1-dev δ=0.3：加速比 ≈ 2.2x
- [ ] FLUX.1-dev δ=0.6：加速比 ≈ 3.3x
- [ ] PSNR/LPIPS/SSIM 与论文基本一致（允许 ±1-2dB）
- [ ] SEA 滤波开销 < 总时间 1%

---

## 八、常见问题与排查

### 8.1 如何获取特定模型的时间步 schedule（a_t, b_t）

```python
from diffusers import FluxPipeline
pipe = FluxPipeline.from_pretrained("black-forest-labs/FLUX.1-dev")
scheduler = pipe.scheduler

# 对于 DDIM/DDPM scheduler:
# a_t = sqrt(alphas_cumprod[t])
# b_t = sqrt(1 - alphas_cumprod[t])
alphas_cumprod = scheduler.alphas_cumprod

# 对于 Flow Matching scheduler (如 FLUX):
# 需要根据 scheduler 的具体公式计算
# 通常: a_t = 1 - sigma_t, b_t = sigma_t  (或其他映射)
```

### 8.2 如何注册 hook 获取中间特征

```python
def register_feature_hook(model, target_module_path):
    """在指定模块注册 forward hook 以捕获中间特征"""
    features = {}
    def hook_fn(module, input, output):
        if isinstance(output, tuple):
            features['value'] = output[0].detach()
        else:
            features['value'] = output.detach()
    
    # 通过模块名访问
    for name, module in model.named_modules():
        if name == target_module_path:
            handle = module.register_forward_hook(hook_fn)
            return handle, features
    raise ValueError(f"Module {target_module_path} not found")
```

### 8.3 LPIPS 安装与使用

```bash
pip install lpips
```

```python
import lpips
loss_fn = lpips.LPIPS(net='alex').cuda()  # 或 'vgg'

# img0, img1: (1, 3, H, W) tensors in [-1, 1] or [0, 1]
d = loss_fn(img0, img1)
```

### 8.4 实验中多个 prompt 的选择

为得到稳定的统计结论，建议使用 ≥ 10 个不同 prompt。可选用：
- MS-COCO 验证集的 30 个随机 caption
- 论文中使用的 prompt 集合（如能从开源代码中获取）
- 自选 10-20 个涵盖不同场景（人像、风景、物体、抽象）的 prompt

### 8.5 OOM 处理

- batch size = 1
- `pipe.enable_model_cpu_offload()`
- 如果分析中间特征导致 OOM，可考虑只保存 FFT 聚合后的径向功率谱（远小于原始特征）

---

## 九、参考资料

- 论文 PDF: https://arxiv.org/pdf/2602.18993
- 论文 HTML: https://arxiv.org/html/2602.18993v2
- CVPR 2026 OpenAccess: https://openaccess.thecvf.com/content/CVPR2026/papers/Chung_SeaCache_Spectral-Evolution-Aware_Cache_for_Accelerating_Diffusion_Models_CVPR_2026_paper.pdf
- 补充材料: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Chung_SeaCache_Spectral-Evolution-Aware_Cache_CVPR_2026_supplemental.pdf
- GitHub: https://github.com/jiwoogit/SeaCache
- HuggingFace: https://huggingface.co/papers/2602.18993
- 相关阅读: [Diffusion is spectral autoregression](https://sander.ai/2024/09/02/spectral-autoregression/) (Sander Dieleman)
- 相关阅读: [Diffusion is not necessarily Spectral Autoregression](https://fabianfalck.github.io/2025/08/06/diffusion-spectral-autoregression.html) (Fabian Falck)
- 相关阅读: [FreSca: Scaling in Frequency Space Enhances Diffusion Models](https://generative-vision.github.io/workshop-CVPR-25/papers/54.pdf)

---

> 📝 研究型复现记录：
> 
> | 日期 | 实验编号 | 模型 | 关键结果 | 是否与论文一致 | 备注 |
> |------|:---:|------|------|:---:|------|
> | | 4.1 | — | G_t(f) 理论曲线 | | |
> | | 4.2 | FLUX | 频谱演化热力图 | | |
> | | 4.4 | — | 归一化前后 μ_t 对比 | | |
> | | 4.5 | FLUX | Raw vs SEA 相关性 | | |
> | | 4.3 | FLUX | 实测 G_t(f) vs 理论 | | |
> | | 4.6 | FLUX | 误 skip/refresh 率 | | |
> | | 4.7 | FLUX | 不同层频谱演化对比 | | |
> | | 4.8 | FLUX | β 敏感性曲线 | | |
> 
> 📝 工程复现记录：
> 
> | 日期 | 模型 | δ | 延迟 | PSNR | LPIPS | SSIM | GPU | 加速比 | 备注 |
> |------|------|---|------|------|-------|------|-----|:---:|------|
> | | | | | | | | | | |
