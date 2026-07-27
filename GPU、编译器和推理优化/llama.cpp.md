# llama.cpp

> 结论：llama.cpp 是一个面向本地和边缘设备的大语言模型推理运行时。
> 它使用 C/C++ 实现，以 GGUF 为主要模型格式，能够在 CPU、GPU 或
> CPU/GPU 混合环境中运行量化模型。它尤其适合消费级硬件、显存受限场景和
> 低依赖部署，但不是 PyTorch 模型开发框架，也不是大规模分布式推理的首选。

## 它解决什么问题

大语言模型部署首先面对的不是 API，而是三个更底层的问题：

1. 模型权重能否放进当前机器的内存和显存。
2. 当前硬件能否高效执行模型中的矩阵乘法、Attention 和其他算子。
3. 能否用足够简单、稳定的方式加载模型并对外提供推理能力。

PyTorch 和 Transformers 可以运行模型，但会引入 Python、框架运行时和较高的
内存开销；纯 GPU Serving 框架通常又假定模型和 KV Cache 主要驻留在 GPU。
llama.cpp 选择了另一条路径：

```text
尽量少的依赖
  + 高度量化的模型
  + 多硬件后端
  + CPU/GPU 混合执行
  = 在更广泛的机器上完成 LLM 推理
```

它最初围绕 Llama 模型开发，但现在已经支持 Qwen、Gemma、Mistral、
DeepSeek、gpt-oss 等大量模型架构。“llama”已经是项目名称，而不是模型支持
范围。

## 它不只是一个命令行程序

可以把 llama.cpp 理解成四层：

```text
llama-cli / llama-server / llama-bench
                    ↓
               libllama
   模型加载、Tokenize、KV Cache、采样
                    ↓
                  GGML
       张量、计算图、算子与内存管理
                    ↓
 CPU / CUDA / Metal / Vulkan / HIP / SYCL
```

### GGML

GGML 是底层张量库，负责：

- 张量表示和内存布局
- 计算图构造与执行
- 量化张量类型
- CPU 和各种加速设备的算子实现
- 不同设备之间的张量放置

它不是 PyTorch，也不依赖 PyTorch 的 Autograd、Dispatcher 或
TorchInductor。llama.cpp 中的 CUDA 优化主要来自 GGML 的 C++/CUDA
内核，而不是 Triton 生成的算子。

### libllama

`libllama` 是主要推理库，对外提供 C 风格 API。它在 GGML 之上实现：

- GGUF 模型加载
- Tokenizer
- Prompt Prefill
- 自回归 Decode
- KV Cache
- Chat Template
- Sampling
- Grammar 和结构化输出约束

如果要把 llama.cpp 嵌入自己的程序，真正依赖的是 `libllama`，而不一定要
启动 `llama-server`。

### 工具层

常用工具包括：

| 工具 | 用途 |
| --- | --- |
| `llama-cli` | 在终端中加载模型并进行对话或文本生成 |
| `llama-server` | 提供 HTTP、Web UI 和 OpenAI 风格接口 |
| `llama-bench` | 分别测试 Prompt Processing 和 Token Generation |
| `llama-quantize` | 将高精度 GGUF 转换为量化 GGUF |
| `llama-perplexity` | 测量困惑度和量化误差 |

## 一次推理如何执行

一次文本生成大致经过下面的过程：

```text
用户输入文本
  ↓ Tokenizer
输入 Token IDs
  ↓ Prompt Prefill
计算全部输入 Token，建立 KV Cache
  ↓ Decode
根据 KV Cache 每次生成一个或多个候选 Token
  ↓ Sampling
temperature / top-k / top-p / grammar
  ↓
输出文本
```

Prefill 和 Decode 的性能特征不同：

- Prefill 一次处理较多 Token，通常更偏向计算吞吐。
- Decode 通常逐 Token 执行，更容易受到显存带宽、Kernel Launch 和
  KV Cache 访问影响。

所以不能只记录一个“tokens/s”。`llama-bench` 会把 Prompt Processing
和 Token Generation 分开测量，更适合作为优化实验的基线。

## GGUF 与 llama.cpp 的关系

GGUF 是 GGML 生态使用的推理模型文件格式，不是量化算法。它可以在单个文件中
保存：

- 模型架构和超参数
- 权重张量
- 量化类型
- Tokenizer
- Chat Template
- 加载模型所需的其他元数据

例如：

```text
Qwen3.5-9B-Q4_K_M.gguf
```

这里：

- `GGUF` 是文件容器。
- `Q4_K_M` 是具体的量化类型。

GGUF 也能保存 BF16、FP16、Q8、Q6、Q5 等权重，因此不能把 GGUF 和
4-bit 量化画等号。关于量化算法、模型格式和推理引擎的区别，见
[量化版本、GGUF 与 TorchAO](./量化版本、GGUF%20与%20TorchAO.md)。

## 模型转换与量化

模型通常先在 PyTorch/Transformers 生态中训练和保存，然后转换成 GGUF：

```text
Hugging Face checkpoint
  ↓ convert_hf_to_gguf.py
BF16/FP16 GGUF
  ↓ llama-quantize
Q4_K_M / Q5_K_M / Q8_0 等量化 GGUF
```

示例：

```bash
python3 convert_hf_to_gguf.py \
  /path/to/huggingface-model \
  --outfile /path/to/model-bf16.gguf \
  --outtype bf16

./build/bin/llama-quantize \
  /path/to/model-bf16.gguf \
  /path/to/model-Q4_K_M.gguf \
  Q4_K_M
```

转换能否成功取决于 llama.cpp 是否已经适配该模型架构。一个模型即使可以被
Transformers 加载，也不代表它能立刻转换并运行在 llama.cpp 中。

量化会减少：

- 模型文件大小
- 权重常驻内存或显存
- 读取权重所需的内存带宽

但也可能带来：

- 模型质量损失
- 反量化计算开销
- 某些量化类型缺少对应硬件的最优内核

所以“位数更低”不必然意味着“端到端速度更快”。

## CPU、GPU 与混合卸载

llama.cpp 的重要能力是让模型张量分布在不同设备上。

### 纯 CPU

模型权重和计算主要位于系统内存与 CPU：

```text
GGUF → mmap/内存 → CPU 算子
```

优点是兼容性强、可运行超过显存容量的模型；缺点是大模型的生成速度通常明显
低于 GPU。

### 完整 GPU 卸载

模型权重和主要计算放到 GPU：

```text
GGUF → 系统内存 → GPU 显存 → CUDA 算子
```

当模型、KV Cache 和计算缓冲区都能放进显存时，这是 NVIDIA 单卡上通常优先
选择的方式。

### CPU/GPU 混合卸载

显存不足时，一部分层留在 CPU，另一部分层放在 GPU：

```text
前一部分层：CPU
      ↓ 设备间传输
后一部分层：GPU
```

这解决的是“模型能否运行”，但跨设备传输和 CPU 计算会降低速度。因此混合
卸载首先是容量方案，不应默认视为性能优化。

当前版本可以使用：

```bash
--n-gpu-layers all
```

尽可能把全部层放入 GPU，也可以传入具体层数控制显存占用。剩余层会在 CPU
上执行。

## 显存由什么构成

运行模型所需显存不等于 GGUF 文件大小：

```text
总显存占用
  ≈ 模型权重
  + KV Cache
  + 计算缓冲区
  + CUDA 运行时和其他开销
```

其中：

- 权重占用主要由参数量和量化类型决定。
- KV Cache 通常随上下文长度和并发序列数近似线性增长。
- Prompt Batch 越大，计算缓冲区通常越大。
- 服务端并发越高，同时存在的序列和 KV Cache 越多。

显存不足时，建议按下面的顺序处理：

1. 降低 `--ctx-size`。
2. 降低 `llama-server` 的并发数。
3. 选择更小或更低位的量化模型。
4. 最后再减少 GPU 卸载层数，让部分层回到 CPU。

直接减少 GPU 层数虽然容易避免 OOM，但通常会明显降低生成速度。

## 在 RTX 4070 Ti SUPER 上构建

当前机器的 RTX 4070 Ti SUPER 是 Ada 架构，Compute Capability 为 8.9。
使用 CUDA 后端构建：

```bash
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp

cmake -B build \
  -DGGML_CUDA=ON \
  -DCMAKE_CUDA_ARCHITECTURES=89 \
  -DCMAKE_BUILD_TYPE=Release

cmake --build build --config Release -j
```

检查可用设备：

```bash
./build/bin/llama-cli --list-devices
```

对于这张 16 GB 显卡，9B 模型的 Q4 或 Q5 GGUF 通常比 BF16 更合适：

- 量化权重能够完整进入显存。
- 可以给 KV Cache 和计算缓冲区留出空间。
- 适合先验证模型能力和建立单请求性能基线。

实际能使用的上下文长度仍要通过启动日志和基准测量确认，不能只根据模型文件
大小推断。

## 使用 llama-cli

加载本地 GGUF：

```bash
./build/bin/llama-cli \
  -m /path/to/model-Q4_K_M.gguf \
  --n-gpu-layers all \
  --ctx-size 8192 \
  -p "解释 CUDA 中的 shared memory"
```

也可以直接从 Hugging Face 下载并运行已有 GGUF：

```bash
./build/bin/llama-cli \
  -hf <organization>/<model-GGUF>:Q4_K_M
```

`-hf` 的具体量化标签取决于仓库实际提供的文件，不能假设每个 GGUF 仓库都包含
`Q4_K_M`。

## 使用 llama-server

`llama-server` 是轻量的 C/C++ HTTP 服务端，支持 OpenAI 风格接口、连续批处理、
并行解码、结构化输出、工具调用、推测解码、Embedding 和多模态等能力。

启动一个本地服务：

```bash
./build/bin/llama-server \
  -m /path/to/model-Q4_K_M.gguf \
  --n-gpu-layers all \
  --ctx-size 8192 \
  --host 0.0.0.0 \
  --port 8080 \
  --jinja
```

请求 Chat Completions：

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "local-model",
    "messages": [
      {
        "role": "user",
        "content": "解释什么是 CUDA kernel fusion"
      }
    ]
  }'
```

需要注意：

- OpenAI 兼容是实用层面的兼容，不保证完整覆盖或严格复制 OpenAI API。
- Chat Template 错误会直接影响对话格式和输出质量。
- Function Calling 通常需要 `--jinja`，个别模型还需要显式指定模板。
- 服务能够正常返回不代表模板、推理参数和模型能力已经配置正确。

## 基准测试

使用 `llama-bench` 分别测试 Prefill 和 Decode：

```bash
./build/bin/llama-bench \
  -m /path/to/model-Q4_K_M.gguf \
  -ngl all \
  -p 512 \
  -n 128 \
  -r 5
```

至少记录：

| 指标 | 含义 |
| --- | --- |
| Prompt Processing tokens/s | Prefill 吞吐 |
| Token Generation tokens/s | Decode 速度 |
| TTFT | 首 Token 延迟 |
| TPOT | 后续每个 Token 的平均耗时 |
| 峰值显存 | 模型、KV Cache 和缓冲区的容量成本 |
| 输出质量 | 量化后是否仍满足目标任务 |

`llama-bench` 的核心测试不包含 Tokenization 和 Sampling 的耗时，所以它适合
比较推理内核和配置，但不能代替完整 HTTP 端到端压测。

## 与其他推理方案的边界

| 方案 | 核心目标 | 适合的任务 |
| --- | --- | --- |
| Transformers + TorchAO | 在 PyTorch 中研究、修改和量化模型 | 理解量化、编译图和自定义算子 |
| llama.cpp | 低依赖、跨硬件、本地量化推理 | 消费级硬件、能力验证、CPU/GPU 混合运行 |
| vLLM | GPU 高吞吐 Serving | 连续批处理、多并发、生产服务 |
| SGLang | 高性能 Serving 与生成工作流 | 前缀复用、结构化生成、Agent 服务 |

这些方案不是简单的性能排名，而是选择了不同的问题边界。

### llama.cpp 与 TorchAO

TorchAO 工作在 PyTorch 模型和算子体系中，适合研究量化表示、线性层替换、
`torch.compile` 和量化内核。llama.cpp 使用 GGUF 与 GGML 量化类型，二者的
权重布局和推理内核通常不能直接互换。

### llama.cpp 与 vLLM/SGLang

llama.cpp 已经支持连续批处理和多用户，但它最突出的优势仍是低依赖、量化和
硬件覆盖。vLLM/SGLang 的主要目标则是 GPU 服务吞吐、调度、KV Cache 管理和
多并发。

如果目标是：

- 在 16 GB 显卡上先把 9B 模型跑起来：优先 llama.cpp。
- 研究量化和 PyTorch Compiler：优先 TorchAO/PyTorch。
- 构建高并发模型 API：优先 vLLM 或 SGLang。
- 学习大规模分布式推理：不要以 llama.cpp 作为主线。

## 优点

- 依赖少，部署路径短。
- 量化类型丰富，适合显存受限环境。
- 同时支持 CPU、CUDA、Metal、Vulkan、HIP、SYCL 等后端。
- 模型超过显存时仍可使用 CPU/GPU 混合推理。
- GGUF 单文件便于分发、缓存和 mmap 加载。
- CLI、C API、HTTP Server 和基准工具处于同一个运行时体系中。
- 适合建立同一模型在不同量化类型和硬件上的可重复基线。

## 局限

- 新模型架构需要专门适配，支持通常会晚于 Transformers。
- 主要用于推理，不是训练和微调框架。
- GGUF 量化模型不适合继续进行常规 PyTorch 训练。
- CPU/GPU 混合卸载可能很慢，能运行不等于值得部署。
- OpenAI API 不是完全兼容实现。
- 高并发、多机和复杂分布式场景通常不是它的主要优势。
- llama.cpp 的 CUDA 内核不属于 TorchInductor/Triton 执行链，不能直接用于
  学习 PyTorch 编译器的全部机制。

## 在当前学习路线中的位置

llama.cpp 最适合作为“模型能力与本地部署基线”，而不是整条推理优化路线的
终点：

### 阶段一：跑通模型

使用：

```text
9B 模型 + GGUF Q4_K_M + llama.cpp + CUDA
```

完成：

- 模型下载和校验
- CUDA 构建
- 完整 GPU 卸载
- CLI 与 HTTP 服务
- Prompt Processing 和 Token Generation 基准

### 阶段二：理解容量

改变：

- GGUF 量化类型
- Context Length
- KV Cache 类型
- GPU 卸载层数
- 并发数

观察模型权重、KV Cache、显存、Prefill 和 Decode 之间的关系。

### 阶段三：进入 PyTorch 优化

回到 BF16/Safetensors 模型，使用 TorchAO、`torch.compile`、CUDA 和
Triton 实现并比较优化算子。此阶段 llama.cpp 作为结果基线，而不是实现平台。

### 阶段四：进入高吞吐 Serving

使用 vLLM 或 SGLang 部署同一模型，比较：

- 单请求延迟
- 并发吞吐
- TTFT 与 TPOT
- KV Cache 管理
- Prefix Cache
- 服务稳定性

这样可以区分三种优化收益：

```text
量化与模型表示收益
        vs
单算子和编译器收益
        vs
Serving 调度与批处理收益
```

## 最终判断

对于当前 RTX 4070 Ti SUPER 16 GB 环境，llama.cpp 是非常合适的第一套
推理运行时：

1. 它能用 GGUF Q4/Q5 快速运行约 9B 的模型。
2. 它能直观展示权重、KV Cache、上下文和显存之间的关系。
3. 它能提供 CUDA 单机性能基线。
4. 它能帮助判断模型本身是否值得继续投入优化。

但后续学习 CUDA、Triton、PyTorch Compiler 和分布式 Serving 时，应当把
llama.cpp 当作对照组。主线仍然应该进入 PyTorch/TorchAO 与 vLLM/SGLang，
因为这些框架更接近现代 GPU 推理编译和生产级服务的问题。

## 参考资料

- [llama.cpp 官方仓库](https://github.com/ggml-org/llama.cpp)
- [llama.cpp 构建指南](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)
- [llama-server 文档](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- [llama-bench 文档](https://github.com/ggml-org/llama.cpp/blob/master/tools/llama-bench/README.md)
- [量化工具文档](https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md)
- [GGUF 格式规范](https://github.com/ggml-org/ggml/blob/master/docs/gguf.md)
- [llama.cpp 多 GPU 指南](https://github.com/ggml-org/llama.cpp/blob/master/docs/multi-gpu.md)
