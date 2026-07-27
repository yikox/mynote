# 量化版本、GGUF 与 TorchAO
>起因：有一个问题很困扰，我之前使用过 torchao 对模型进行量化，但是在大语言模型部署的时候是推荐我使用量化好的版本，因此有些疑惑为何需要使用所谓的量化版本，还有经常听到所谓的 GGUF 的量化版本中的 GGUF

> 结论：可以直接使用 TorchAO 量化。所谓“专门的量化版本”不是硬性要求，
> 而是别人已经完成并验证了量化、权重打包、保存和推理引擎兼容性。

## 先区分三个概念

量化算法、权重格式和推理引擎经常被统称为“量化版本”，但实际上是三层不同的
东西：

| 概念 | 解决的问题 | 例子 |
| --- | --- | --- |
| 量化算法 | 如何把高精度权重压缩 | TorchAO INT4、AWQ、GPTQ |
| 权重格式或容器 | 如何保存张量、量化参数和模型元数据 | Safetensors、GGUF |
| 推理引擎 | 用什么加载器和计算内核运行这些权重 | PyTorch、vLLM、SGLang、llama.cpp |

完整过程是：

```text
BF16 权重
  ↓ 选择量化算法、粒度和保留层
计算 scale / zero point
  ↓
打包为特定内存布局
  ↓
保存量化权重与配置
  ↓
由匹配的推理内核执行
```

即使两个模型都标记为 `W4A16`，只要量化方法、group size、张量布局或推理
内核不同，它们也不是同一种量化模型。

## 为什么会发布专门的量化版本

量化不是简单地把权重转换为整数：

```python
weight = weight.to(torch.int4)
```

真正的量化模型还需要确定：

1. 每组权重的 scale，以及某些方案使用的 zero point。
2. group size，例如每 32 或 128 个权重共享量化参数。
3. 哪些层量化，哪些层保留 BF16。
4. 权重的 bit packing 和内存排列。
5. 与推理内核匹配的张量布局。
6. 量化配置、模型结构和加载元数据。

预量化 checkpoint 的价值是：

- 启动时不需要重复执行量化。
- 不需要先在 GPU 中完整放下 BF16 模型。
- 量化结果和精度损失可以复现。
- 发布者通常已经执行过基本质量验证。
- vLLM、SGLang 等引擎可以直接选择与格式匹配的高速内核。

因此，“专门的量化版本”本质上是已经物化并验证过的量化结果，而不是模型能力
上的另一种版本。

## GGUF 是什么

GGUF 是 GGML/llama.cpp 生态的模型文件格式，不是量化算法。它通常把以下内容
放在一个文件中：

- 模型张量
- 模型架构与超参数
- Tokenizer
- 量化类型
- 加载所需的其他元数据

GGUF 的主要目标是单文件分发、快速 mmap 加载、CPU 推理，以及 CPU/GPU
混合卸载。

例如：

```text
Ornith-1.0-9B-Q4_K_M.gguf
```

其中：

- `GGUF` 是文件容器格式。
- `Q4_K_M` 是 llama.cpp 使用的具体 4-bit 量化方案。

GGUF 文件也可以保存 BF16、FP16、Q8、Q6、Q5、Q4 等不同精度的权重，因此
“GGUF”本身不等于“4-bit”。

它最适合：

- llama.cpp
- Ollama
- LM Studio
- CPU/GPU 混合推理
- 在消费级显卡上快速验证模型能力

虽然 vLLM 也支持 GGUF，但当前官方仍将其标记为高度实验性且未充分优化，并且
需要额外的 `vllm-gguf-plugin`。因此 GGUF 可以用于降低显存占用和验证能力，
但不适合作为正式的 vLLM 吞吐基线。

## 可以直接使用 TorchAO

Transformers 支持在加载模型时通过 TorchAO 执行 INT4 weight-only 量化：

```python
import torch
from transformers import AutoModelForCausalLM, TorchAoConfig
from torchao.quantization import Int4WeightOnlyConfig

quantization_config = TorchAoConfig(
    Int4WeightOnlyConfig(group_size=128)
)

model = AutoModelForCausalLM.from_pretrained(
    "deepreinforce-ai/Ornith-1.0-9B",
    dtype=torch.bfloat16,
    device_map="auto",
    quantization_config=quantization_config,
)
```

TorchAO 的 `quantize_` 会转换模型中的线性层，也可以按模块跳过某些层。
TorchAO 0.15 以上可以使用 `save_pretrained()` 将量化结果保存为
Safetensors。

一旦把量化结果保存下来，就已经创建了自己的“专门 TorchAO 量化版本”。

## 直接使用 TorchAO 的限制

- 仍然需要先下载 Ornith-1.0-9B 大约 18.8 GB 的 BF16 原始权重。
- 量化过程需要足够的 CPU 内存、磁盘空间和临时空间。
- INT4 的张量布局可能与设备相关；需要在与量化时相同的设备类型上重新加载。
- TorchAO 主要处理 `nn.Linear`；Qwen3.5/Ornith 的 DeltaNet、自定义状态更新、
  Attention 和视觉模块仍需逐层确认。
- 成功生成文本不代表已经得到最优吞吐。
- TorchAO INT4、AWQ 和 GPTQ 的量化误差、张量布局与运行速度不能视为等价。

## TorchAO 与 vLLM 的关系

vLLM 当前支持 TorchAO，也支持 AWQ、GPTQ、compressed-tensors、GGUF 等格式。
但“支持”要分成两层：

1. 能否正确加载和运行。
2. 能否在当前模型架构和 GPU 上使用最优融合内核。

Ornith-1.0-9B 继承 Qwen3.5 的 DeltaNet 与 Attention 混合架构。TorchAO
包装线性层以后，不一定能完全复用 vLLM 为 Qwen3.5 准备的所有融合路径，
因此仍需要通过端到端基准验证。

## 当前学习路径中的选择

三条路径适合不同目标。

### 快速验证模型能力

使用：

```text
GGUF Q4_K_M + llama.cpp
```

优点是无需自行量化，可以先判断 Ornith 是否真的适合实际代码任务。这个结果
不作为 vLLM 性能基线。

### 学习量化原理

使用：

```text
BF16 checkpoint + TorchAO INT4
```

自行控制 group size、跳过层和保存格式，并比较：

- 权重大小
- 峰值显存
- 常驻显存
- 输出质量
- TTFT 与 TPOT
- 端到端吞吐

这条路径最适合衔接 PyTorch Compiler、`torch.compile` 和自定义量化算子。

### 学习高吞吐 Serving

使用：

```text
W4A16 / AWQ / GPTQ / compressed-tensors
  + vLLM 或 SGLang
```

优先选择推理引擎原生支持并经过验证的量化 checkpoint，用于并发、TTFT、
TPOT、吞吐和 KV Cache 实验。

## 最终判断

TorchAO、预量化 W4A16 和 GGUF 不是互相替代的同一条路径：

- TorchAO 适合自己研究和构造量化模型。
- 预量化 W4A16、AWQ、GPTQ 或 compressed-tensors 适合稳定的
  vLLM/SGLang 部署。
- GGUF 适合 llama.cpp 和本地快速运行。

对于当前 16 GB RTX 4070 Ti SUPER，合理顺序是先用 GGUF Q4 验证
Ornith-1.0-9B 的任务能力，再使用 TorchAO 自行量化学习原理，最后选用
vLLM/SGLang 原生格式建立高吞吐服务基线。

## 参考资料

- [GGUF 格式说明](https://github.com/ggml-org/ggml/blob/master/docs/gguf.md)
- [Transformers TorchAO 文档](https://huggingface.co/docs/transformers/quantization/torchao)
- [TorchAO 量化 API](https://docs.pytorch.org/ao/stable/api_reference/api_ref_quantization.html)
- [vLLM GGUF 文档](https://docs.vllm.ai/en/latest/features/quantization/gguf/)
- [vLLM 量化支持](https://docs.vllm.ai/en/stable/)
