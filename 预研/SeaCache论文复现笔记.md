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
|                      |                             |                                  |

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

## 四、复现环境与依赖

### 4.1 硬件要求

| 模型 | 最低显存 | 推荐 GPU |
|------|---------|---------|
| FLUX.1-dev | ~24 GB | RTX 4090 / A100 / RTX PRO 6000 |
| Wan2.1 1.3B | ~16 GB | RTX 4090 / A100 |
| HunyuanVideo | ~45+ GB | A100 80GB / H100 |

> 论文使用 NVIDIA RTX PRO 6000 Blackwell 进行 FLUX 实验。

### 4.2 软件环境

```bash
# 基础依赖
Python >= 3.10
PyTorch >= 2.0
CUDA >= 11.8

# 核心 Python 包
pip install torch torchvision
pip install diffusers                    # HuggingFace Diffusers
pip install transformers accelerate
pip install opencv-python
pip install imageio[ffmpeg]              # 视频读写
pip install numpy scipy                  # FFT 相关
```

### 4.3 模型权重下载

| 模型 | HuggingFace 路径 |
|------|-----------------|
| FLUX.1-dev | `black-forest-labs/FLUX.1-dev` |
| Wan2.1 T2V 1.3B | `Wan-AI/Wan2.1-T2V-1.3B` |
| HunyuanVideo | `tencent/HunyuanVideo` |

---

## 五、严格复现步骤

### 5.1 获取代码

```bash
git clone https://github.com/jiwoogit/SeaCache.git
cd SeaCache
```

仓库结构：
```
SeaCache/
├── FLUX/
│   ├── README.md
│   └── seacache_generate.py      # FLUX 推理入口
├── HunyuanVideo/
│   └── ...                        # HunyuanVideo 推理入口
├── Wan2.1/
│   └── ...                        # Wan2.1 推理入口
├── assets/
├── README.md
└── .gitignore
```

### 5.2 复现 FLUX.1-dev 文生图（最推荐先复现）

**目标**：验证 Table 1 中 SeaCache 的两组配置

#### Step 1: 安装依赖

```bash
cd FLUX
pip install torch diffusers transformers accelerate
```

#### Step 2: 运行 SeaCache 推理

```bash
# 中等加速 (δ=0.3，预期延迟 ~9.4s，预期 PSNR ~26.285)
python seacache_generate.py \
    --prompt "a high-resolution photo of a panda drinking coffee in a cozy cafe" \
    --output_dir ./outputs \
    --seacache_thresh 0.3

# 激进加速 (δ=0.6，预期延迟 ~6.4s，预期 PSNR ~21.332)
python seacache_generate.py \
    --prompt "a high-resolution photo of a panda drinking coffee in a cozy cafe" \
    --output_dir ./outputs \
    --seacache_thresh 0.6
```

#### Step 3: 运行 Baseline（对比用）

```bash
# 原始 50 步（无缓存，预期延迟 ~20.9s）
python seacache_generate.py \
    --prompt "a high-resolution photo of a panda drinking coffee in a cozy cafe" \
    --output_dir ./outputs \
    --seacache_thresh 0.0   # δ=0 等效于不做缓存

# 或直接使用 Diffusers 原版 50 步推理作为 baseline
```

#### Step 4: 记录指标

| 配置 | 预期延迟 | 预期 PSNR | 预期 LPIPS | 预期 SSIM | 你的结果 |
|------|:---:|:---:|:---:|:---:|:---:|
| Original 50 steps | 20.9s | — | — | — | |
| SeaCache δ=0.3 | 9.4s | 26.285 | 0.106 | 0.893 | |
| SeaCache δ=0.6 | 6.4s | 21.332 | 0.226 | 0.798 | |

> 注意：延迟受 GPU 型号影响，论文使用 RTX PRO 6000 Blackwell。如果你用 RTX 4090 等不同 GPU，延迟绝对值会不同，但**加速比**（speedup ratio）应大致一致：δ=0.3 约 2.2x，δ=0.6 约 3.3x。

### 5.3 复现 Wan2.1 1.3B 文生视频

**目标**：验证 Table 4 中 SeaCache 的两组配置

```bash
cd Wan2.1
pip install -r requirements.txt   # 如果有 requirements.txt

# 中等加速 (δ=0.2，预期延迟 ~83.9s)
python seacache_generate.py \
    --prompt "..." \
    --seacache_thresh 0.2

# 激进加速 (δ=0.35，预期延迟 ~56.6s)
python seacache_generate.py \
    --prompt "..." \
    --seacache_thresh 0.35
```

| 配置 | 预期延迟 | 预期 PSNR | 预期 LPIPS | 预期 SSIM | 你的结果 |
|------|:---:|:---:|:---:|:---:|:---:|
| SeaCache δ=0.2 | 83.9s | 26.60 | 0.075 | 0.873 | |
| SeaCache δ=0.35 | 56.6s | 21.78 | 0.170 | 0.740 | |

### 5.4 复现 HunyuanVideo 文生视频

**注意**：HunyuanVideo 需要较大显存（~45GB+），建议用 A100 80GB 或 H100。

```bash
cd HunyuanVideo
pip install -r requirements.txt   # 如果有 requirements.txt

# 中等加速 (δ=0.19，预期延迟 ~90.8s)
python seacache_generate.py \
    --prompt "..." \
    --seacache_thresh 0.19

# 激进加速 (δ=0.35，预期延迟 ~58.1s)
python seacache_generate.py \
    --prompt "..." \
    --seacache_thresh 0.35
```

| 配置 | 预期延迟 | 预期 PSNR | 预期 LPIPS | 预期 SSIM | 你的结果 |
|------|:---:|:---:|:---:|:---:|:---:|
| SeaCache δ=0.19 | 90.8s | 32.39 | 0.047 | 0.932 | |
| SeaCache δ=0.35 | 58.1s | 26.46 | 0.133 | 0.857 | |

---

## 六、核心代码逻辑（阅读源码时关注）

### 6.1 SEA 滤波器的实现位置

在 `seacache_generate.py`（或其他模型对应的推理脚本）中，关注以下关键模块：

```
1. FFT 变换: torch.fft.fft2 (图像) / torch.fft.fftn (视频)
2. 径向频率 bin 计算: 根据 H×W 计算每个频率分量属于哪个径向 bin
3. SEA 滤波器查表: 根据当前时间步 t 取出 G_norm_t，按径向频率索引逐元素乘
4. iFFT 还原: torch.fft.ifft2 / torch.fft.ifftn
5. L1_rel 距离: torch.norm(a-b, p=1) / torch.norm(a, p=1)
6. 累积比较: accumulated += Δ̃_t; if accumulated >= δ: refresh else skip
```

### 6.2 关键超参数

| 参数 | 含义 | FLUX 推荐值 | Wan2.1 推荐值 | HunyuanVideo 推荐值 |
|------|------|:---:|:---:|:---:|
| δ (seacache_thresh) | 累积距离阈值 | 0.3 / 0.6 | 0.2 / 0.35 | 0.19 / 0.35 |
| 总步数 | 去噪步数 | 50 | 50 | 50 |
| 中间层选择 | 取哪一层特征计算距离 | 论文未详述，见源码 | — | — |

---

## 七、常见问题与排查

### 7.1 延迟与论文不一致

- **原因**：GPU 型号不同（论文用 RTX PRO 6000 Blackwell）
- **验证方式**：计算**加速比**（Original 延迟 ÷ SeaCache 延迟），应大致匹配
- FLUX δ=0.3：加速比约 2.2x；δ=0.6：加速比约 3.3x

### 7.2 PSNR/LPIPS 计算

- 需要以 Original 50 步的输出为 reference（ground truth）
- 计算 SeaCache 输出与 reference 之间的 PSNR、LPIPS、SSIM
- 使用多个 prompt（论文通常用 MS-COCO 或其他 benchmark 的 prompt 集合），取平均

### 7.3 OOM（显存不足）

- 减小 batch size（通常 batch=1 即可）
- FLUX 可尝试启用 CPU offload：`pipe.enable_model_cpu_offload()`
- HunyuanVideo 若单卡放不下，需多卡或使用更高显存 GPU

### 7.4 代码运行报错

- 检查 diffusers 版本是否与仓库兼容
- 检查 transformers 版本
- 查看 GitHub Issues 区是否有类似问题

---

## 八、验证清单

复现完成后逐项确认：

- [ ] FLUX.1-dev δ=0.3：延迟在合理范围 + 加速比 ≈ 2.2x
- [ ] FLUX.1-dev δ=0.6：延迟在合理范围 + 加速比 ≈ 3.3x
- [ ] 质量指标（PSNR/LPIPS/SSIM）与论文报告值基本一致（允许 ±1-2dB PSNR 波动）
- [ ] SEA 滤波开销 < 总时间的 1%
- [ ] 对比 TeaCache（如果能运行）: SeaCache 在相同 Refresh Ratio 下 PSNR 明显更高
- [ ] 目测生成图像质量：与 Original 50 步无明显感知差异

---

## 九、参考资料

- 论文 PDF: https://arxiv.org/pdf/2602.18993
- 论文 HTML: https://arxiv.org/html/2602.18993v2
- CVPR 2026 OpenAccess: https://openaccess.thecvf.com/content/CVPR2026/papers/Chung_SeaCache_Spectral-Evolution-Aware_Cache_for_Accelerating_Diffusion_Models_CVPR_2026_paper.pdf
- 补充材料: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Chung_SeaCache_Spectral-Evolution-Aware_Cache_CVPR_2026_supplemental.pdf
- GitHub: https://github.com/jiwoogit/SeaCache
- HuggingFace: https://huggingface.co/papers/2602.18993

---

> 📝 复现记录：
> | 日期 | 模型 | δ | 延迟 | PSNR | LPIPS | SSIM | GPU | 备注 |
> |------|------|---|------|------|-------|------|-----|------|
> | | | | | | | | | |
