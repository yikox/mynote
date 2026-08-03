# 第二章：使用 llama.cpp 部署 Qwen3.5-9B

> 状态：已完成一轮可用性验收。当前 `llama-server` 以 128K 总上下文运行，OpenAI 兼容 API、结构化输出、流式响应、工具调用、110K 长上下文和 Pi Code Agent 均已通过实测。

## 优缺点

### 优点

- Q4_K_M GGUF 的最终文件为 5,530,618,176 bytes，在 16GB 显卡上同时容纳模型、128K Q8 KV Cache 和计算缓冲区没有压力。
- llama.cpp 对单机、单请求、消费级 GPU 很合适。权重层、KV 精度、上下文、物理批次和并发 Slot 都能直接控制。
- `llama-server` 原生提供 OpenAI 风格的 Chat Completions、SSE 流式输出、JSON Schema、API Key 和 Function Calling，能直接接入 Pi Code Agent。
- Qwen3.5-9B 的 32 层中只有 8 层是全注意力，另外 24 层是 Gated DeltaNet。长上下文下，随长度线性增长的全注意力 KV Cache 比纯全注意力模型少，因此 128K Q8 KV 能完整放在 GPU。
- 模型、源码、服务和第一章 vLLM 目录相互独立；切换路线不需要删除第一章产物。
- 同一长前缀能够复用 Slot 缓存。本次第二次提交相同 110K 请求时，服务命中 110,001 个缓存 token。

### 局限

- Q4_K_M 是 llama.cpp 的混合 K-quant 权重量化，不是第一章的 W4A16。两章是不同权重表示和不同运行时，不能当成完全同条件的性能对比。
- 当前派生 GGUF 只保留文本主模型，删除了视觉权重和旧格式 MTP 张量：不支持图片/视频，也不支持内置 MTP speculative decoding。
- 当前为 `PARALLEL=1`，只有一个 Slot。并发请求会排队，目标是本地编码 Agent，不是高并发 Serving。
- 128K 是输入与输出共享的总窗口，不是“128K 输入再加 16K 输出”。
- 本次验证了请求可设置 `max_tokens=16384`，但模型只实际生成了 17 tokens；尚未做连续生成完整 16K token 的耗时与稳定性压力测试。
- 长上下文验收使用低熵重复文本和首尾双针检索，证明容量、Prefill 和基本检索链路可用，不等价于复杂代码仓库、多轮工具历史的长期质量评测。
- 工具调用基线采用 Thinking Off。开启 Thinking 后需要重新验收工具调用、流式格式和 token 预算。
- 当前使用 `nohup + PID` 管理，没有 systemd 开机自启、崩溃自动拉起和日志轮转。
- 服务监听 `0.0.0.0:8080`，虽然生成 API 有 Bearer Key，但 LAN 上仍是明文 HTTP，且 `/health`、`/v1/models` 可公开读取。日常从 Mac 使用时应走仅绑定本机回环地址的 SSH 隧道。
- 构建未嵌入 Web UI；本章只交付 API 服务。

## 本章目标与最终结论

最终链路为：

```text
Pi Code Agent（Mac）
  → 127.0.0.1:18080
  → SSH Local Forward
  → WSL2 127.0.0.1:8080
  → llama-server
  → Qwen3.5-9B text-only GGUF Q4_K_M
  → RTX 4070 Ti SUPER 16GB
```

最终配置：

| 项目 | 实际值 |
| --- | --- |
| 模型 | Qwen3.5-9B 文本主模型，GGUF Q4_K_M |
| llama.cpp | `e1a1abb78746c025f5e9039f590e37ccdb758ae7` |
| 服务端 | `llama-server`，CUDA |
| 总上下文 | 131072 tokens |
| Pi 最大输出 | 16384 tokens |
| Pi 可预期输入上限 | 约 110592 tokens，已包含 4096 safety tokens |
| 并发 | 单 Slot |
| KV Cache | K/V 均为 Q8_0 |
| GPU 放置 | `--n-gpu-layers all`，KV 也在 GPU |
| CPU offload | 未使用 |
| 多模态 | 关闭 |
| Thinking | Pi 默认 Off |
| 远端端口 | 8080 |
| 本机隧道端口 | 18080 |
| API 模型 ID | `qwen3.5-9b-gguf` |

这台机器不需要把 Prefill、Decode、模型层或 KV Cache 放入 CPU。128K 配置完成长请求后总显存约 8.4GiB，仍有约 8GiB 余量；CPU offload 只会增加 PCIe/内存传输并降低 Decode 速度。

## 机器规格

| 项目 | 实测 |
| --- | --- |
| 系统 | Ubuntu 24.04.1 LTS，WSL2 kernel `6.18.33.2-microsoft-standard-WSL2` |
| CPU | Intel Core i5-13600KF，WSL 分配 20 vCPU |
| 内存 | 15GiB |
| Swap | 4GiB |
| GPU | NVIDIA GeForce RTX 4070 Ti SUPER |
| 显存 | 16,376MiB |
| NVIDIA Driver | 560.94 |
| CUDA Toolkit | 12.6 |
| CMake | 3.28.3 |
| GCC | 13.3.0 |
| GPU 架构 | Ada，Compute Capability 8.9 |

最终服务空闲时进程 RSS 约 1.48GiB；系统仍有约 13GiB 可用内存。128K 服务完成长请求后，整卡显存占用为 8,421MiB。

## 部署方案的选择

### 1. 保留第一章，建立独立服务目录

第一章目录保留：

```text
/home/yiko/workspace/qwen35-agent-serve
```

第二章使用：

```text
/home/yiko/workspace/qwen35-llamacpp-serve
```

两套服务不共享源码、PID、日志和启动脚本。第一章 vLLM 使用 8000，第二章 llama.cpp 使用 8080。

两套服务的模型文件都保留，但 16GB 显存不适合让它们同时驻留。本章完成后保持 llama.cpp 运行、vLLM 停止；需要回到第一章时先停止 llama.cpp，再启动 vLLM。

### 2. 复用 Ollama 模型层，不重复下载标准 GGUF

机器已经有 Ollama 官方模型库的 `qwen3.5:9b`：

| 项目 | 值 |
| --- | --- |
| Ollama tag | `registry.ollama.ai/library/qwen3.5:9b` |
| Ollama 显示的 model ID | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| model layer SHA-256 | `dec52a44569a2a25341c4e4d3fee25846eed4f6f0b936278e3a3c900bb99d37c` |
| model layer 大小 | 6,594,462,816 bytes |
| Ollama 标记 | Q4_K_M，262144 原生上下文 |

标准 Hugging Face GGUF 下载在该机器上只有约 1.0～1.3MB/s。现有 Ollama blob 已完整下载并通过 SHA-256 校验，因此最终选择本地重写，而不是再下载一份近 6GB 的相同量化路线。

不能把 Ollama blob 直接软链接给原版 llama.cpp。该文件是 Ollama 使用的组合式 GGUF：

- 一共 883 个 tensors；
- `v.*` 视觉 tensors 441 个；
- `mtp.*` 旧格式 MTP tensors 15 个；
- 文本主模型 tensors 427 个；
- MRoPE metadata 是 `[11,11,10]`；
- `attention.head_count_kv` 是逐层数组；
- 24 个 DeltaNet tensor 使用旧名 `blk.*.ssm_dt`。

固定的原版 llama.cpp 需要不同的 text-only metadata 和 tensor 命名。最终转换器只针对上述固定 SHA 的 blob：

1. 保留 427 个文本 tensors。
2. 过滤 `v.*`、`mtp.*`，并防御性过滤 `mm.*`。
3. 把 MRoPE sections 改为 `[11,11,10,0]`。
4. 把 24 个 `blk.*.ssm_dt` 改名为 `blk.*.ssm_dt.bias`。
5. 把逐层 KV heads metadata 折叠为 `UINT32(4)`。
6. 保持 `block_count=32`，不伪造 llama.cpp-native MTP 第 33 层。
7. 先写入 `.partial`，重读验证全部 metadata/tensor 约束后再原子发布。

最终产物：

| 项目 | 值 |
| --- | --- |
| 路径 | `/home/yiko/workspace/qwen35-llamacpp-serve/models/Qwen3.5-9B-Q4_K_M.gguf` |
| 大小 | 5,530,618,176 bytes |
| SHA-256 | `068b6bace4d4f5d18f3b3d84c48cd03304fa0e5e354da115eff26f3666023435` |
| tensors | 427 |
| llama-server 参数量 | 8,953,803,264 |
| 架构 | `qwen35` |
| 原生训练上下文 | 262144 |

这应称为“由固定 Ollama model layer 本地重写得到的 text-only Q4_K_M GGUF”，不能称为 Hugging Face 下载文件或官方 llama.cpp GGUF。

### 3. 使用 Q8 KV、全部 GPU、单 Slot

最终组合：

```text
权重：Q4_K_M
K Cache：Q8_0
V Cache：Q8_0
上下文：131072
并发：1
GPU layers：all
Flash Attention：on
```

选择 Q8 KV 是容量与质量的折中：它比 F16 KV 节省约一半空间，又比 Q4 KV 更适合长上下文检索、结构化输出和工具参数。实测 128K 仅使用约 8.4GiB 总显存，因此没有继续降低 KV 精度，也没有使用 CPU KV。

### 4. 固定源码 commit，而不是记录“最新版”

源码信息：

```text
remote: https://github.com/ggml-org/llama.cpp.git
commit: e1a1abb78746c025f5e9039f590e37ccdb758ae7
date:   2026-07-30T21:39:46+08:00
binary: version 1 (e1a1abb)
```

源码工作树最终为 clean，没有保留运行时兼容补丁。兼容处理全部在一次性 GGUF 重写中完成，后续能直接跟踪官方 llama.cpp。

## 最终目录

```text
/home/yiko/workspace/qwen35-llamacpp-serve/
├── .venv-tools/
├── config/
│   ├── api_key
│   ├── server.env
│   └── tools-requirements.txt
├── logs/
│   └── server.log
├── models/
│   └── Qwen3.5-9B-Q4_K_M.gguf
├── run/
│   └── llama-server.pid
├── scripts/
│   ├── accept_agent_api.py
│   ├── accept_long_context.py
│   ├── accept_stream_json.py
│   ├── convert-model.sh
│   ├── convert_ollama_qwen35_text_gguf.py
│   ├── setup-tools.sh
│   ├── start.sh
│   ├── status.sh
│   └── stop.sh
└── src/
    └── llama.cpp/
```

## 从零复现

### 1. 登录并检查基线

```bash
ssh yiko@192.168.31.107

/usr/lib/wsl/lib/nvidia-smi
free -h
ss -ltnp | grep -E ':(8000|8080) ' || true
ollama show qwen3.5:9b
```

创建独立目录：

```bash
BASE=/home/yiko/workspace/qwen35-llamacpp-serve

mkdir -p \
  "$BASE/config" \
  "$BASE/logs/acceptance" \
  "$BASE/models" \
  "$BASE/run" \
  "$BASE/scripts" \
  "$BASE/src"
```

### 2. 取得并固定 llama.cpp

网络可用时可直接执行：

```bash
BASE=/home/yiko/workspace/qwen35-llamacpp-serve

git clone https://github.com/ggml-org/llama.cpp.git \
  "$BASE/src/llama.cpp"

git -C "$BASE/src/llama.cpp" checkout \
  e1a1abb78746c025f5e9039f590e37ccdb758ae7
```

验证：

```bash
git -C "$BASE/src/llama.cpp" rev-parse HEAD
git -C "$BASE/src/llama.cpp" status --short
```

### 3. 构建 CUDA 版本

```bash
BASE=/home/yiko/workspace/qwen35-llamacpp-serve
cd "$BASE/src/llama.cpp"

cmake -S . -B build \
  -DGGML_CUDA=ON \
  -DCMAKE_CUDA_ARCHITECTURES=89 \
  -DCMAKE_BUILD_TYPE=Release \
  -DLLAMA_CURL=OFF \
  -DLLAMA_BUILD_UI=OFF \
  -DLLAMA_USE_PREBUILT_UI=OFF

cmake --build build \
  --config Release \
  --target llama-server llama-cli \
  --parallel 8
```

关闭 CURL 和 UI 是为了让构建不依赖额外的 Hugging Face UI 下载或 Node/npm。API、Jinja Chat Template、工具调用和 metrics 不受影响。

检查二进制：

```bash
"$BASE/src/llama.cpp/build/bin/llama-server" --version
```

预期：

```text
version: 1 (e1a1abb)
built with GNU 13.3.0 for Linux x86_64
```

### 4. 建立独立 GGUF 工具环境

依赖清单固定为：

```text
numpy==2.5.1
PyYAML==6.0.3
requests==2.34.2
tqdm==4.70.0
```

执行：

```bash
"$BASE/scripts/setup-tools.sh"
```

脚本使用本机 `/home/yiko/.local/bin/uv`、Python 3.12 和清华 PyPI 镜像。默认 PyPI 下载 15.9MiB NumPy 超过 90 秒仍未完成；切换镜像后约 1 秒完成，因此最终复现路径直接保留快源。

### 5. 校验源模型并生成 text-only GGUF

```bash
SOURCE=/usr/share/ollama/.ollama/models/blobs/sha256-dec52a44569a2a25341c4e4d3fee25846eed4f6f0b936278e3a3c900bb99d37c

stat -c '%s' "$SOURCE"
sha256sum "$SOURCE"
```

必须得到：

```text
6594462816
dec52a44569a2a25341c4e4d3fee25846eed4f6f0b936278e3a3c900bb99d37c
```

目标文件不存在时执行：

```bash
"$BASE/scripts/convert-model.sh"
```

转换器拒绝覆盖已有文件。转换完成后验证：

```bash
MODEL="$BASE/models/Qwen3.5-9B-Q4_K_M.gguf"

stat -c '%s' "$MODEL"
sha256sum "$MODEL"
```

必须得到：

```text
5530618176
068b6bace4d4f5d18f3b3d84c48cd03304fa0e5e354da115eff26f3666023435
```

### 6. 创建 API Key

本次为了让已有 Pi 环境无缝切换，复用了第一章 API Key，并把第二章副本权限设为 `600`。独立部署可生成新 Key：

```bash
umask 077
openssl rand -hex 32 > "$BASE/config/api_key"
chmod 600 "$BASE/config/api_key"
```

不要把 Key 写入脚本、命令行参数、Markdown 或 Git。

### 7. 写入最终服务配置

`config/server.env`：

```bash
BASE_DIR=/home/yiko/workspace/qwen35-llamacpp-serve
MODEL_PATH=/home/yiko/workspace/qwen35-llamacpp-serve/models/Qwen3.5-9B-Q4_K_M.gguf
MODEL_ALIAS=qwen3.5-9b-gguf
HOST=0.0.0.0
PORT=8080
CTX_SIZE=131072
PARALLEL=1
CACHE_TYPE_K=q8_0
CACHE_TYPE_V=q8_0
BATCH_SIZE=2048
UBATCH_SIZE=512
```

`start.sh` 最终启动的核心参数：

```bash
llama-server \
  --model "$MODEL_PATH" \
  --alias qwen3.5-9b-gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 131072 \
  --parallel 1 \
  --n-gpu-layers all \
  --flash-attn on \
  --kv-offload \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --batch-size 2048 \
  --ubatch-size 512 \
  --api-key-file "$BASE/config/api_key" \
  --jinja \
  --no-mmproj \
  --no-ui \
  --metrics
```

运维脚本额外完成：

- 检查模型、二进制和 API Key；
- 强制 API Key 权限为 `600`；
- 检查端口占用；
- 验证 PID 是正整数；
- 同时核对 `/proc/PID/exe` 和模型路径，避免 PID 复用时误杀其他进程；
- 健康检查设置连接与总超时；
- 启动 180 秒未健康时清理子进程和 PID；
- 停止时先发 SIGTERM，30 秒后只对已验证的服务进程使用 SIGKILL。

### 8. 启动、检查与停止

第一章 vLLM 正在运行时先停止它：

```bash
/home/yiko/workspace/qwen35-agent-serve/scripts/stop.sh
```

启动 llama.cpp：

```bash
"$BASE/scripts/start.sh"
"$BASE/scripts/status.sh"
```

停止：

```bash
"$BASE/scripts/stop.sh"
```

重启：

```bash
"$BASE/scripts/stop.sh"
"$BASE/scripts/start.sh"
```

## API 验收

### 最小调用

```bash
API_KEY="$(<"$BASE/config/api_key")"

curl -fsS http://127.0.0.1:8080/health

curl -fsS \
  -H "Authorization: Bearer $API_KEY" \
  http://127.0.0.1:8080/v1/models
```

关闭 Thinking 的最小 Chat Completion：

```bash
curl -fsS \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  http://127.0.0.1:8080/v1/chat/completions \
  --data-binary '{
    "model": "qwen3.5-9b-gguf",
    "messages": [
      {"role": "user", "content": "只回复 READY"}
    ],
    "max_tokens": 16,
    "temperature": 0,
    "chat_template_kwargs": {
      "enable_thinking": false
    }
  }'
```

实测返回：

```text
READY
```

### 可重复验收脚本

```bash
"$BASE/scripts/accept_agent_api.py"
"$BASE/scripts/accept_stream_json.py"
"$BASE/scripts/accept_long_context.py"
```

覆盖范围：

| 脚本 | 验收内容 |
| --- | --- |
| `accept_agent_api.py` | 模型生成 `get_weather` 工具调用、参数解析、工具结果回填、最终回答 |
| `accept_stream_json.py` | OpenAI `json_schema`、SSE 文本增量、`finish_reason=stop`、`[DONE]` |
| `accept_long_context.py` | 约 110K token Prefill、首尾双针检索、16K 最大输出请求、前缀缓存 |

工具调用实测：

```text
finish_reason: tool_calls
tool name: get_weather
arguments: {"location":"上海"}
final answer: TOOL_OK 23
```

结构化与流式实测：

```text
structured output: {"status":"JSON_OK"}
stream content: STREAM_OK
stream finish_reason: stop
[DONE]: received
```

## 上下文与性能结果

### 分级启动

所有档位都使用 Q4_K_M、Q8_0 K/V、单 Slot、全部层 GPU，仅调整总上下文：

| 总上下文 | 启动 | 短回答 | 空载整卡显存 |
| ---: | --- | --- | ---: |
| 8192 | 通过 | `READY` | 5,773MiB |
| 32768 | 通过 | `CTX32_OK` | 6,307MiB |
| 65536 | 通过 | `CTX64_OK` | 7,012MiB |
| 98304 | 通过 | `CTX96_OK` | 7,701MiB |
| 131072 | 通过 | `CTX128_OK` | 8,405MiB |

完成 110K 长请求后显存为 8,421MiB，未发生 CUDA OOM，也未启用 CPU offload。

### OpenAI 接口冷缓存吞吐

通过 Mac 上的 SSH 隧道直接请求实际的 `/v1/chat/completions`。测试固定：

```text
Thinking：Off
Prompt Cache：Off
cache_n：0
并发：1
KV Cache：Q8_0
总上下文：131072
```

输出测试使用 `ignore_eos=true`，确保实际生成达到 512 或 256 tokens，而不是用十几个 token 的短回答推算 Decode。

| 场景 | API prompt | 实际输出 | Prefill | Decode | HTTP 总耗时 | 端到端输出速率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 约 8K 输入，三次中位数 | 7,989 | 512 | 5,777.77 tok/s | 103.13 tok/s | 7.077s | 72.35 tok/s |
| 约 32K 输入 | 31,976 | 3 | 5,308.34 tok/s | 样本太短，不采用 | 6.809s | 不采用 |
| 约 110K 输入 | 110,004 | 256 | 4,030.55 tok/s | 72.21 tok/s | 33.932s | 7.54 tok/s |

8K 的三次 Decode 分别为：

```text
103.13 tok/s
103.41 tok/s
101.98 tok/s
```

110K 请求中，Prefill 为 27.293s，256-token Decode 为 3.545s。表中的“端到端输出速率”把 Prefill、HTTP 和输出全部算入，因此适合描述整个请求的平均产出，不等于模型开始输出后的 Decode 速度。

极短 Prompt 经 SSH 隧道的首个非空 SSE 内容为 98.7ms；没有把 HTTP 响应头或空 delta 误算成首 token。

### 同口径 OpenAI 流式接口对比（客户端观测）

2026-07-30 将本章 llama.cpp 与第一章保留的 vLLM 服务互斥启动，在同一台机器、同一块 GPU、同一条 Mac 到 WSL 的 SSH 链路上复测。这里比较的是两套**实际部署整体**，不是只替换推理框架的严格 A/B：

| 部署 | 权重与运行时 | 上下文与 KV |
| --- | --- | --- |
| 本章 | llama.cpp `e1a1abb...`，本地派生 text-only Q4_K_M | 131072 总上下文，Q8_0 K/V，单 Slot |
| 第一章 | vLLM 0.18.1，Compressed-Tensors W4A16，Marlin kernel | `max_model_len=8192`，KV `auto`，`gpu_memory_utilization=0.85` |

两端使用完全相同的三份请求：

```text
API prompt：7345 tokens
输出：512 tokens
temperature：0
Thinking：Off
ignore_eos：true
stream：true
并发：1
```

每一轮从 Prompt 的第一个字符开始使用不同 nonce。llama.cpp 显式设置 `cache_prompt=false`，三轮都返回 `cached_tokens=0`；vLLM 启动日志确认 `enable_prefix_caching=False`，因此后两轮加速不是 Prefix Cache 命中。每个请求共 7857 tokens，低于 vLLM 的 8192 上限。

客户端计时口径：

```text
TTFT = 发出请求到首个非空 SSE delta
流式 Decode 估算 = (completion_tokens - 1)
                   / (末个非空 delta 时间 - 首个非空 delta 时间)
HTTP 总耗时 = 发出请求到流结束
端到端输出速率 = completion_tokens / HTTP 总耗时
```

逐轮原始数据：

| 部署 | 轮次 | TTFT | 客户端流式 Decode 估算 | HTTP 总耗时 | 端到端输出速率 |
| --- | ---: | ---: | ---: | ---: | ---: |
| llama.cpp Q4_K_M | 1 | 1.449s | 93.35 tok/s | 6.927s | 73.92 tok/s |
| llama.cpp Q4_K_M | 2 | 1.565s | 92.73 tok/s | 7.080s | 72.32 tok/s |
| llama.cpp Q4_K_M | 3 | 1.577s | 92.86 tok/s | 7.084s | 72.28 tok/s |
| vLLM W4A16 | 1 | 5.581s | 69.93 tok/s | 12.888s | 39.73 tok/s |
| vLLM W4A16 | 2 | 1.413s | 69.95 tok/s | 8.718s | 58.73 tok/s |
| vLLM W4A16 | 3 | 1.413s | 69.94 tok/s | 8.719s | 58.72 tok/s |

三轮中位数：

| 部署 | TTFT | 客户端流式 Decode 估算 | HTTP 总耗时 | 端到端输出速率 |
| --- | ---: | ---: | ---: | ---: |
| llama.cpp Q4_K_M | 1.565s | 92.86 tok/s | 7.080s | 72.32 tok/s |
| vLLM W4A16 | 1.413s | 69.94 tok/s | 8.719s | 58.72 tok/s |

按中位数看，vLLM 的 TTFT 少约 152ms，低约 9.7%；llama.cpp 的客户端流式输出快约 32.8%，整个请求耗时低约 18.8%。但 vLLM 明显存在冷/热两态：

- 服务从启动到 `/health` 就绪约 54s；
- 就绪后的首个 16-input / 32-output 短请求，TTFT 为 10.618s，总耗时 11.049s；
- 首个 7345-token 长输入的 TTFT 为 5.581s，是后两轮 1.413s 的约 3.95 倍；
- 三轮长输入的持续 Decode 都约为 69.94 tok/s，额外开销发生在首个输出之前；
- 日志已经确认 Prefix Cache 关闭。更可能是长输入形状触发的懒编译、Triton/CUDA kernel 初始化或调度路径预热，但本次证据不足以断言具体机制。

vLLM `/metrics` 对四个请求的汇总值与客户端 usage 一致：

```text
prompt_tokens_total     = 22051
generation_tokens_total = 1568
finished_reason=length  = 4
Prefix cache hit rate   = 0.0%
```

运行时资源：

| 部署 | `nvidia-smi` 已用 / 总显存 | 说明 |
| --- | ---: | --- |
| llama.cpp 128K | 8397MiB / 16376MiB | 128K Q8 KV，单 Slot |
| vLLM 8K | 15398MiB / 16376MiB | 模型装载报告 9.48GiB，预留 3.11GiB GPU KV，面向批处理预分配 |

vLLM 几乎吃满 16GB 显存是当前 `gpu_memory_utilization=0.85` 和批处理式 KV 预留共同作用的结果，不能只凭这一个数字判断框架固有的显存效率。启动日志还报告 WSL 下 `pin_memory=False`，可能影响当前 vLLM 路线的性能。

这组 TTFT 包含 SSH/HTTP、排队、请求解析、聊天模板、分词、Prefill、首 token Decode、SSE 序列化和传输，**不能**用 `7345 / TTFT` 冒充服务端精确 Prefill。流式 Decode 也可能受空 token、UTF-8 缓冲或一个 delta 合并多个 token 影响，因此只称客户端估算。上一个小节的 llama.cpp `timings.prompt_ms` 和 `timings.predicted_ms` 才是服务端内部计时。

对当前目标的结论：在这台 16GB 机器上做单用户、单请求编码 Agent，本章 llama.cpp 路线同时提供更长上下文、更低显存和更高持续输出速度；第一章 vLLM 仍能正常启动和完成 OpenAI 请求，但 8K 配置不满足 128K / 16K 目标。vLLM 擅长的连续批处理和多并发没有在本轮单请求实验中测试，因此不能把结果外推成两个框架的通用性能排名。

### 110K 长上下文

首次请求：

| 指标 | 实测 |
| --- | ---: |
| 内容 token | 109,993 |
| API prompt token | 110,005 |
| completion token | 17 |
| 总 token | 110,022 |
| Prefill 时间 | 27.322s |
| Prefill 吞吐 | 4,026.25 tok/s |
| 长上下文后 Decode | 74.83 tok/s |
| 检索结果 | `START-7F3A91 END-4C82D6`，正确 |

第二次发送相同请求：

```text
cached_tokens = 110001
cache_n       = 110001
prompt_n      = 4
```

同时将请求的 `max_tokens` 设为 16384，服务接受请求并正确回答。这里证明的是“16K 上限可配置”，不是“已经实际生成完整 16K”。

### 128K / 16K 在 Pi 中的预算

服务总窗口：

```text
131072
```

如果输出上限为 16384，理论上输入与模板合计最多约：

```text
131072 - 16384 = 114688
```

Pi 0.82.1 的请求层还会保留 4096 safety tokens。为了仍允许完整的 16384 输出，估算输入上限约：

```text
131072 - 16384 - 4096 = 110592
```

本次实际 prompt 为 110,005 tokens，正好验证了这一可用边界。真实 Pi 会话还包含系统提示、工具定义和历史消息，应让 Pi 的压缩机制管理预算，不要把用户文本直接塞满 110592。

短工具请求 Decode 实测约 108～115 tok/s；8K 极短回答最高约 154 tok/s。短请求数字受固定调度开销影响，不能与 110K 后约 75 tok/s 的 Decode 直接等同。

本次只测量了极短 Prompt 的流式首内容时间，没有单独测量 8K/110K TTFT；也没有运行完整 16K 长输出或多并发基准。

## 接入 Pi Code Agent

### 1. 持久化 API Key

本机文件：

```text
~/.config/qwen35/key.env
```

权限为 `600`，内容只定义：

```bash
export QWEN35_API_KEY=...
```

`~/.zshrc` 加载它：

```bash
[[ -f "$HOME/.config/qwen35/key.env" ]] \
  && source "$HOME/.config/qwen35/key.env"
```

只有 Key 发生变化时才重新读取远端：

```bash
source ~/.config/qwen35/load-key.zsh
```

该脚本现在读取：

```text
/home/yiko/workspace/qwen35-llamacpp-serve/config/api_key
```

### 2. SSH 隧道

启动：

```bash
~/.config/qwen35/start-llamacpp-tunnel.zsh
```

停止：

```bash
~/.config/qwen35/stop-llamacpp-tunnel.zsh
```

隧道使用：

```text
127.0.0.1:18080 → 192.168.31.107 → 127.0.0.1:8080
```

启动脚本使用 SSH Control Socket、`ExitOnForwardFailure` 和 keepalive，并在报告 ready 前实际请求 `/health`。

### 3. `~/.pi/agent/models.json`

保留原 `qwen35-vllm`，把以下条目合并到 `providers`；不要用整份示例覆盖已有配置：

```json
{
  "qwen35-llamacpp": {
    "baseUrl": "http://127.0.0.1:18080/v1",
    "api": "openai-completions",
    "apiKey": "$QWEN35_API_KEY",
    "authHeader": true,
    "compat": {
      "supportsDeveloperRole": false,
      "supportsReasoningEffort": false,
      "supportsUsageInStreaming": false,
      "maxTokensField": "max_tokens",
      "requiresToolResultName": true,
      "thinkingFormat": "qwen-chat-template",
      "supportsStrictMode": false
    },
    "models": [
      {
        "id": "qwen3.5-9b-gguf",
        "name": "Qwen3.5-9B Q4_K_M (LAN llama.cpp)",
        "reasoning": true,
        "input": ["text"],
        "contextWindow": 131072,
        "maxTokens": 16384,
        "cost": {
          "input": 0,
          "output": 0,
          "cacheRead": 0,
          "cacheWrite": 0
        }
      }
    ]
  }
}
```

必须保留 `"reasoning": true`，这样 Pi 才会通过 `qwen-chat-template` 显式发送 `enable_thinking=false`。若改为 `false`，Pi 不发送该字段，而 Qwen 模板可能回到默认 Thinking On。

`~/.pi/agent/settings.json` 已合并：

```json
{
  "defaultProvider": "qwen35-llamacpp",
  "defaultModel": "qwen3.5-9b-gguf",
  "defaultThinkingLevel": "off"
}
```

旧会话可能恢复自己保存的 Thinking Level；此时新开会话，或显式使用：

```bash
pi \
  --provider qwen35-llamacpp \
  --model qwen3.5-9b-gguf \
  --thinking off
```

当前新会话直接运行 `pi` 即可。

### 4. Pi 实际验收

不是只检查模型列表。本次让 Pi 在流式会话中：

1. 生成一个 `bash` 工具调用；
2. 执行无副作用的 `printf PI_TOOL_OK`；
3. 回填工具结果；
4. 继续生成最终回答。

结果：

```text
PI_AGENT_OK
```

将 llama.cpp 停止并重新启动后，不重建 SSH 隧道再次调用 Pi：

```text
PI_RESTART_OK
```

最后不传 Provider、Model 或 Thinking 参数，使用默认配置再次完成工具调用：

```text
PI_DEFAULT_AGENT_OK
```

因此当前默认入口已经达到“Pi 可以直接作为编码 Agent 调用”的最低可用状态。

## 当前状态

截至本章收尾：

- `llama-server` 正在远端 `0.0.0.0:8080` 运行；
- `/health` 返回 `{"status":"ok"}`；
- `/v1/models` 报告 `n_ctx=131072`、`n_ctx_train=262144`；
- 本机 SSH 隧道正在 `127.0.0.1:18080` 监听；
- Pi 默认 Provider 为 `qwen35-llamacpp`；
- Pi 默认 Thinking 为 Off；
- 128K Q8 KV、110K 实际 Prompt、16K 输出上限请求、工具调用、JSON Schema、SSE 和重启恢复均通过；
- 第一章目录、模型、脚本和 API Key 均保留；vLLM 0.18.1 已于 2026-07-30 重新启动并完成同口径接口测速，随后停止；
- vLLM 临时测速隧道已经关闭，llama.cpp 的 `127.0.0.1:18080` 隧道继续使用；
- Ollama 原始 6,594,462,816-byte blob 保持不变；
- llama.cpp 源码工作树 clean；
- 没有采用 CPU 权重卸载或 CPU KV。

结论：这套部署已经完成“单用户、单并发、文本编码 Agent”的第一阶段目标。它不是高并发生产服务，也还没有证明复杂项目上长期运行、Thinking On 工具调用或完整 16K 长输出的稳定性。

## 后续实验

按价值排序：

1. 使用真实代码仓库和多轮工具历史做 32K、64K、110K 质量评测。
2. 实际生成 4K、8K、16K 输出，记录速度曲线、停止原因和稳定性。
3. 对 Thinking On 单独验证工具调用与 Pi 流式回放。
4. 比较 Q8 KV 与 F16 KV 的长上下文检索和结构化输出质量。
5. 如果继续研究 vLLM，为两端各做“每次重启后的冷首请求”和“固定预热后至少五轮”的独立基准，再测试并发 2/4，验证连续批处理优势。
6. 如果需要无人值守运行，再加入 systemd、日志轮转和崩溃恢复。
7. 如果需要视觉或 MTP speculative decoding，改用 llama.cpp-native 的 442-tensor GGUF，而不是扩展本章的 text-only 派生文件。

## 参考

- [llama.cpp 官方仓库](https://github.com/ggml-org/llama.cpp)
- [llama.cpp CUDA 构建](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)
- [llama-server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- [llama.cpp Function Calling](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)
- [Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B)
- [llama.cpp 对 Ollama Qwen3.5 GGUF 兼容问题的记录](https://github.com/ggml-org/llama.cpp/issues/20134)
- [Ollama 的 llama.cpp 兼容层](https://github.com/ollama/ollama/commit/9db4bdbad6a4981ad761aa2b603e69e8fb83212c)
- [第一章 最小部署计划](./第一章%20最小部署计划.md)
- [llama.cpp 原理笔记](./llama.cpp.md)
