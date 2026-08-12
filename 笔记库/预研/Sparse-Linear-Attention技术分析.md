# Sparse-Linear Attention (SLA) 技术分析

> 核心参考：[thu-ml/SLA](https://github.com/thu-ml/SLA) · [Paper](https://openreview.net/forum?id=eD8IPvNoZB)

---

## 1. 核心思想

SLA 将 attention weights 解耦为两部分：

| 成分 | 特征 | 加速策略 |
|------|------|----------|
| **大权重** | 少量、高 rank | 稀疏注意力 (top-k) |
| **小权重** | 大量、低 rank | 低秩线性注意力 |

```
Attention ≈ Sparse(QK^T)V  +  proj(Linear(QK^T)V)
            ↑ 大权重区域        ↑ 小权重区域
```

---

## 2. 关键技术发现

### 2.1 Attention 矩阵的低秩结构

在 Diffusion Transformers（尤其是视频生成）中：
- Attention 矩阵存在天然的结构化稀疏性
- 大多数信息集中在少数强关联位置上
- 剩余权重呈低秩分布

### 2.2 混合加速架构

```
输入 Token 序列
     │
     ▼
┌────────────────────────────────────┐
│        SLA Attention               │
│  ┌──────────────┬───────────────┐  │
│  │  Top-K 稀疏  │  线性低秩近似  │  │
│  │  (捕获强依赖) │  (捕获弱依赖)  │  │
│  └──────────────┴───────────────┘  │
└────────────────────────────────────┘
     │
     ▼
融合输出
```

---

## 3. 原始 SLA 性能提升

| 指标 | 提升幅度 |
|------|----------|
| 注意力计算量 | **20x ↓** |
| 注意力延迟 | **13.7x ↓** |
| 端到端视频生成 (Wan2.1-1.3B) | **2.2x ↓** |
| 生成质量 | 无损 |

---

## 4. 迭代技术（2025-2026）

### 4.1 SLA2 (2026.02) ⭐

> Paper: [arXiv:2602.12675](https://arxiv.org/abs/2602.12675) · 继承自 SLA

**三大改进**：

| 改进 | 说明 | 效果 |
|------|------|------|
| **可学习路由器** | 动态选择稀疏/线性注意力 | 自适应计算分配 |
| **直接稀疏线性公式** | 使用可学习比率融合两分支 | 更忠实于原始注意力 |
| **量化感知微调 (QAT)** | 低比特注意力 + 稀疏 | 减少量化误差 |

**核心公式**：
```
Attention = Router(Q,K,V) ? Sparse(QK^T)V : Linear(QK^T)V
                            + learnable ratio fusion
```

**性能**：
- **97% 稀疏度**
- **18.6x 加速** (vs FlashAttention)
- 保持生成质量

---

### 4.2 Re-ttention (NeurIPS 2025)

> Paper: [arXiv:2505.22918](https://arxiv.org/abs/2505.22918) · **训练无关**

**核心思想**：利用扩散模型的**时间冗余性**重塑注意力分布

```
问题：极稀疏注意力会扭曲 softmax 分布
解决：基于先前 softmax 分布历史重塑注意力分数
```

**技术亮点**：
- **训练无关**：无需微调，即插即用
- **超稀疏**：仅需 **3.1%** tokens
- 解决稀疏注意力的概率归一化偏移问题

**测试模型**：
- CogVideoX (T2V)
- PixArt DiT (T2I)

**对比优势**：优于 FastDiTAttn、Sparse VideoGen、MInference

---

### 4.3 LLSA - Log-linear Sparse Attention (2025.12)

> Paper: [arXiv:2512.16615](https://arxiv.org/pdf/2512.16615)

**突破性创新**：首个 **O(N log N)** 复杂度的稀疏注意力

```
标准稀疏注意力: O(N²)  - 选择阶段太慢
LLSA:            O(N log N) - 层级化 Top-K 选择
```

**层级化选择策略**：

```
层级1: 在最粗粒度计算 Top-K (O(N) tokens)
层级2: 递归计算剩余层级的稀疏 Top-K
...
最终: 每个 query 关注 O(K log N) 个 coarse tokens
```

**性能**：
| 任务 | 加速比 |
|------|--------|
| 注意力推理 | **28.27x** |
| DiT 训练 (256×256) | **6.09x** |
| 生成质量 | 保持 |

---

### 4.4 EDiT - Efficient Diffusion Transformer (ICCV 2025)

> Paper: [ICCV 2025](https://openaccess.thecvf.com/content/ICCV2025/papers/Becker_EDiT_Efficient_Diffusion_Transformers_with_Linear_Compressed_Attention_ICCV_2025_paper.pdf)

**核心机制**：线性压缩注意力

```
架构设计：
┌─────────────────────────────────────────────┐
│  Q (Queries):  多层卷积处理                   │
│  K/V (Keys/Values): 卷积压缩空间token          │
└─────────────────────────────────────────────┘
```

**变体**：
| 模型 | 注意力机制 |
|------|-----------|
| EDiT | 线性压缩注意力（单模态） |
| MM-EDiT | 混合注意力：图像用线性压缩 + 文本用标准注意力 |

---

### 4.5 Block-Sparse DiT

**技术特点**：
- 稀疏注意力 + 动态块跳过
- 时间特征相似性缓存
- 模式特定注意力掩码

**性能**：
| 指标 | 提升 |
|------|------|
| 图像/视频合成加速 | **3x** |
| 内核级加速 | **10-30x** |

---

## 5. 实现更新

### 5.1 SageSLA (基于 SageAttention)

> GitHub Issue #9 更新 (2025)

**最新改进**：
- ✅ Triton 实现更稳定
- ✅ 训练更快速
- ✅ 更好的训练结果

**版本演进**：
| 版本 | 特性 |
|------|------|
| SageAttention v1/v2/v3 | 基于量化的注意力加速 |
| SageAttention 2.0.1 β | 线程级量化 |
| SageSLA | SLA + SageAttention 高性能实现 |
| SageAttention2++ | 免费版可用 |

---

## 6. 技术演进路线图

```
原始 SLA (2024)
├── 稀疏 + 线性混合
├── 固定比例融合
└── 20x 计算减少

    ↓ 迭代方向

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  SLA2 (2026)                    Re-ttention (2025)      │
│  ├── 可学习路由器 ←──────────→ 训练无关即插即用          │
│  ├── 直接融合公式                    时间冗余利用        │
│  └── 量化感知微调                    3.1% tokens        │
│                                                         │
│  LLSA (2025.12)              EDiT (ICCV 2025)          │
│  ├── O(N log N) 复杂度 ─────→ 线性压缩注意力           │
│  └── 层级化 Top-K               图像+多模态            │
│                                                         │
└─────────────────────────────────────────────────────────┘

    ↓ 最终目标

超稀疏 + 低延迟 + 无质量损失 + 即插即用
```

---

## 7. 性能对比总览

| 方法 | 年份 | 稀疏度 | 加速比 | 训练需求 | 复杂度 |
|------|------|--------|--------|----------|--------|
| **SLA** | 2024 | ~80% | 20x | 微调 | O(N) |
| **SLA2** | 2026 | 97% | 18.6x | 微调 | O(N) |
| **Re-ttention** | 2025 | 97% | - | **无需** | O(N²) |
| **LLSA** | 2025 | - | 28x | 训练 | **O(N log N)** |
| **EDiT** | 2025 | - | - | - | O(N) |
| **SpargeAttn** | 2025 | 高 | - | **无需** | O(N²) |

---

## 8. 应用场景扩展

| 场景 | 推荐技术 |
|------|----------|
| 视频生成 (Wan2.1) | SLA2 / SageSLA |
| 即插即用加速 | Re-ttention / SpargeAttn |
| 超长序列 | LLSA |
| 多模态 DiT | MM-EDiT |
| 低资源部署 | EDiT |

---

## 9. 快速上手

```bash
# 克隆仓库
git clone https://github.com/thu-ml/SLA.git

# 查看 SageSLA 实现 (推荐)
cd SageSLA/

# 基础使用
python -c "
from sage_sla import sage_sla_attention
# 替换标准 attention
"

# 获取 SLA2
git checkout sla2  # 或从新分支获取
```

---

## 10. 参考文献

### 核心论文

1. **SLA** (2024): "SLA: Beyond Sparsity in Diffusion Transformers via Fine-Tunable Sparse-Linear Attention" - THU-ML, ICML/NeurIPS
2. **SLA2** (2026): "SLA2: Sparse-Linear Attention with Learnable Routing and QAT" - arXiv:2602.12675
3. **Re-ttention** (NeurIPS 2025): "Ultra Sparse Visual Generation via Attention Statistical Reshape" - arXiv:2505.22918
4. **LLSA** (2025): "Trainable Log-linear Sparse Attention for Efficient Diffusion Transformers" - arXiv:2512.16615
5. **EDiT** (ICCV 2025): "Efficient Diffusion Transformers with Linear Compressed Attention"

### 相关技术

6. **GLA**: "Gated Linear Attention Transformers with Hardware-Efficient Training" - ICML 2024
7. **SpargeAttn**: "SpargeAttention: A Training-Free Sparse Attention" - ICML 2025
8. **Mamba**: "Mamba: Linear-Time Sequence Modeling with Selective State Spaces" - 2023
9. **RetNet**: "Retentive Network: A Successor to Transformer" - 2023

---

## 11. 未来方向

- [ ] LLSA 与 SLA 的结合 (层级化稀疏 + 线性补偿)
- [ ] Re-ttention 与 QAT 的结合
- [ ] 实时视频生成的端到端优化
- [ ] 与 state space models 的进一步融合

---

*Last updated: 2026-02 (SLA2 发布)*