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

