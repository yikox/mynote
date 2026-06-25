# SeaCache 论文复现笔记

> 论文: SeaCache: Spectral-Evolution-Aware Cache for Accelerating Diffusion Models
> CVPR 2026 Oral, Best Paper Finalist
> arXiv: https://arxiv.org/abs/2602.18993
> 代码: https://github.com/jiwoogit/SeaCache

---

## 0. 前置实验

### 实验 0.1：可视化去噪轨迹的频谱演化（Fig.1 下半部分）

取一张猫图，逐时间步观察去噪过程：

| 时间步 | 图像表现 | 频谱特征 |
|--------|---------|---------|
| 早期（噪声多） | 模糊轮廓 | 低频结构先出现 |
| 后期（噪声少） | 毛发纹理清晰 | 高频细节后出现 |

**结论**：扩散模型存在频谱演化——低频在前、高频在后。

### 实验 0.2：Oracle 实验（Fig.2）

以 FLUX/Wan2.1 的 50 步全量输出为 ground truth，比较两种缓存决策标准：
- Raw output：原始输出跨步 L1 距离
- SEA-filtered output：SEA 滤波后输出的跨步 L1 距离

**结果**：相同 Refresh Ratio 下 SEA-filtered 的 PSNR 始终更高。频谱感知的距离更接近全量计算轨迹。

---

## 1. 思考

现有方法（TeaCache 等）用原始特征算距离 → 内容+噪声纠缠 → 早期噪声被误判为内容变化。

**核心思路**：计算距离前先做频域滤波（放大内容分量、抑制噪声分量）。

拆出三个子问题：
1. 滤波器怎么设计？（不同 t 应有不同频率响应）
2. 跨步距离怎么归一化？（不同 t 特征能量不同）
3. 能否用输入侧 proxy 代替输出？（输出必须先跑 forward → 无加速）

---

## 2. 实验：逐步构建 SeaCache

### 实验 2.1：推导 SEA 滤波器 G_t(f)（Fig.4a）

用最优线性去噪器（Wiener filter 视角）刻画频域行为。扩散模型一步近似为：

```
x_t = a_t · x_0 + b_t · ε,   ε ~ N(0, I)
```

x_0 宽平稳（功率谱 1/f 衰减），ε 白噪声（S_ε=1），二者独立。最优频率响应：

```
G_t(f) = a_t² · S_{x_0}(f) / (a_t² · S_{x_0}(f) + b_t²)
```

**观察**：

| 时间步 | a_t | b_t | G_t(f) 行为 |
|--------|:---:|:---:|------|
| 早期 (τ≈0.31) | 小 | 大 | 仅低频通过 → 低通滤波器 |
| 中期 (τ≈0.82) | 中 | 中 | 低频+部分中频通过 |
| 后期 (τ≈1.0) | 大 | ≈0 | 全频段通过 → 近似恒等 |

**结论**：G_t(f) 精确刻画了频谱演化——早期低通，后期全通。

### 实验 2.2：增益归一化（Fig.4b）

**问题**：不同 t 的 G_t(f) 整体能量不同，滤波后特征能量随 t 变化 → 跨步距离不可比。

**解决**：密度归一化：

```
ν_t = (1/L · Σ G_t(f_ℓ))^(−1)
G_norm_t(f) = ν_t · G_t(f)
```

G_norm_t 在所有径向频率上均值恒为 1，保留频率选择性但统一能量尺度。这就是最终的 SEA 滤波器。

### 实验 2.3：找输入侧 proxy（Fig.5）

FLUX 和 Wan2.1 各取 10 样本，沿去噪轨迹逐步计算五种特征的跨步 L1_rel 距离：
- Input / Output / Poly(input) / SEA(input) / SEA(output)

**观察**：
- SEA(input) 和 SEA(output) 的距离曲线高度吻合，几乎重叠
- 原始 Input、Poly(input) 曲线偏离严重，尤其早期噪声大时
- SEA(input) 在早期距离天然较大 → 早期步不易被跳过（合理行为）

**结论**：SEA(input) 是 SEA(output) 的高质量 proxy——不需要跑 forward，是核心设计决策。

### 实验 2.4：组装完整 pipeline

```
对相邻时间步 t 和 t+1：
1. 取 I_t, I_{t+1} → FFT → 乘 G_norm_t(f) → iFFT → P(G_norm_t, I_t)
2. Δ̃_t = L1_rel( P(G_norm_t,I_t), P(G_norm_{t+1},I_{t+1}) )
3. accumulated += Δ̃_t
4. if accumulated < δ: Skip else: Refresh + 重置 accumulated
```

---

## 3. 结论

三句话：
1. 频谱演化是扩散模型固有特性——早期低频、后期高频（实验 0.1）
2. 频谱感知距离比原始特征更准（实验 0.2）
3. SEA(input) ≈ SEA(output)——不需要跑 forward 就能接近 oracle 质量（实验 2.3）

SEA 滤波开销仅 0.4%~0.6%，几乎免费。训练无关、即插即用。

---

## 4. 结果

### 4.1 FLUX.1-dev（Table 1，RTX PRO 6000 Blackwell）

| Method | Latency (s) | TFLOPs | PSNR ↑ | LPIPS ↓ | SSIM ↑ |
|--------|:---:|:---:|:---:|:---:|:---:|
| Original (50 steps) | 20.9 | 2976 | — | — | — |
| TeaCache (δ=0.3) | 11.4 | 1547 | 20.76 | 0.211 | 0.810 |
| TaylorSeer (S=3) | 9.8 | 1191 | 22.78 | 0.163 | 0.828 |
| **SeaCache (δ=0.3)** | **9.4** | **1098** | **26.29** | **0.106** | **0.893** |
| TeaCache (δ=0.6) | 7.1 | 892 | 17.21 | 0.348 | 0.714 |
| TaylorSeer (S=5) | 7.5 | 834 | 19.97 | 0.236 | 0.762 |
| **SeaCache (δ=0.6)** | **6.4** | **773** | **21.33** | **0.226** | **0.798** |

δ=0.3：比 TeaCache 快 17%，PSNR 高 5.5dB

### 4.2 Wan2.1 1.3B T2V（Table 4）

| Method | Latency (s) | PSNR ↑ | LPIPS ↓ | SSIM ↑ |
|--------|:---:|:---:|:---:|:---:|
| Original (50 steps) | 176.3 | — | — | — |
| TeaCache (δ=0.09) | 86.6 | 20.84 | 0.171 | 0.721 |
| TaylorSeer (S=2) | 93.1 | 16.15 | 0.336 | 0.543 |
| **SeaCache (δ=0.2)** | **83.9** | **26.60** | **0.075** | **0.873** |
| TeaCache (δ=0.15) | 63.6 | 18.88 | 0.245 | 0.645 |
| **SeaCache (δ=0.35)** | **56.6** | **21.78** | **0.170** | **0.740** |

### 4.3 HunyuanVideo

| Method | Latency (s) | PSNR ↑ | LPIPS ↓ | SSIM ↑ |
|--------|:---:|:---:|:---:|:---:|
| Original (50 steps) | 182.6 | — | — | — |
| TeaCache (δ=0.12) | 98.5 | 23.40 | 0.133 | 0.805 |
| TaylorSeer (S=2) | 96.9 | 24.14 | 0.152 | 0.820 |
| **SeaCache (δ=0.19)** | **90.8** | **32.39** | **0.047** | **0.932** |
| TeaCache (δ=0.2) | 64.4 | 20.42 | 0.172 | 0.734 |
| **SeaCache (δ=0.35)** | **58.1** | **26.46** | **0.133** | **0.857** |

### 4.4 VBench 排名

| 模型 | 预算 | SeaCache | 对比 |
|------|------|:---:|------|
| HunyuanVideo | ≈50% | **第 1** (1.91) | TeaCache 2.03 / TaylorSeer 2.06 |
| HunyuanVideo | ≈30% | **第 1** (1.75) | TeaCache 2.16 / TaylorSeer 2.09 |
| Wan2.1 1.3B | ≈50% | 第 2 (1.97) | 第 1 名 1.91 |

### 4.5 SEA 滤波开销

| 模型 | 滤波耗时 | 总延迟 | 占比 |
|------|:---:|:---:|:---:|
| FLUX | 0.058 s | 9.4 s | 0.6% |
| HunyuanVideo | 0.362 s | 90.8 s | 0.4% |

---

## 5. 复现步骤

```bash
git clone https://github.com/jiwoogit/SeaCache.git && cd SeaCache
pip install torch diffusers transformers accelerate opencv-python imageio[ffmpeg]
```

### FLUX（推荐先复现）

```bash
cd FLUX
# δ=0.3，加速比约 2.2x
python seacache_generate.py --prompt "..." --output_dir ./outputs --seacache_thresh 0.3
# δ=0.6，加速比约 3.3x
python seacache_generate.py --prompt "..." --output_dir ./outputs --seacache_thresh 0.6
# baseline（δ=0 即无缓存）
python seacache_generate.py --prompt "..." --output_dir ./outputs --seacache_thresh 0.0
```

### Wan2.1 1.3B

```bash
cd Wan2.1
python seacache_generate.py --prompt "..." --seacache_thresh 0.2   # 约 83.9s
python seacache_generate.py --prompt "..." --seacache_thresh 0.35  # 约 56.6s
```

### HunyuanVideo（需 A100 80GB+）

```bash
cd HunyuanVideo
python seacache_generate.py --prompt "..." --seacache_thresh 0.19  # 约 90.8s
python seacache_generate.py --prompt "..." --seacache_thresh 0.35  # 约 58.1s
```

### 验证清单

- [ ] FLUX δ=0.3：加速比约 2.2x
- [ ] FLUX δ=0.6：加速比约 3.3x
- [ ] SEA 滤波开销 < 1%
- [ ] 目测质量与 50 步无感知差异
- [ ] PSNR/LPIPS/SSIM 与论文值误差 ±1-2dB 内

---

## 6. 源码关键路径

| 模块 | 实现 | 关注点 |
|------|------|------|
| FFT | torch.fft.fft2 / fftn | 图像 2D，视频 3D |
| 径向频率 bin | H×W 计算每点径向距离 | 按 bin 聚合 |
| G_norm_t 查表 | 预计算 | 按 t 取权重 |
| 频域乘法+iFFT | 逐元素乘 + ifft2 | per-channel |
| L1_rel | norm(a-b,1)/norm(a,1) | 相对距离 |
| 累积+阈值 | accumulated+=Δ̃; if>=δ:refresh | 核心调度 |

---

> 📝 复现记录：
> | 日期 | 模型 | δ | 延迟 | 加速比 | PSNR | LPIPS | SSIM | GPU |
> |------|------|---|------|:---:|------|-------|------|-----|
> | | | | | | | | | |

> 📎 参考：PDF https://arxiv.org/pdf/2602.18993 | 补充材料 https://openaccess.thecvf.com/content/CVPR2026/supplemental/Chung_SeaCache_Spectral-Evolution-Aware_Cache_CVPR_2026_supplemental.pdf
