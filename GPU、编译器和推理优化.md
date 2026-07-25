# GPU、编译器和推理优化

> 以一个真实的大语言模型部署项目贯穿 GPU 算子、编译器、推理框架与
> 分布式推理：在 RTX 4070 Ti SUPER 上部署和优化 Qwen3.5-9B，
> 再扩展到多 GPU。

## 目标

最终交付的不是几组互不相关的 CUDA、Triton 和框架示例，而是一个逐步演进的
Qwen 推理系统：

```text
Qwen3.5-9B
├── 单卡量化 OpenAI-compatible 服务
├── 可重复的性能基准与 Profiling
├── CUDA 优化算子
├── Triton 融合算子
├── torch.compile 模型图与自定义算子
├── vLLM 基线服务
├── SGLang 对照服务
└── 多 GPU 分布式版本
```

完成后应能回答：

- 一个算子慢在计算、显存带宽、同步还是 launch overhead？
- 应该手写 CUDA、写 Triton，还是交给 TorchInductor？
- `torch.compile` 为什么 graph break、重复编译或没有产生融合？
- vLLM 和 SGLang 的缓存、调度策略分别适合什么流量？
- TTFT、TPOT、吞吐、并发、上下文长度和显存之间如何权衡？
- 模型放不下或吞吐不足时，应选择量化、TP、PP 还是 DP？
- 增加 GPU 后为什么不一定线性加速？

## 项目边界与当前环境

主模型使用 `Qwen/Qwen3.5-9B`。原先设想的 `Qwen3.6-9B` 并不是当前
官方型号；Qwen3.6 可在分布式阶段使用 `Qwen3.6-35B-A3B`。

远程实验机：

| 项目 | 当前状态 |
| --- | --- |
| GPU | NVIDIA GeForce RTX 4070 Ti SUPER，16376 MiB |
| 架构 | Ada，Compute Capability 8.9 |
| 驱动 | 560.94 |
| CUDA | Toolkit 12.6，NVCC 12.6.20 |
| 工作目录 | `/home/yiko/workspace` |
| 当前缺少 | PyTorch、vLLM、SGLang、独立 cuDNN/NCCL 包 |

Qwen3.5-9B 原始权重约 19 GB，无法在 16 GB 显存中留出足够的运行空间和
KV Cache。单卡起点采用 W4A16 checkpoint，候选为
`RedHatAI/Qwen3.5-9B-quantized.w4a16`；先只启用语言模型，初始上下文
限制为 8K。不要使用 MXFP4/NVFP4：Ada 没有对应的原生硬件计算路径。

当前系统 CUDA 保持不动。PyTorch、vLLM 和 SGLang 使用相互隔离并锁定版本的
Python 环境；安装前先核对 wheel、CUDA runtime 和驱动兼容性，不直接追逐
最新版或覆盖 `/usr/local/cuda-12.6`。

不进入主线：

- TensorRT / TensorRT-LLM：偏向 NVIDIA 专用 Engine 和特定硬件部署，
  与当前“理解 LLM serving 系统”的目标不够一致。
- 完整训练和微调：本计划只处理推理与部署。
- 一开始追求 262K 上下文、多模态或生产级 Kubernetes。

## 学习原则

1. **先跑通纵向切片**：第一周就得到可调用的 Qwen API，再逐层下钻。
2. **先测量再优化**：没有 profiler 证据，不决定要写哪个 kernel。
3. **优化真实算子**：Vector Add、Reduction 只用于热身，不算阶段交付。
4. **既看 microbenchmark，也看端到端**：单 kernel 变快但 TTFT、TPOT 或
   吞吐没有变化，不算完成。
5. **同一工作负载比较框架**：vLLM 与 SGLang 使用相同模型、精度、请求集、
   chat template 和采样参数。
6. **一次只验证一个假设**：每轮只改变一个 kernel、调度参数或缓存策略。

## 总体计划

按每周 10–12 小时估算，共 16 周；全职学习可压缩，但阶段验收线不变。

| 阶段 | 时间 | 阶段完成物 |
| --- | ---: | --- |
| 0. 最小部署 | 1 周 | Qwen3.5-9B W4A16 的 OpenAI-compatible API |
| 1. 推理基准与 Profiling | 1 周 | TTFT、TPOT、吞吐、显存和并发基线 |
| 2. CUDA 优化算子 | 3 周 | 两个接入 Qwen Block 的 CUDA Extension |
| 3. Triton 融合算子 | 2 周 | 两个接入模型的融合 kernel 与 autotune 结果 |
| 4. PyTorch Compiler | 2 周 | 可解释的 Qwen Block 编译图和自定义算子接入 |
| 5. vLLM 深化 | 2 周 | 可稳定压测的单卡基线服务 |
| 6. SGLang 与框架对照 | 2 周 | 公平的 vLLM / SGLang 选型报告 |
| 7. 分布式推理 | 3 周 | 2+ GPU 部署、扩展效率和通信分析 |

## 阶段 0：最小部署

先用 vLLM 跑通：

```text
客户端
  ↓ OpenAI Chat Completions
vLLM
  ↓
Qwen3.5-9B W4A16（language-model-only，8K context）
  ↓
RTX 4070 Ti SUPER
```

完成内容：

- 建立锁定版本的 Python 环境；
- 下载并校验模型 checkpoint；
- 提供 `/v1/chat/completions`；
- 支持普通响应和流式响应；
- 固定启动参数、模型 revision 和采样参数；
- 保存启动日志与 GPU/软件版本。

验收：

- 连续完成 100 个测试请求；
- 8K 上下文不 OOM；
- 服务重启后可由同一命令恢复；
- 输出通过一组固定 prompt 的基本正确性检查。

## 阶段 1：推理基准与 Profiling

先理解 LLM 请求的两个阶段：

- **Prefill**：处理输入 prompt，通常更偏计算密集；
- **Decode**：逐 token 生成，通常更受显存带宽、KV Cache 和调度影响。

统一指标：

- TTFT：首 token 延迟；
- TPOT / ITL：后续 token 的生成间隔；
- 输入、输出和总 tokens/s；
- P50、P95、P99 端到端延迟；
- 峰值显存与 KV Cache 容量；
- 最大稳定并发和满足延迟目标的 goodput。

固定测试矩阵：

| 维度 | 取值 |
| --- | --- |
| 输入长度 | 128、1K、4K、8K |
| 输出长度 | 128、512 |
| 并发 | 1、2、4、8、16 |
| Prompt | 全不同、50% 共享前缀、高度共享前缀 |
| 输出 | 自由文本、约束 JSON |
| Thinking | 开启、关闭 |

交付原始 JSON/JSONL、汇总表和 profiler 时间线。后续所有优化都必须和这份
基线比较。

## 阶段 2：CUDA 优化算子

CUDA 阶段的目标不是完成语法练习，而是从真实 Qwen 推理链路中找到热点，
提出访存或融合假设并实现优化。

前两天热身：

- Vector Add：线程索引、边界和合并访存；
- Reduction：同步、warp primitive 和 Shared Memory。

正式交付优先选择：

### 1. Fused Residual + RMSNorm

```text
原路径：
residual = x + residual
output = rms_norm(residual)

优化路径：
一个 CUDA kernel 完成 residual add、平方和归约、归一化和缩放
```

学习点：归约、向量化加载、warp shuffle、register pressure、内存带宽和
不同 hidden size 下的 kernel 配置。

### 2. Fused RoPE + KV Cache Write

一个 kernel 完成：

- Q/K 旋转位置编码；
- K/V layout 转换；
- KV page 地址计算；
- FP16/BF16 转换；
- K/V 写入和边界处理。

学习点：serving 数据布局、paged KV Cache、访存合并和 decode 路径。

高级候选：

- 简化版 Paged Decode Attention；
- Qwen3.5 Gated DeltaNet state update 或 chunk scan。

暂不把 W4A16 GEMM、完整 FlashAttention 作为前期目标；它们需要量化 packing、
Tensor Core、CUTLASS 或复杂流水线知识，工程量会遮蔽本阶段的核心问题。

每个 CUDA 算子的完成条件：

- 有 PyTorch reference 和自动正确性测试；
- 覆盖多个 shape、FP16/BF16 和边界情况；
- 有独立 microbenchmark 与 Nsight Systems/Compute 证据；
- 通过 PyTorch CUDA Extension 或 `torch.library` 接入 Qwen Block；
- 确认请求链路实际调用新 kernel；
- 同时报告单算子和端到端收益。

## 阶段 3：Triton 融合算子

Triton 阶段不机械重写全部 CUDA 代码。保留一个共同算子做语言和性能对照，
其余选择更适合快速融合和 autotune 的真实组合。

### 1. Fused Residual + RMSNorm

和 CUDA 版本直接比较：

- program/block 模型与 CUDA thread/block 的差异；
- Reduction 的表达方式；
- block size、warp 数和 register pressure；
- 不同 hidden size 的 autotune 选择。

### 2. Fused SwiGLU

融合 `SiLU(gate) × up`、类型转换及可选输出量化。Projection GEMM 继续交给
cuBLAS、Inductor 或现有量化 kernel，不为练习而重写成熟 GEMM。

### 3. Fused RoPE + KV Cache Write

将 RoPE、layout 转换、page 定位和 cache write 合并，并与 CUDA 版本比较
开发成本、可读性和性能。

高级毕业算子为 Qwen3.5 的 Gated DeltaNet state update / chunk scan。它比
再写一个普通 Attention 更贴合 Qwen3.5，因为该模型的语言层中
Gated DeltaNet 比标准 Attention 出现得更频繁。

每个 Triton 算子同样必须进入实际 Qwen Block，并提供正确性、autotune、
microbenchmark 和端到端报告。

## 阶段 4：PyTorch Compiler

理解并实际走通：

```text
Python / PyTorch
  → TorchDynamo
  → FX Graph
  → AOTAutograd
  → TorchInductor
  → Triton / CUDA kernel
```

完成内容：

- 捕获一个 Qwen3.5 Block 的 FX Graph；
- 找出并解释 graph break、guards 和重复编译；
- 区分首次编译成本与 warm steady-state；
- 查看 Inductor 生成的 Triton；
- 用 `torch.library` 正确注册自定义 CUDA/Triton 算子；
- 为 fake/meta tensor、动态 shape 和 mutation 提供必要描述；
- 比较 eager、`torch.compile` 和“compile + 自定义 kernel”。

验收重点不是成功执行一行 `torch.compile(model)`，而是能指出哪些算子融合、
哪些没有、性能变化来自哪里，以及自定义算子是否破坏图捕获。

## 阶段 5：vLLM 深化

从“能启动”推进到“能解释和稳定压测”：

- PagedAttention 与 KV Cache block；
- continuous batching；
- chunked prefill；
- prefix caching；
- CUDA Graph；
- scheduler、最大 token 数和并发控制；
- OpenAI API、流式响应、健康检查和 metrics；
- OOM、取消请求和重启行为。

交付：

- 固定版本和启动配置；
- 单卡最大稳定上下文与并发；
- 缓存开关、不同流量和不同调度参数的对照；
- TTFT、TPOT、throughput、goodput 和显存报告。

## 阶段 6：SGLang 与框架对照

使用和 vLLM 完全相同的 checkpoint、上下文、请求集、chat template 与采样参数
部署 SGLang。

学习：

- RadixAttention / Radix Cache；
- continuous batching 和 scheduler；
- chunked prefill；
- CUDA Graph；
- structured outputs；
- speculative decoding；
- prefix-aware workload；
- 为后续分布式准备的 TP、PP、DP、EP 和 Prefill/Decode disaggregation。

统一压测：

- 用同一 benchmark 客户端压 vLLM 与 SGLang；
- 测普通 prompt、共享 system prompt、长上下文和约束 JSON；
- 比较启动时间、空载显存、最大稳定并发；
- 比较 P50/P95/P99 TTFT、TPOT、tokens/s；
- 比较缓存命中收益、OOM 行为、日志和配置复杂度。

不存在脱离 workload 的“更好框架”。阶段交付是有数据的选型结论，并选出一个
框架作为分布式阶段主线；另一个只保留最小可运行基线。

## 阶段 7：分布式推理

Qwen3.5-9B W4A16 单卡即可运行，直接做 TP 可能因通信而变慢。分两步学习：

1. 用 Qwen3.5-9B BF16 在至少 2 张 GPU 上完成 TP 教学实验；
2. 用真正有容量需求的 Qwen3.6-35B-A3B 完成毕业部署。

知识点：

- rank、world size、process group；
- NCCL `all_reduce`、`all_gather`、`reduce_scatter`、P2P；
- Tensor Parallel、Pipeline Parallel、Data Parallel；
- MoE 的 Expert Parallel；
- 单机多卡与多机；
- 计算/通信重叠；
- Ray 或框架原生 multiprocessing；
- 网络、拓扑、模型路径和环境一致性；
- worker 失败、超时和可观测性；
- 高级阶段的 Prefill/Decode 分离。

交付：

- NCCL collective 基准；
- TP=1/2/4 的延迟、吞吐、显存和通信时间；
- 单卡与多卡扩展效率；
- 至少一次 worker 故障实验；
- 对“为什么没有线性加速”的证据化解释。

## 优化算子的统一工作流

```text
PyTorch Reference
        ↓
正确性测试
        ↓
Profiler 找瓶颈
        ↓
提出融合或访存优化假设
        ↓
CUDA / Triton 实现
        ↓
Microbenchmark
        ↓
接入 Qwen Block
        ↓
torch.compile 兼容
        ↓
接入 vLLM / SGLang 请求链路
        ↓
TTFT / TPOT / 吞吐端到端验证
```

每个优化都要回答：

- 实际请求是否调用了新 kernel？
- kernel launch 数是否减少？
- HBM 读写是否减少？
- Prefill 或 Decode 的哪一段改善？
- 并发吞吐和尾延迟是否改善？
- 是否增加编译时间、显存或维护成本？

## 知识地图

### Profiling

- 正确计时：warmup、CUDA 异步、Events、同步；
- PyTorch Profiler、Nsight Systems、Nsight Compute；
- Roofline、算术强度、memory-bound / compute-bound；
- kernel launch、CPU scheduler、GPU timeline；
- microbenchmark 与端到端指标的关系。

### CUDA

- SIMT、warp、thread block、occupancy；
- global/shared/register memory；
- coalescing、bank conflict、向量化加载；
- warp primitive、归约和同步；
- streams、events、CUDA Graph；
- Tensor Core、精度与数据布局；
- PyTorch CUDA Extension 和自定义算子注册。

### Triton

- `program_id`、block、mask、pointer arithmetic；
- layout、reduction、fusion；
- `num_warps`、block size、autotune；
- generated PTX 与 profiler；
- 和 PyTorch、CUDA reference 的正确性与性能比较。

### PyTorch Compiler

- Dynamo、FX、guards、graph break；
- AOTAutograd；
- Inductor IR 与生成的 Triton；
- dynamic shapes、recompilation；
- custom op、fake/meta implementation；
- eager / compile / AOT 的适用边界。

### LLM 推理

- Transformer 与 Qwen3.5 的 Gated DeltaNet / Gated Attention 混合结构；
- Prefill、Decode、KV Cache；
- paged KV、continuous batching、chunked prefill；
- quantization：W4A16、W8A8、FP8；
- sampling、structured output、speculative decoding；
- TTFT、TPOT、throughput、goodput。

### vLLM

- PagedAttention；
- scheduler 与 KV block manager；
- prefix caching；
- CUDA Graph 和执行后端；
- OpenAI-compatible serving；
- TP、PP、DP 和多节点。

### SGLang

- RadixAttention / Radix Cache；
- zero-overhead scheduler；
- structured generation；
- speculative decoding；
- TP、PP、DP、EP；
- Prefill/Decode disaggregation。

### 分布式推理

- NCCL collectives 和拓扑；
- TP、PP、DP、EP 的容量与通信代价；
- 单机多卡和多机；
- 计算通信重叠；
- Ray、multiprocessing、故障恢复和观测。

## 参考入口

- [Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B)
- [CUDA C++ Programming Guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/contents.html)
- [CUDA Best Practices Guide](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/)
- [Triton Tutorials](https://triton-lang.org/main/getting-started/tutorials/)
- [PyTorch Compiler](https://docs.pytorch.org/docs/main/user_guide/torch_compiler/torch.compiler.html)
- [vLLM Quickstart](https://docs.vllm.ai/en/stable/getting_started/quickstart/)
- [vLLM Parallelism and Scaling](https://docs.vllm.ai/en/stable/serving/parallelism_scaling/)
- [SGLang](https://github.com/sgl-project/sglang)
- [SGLang Serving Benchmark](https://docs.sglang.ai/developer_guide/bench_serving)
