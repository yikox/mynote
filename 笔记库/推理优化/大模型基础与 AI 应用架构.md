# 大模型基础与 AI 应用架构

> LLM 核心原理与上层应用架构：从 Transformer 底层到 RAG、Agent、评估与安全。

---

## 概览

- **主题范围**：大模型的技术基础（Transformer / KV Cache）与 AI 应用架构的关键模式（RAG / Tool Calling / Agent / Eval / 安全）。
- **学习路径**：自底向上——先掌握 Transformer 和 KV Cache 原理，再学习 RAG → Tool Calling → Agent 的应用链路，最后以 Eval 和安全收尾。

---

## 知识地图

### Transformer
#### 为什么是 Transformer

- RNN/LSTM 顺序计算难以并行，长序列训练效率低；CNN 感受野有限，建模长距离依赖需多层堆叠。
- Transformer 完全基于注意力机制，任意两 token 一步可达，并行度极高，成为大模型的统一底座。

#### 整体结构

- **Encoder–Decoder**（原版）：编码器双向注意力，解码器带掩码的自注意力 + 交叉注意力。
- **Decoder-only**（GPT 系）：去掉编码器，仅用带因果掩码的自注意力，规模化效果好，是当前主流。
- **Encoder-only**（BERT 系）：双向注意力，适合理解任务。

#### 自注意力（Self-Attention）

- 三个可学习投影：`Q = X·W_Q`、`K = X·W_K`、`V = X·W_V`。
- 计算：`Attention(Q,K,V) = softmax( Q·Kᵀ / √d_k + mask ) · V`。
- `√d_k` 用于抵消点积方差随维度放大导致的 softmax 饱和。
- **Causal Mask**：上三角置 −∞，保证位置 `i` 只能看到 `≤ i` 的 token。

#### 多头注意力（Multi-Head, MHA）

- 将 `d_model` 切成 `h` 个 `d_k = d_model / h`，每头独立做注意力再拼接：`MultiHead = Concat(head_1,…,head_h) · W_O`。
- 多头让不同子空间捕捉不同关系（语法、短程、长程等）。
- 衍生变体：**MQA**（多 Query 共享 1 组 K/V）、**GQA**（分组共享）、**MHA** 全部独立，KV Cache 友好度依次提升。

#### 位置编码

- **绝对位置编码**（原始 Transformer）：正弦/学习式，为 token embedding 注入位置信息。
- **相对位置编码**（T5 等）：在注意力分数上加相对距离偏置。
- **RoPE**（旋转位置编码，主流）：对 Q/K 施加与位置相关的旋转变换，内积自然编码相对距离，外推友好。
- **ALiBi**：直接给注意力分数加线性距离偏置，简单且长度外推稳定。

#### 其他关键组件

- **FFN / MLP**：两层线性 + 激活（ReLU/GELU/SwiGLU），参数量主要集中在此。
- **残差连接 + LayerNorm**（或 RMSNorm、Pre/Post-Norm）：稳定深层训练，Pre-Norm 更易收敛。
- **Embedding 共享**：输入/输出 embedding 常共享权重，节省参数。

#### 训练与推理要点

- 训练：Teacher Forcing + 交叉熵损失，并行喂入整序列。
- 推理：自回归生成，每步只新增一个 token，因此引入 **KV Cache** 避免重复计算 K/V。
- 复杂度：自注意力 `O(n²·d)`，长序列下是主要瓶颈（→ 见 KV Cache / FlashAttention 等优化）。

### Attention
列出有哪些 attention 
加速的，比如 flashattention,sage attention,稀疏注意力
效果的，比如交叉注意力，多头注意力，等等

### 安全

---

## 演进 / 待补

- 各子节点待填充内容
