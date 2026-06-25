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
