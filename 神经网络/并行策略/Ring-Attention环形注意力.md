# Ring Attention：环形注意力并行技术

## 概述

Ring Attention 是由 UC Berkeley Flash Attention 团队提出的分布式注意力机制，旨在突破单 GPU 内存限制，支持百万 token 量级的长上下文训练。该技术通过环形拓扑组织 GPU，块式计算注意力，实现序列长度的线性扩展。

## 核心原理

### 问题背景

* 大语言模型上下文窗口持续增长（从 4k 到 1M tokens）

* 激活内存随序列长度呈二次方增长

* 即使是 2.3TB HBM3e 的 HGX B300 系统也无法满足超长序列需求

### Ring Attention 核心思想

```
GPU 0 → GPU 1 → GPU 2 → ... → GPU N → GPU 0
   ↑                                   ↓
   └───────────────────────────────────┘
```

1. **序列块切分**：将长序列切分为多个块，分布到不同 GPU
2. **环形通信**：每轮计算时传递 KV 对给下一个 GPU
3. **块式注意力**：每 GPU 只计算当前块与已接收 KV 块的注意力
4. **流水线执行**：通信与计算重叠，Zero-overhead 扩展

### 计算流程

```
For each step in ring:
  ┌─────────────────────────────────┐
  │ GPU i 持有 Query[i]             │
  │ GPU i 接收 Key[i-1], Value[i-1] │
  │ 计算 partial attention          │
  │ 发送 Key[i], Value[i] → next    │
  └─────────────────────────────────┘
```

## 主要特性

| 特性            | 说明                            |
| ------------- | ----------------------------- |
| 无限序列长度        | 理论上可线性扩展                      |
| Zero-overhead | 计算与通信重叠                       |
| 可组合性          | 可与 FSDP、tensor parallelism 组合 |
| 异步执行          | 环形传递与计算并行                     |

## PyTorch 实现：TorchTitan

### Context Parallel

PyTorch 原生实现于 [torchtitan](https://github.com/pytorch/torchtitan) 项目：

```python
# Pass-KV Ring Attention 实现
# 支持与 FSDP 组合
# 支持 torch.compile 优化
```

### 核心特性

* 原生 PyTorch 实现，易于理解和扩展

* 支持多维并行（Context Parallel + FSDP + Tensor Parallel）

* 模块化设计，便于集成

## 与其他并行技术对比

### Ring Attention vs Ulysses

| 维度   | Ring Attention            | Ulysses       |
| ---- | ------------------------- | ------------- |
| 并行维度 | 序列维度                      | 注意力头维度        |
| 通信模式 | Ring (P2P)                | All-to-All    |
| 通信量  | O(N) steps, each O(Seq/N) | 2次 All-to-All |
| 最优场景 | 超长序列                      | 中等长度          |

### Context Parallelism

Ring Attention 是 Context Parallelism 的核心实现：

* **128k tokens 以内**：可用 tensor parallelism

* **128k tokens 以上**：必须使用 Context Parallel (Ring Attention)

## 扩展变体

### RingX

发表于 HPC 系统的扩展方案，针对高性能计算环境优化。

### Ulysses + Ring Attention 混合

统一序列并行（USP）结合两者优势：

* Ulysses 处理注意力头并行

* Ring Attention 处理序列块传递

* 适用于更广泛的场景

## 应用场景

1. **长文档理解**：书籍、论文、文档摘要
2. **多模态理解**：超长视频帧序列
3. **代码生成**：大型代码仓库理解
4. **Agent 系统**：多轮对话历史

## 参考资料

* [PyTorch Forum: Context Parallel Discussion](https://discuss.pytorch.org/t/distributed-w-torchtitan-breaking-barriers-training-long-context-llms-with-1m-sequence-length-in-pytorch-using-context-parallel/215082)

* [Exxact Blog: Context Parallelism & Ring Attention](https://www.exxactcorp.com/blog/deep-learning/how-llms-reach-large-token-context-windows)

* [RingX Paper](https://dl.acm.org/doi/10.1145/3712285.3759859)

* [YouTube: Ring Attention Explained](https://www.youtube.com/watch?v=jTJcP8iyoOM)

