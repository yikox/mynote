> 状态：执行前计划稿。远端机器当前不可连接，本章中的容量、速度和兼容性均为待验证假设。执行时在本文件上直接更正方案、命令和数据；完成后删除失效候选与过程记录，只保留最终可复现路径、实测结果和明确限制。

## 优缺点

### 优点

- GGUF 的模型表示更紧凑。Qwen3.5-9B Q4_K_M 约 6 GB，比第一章使用的约 11 GB 选择性 W4A16 checkpoint 更容易在 16 GB 显存中同时容纳模型、128K KV Cache 和运行时缓冲区。
- llama.cpp 对消费级硬件和单请求推理友好，能够精确控制 GPU 层数、KV Cache 类型、物理 Prefill 批次和服务 Slot 数量。
- 支持 CPU、CUDA 以及 CPU/GPU 混合执行；模型超过显存时仍有降级运行路径。
- `llama-server` 依赖少，可直接提供 OpenAI 风格的 `/v1/chat/completions`、流式响应、API Key 和工具调用。
- `llama-bench` 与服务端使用同一个推理运行时，适合分别测量 Prompt Processing 与 Token Generation，建立 vLLM 的对照基线。
- 本章可以复用现有 Ollama/GGUF 资产；确认内容一致时不重复下载模型。

### 局限

- GGUF Q4_K_M 与第一章 W4A16 不是同一个权重表示，结果只能作为另一条部署路线，不能混入 vLLM 性能基线。
- llama.cpp 的 OpenAI API 是实用兼容，不保证所有字段和边界行为与 OpenAI/vLLM 完全一致；Pi Code Agent 的工具调用必须单独验收。
- 工具调用依赖 GGUF 内置 Chat Template 与 `--jinja` 解析。模型能普通聊天，不代表工具调用格式一定正确。
- Q4 权重和量化 KV Cache 都可能损失质量。尤其不应为了容量直接使用 Q4 KV；编码 Agent 首选 Q8 KV。
- 单请求和本地部署是它的优势；高并发、Paged KV Cache 和大规模 GPU Serving 仍以 vLLM/SGLang 为主要对照。
- CPU/GPU 混合卸载首先解决“能否运行”，通常会降低 Decode 速度。本章的 9B 模型应优先完整放入 GPU。
- llama.cpp 更新较快，Qwen3.5 的 Gated DeltaNet、工具解析或 CUDA Kernel 可能随版本变化，因此必须记录源码 commit，而不能只写“最新版”。

## 本章目标与完成定义

在不破坏第一章 vLLM 服务的前提下，新增一套独立的 llama.cpp 服务：

```text
Pi Code Agent（Mac，经 SSH 隧道）
  → OpenAI-compatible API
  → llama-server（WSL2，CUDA）
  → Qwen3.5-9B GGUF Q4_K_M
  → RTX 4070 Ti SUPER 16 GB
```

目标配置：

| 项目 | 目标值 |
| --- | --- |
| 模型 | Qwen3.5-9B，GGUF Q4_K_M |
| 服务端 | llama-server，CUDA 后端 |
| 总上下文 | 131072 tokens |
| 最大输出 | 16384 tokens，由客户端请求控制 |
| 最大输入 | 约 114688 tokens（总窗口减去最大输出） |
| 并发 | 单 Slot、单活跃请求 |
| KV Cache | K/V 均为 Q8_0，验证不通过时退回 F16 |
| GPU 放置 | 所有可卸载语言模型层进入 GPU |
| 多模态 | 关闭，不加载 mmproj |
| 工具调用 | 使用 GGUF Chat Template 与 `--jinja` |
| 监听端口 | 8080，与第一章 vLLM 的 8000 并存 |
| API 模型别名 | `qwen3.5-9b-gguf` |

以下条件全部通过，才把本章标记为完成：

- 固定 llama.cpp commit、构建命令、GGUF 来源、文件大小和 SHA-256。
- 启动日志确认 CUDA 后端可用，计划卸载的层确实位于 GPU。
- 128K 总窗口在单 Slot 下可以启动，并通过分阶段长上下文测试。
- 普通、流式、结构化 JSON 和工具调用完整往返均通过。
- Pi Code Agent 能经独立模型配置完成一次读取文件或执行安全测试工具的闭环。
- 记录 TTFT、Prompt Processing tokens/s、Decode tokens/s、峰值显存和峰值主内存。
- 服务停止、启动和机器重启后的恢复方式可重复。
- 第一章 vLLM 服务、模型、端口和脚本没有被覆盖或删除。

## 部署方案的选择

### 1. 保留第一章，新增独立对照服务

工作目录计划使用：

```text
/home/yiko/workspace/qwen35-llamacpp-serve
```

第一章继续保留：

```text
/home/yiko/workspace/qwen35-agent-serve
```

两个服务不共享虚拟环境、PID 文件、日志或启动脚本。llama.cpp 使用 8080，vLLM 继续使用 8000。实际切换 Pi 前先并行验收，不能直接替换已工作的入口。

### 2. 模型选择 Q4_K_M，不使用当前 W4A16

计划首选 Qwen3.5-9B Q4_K_M：

- 大小和输出质量之间较平衡；
- 预计能完整进入 16 GB 显存；
- 能给 128K Q8 KV Cache 和 CUDA 工作区留下空间；
- llama.cpp 对 GGUF Q4_K_M 有原生加载和 CUDA Kernel 路径。

执行时按以下顺序确定模型来源：

1. 检查现有 Ollama 模型和磁盘中是否已经存在可直接复用的 Qwen3.5-9B Q4_K_M GGUF。
2. 若存在，核对基础模型、量化类型、Chat Template、文件大小和 SHA-256；确认一致后复用，不重新下载。
3. 若不存在，先对可信 GGUF 仓库做短时速度探测，再选择来源。候选为 `bartowski/Qwen_Qwen3.5-9B-GGUF` 的 Q4_K_M；必须在下载时记录具体 revision。
4. 远端 Hugging Face 仍不可达或速度不可接受时，从可访问的本机下载后经 SSH/SCP 传入远端；不使用来源不明的镜像。

Q5_K_M、Q6_K 和 Q8_0 权重暂不作为第一轮目标。它们可以用于后续质量对照，但会缩小 128K 的显存余量。

### 3. KV Cache 选择 Q8_0

Qwen3.5-9B 只有 8 个全注意力层，128K F16 KV Cache 估算约 4 GiB；Q8 KV 估算约 2～2.5 GiB。首选：

```text
权重：Q4_K_M
K Cache：Q8_0
V Cache：Q8_0
```

选择理由：

- 相比 F16 约节省一半 KV 空间；
- 比 Q4 KV 更适合需要精确结构化输出和工具调用的 Agent；
- 模型权重已经量化，没有必要同时把关键缓存压到极低精度。

如果当前 commit、CUDA Flash Attention 或 Qwen3.5 混合缓存不支持该组合，则退回 F16 KV，并重新测量最大稳定上下文；不得无记录地更换参数。

### 4. 所有模型层优先进入 GPU

Q4_K_M 权重预计约 6 GB，本章不计划主动把 9B 模型层放入 CPU。首选：

```bash
--n-gpu-layers all
--kv-offload
```

只有完整 GPU 路径在 128K 下仍然 OOM，才按顺序调整：

1. 降低物理 Prefill 批次 `--ubatch-size`。
2. 确认只启用一个 Slot，关闭额外 RAM Prompt Cache。
3. 检查 mmproj、桌面进程和遗留模型进程是否占用显存。
4. KV 从 F16 改为 Q8，或确认 Q8 确实生效。
5. 最后才减少 GPU 层数或把 KV 留在 CPU，并记录速度代价。

### 5. llama.cpp 从源码构建并固定 commit

计划使用官方仓库源码构建 CUDA 版本，而不是依赖来源和版本不明确的二进制：

```bash
cmake -B build \
  -DGGML_CUDA=ON \
  -DCMAKE_CUDA_ARCHITECTURES=89 \
  -DCMAKE_BUILD_TYPE=Release

cmake --build build \
  --config Release \
  --target llama-server llama-cli llama-bench \
  -j
```

执行时先检查 `cmake`、C/C++ 编译器、CUDA Toolkit 和已有 llama.cpp。只有缺少依赖时才安装；不覆盖系统 CUDA 12.6。最终文档记录：

- Git remote 和 commit SHA；
- 构建器与编译器版本；
- CMake 配置；
- `llama-server --version`；
- CUDA 设备识别结果。

### 6. 文本 Agent 优先，不加载视觉模块

本章目标是编码 Agent，不是多模态服务。使用本地 GGUF 时不提供 mmproj；通过 `--hf-repo` 下载时显式加 `--no-mmproj`，避免视觉投影器占用主内存、显存和下载时间。

## 计划目录结构

```text
/home/yiko/workspace/qwen35-llamacpp-serve/
├── config/
│   ├── serve.env
│   ├── api_keys
│   └── build-info.txt
├── logs/
│   ├── llama-server.log
│   └── acceptance/
├── models/
│   └── Qwen3.5-9B-Q4_K_M.gguf
├── scripts/
│   ├── start.sh
│   ├── stop.sh
│   └── restart.sh
├── src/
│   └── llama.cpp/
└── run/
    └── llama-server.pid
```

只保留运行服务需要的脚本和最终验收结果。下载探测、临时请求体和一次性调试文件放入系统临时目录，执行结束后删除。

## 实际操作流程

### 步骤 0：保护现有基线

- 确认第一章 vLLM 服务目录、进程、端口 8000 和模型文件状态。
- 记录当前 GPU、内存、磁盘和正在运行的推理进程。
- llama.cpp 使用新目录和 8080，不修改第一章的配置与 Pi 默认模型。
- 若两套服务不能同时驻留显存，允许测试时停止 vLLM，但不得删除；测试结束后恢复。

### 步骤 1：清点可复用资产

检查：

- 是否已经安装 CUDA 版 llama.cpp；
- 是否已有可用源码目录及 commit；
- Ollama 使用的 Qwen3.5-9B 具体 GGUF、量化类型和路径；
- CMake、Ninja/Make、GCC/G++、Git 和 CUDA Toolkit 版本；
- 端口 8080 是否空闲。

这一阶段结束后再决定“复用”还是“下载/编译”，不能预先重复安装。

### 步骤 2：探测并取得模型

若需要下载：

1. 先取得文件元数据和总大小。
2. 做短时下载速度探测，估算完成时间。
3. 速度持续不合理时，比较可信来源或改为本机下载后传输。
4. 下载过程支持断点续传，不创建多份同名模型。
5. 完成后记录仓库、revision、文件大小和 SHA-256。

预期文件：

```text
Qwen3.5-9B-Q4_K_M.gguf
```

实际文件名以最终来源为准，执行完成后更正文档。

### 步骤 3：构建 llama.cpp CUDA 版本

- 克隆或复用官方 `ggml-org/llama.cpp`。
- 固定一个实际支持 Qwen3.5、Q8 KV 和工具调用的 commit。
- 使用 Compute Capability 8.9 构建。
- 只构建本章需要的 `llama-server`、`llama-cli`、`llama-bench`。
- 执行最小设备检查和短 Prompt 测试，确认不是误用 CPU-only 二进制。

若最新版出现 Qwen3.5 回归，允许退回经验证 commit；最终文档只保留实际使用的 commit 和选择理由。

### 步骤 4：先做 8K 最小正确性测试

第一次启动不直接使用 128K。先用：

```text
8K context
Q4_K_M 权重
Q8 KV
全部层 GPU
单 Slot
Flash Attention
```

验证：

- 模型能正常加载；
- 输出不是乱码或重复字符；
- Chat Template 正确；
- CUDA 层卸载符合预期；
- `/health` 与 `/v1/models` 正常；
- 普通和流式聊天正常。

最小正确性通过后再扩大上下文，避免把架构兼容、模板错误和容量问题混在一起排查。

### 步骤 5：逐级扩大到 128K

按单变量方式测试：

```text
8K → 32K → 64K → 96K → 128K
```

每一级记录：

- 启动是否成功；
- 空载与峰值显存；
- 峰值主内存；
- Prompt Processing tokens/s；
- TTFT；
- Decode tokens/s；
- 是否出现 OOM、输出异常或 Cache 精度问题。

计划最终启动命令如下，执行后以实际可用参数为准更正：

```bash
BASE=/home/yiko/workspace/qwen35-llamacpp-serve

"$BASE/src/llama.cpp/build/bin/llama-server" \
  --model "$BASE/models/Qwen3.5-9B-Q4_K_M.gguf" \
  --alias qwen3.5-9b-gguf \
  --ctx-size 131072 \
  --n-gpu-layers all \
  --parallel 1 \
  --flash-attn on \
  --kv-offload \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --batch-size 2048 \
  --ubatch-size 512 \
  --cache-ram 0 \
  --jinja \
  --no-mmproj \
  --host 0.0.0.0 \
  --port 8080 \
  --api-key-file "$BASE/config/api_keys"
```

如果 128K 的 Prefill 峰值过高，优先把 `--ubatch-size` 从 512 降为 256 或 128；一次只调整一个参数并重新测量。

### 步骤 6：创建最小运维入口

建立与第一章一致的最小接口：

```text
start.sh
stop.sh
restart.sh
```

脚本只负责：

- 读取最终配置；
- 检查重复进程和端口；
- 启动或优雅停止服务；
- 保存 PID 与日志；
- 在失败时返回非零状态。

API Key 写入权限为 `600` 的独立文件，不写入脚本、Pi 配置或 Git。

### 步骤 7：API 与 Agent 验收

按以下顺序测试：

1. `GET /health`。
2. `GET /v1/models`，模型别名为 `qwen3.5-9b-gguf`。
3. 非流式最小聊天。
4. 流式聊天。
5. 关闭 Thinking 的短回答。
6. JSON 结构化输出。
7. 强制调用一个无副作用工具。
8. 工具结果回传后生成最终答复。
9. 工具参数包含路径、中文、引号和多字段对象。
10. 连续多轮 Agent 请求，确认 Chat Template 和工具消息历史没有损坏。

工具调用重点检查：

- `finish_reason`；
- `tool_calls[].function.name`；
- `tool_calls[].function.arguments` 是字符串还是 JSON 对象；
- 流式增量格式能否被 Pi 正确拼接；
- 错误参数是否会产生可诊断响应。

### 步骤 8：长上下文与 16K 输出验收

分开验证容量和生成时长：

- 32K、64K、96K、112K 输入，各生成 256～1024 tokens，验证长 Prefill 与 Cache 稳定性。
- 短输入请求允许 `max_tokens=16384`，确认服务和 Pi 接受该上限。
- 至少执行一次长输出压力测试，记录实际停止原因、生成 tokens、耗时和显存；若完整 16K 生成耗时不适合日常 Agent，仍把 16K 保留为上限而不是默认值。
- 最终确认输入与输出总和不超过 131072；本章不把“128K 输入 + 16K 输出”误写成 128K 总窗口。

### 步骤 9：基准与效果记录

使用 `llama-bench` 和真实 HTTP 请求分别记录：

| 指标 | 说明 |
| --- | --- |
| Prompt Processing tokens/s | Prefill 内核吞吐 |
| Token Generation tokens/s | Decode 内核吞吐 |
| TTFT | HTTP 请求到首 token |
| TPOT / ITL | 后续 token 间隔 |
| 峰值显存 | 模型、KV 和工作区总成本 |
| 峰值主内存 | mmap、服务和缓存成本 |
| Prefix 重用 | 相同对话前缀是否减少重复 Prefill |
| 工具调用成功率 | Agent 能否稳定解析并继续对话 |

至少比较：

- 8K 与 128K；
- F16 KV 与 Q8 KV；
- llama.cpp Q4_K_M 与第一章 vLLM W4A16 的单请求结果。

比较时必须固定 Prompt、输入/输出长度、Thinking、采样参数和并发；不同量化格式的结果要注明“能力与部署对照”，不能宣称是完全同权重性能对比。

### 步骤 10：接入 Pi，但不覆盖旧模型

Pi 新增独立模型项：

```text
模型：qwen3.5-9b-gguf
Base URL：http://127.0.0.1:18080/v1（SSH 隧道后）
Context Window：131072
Max Tokens：16384
```

SSH 隧道计划使用独立本地端口，例如：

```bash
ssh -N \
  -L 127.0.0.1:18080:127.0.0.1:8080 \
  yiko@192.168.31.107
```

原有 `qwen35-vllm` 配置继续保留。llama.cpp 完成工具调用和稳定性验收后，再决定是否调整默认模型。

### 步骤 11：稳定性与恢复

- 连续执行 100 个混合请求，包含普通、流式和工具调用。
- 验证客户端取消、超时、非法 API Key 和超长上下文的错误行为。
- 执行停止、启动、重启，确认端口、PID 和日志没有残留。
- 若测试期间停止过 vLLM，恢复第一章服务并重新检查其 `/v1/models`。

## 预计结果与决策门

当前仅能给出估算：

| 项目 | 计划预期 | 执行后填写 |
| --- | --- | --- |
| Q4_K_M 文件 | 约 6 GB | 待实测 |
| 128K Q8 KV | 约 2～2.5 GiB | 待实测 |
| 128K 是否完整 GPU | 有较大概率 | 待实测 |
| Decode 速度 | 预计为每秒数十 tokens，随上下文下降 | 待实测 |
| 128K TTFT | 预计为数十秒到数分钟 | 待实测 |
| 工具调用兼容 | 存在风险 | 待实测 |

决策门：

1. **8K 普通输出异常：** 先处理模型、commit、CUDA Kernel 或 Chat Template，不继续扩大上下文。
2. **128K OOM：** 先减小 `ubatch` 和额外缓存，再检查 KV 类型；最后才考虑 CPU 路径。
3. **工具调用不兼容 Pi：** 固定或更换 Jinja Template；若仍不稳定，llama.cpp 只作为能力/容量基线，Agent 主入口继续使用 vLLM。
4. **128K 可运行但 TTFT 不可接受：** 保留模型能力，将日常 Agent 窗口改为 32K/64K，并依赖上下文压缩；文档如实记录 128K 是容量上限而非交互默认值。
5. **Q8 KV 明显损害工具调用或长上下文质量：** 退回 F16 KV，重新评估可用上下文。

## 执行后的文档更正规则

执行时持续更新本文件，但最终不保留命令试错流水账：

- 把“计划预期”替换成实际版本、commit、文件哈希、参数和数据。
- 方案发生变化时，直接更正“部署方案的选择”，并保留一句最终选择理由。
- 删除失败源、过时命令、临时路径和已经被替代的参数。
- 将“实际操作流程”整理为从零可复现步骤，不能要求读者先经历排错过程。
- 结尾写明当前服务是否可用、最大稳定上下文、工具调用状态、Pi 接入状态和未解决限制。
- 所有“通过”“可用”“支持 128K”等结论必须有对应实测记录，不能继续沿用本计划中的估算措辞。

## 参考资料

- [llama.cpp 官方仓库](https://github.com/ggml-org/llama.cpp)
- [llama.cpp CUDA 构建指南](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)
- [llama-server 参数与 API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- [llama.cpp Function Calling](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)
- [Qwen3.5-9B 官方模型](https://huggingface.co/Qwen/Qwen3.5-9B)
- [Qwen3.5-9B GGUF 候选](https://huggingface.co/bartowski/Qwen_Qwen3.5-9B-GGUF)
- [llama.cpp 原理笔记](./llama.cpp.md)
- [第一章 最小部署计划](./第一章%20最小部署计划.md)
