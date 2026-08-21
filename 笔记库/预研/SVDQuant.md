# SVDQuant 论文分析

**论文**：*SVDQuant: Absorbing Outliers by Low-Rank Components for 4-Bit Diffusion Models*（ICLR 2025 Spotlight）
**机构**：MIT、Adobe Research、NVIDIA
**GitHub**：`nunchaku-ai/nunchaku`（配套推理引擎 Nunchaku）

---

## 一、背景（一句话）

扩散模型（FLUX.1-dev 12B、SDXL、PixArt-Σ）部署太贵：BF16 占 22.2 GiB，普通消费级 GPU（16GB）必须 CPU offload，速度慢 10 倍。目标：把 **W 和 A 都压到 4-bit**，并在 GPU 上实测加速。

---

## 二、已有方法的不足（一句话）

LLM 的主流 PTQ 方法（如 SmoothQuant）用对角缩放在 W 和 X 之间**重新分配** outliers，但扩散模型激活对量化极敏感，4-bit 下 smoothing 不够用。

---

## 三、SVDQuant 方法（核心）

### 3.1 起点：一次线性层的前向

扩散模型中每个 Transformer block 里的线性层都形如：

$$Y = X W, \quad X \in \mathbb{R}^{n \times c}, \ W \in \mathbb{R}^{c \times d}, \ Y \in \mathbb{R}^{n \times d}$$

- $X$：激活（输入），行数 $n$ = token 数（对于 2D 扩散模型通常是 patch 数），列数 $c$ = 隐藏维
- $W$：权重矩阵，形状 (c, d)
- $Y$：输出，再交给 attention/MLP 的下一个 op

**问题**：$X$ 和 $W$ 里都有 outliers（少数几个通道的值远大于其他通道），把 4-bit 的量化网格撑爆，导致严重的截断误差。

---

### 3.2 Stage 1 — Smoothing：把 X 的 outliers 赶进 W

用一个**对角缩放矩阵** $S = \text{diag}(s_1, ..., s_c)$（每输入通道一个标量）做等价变换：

$$\hat{X} = X \, S^{-1}, \quad \hat{W} = S \, W$$

数学上 $\hat{X}\hat{W} = X S^{-1} \cdot S W = XW = Y$，所以前向结果不变。

> **变量对应**：
> - $S$ 的每个分量 $s_i$ 由校准集按 channel-wise 选出来（通常选 $s_i = \max|X[:,i]|^{1-\alpha} / \max|W[i,:]|^{\alpha}$，$\alpha$ 是迁移强度）
> - $S$ 在量化前**除进 $X$**、**乘进 $W$**，离线完成

**结果**：
- $\hat{X}$ 的 outliers 被压住，分布变平滑 → **好量化**
- $\hat{W}$ 反过来更难量化了（吸收了 outliers）→ **坏量化**

smoothing 走到这一步就停了，所以 smoothing 的 W4A4 效果崩。SVDQuant 的核心是**继续处理**这个"难量化"的 $\hat{W}$。

---

### 3.3 Stage 2 — SVD 拆分：用低秩分支吃掉 outliers

对 $\hat{W}$ 做奇异值分解：

$$\hat{W} = U \Sigma V^\top = \sum_{i=1}^{r} \sigma_i \, u_i v_i^\top + \underbrace{\sum_{i=r+1}^{c} \sigma_i \, u_i v_i^\top}_{\text{小奇异值，截掉}}$$

取前 $r$ 个奇异值（论文用 $r=32$，远小于 $c$），得到**低秩近似**：

$$L_1 = U_r \, \Sigma_r^{1/2} \in \mathbb{R}^{c \times r}, \quad L_2 = \Sigma_r^{1/2} \, V_r^\top \in \mathbb{R}^{r \times d}$$

于是：

$$\hat{W} \approx L_1 L_2 \quad \text{(低秩分支，跑 16-bit)}$$

剩下的**残差**：

$$R = \hat{W} - L_1 L_2 \in \mathbb{R}^{c \times d}$$

> **关键观察**：outliers 通常集中在几个**主导方向**上，对应 SVD 分解中**前几个最大的奇异值**。所以把它们塞进 $L_1 L_2$（一个 $c \times d$ 的矩阵被压缩成 $c \times r + r \times d$）就能吸收。残差 $R$ 的分布变得很"平"，普通 4-bit 量化轻松搞定。

---

### 3.4 完整前向

把上面两步代回去：

$$Y = XW = \hat{X} \hat{W} = \hat{X} (L_1 L_2 + R) = \underbrace{(\hat{X} L_1) L_2}_{\text{低秩分支，16-bit}} + \underbrace{\hat{X} R}_{\text{主分支，4-bit}}$$

**计算图**（每个线性层被替换成）：

```
       X̂ (16-bit) ──┬──► L1 (16-bit, c×r) ──► 中间 (16-bit) ──► L2 (16-bit, r×d) ──┐
                     │                                                                       ├─► 相加 ─► Y
                     └──► Quant(X̂) ──► 4-bit X̂ ──► R (4-bit, c×d) ──► 4-bit GEMM ──────┘
```

> **变量对应**：
> - $\hat{X}$：上一步 smoothing 后的激活，先做 per-channel 4-bit 量化
> - $L_1, L_2$：两个 16-bit 小矩阵，存的是 SVD 分解出的方向 + 奇异值
> - $R$：4-bit 量化后的残差矩阵
> - 中间的 $(\hat{X} L_1)$ 是 $n \times r$ 的小张量（$r=32$ 极小），16-bit 存
> - 最终 $Y$ 累加得到

**总参数增量**：每个线性层多了 $L_1 + L_2$ 共 $r(c+d)$ 个 16-bit 浮点。对于 FLUX.1 这种 12B 模型，全部线性层加起来约 0.3 GiB，相对 22.2 GiB 的节省微不足道。

---

### 3.5 与 Smoothing 的本质区别

| | Smoothing | SVDQuant |
|---|---|---|
| 处理 outliers 的方式 | 在 W/X 之间**重新分配** | 用低秩结构**吸收** |
| W 的精度 | 4-bit | 4-bit（残差）+ 16-bit（低秩）|
| 适合 4-bit 激活吗 | 不够 | 够（双侧都缓解了）|

SVDQuant 名字里 "SVD" 指的就是 Stage 2 这个拆分；"Quant" 指残差 $R$ 和激活 $\hat{X}$ 的 4-bit 量化。

---

## 四、Nunchaku 推理引擎

### 4.1 朴素实现的瓶颈

如果直接按上面的计算图写 4 个独立 CUDA kernel：

| 步骤 | 算子 | 访存特征 |
|---|---|---|
| A | $\hat{X} L_1$（Down Projection）| **读** 16-bit $\hat{X}$，**写** 16-bit 中间张量 |
| B | $(\hat{X} L_1) L_2$（Up Projection）| **读** 16-bit 中间，**写** 16-bit 输出 |
| C | $\text{Quant}(\hat{X})$ | **读** 16-bit $\hat{X}$，**写** 4-bit 量化张量 |
| D | $\hat{X}_q \cdot R$（4-bit GEMM）| **读** 4-bit $\hat{X}_q$ 和 4-bit $R$，**写** 16-bit 输出 |
| E | B + D → Y | **读 + 写** 16-bit |

**问题**：
1. $\hat{X}$ 被读了两遍（A 和 C），多 1 次 16-bit 访存
2. 中间张量 $(\hat{X} L_1)$ 写入 HBM 又读出来，多 1 次 16-bit 访存
3. B 的结果和 D 的结果都要写 16-bit，再相加又写一次

实测下来，rank=32 时**低秩分支引入 57% 延迟开销**，把量化省下的时间全吃回去了。

### 4.2 Nunchaku 的两处 kernel fusion

**Fusion 1：Down Projection + Quantize**

观察到 A 和 C **共用同一个输入 $\hat{X}$**。融合成一个 kernel：
- 一个 thread block 加载 $\hat{X}$ 的 tile
- **同一次访存**内：
  - 算 $\hat{X} L_1$（送进 shared memory 给 16-bit 矩阵乘）
  - 同时做 $\text{Quant}(\hat{X})$（4-bit 量化，结果直接写回 HBM 给后面用）

→ **消除对 $\hat{X}$ 的第二次读**

**Fusion 2：Up Projection + 4-bit GEMM**

观察到 B 和 D **结果直接累加到同一个输出 $Y$**。融合成一个 kernel：
- 用两个独立的 MMA 流水线分别算 $(\hat{X} L_1) L_2$（16-bit 矩阵乘）和 $\hat{X}_q R$（4-bit 矩阵乘）
- **结果在寄存器 / shared memory 里直接相加**，写一次 $Y$ 到 HBM

→ **消除中间 16-bit 输出的 HBM 往返**

融合后实测开销从 57% 压到可接受水平，量化省下的时间真正变成了端到端加速。

### 4.3 其他工程要点

- **自定义 CUTLASS kernel**：4-bit GEMM 不是用 cuBLAS 现成的（它只有 INT8/FP16），需要手写或用 CUTLASS template 实例化
- **NVFP4 支持**：Blackwell 架构（RTX 5090）原生支持 microscaling FP4，group size 更小，Nunchaku 同时出了 FP4 版本
- **LoRA 兼容**：社区 LoRA 本质上就是 $W + A B$（$A$ 和 $B$ 是低秩），Nunchaku 把 LoRA 的 $(A, B)$ 直接合并到 $L_1 L_2$ 同一个数据结构里推理：
  $$\hat{X} L_1' L_2' \quad \text{其中} \ L_1' L_2' = L_1 L_2 + AB$$
  → **不需要重新量化 LoRA**

---

## 五、实验（最简版）

- **模型**：FLUX.1-dev、PixArt-Σ、SANA、SDXL、SDXL-Turbo
- **显存**：FLUX.1-dev 从 22.2 GiB → 6.1 GiB（3.5× 缩减，含 0.3 GiB 低秩开销）
- **速度**：laptop 4090 上 INT4 比 NF4 W4A16 baseline 快 **3.0×**；消除 CPU offload 后比原 BF16 快 **8.7~10.1×**
- **质量**：MJHQ-30K / sDCI 上的 FID/IR/PSNR 接近 BF16，远超 W4A8 baseline

---

## 六、意义（一句话）

**算法（吸收 outliers）+ 系统（kernel fusion）联合设计**，让 12B 扩散模型首次在 16GB 消费级 GPU 上既省显存又真正加速，且无缝兼容 LoRA 生态。
