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



## 拆分后的执行笔记

本节点保留方案、环境、结论与状态；执行细节按验收边界拆到三个子节点，避免重复维护：

- [从零部署与服务运维](./第二章%20llama.cpp%20部署%20Qwen3.5-9B/从零部署与服务运维.md) — 从远程基线、源码与 GGUF 准备到服务启停
- [API 与性能验收](./第二章%20llama.cpp%20部署%20Qwen3.5-9B/API%20与性能验收.md) — API、上下文、性能和长上下文验收
- [Pi Code Agent 接入](./第二章%20llama.cpp%20部署%20Qwen3.5-9B/Pi%20Code%20Agent%20接入.md) — SSH 隧道、Pi 配置与 Agent 验收

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
