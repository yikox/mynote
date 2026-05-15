# DeepSpeed-Ulysses：序列并行技术

## 概述

DeepSpeed-Ulysses 是由 Snowflake AI Research 提出的长序列训练并行技术，属于 Arctic Long Sequence Training (ALST) 协议的一部分。该技术通过注意力头并行（Attention Head Parallelism）将注意力计算分布到多个 GPU 上，从而支持超过百万 token 的序列训练。

## 核心原理

### 问题背景
- Transformer 的注意力机制随序列长度呈 **O(n²)** 复杂度增长
- 单 GPU 内存无法容纳超长序列的注意力计算
- 典型书籍约 250k tokens，多文档上下文训练需要更长的序列支持

### 解决方案
Ulysses 在**序列维度**和**注意力头维度**同时进行切分：

1. **Sequence Parallel (SP)**：将序列沿长度维度切分到不同 GPU
2. **Attention Head Parallel**：将注意力头分布到多个 GPU

### 工作流程

```
输入序列 → 切分到 N 个 GPU
              ↓
         All-to-All 通信（重排数据）
              ↓
      每 GPU 计算部分注意力头
              ↓
         All-to-All 通信（合并结果）
              ↓
         还原为完整注意力输出
```

## 主要特性

| 特性 | 说明 |
|------|------|
| 序列长度扩展 | 支持 4x 以上的序列长度 |
| 训练规模 | 可在 256 张 A100 GPU 上验证 |
| 兼容性 | 与 blocked sparse attention 兼容 |
| 收敛性 | 保持训练收敛性 |

## 集成支持

### Hugging Face 生态
- **Accelerate**：基础集成
- **Transformers Trainer**：官方训练器支持
- **TRL SFTTrainer**：强化学习训练器支持

### DeepSpeed 集成
作为 DeepSpeed Sequence 的一部分提供系统级优化。

## 与 Ring Attention 的对比

| 维度 | Ulysses | Ring Attention |
|------|---------|----------------|
| 并行方式 | 注意力头并行 | 序列块环形传递 |
| 通信模式 | All-to-All | Ring communication |
| 适用场景 | 中等长度（<1M tokens） | 超长序列（1M+ tokens） |

## 统一序列并行 (USP)

最新研究将 Ulysses 和 Ring Attention 结合，形成统一序列并行方法：
- 取长补短
- 支持更广泛的场景
- 已在 Hugging Face 博客中介绍

## 参考资料

- 论文：[DeepSpeed Ulysses: System Optimizations for Enabling Training of Extreme Long Sequence Transformer Models](https://arxiv.org/abs/2309.14509) (arXiv:2309.14509)
- [Hugging Face Ulysses SP 博客](https://huggingface.co/blog/ulysses-sp)
- [DeepSpeed ALST 教程](https://www.deepspeed.ai/tutorials/ulysses-alst-sequence-parallelism/)