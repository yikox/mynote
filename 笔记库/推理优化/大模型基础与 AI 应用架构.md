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

Attention 相关技术可分为两条主线：

1. **改变注意力结构或效果**：改变 Q/K/V 的组织方式、可见范围或注意力计算公式，解决模型能力、长序列复杂度或 KV Cache 体积问题；通常需要训练或微调适配。
2. **优化计算和显存效率**：保持注意力语义不变，主要改写 kernel、访存与数值表示；通常可直接替换推理/训练算子。

#### 结构与效果机制

| 类型 | 核心做法 / 解决问题 | 数学结果 | KV Cache 影响 | 典型场景 |
|---|---|---|---|---|
| **MHA** | 每个 Query Head 拥有独立 K/V Head，表达能力完整 | 基准结构 | 最大：缓存全部 K/V Head | 训练、Encoder、对质量优先的模型 |
| **GQA** | 多个 Query Head 共享一组 K/V，折中质量与推理效率 | 改变模型结构，非等价于 MHA | 按 KV Head 数缩小，常为 MHA 的 `n_kv_heads / n_heads` | 现代 Decoder-only LLM，主流折中方案 |
| **MQA** | 所有 Query Head 共享一组 K/V，最大幅度降低带宽与缓存 | 改变模型结构，容量低于 MHA/GQA | 最小，约为 MHA 的 `1 / n_heads` | 高吞吐、低延迟自回归推理 |
| **Cross-Attention** | Q 来自当前序列，K/V 来自另一序列，实现跨模态或条件注入 | 改变信息来源与模型功能 | 可缓存条件侧 K/V；大小取决于条件序列长度 | Encoder–Decoder、图文/音频模型、扩散模型 |
| **Local / Window Attention** | 每个 token 只关注固定窗口，降低长序列计算量 | 改变可见范围，无法直接建模窗口外关系 | 滑动窗口推理可只保留最近 `w` 个 K/V | 长文本、视觉模型、流式推理 |
| **Sparse Attention** | 按局部、跨步、块或路由模式只计算部分连接 | 改变注意力图，结果取决于稀疏模式 | 若历史连接集合受限可减少；仅稀疏计算不一定减少缓存 | 超长上下文、规则化稀疏或块稀疏模型 |
| **Linear Attention** | 用核函数/状态递推重排计算，避免显式构造 `n×n` 矩阵 | 改变 softmax Attention 公式，通常为近似或不同机制 | 可用固定大小状态替代完整 KV Cache，取决于具体算法 | 极长序列、流式处理、内存受限场景 |

> **注意**：Sparse Attention 属于结构算法，不应与 FlashAttention 混为一类。前者减少“要计算哪些注意力连接”，后者优化“如何计算同一个注意力”。

#### 高效实现

| 类型 | 核心做法 / 解决问题 | 数学结果 | KV Cache 影响 | 典型场景 |
|---|---|---|---|---|
| **FlashAttention** | 分块计算并利用 online softmax，减少 HBM 读写且不物化完整注意力矩阵 | 数学上等价于标准 Attention；浮点舍入顺序不同，数值可能有微小误差 | 不改变缓存形状或容量；可提升读写效率 | 长序列训练、Prefill、通用精确注意力 |
| **PagedAttention** | 将 KV Cache 分页管理，消除连续显存要求并减少碎片与预留浪费 | 不改变 Attention 数学定义 | 不减少单 token 理论 KV 大小，但提高缓存利用率、共享与调度能力 | vLLM 类连续批处理、多请求服务 |
| **FlashInfer / 高效 Decode Kernel** | 融合算子并针对单/批量 Query 访问 KV Cache 优化 | 语义等价；仅有浮点误差 | 不改变容量，降低读取开销和 kernel 启动成本 | 自回归 Decode、在线推理服务 |
| **SageAttention** | 对 Q/K 或 P/V 等阶段量化并设计专用 kernel，降低带宽与提升 Tensor Core 利用率 | 近似计算，通常有小量化误差 | 通常不改变 KV Cache 结构；是否量化缓存取决于具体版本/配置 | 视觉生成、长序列 Attention、可接受微小误差的推理 |
| **KV Cache 量化** | 将缓存从 FP16/BF16 压到 FP8/INT8/INT4，直接降低容量与带宽 | 近似计算，精度取决于位宽、缩放与校准 | 直接按位宽缩小，例如 FP16→INT8 约减半 | 长上下文、大并发、显存受限推理 |

#### 判断原则

- **先看模型结构**：MHA/GQA/MQA、Cross/Local/Sparse/Linear 通常由模型训练阶段决定，不能只换一个 kernel 就获得同等效果。
- **再看执行实现**：FlashAttention、PagedAttention、FlashInfer 等主要优化访存与调度，可在结构兼容时替换实现。
- **区分等价与近似**：FlashAttention 保持公式等价；SageAttention、KV Cache 量化通过低精度换速度与显存；Linear Attention 则改变了注意力公式。
- **区分 Prefill 与 Decode**：Prefill 更受大矩阵计算和临时显存影响；Decode 每步 Query 很短，更受 KV Cache 容量、带宽与调度影响。

### 安全

---

## 演进 / 待补

- 各子节点待填充内容
