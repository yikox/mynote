# MX 微缩放族与 NVIDIA NVFP4

> 本文是《浮点精度全景》的第 3 篇，重点：
> - OCP Microscaling Formats (MX) 规范的设计动机与 E8M0 scale 格式
> - MXFP8 / MXFP6 / MXFP4 / MXINT8 全家福
> - NVIDIA NVFP4 与 MXFP4 的差异（三层缩放）
> - IEEE P3109 标准化前沿与 4-bit 训练的可行性

## 1. 动机：当 bit 数降到 4 时

经典格式的精度/范围张力在 4-bit 上达到极限：
- E2M1 FP4 的码点集合只有 $\{-6, -4, -3, -2, -1.5, -1, -0.5, 0, +0.5, +1, +1.5, +2, +3, +4, +6\}$（外加 ±0、subnormal）
- 这 15 个幅度值（加上 0 共 16 个）几乎无法直接拟合深度学习张量

补救思路：**给一小块元素共享一个"外部指数"，把整体量级抬到合适位置**。

$$
\hat{x}_i = \text{FP4}(x_i / \Delta_{\text{block}}), \quad
x_i \approx \hat{x}_i \cdot \Delta_{\text{block}}
$$

其中 $\Delta_{\text{block}}$ 是块共享的 scale。这样：

- 块内每个元素的相对精度仍是 $2^{-m}$（E2M1 下 ~50%）
- 但块的**整体动态范围**被 scale 拉到了指数位的全宽（$2^{e_{\max}}$ 量级）
- 总位 = 元素位 + 共享 scale 位 + 元数据（如适用）

这就是 **OCP Microscaling Formats (MX) Specification v1.0** 的核心思想。

## 2. OCP Microscaling Formats (MX) v1.0

OCP（Open Compute Project）2023 年 9 月发布 MX v1.0，
把上面思路标准化。规范定义：

- 1 个 **scale 数据类型**（block 共享）
- 4 个 **元素数据类型**（每个元素独立编码）
- 每块固定 32 个元素（k=32）

### 2.1 共享 scale：E8M0

| 字段 | 位数 | 取值 |
|---|---|---|
| 符号 | 0 | （无符号） |
| 指数 | 8 | **偏置 127** |
| 尾数 | 0 | （无） |

- scale 值 = $2^{E - 127}$，范围 $2^{-127} \sim 2^{+127}$
- **只能取 2 的幂次**（因为没有尾数位）
- 没有 ±Inf；只有 0xFF 一个 NaN 编码
- 没有 0 scale（避免 scale 为 0 导致整个块被吞）

设计含义：

- 极简硬件：一个 block 的 dequantize 只需要左移/右移指数
- 缺点：scale 步长为 2×（粗糙），对"刚好介于两个 2 的幂次之间"的数据有 2× 误差

### 2.2 量化算法（伪描述）

输入：一段连续 32 个 FP32 值 $\{x_1, \dots, x_{32}\}$

1. 算块内最大值 $M = \max_i |x_i|$
2. 选 E8M0 scale：$\Delta = 2^{\lfloor \log_2 M \rfloor - e_{\max}}$
   （让 $M/\Delta$ 正好占满元素类型最大正常数）
3. 把每个 $x_i$ 除以 $\Delta$，四舍五入到元素类型的最近码点
4. 存：32 × 元素位 + 1 × 8 bit scale

反量化：$\hat{x}_i = x_i^{\text{elem}} \cdot \Delta$。

### 2.3 MX 全家福

| 格式 | 元素宽度 | 元素类型 | 元素 binade / ULP | 块大小 | Scale 类型 | 每块字节数 | 备注 |
|---|---|---|---|---|---|---|---|
| **MXFP8** | 8 | E4M3 / E5M2 | 17 / 32 | 32 | E8M0 | 33 | FP8 加 block scale，节省 scale 之外的元数据 |
| **MXFP6** | 6 | E3M2 / E2M3 | 8 / 7 | 32 | E8M0 | 25 | 业界应用较少，研究阶段 |
| **MXFP4** | 4 | E2M1 | 4 | 32 | E8M0 | 17 | OCP 标准 4-bit 格式 |
| **MXINT8** | 8 | INT8（2's comp） | — | 32 | E8M0 | 33 | 整数元素 × 浮点 scale，硬件最简单 |

总位计算（MXFP4）：$32 \times 4 + 8 = 136$ bit = 17 B，平均 4.25 bits/value。

## 3. MXFP4 的精度分析

MXFP4 元素 E2M1 + scale = $2^{\lfloor \log_2 M \rfloor - e_{\max}}$：

- **块内精度**：相对 ULP $\approx 2^{-1} = 0.5$（E2M1）
- **块的动态范围**：scale 提供 $2^{-127} \sim 2^{127}$，远超 FP32
- **理论误差上界**：
  $$
  |\hat{x}_i - x_i| \le \tfrac{1}{2} \text{ulp}(\Delta x_i^{\text{elem}}) \le \tfrac{\Delta}{4}
  $$
  其中 $\Delta = 2^{\text{E8M0}-127}$。

直觉上：

- 如果块内数据**分布集中**（大部分 $|x_i|$ 接近 $M$）：scale 选得合适，相对误差约 0.5
- 如果块内数据**长尾分布**（少数极大值）：scale 被拉上去，小值的相对误差剧烈恶化
  - 例：块内一个值 $M = 1000$，其余 31 个值都 $0.001$
  - scale $= 2^{\lfloor \log_2 1000 \rfloor - 1} = 2^8 = 256$
  - 小值量化后 $\hat{x} = 0$（次规格化也撑不住 $0.001 / 256 = 4 \times 10^{-6}$）
  - **相对误差 = 100%**

→ **MXFP4 对异常值极其敏感**。经验：直接套用 MXFP4 量化（无 outlier 处理），
GPT/Llama 类模型的精度损失可达 5–30%（见 Yang et al., 2025）。

## 4. NVFP4：NVIDIA 的 4-bit 答案

Blackwell（B200/RTX 5090）Tensor Core 上 NVIDIA 推出了 NVFP4。
表面上 NVFP4 与 MXFP4 都用 E2M1 元素，但设计上有 3 个关键差异：

| 维度 | MXFP4 | NVFP4 |
|---|---|---|
| 元素编码 | E2M1 (1+2+1) | E2M1（兼容） |
| 块大小 | 32 | **16** |
| 块级 scale | E8M0（仅 2 的幂） | **E4M3 FP8**（带尾数，可非整次幂） |
| 全局 scale | （无） | per-tensor **FP32** |
| 平均 bits/value | 4.25 | ≈ 4.5 |
| 硬件支持 | OCP 标准，多家兼容 | NVIDIA Blackwell 独占 |

### 4.1 三个差异的数值后果

**1. 块大小 32 → 16**

- 一个 outlier 只污染 16 个值而不是 32 个，**异常敏感度减半**
- 但每块多一个 scale 字节 → 16 个元素的存储变为 $16 \times 4 + 8 = 72$ bit = 9 B，
  平均 4.5 bits/value（相比 MXFP4 的 4.25 bits/value 略多）

**2. Scale 类型 E8M0 → E4M3 FP8**

- E8M0 scale 步长 2× → E4M3 scale 步长 $\approx 2^{-3} = 12.5\%$ 相对
- **量化误差降低约 16 倍**（粗略估计：$2^3 / 2^0$ 的差距）
- 代价：scale 字段从纯指数变成有尾数，硬件需要一次 FP8→FP32 的转换

**3. 新增 per-tensor FP32 scale**

- 训练时由全局统计量（如 activation 的滚动 max）决定
- 给整个张量一个"全局微调"，进一步缓解长尾
- 推理时常折叠到 weight 中，几乎无额外开销

### 4.2 Four Over Six 量化策略

NVFP4 训练（而非仅推理）时常用的 scale 选择算法：

```text
对每个 16 元素 block:
    候选 1: 把 max 映到 6（不裁剪），s_a = max / 6
    候选 2: 把 max 映到 4（裁剪超出的），s_b = max / 4
    分别按 s_a 和 s_b 量化整块，计算与原 FP32 的 MSE
    取 MSE 更小的那个
```

依据：候选 2 牺牲少量极值，保住整体精度；候选 1 留住极值但低值精度更差。
**选 MSE 小的那个**在大量块上接近最优。

NVIDIA 报告：Four Over Six + NVFP4 在 Llama 4 / Qwen 3 等模型上，
相对 FP8 推理的精度损失 < 0.5%，而吞吐量提升 ~3.5×。

### 4.3 Blackwell Tensor Core 路径

- 元素存储 4-bit（每两个元素打包成 1 字节）
- Scale 单独存为 FP8 张量 + 一个 per-tensor FP32
- 加载到 Tensor Core：4-bit × 4-bit 乘法 → 乘积按 FP32 累加
- 内存带宽省 3.5×（vs FP16），算力 ≈ INT4 但数值属性更友好
- KV cache 也可以 NVFP4 化（FP8 之前 KV cache 多用 FP16/BF16，量化收益已见顶）

### 4.4 NVFP4 vs MXFP4 的实际选择

- **MXFP4**：OCP 开放标准，NVIDIA / AMD / 通用 ASIC 都可实现；AMD MI355X 通过 MFMA 在 ROCm 7.x 中支持
- **NVFP4**：NVIDIA 私有扩展，硬件仅 Blackwell，但量化误差更小、推理更稳
- Hugging Face 上 `nvidia/` 命名空间的 NVFP4 checkpoint 与 OCP MXFP4 兼容
- 实际部署：MXFP4 工具链（TensorRT Model Optimizer / ModelOpt）生成的 checkpoint 在 Blackwell 上原生运行

## 5. FP4 训练是否可能

MXFP4 / NVFP4 当前主要定位是**推理 + 推理后训练 (post-training)**。

训练涉及：
- 前向：量化激活到 FP4
- 反向：量化梯度到 FP4（梯度数值跨度更大，可能需要 E5M2 这种宽范围变体——但 FP4 没有 E5M2 这种区分）
- 优化器状态：通常保留 FP32 master weight + FP32 momentum/variance

**主要瓶颈**：

1. 梯度量化到 4-bit 几乎一定损失过多——长尾 + 大量极小值同时存在
2. BN/RMSNorm 等归一化操作的中间统计量需要更高精度
3. 小学习率 fine-tuning 阶段，单步更新 $\le 10^{-5}$，量化噪声主导信号

现状（2025）：
- NVFP4 训练在论文（NVIDIA, "NVFP4 Training", 2025）中初步展示可行，但需：
  - Per-tensor FP32 scale（动态）
  - 优化器状态保持 FP32
  - 注意力层用 FP8 而非 FP4
- 业界共识：**MXFP4/NVFP4 是推理格式，训练到 FP4 还差一步**
- 主流 4-bit LLM 训练仍是 BF16/FP8

## 6. 标准化前沿：IEEE P3109

IEEE P3109 是 IEEE 754 工作组下属项目，目标是把低精度浮点（≤ 8-bit）
正式纳入 IEEE 标准族。关键时间线：

- 2022 年 FP8 进入 IEEE 754-2019 修订讨论
- 2023 年 OCP MX v1.0 发布
- 2024 年 IEEE P3109 立项，正式讨论 4-bit / 6-bit / 8-bit 标准化
- 2025–2026 年：interim report 与候选格式收敛

关键议题：
- 是否把 OCP MX 的"块共享 scale"理念并入 IEEE 754？
- FP4 / FP6 的位分配：E2M1 之外是否需要 E3M0（纯指数）？
- E8M0 scale 是否要扩展为 E4M3（带尾数）？

如果 P3109 把 MX 思想纳入 IEEE 754，下一代硬件（2026–2028）
可能会原生支持 MX 风格的"block-scaled FP4"，不再依赖厂商私有扩展。

## 7. 横向对比表

| 维度 | MXFP4 | NVFP4 | FP8 E4M3 |
|---|---|---|---|
| 元素编码 | E2M1 | E2M1 | E4M3 |
| 元素 bits | 4 | 4 | 8 |
| 块大小 | 32 | 16 | 1（per-tensor scale） |
| 块 scale 类型 | E8M0 | E4M3 | （per-tensor FP32） |
| 平均 bits/value | 4.25 | 4.5 | 8 |
| 典型应用 | 推理（OCP 标准） | 推理（NVIDIA 优化） | 训练 / 推理 |
| 量化误差（高斯分布） | ~12% | ~5% | ~2.5% |
| 硬件 | 多家 | Blackwell 独占 | Hopper+ |

## 8. 训练/推理决策表（续 §5 总览）

| 场景 | 推荐 | 备注 |
|---|---|---|
| LLM 推理 ≤ 13B | FP8 E4M3 | 精度足够，吞吐翻倍 |
| LLM 推理 ≥ 70B | NVFP4 / MXFP4 | 显存压到极限 |
| LLM 推理（KV cache 敏感） | NVFP4 + FP8 KV cache | KV 不直接到 4-bit |
| 长上下文推理 | FP8 KV cache + NVFP4 权重 | 注意力数值敏感 |
| LLM 训练 | BF16 / FP8 混合 | **4-bit 训练还不成熟** |
| 视觉 Transformer 推理 | FP8 E4M3 | 激活分布更窄 |
| 扩散模型推理 | NVFP4 / FP8 | 激活分布较窄 |
| 通用边缘部署 | INT8/INT4 | 算力优先 |

## 9. 参考资料

1. **OCP Microscaling Formats (MX) Specification v1.0**（2023-09）
2. **Microscaling Data Formats for Deep Learning**（Rouhani et al., 2023, arXiv:2310.10537）
3. **Introducing NVFP4 for Efficient and Accurate Low-Precision Inference**（NVIDIA Technical Blog, 2025）
4. **An Empirical Study of Microscaling Formats for Low-Precision LLM Training**（Yang et al., 2025, arXiv）
5. IEEE P3109 工作组公开 GitHub 与 interim report
6. Morph: FP8 Quantization: E4M3 vs E5M2, Hardware Support, and the Accuracy Tradeoff
7. Spheron Network: MXFP4 Quantization on GPU Cloud（2026）