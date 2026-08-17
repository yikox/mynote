## 任务

在远程机器 `root@10.255.1.238` 上部署 `deepseek-ai/DeepSeek-V4-Flash-0731`，优先保持原始精度表达，并在可用、正确、稳定的前提下提高吞吐。

## 约束与方法

- 所有部署、构建、下载和性能实验只在远程机器进行。
- 不在通信基线前修改 BIOS、IOMMU、ACS 或驱动配置。
- 从 4K context、单并发、关闭 DSpark、F16 KV cache 的最小闭环开始。
- 关键结论必须有远端命令、日志和实测数据支撑。
- 远端审计与实验日志统一保存在 `/root/ds4_3090_audit/`。

## 已验证事实（2026-08-10）

- 系统：Ubuntu 24.04 LTS，运行于 LXC；宿主内核 `6.8.12-19-pve`。
- CPU：双路 Intel Xeon Platinum 8350C，2 个 NUMA；容器仅放行 32 个逻辑 CPU。
- 可见内存约 256 GiB，无 swap；`/dev/shm` 约 252 GiB。
- 根盘 2.0 TB，剩余约 1.2 TB。
- GPU：8×RTX 3090 24 GiB；初始审计时无 GPU 进程。驱动 580.126.18，驱动报告 CUDA 13.0，系统 nvcc 12.0。
- PCIe：8 张卡均为 Gen4 x16；GPU0–3 属于 NUMA0，GPU4–7 属于 NUMA1；岛内 PXB，GPU2↔3 与 GPU6↔7 为 PIX，跨岛为 SYS。
- `nvidia-smi topo -p2p p/n` 对所有 GPU pair 均为 `NS`；peer read 矩阵为 `CNS`，CUDA sample 已进一步确认 Peer Connectivity 全为 0。
- 宿主启动参数已包含 `intel_iommu=on iommu=pt pcie_acs_override=downstream,multifunction`，不是本次任务修改。
- 远端已有 `/root/llama.cpp`、SGLang 源码与若干环境，但没有发现 DeepSeek-V4 模型文件。
- 远端已有一个长期存在的 Qwen 模型下载进程；本任务不停止、不覆盖该进程及其文件。

## 最终路线

采用 `llama.cpp + UD-Q8_K_XL GGUF + 8 卡 layer split`，让跨 NUMA 的关键通信主要集中在层边界。官方 0731 模型为 304B、混合 BF16/FP8 权重；Unsloth 将 162 GB 的 `UD-Q8_K_XL` 标注为 full-precision lossless 档，但这不表示逐 bit 等同官方 safetensors。该 Q8 只比 Q4 大约 6.3 GiB，并能在本机全 GPU 驻留，因此作为原始精度优先主线；TP8/EP 因无 P2P 与 LXC NCCL SHM 限制不采用。

## 通信实测

- NVIDIA CUDA sample 显示 8 卡 `Peer Connectivity` 全为 0。
- 无 direct P2P 时 GPU 间经 Host staging 的带宽约 10.8–16 GB/s。
- GPU0/GPU4 的 pinned Host↔Device 带宽约 25–26 GB/s；本地/远端 NUMA 绑定差异很小。
- 4 卡 NCCL AllReduce（256 MiB/rank）默认约 3.295 GB/s algbw、4.942 GB/s busbw；强制 `NCCL_P2P_DISABLE=1` 后约 3.312/4.969 GB/s，证明默认本来就没有使用 direct P2P。
- 8 卡默认 NCCL 在当前 LXC 中出现 `/dev/shm/nccl-*` attach 失败；仅作诊断地关闭 SHM 后可经 NET/Socket 运行，AllReduce 约 1.312 GB/s，AllToAll 约 2.352 GB/s。
- 结论：TP8/EP 同时面临共享内存可靠性和跨 NUMA 通信吞吐风险，不作为主线；llama.cpp layer split 不依赖 NCCL collective。

## 已固定的软件与模型

- llama.cpp 固定提交：`e23e9440eb0c625c30d6c40266e9335071a4debc`，包含 DeepSeek4、0731 模板与近期修复。
- 为避免以 root 执行公共仓库构建规则，源码通过 `git archive` 导出到 `/tmp`，由 `nobody` 用户以 `GGML_CUDA=ON`、SM86、NCCL off 完成隔离构建；运行时复制到 `/root/deepseek-v4-flash-0731/runtime/` 并记录 SHA256。
- 基线运行时显式关闭 CUDA Graphs；同一提交、同一编译参数的 `runtime_graphs/` 候选已通过严格输出一致性和性能 A/B，成为最终运行时。
- 主模型：`unsloth/DeepSeek-V4-Flash-0731-GGUF` 的 `UD-Q8_K_XL`，固定 revision `fbbb5b93fb787c21338159b0af3318bb3f4d9768`。
- 5 个 GGUF 分片总计 `161,869,615,520` 字节，约 150.75 GiB；相比 Q4 只多约 6.3 GiB，优先保留非 expert 权重精度。
- 五个分片已全部达到固定字节数并匹配固定 revision 的 SHA256；GGUF metadata 为 version 3、`architecture=deepseek4`、5 分片，内嵌 chat template。
- Hugging Face 直连探测约 1.27 MB/s；ModelScope 镜像约 3.85 MB/s，且清单中的文件大小与 SHA256 均与固定 Hugging Face revision 匹配，因此使用可续传镜像完成下载，最终逐片 SHA256 全部通过。
- 真实 `huggingface_hub + hf_xet` 独立测速已确认命中 Xet，但 60 秒仅新增约 40 KiB，没有进入有效大块传输；现有 ModelScope aria2 单分片约 1.0–1.7 MiB/s，因此不切源、不重启、不并发写同一文件。
- 正确性风险：DeepSeek-V4 量化 K cache 存在静默乱码的上游问题，最终固定 `K/V=f16`。当前 Q8 五片没有 nextn/MTP/DSpark draft tensors，而 llama.cpp 的 DSpark 需要独立 draft GGUF，因此未下载第二 checkpoint、未启用 speculative。

## 最终配置与性能

- 最终服务脚本：`/root/deepseek-v4-flash-0731/runtime/ds4-server.sh`；默认仅绑定业务地址 `10.255.1.238:8000`，模型别名 `deepseek-v4-flash-0731`，通过 root-only API Key 文件保护生成端点。
- 当前 Claude Code 默认参数：`runtime_graphs`、8 卡 layer split、单槽 context 262144、parallel 1、batch/ubatch 512/128、Flash Attention、F16 K/V、continuous batching、direct I/O。启动脚本与审计副本 SHA256 均为 `80075a150d3cf5b0875375b8b80ce5d209c7d75281748bc6db2e819710667643`。
- 模型元数据的 `context_length` 为 1,048,576，YARN `original_context_length` 为 65,536。64K F16 候选以 50,041-token 输入和 `max_tokens=4096` 返回 HTTP 200、`thinking+text=323`，耗时 128.54 秒；工具调用、流式事件和鉴权均通过，GPU 峰值最高 21,849 MiB。
- 历史 128K F16 配置以 90,081-token 输入和 `max_tokens=4096` 完成跨 64K 的针检索：正确从上下文开头取回校验码 `731946`，HTTP 200、`end_turn`，耗时 279.392 秒；GPU 峰值最高 21,993 MiB，无 OOM/Xid。
- 最终 256K F16 配置按持续对话路径完成 100,009→160,004→220,059 tokens 三轮验收，三轮均 HTTP 200、`thinking+text/end_turn` 且正确取回上下文开头校验码 `582741`。第二轮复用 99,877 tokens、仅新算 60,127；第三轮复用 159,872、仅新算 60,187；对应耗时 325.209/298.052/375.157 秒。工具调用、流式事件和鉴权均通过，GPU 峰值最高 22,321 MiB、最高 65°C，无 OOM/Xid。证据位于 `/root/ds4_3090_audit/results/context_capacity_20260811/`。
- CUDA Graphs 在相同正确性下将 S4 聚合吞吐从约 27.37 提高到 30.54 tokens/s，提升约 11.6%。
- batch/ubatch 512/128 将固定 2048-token prefill 从约 251.4 提高到 421.0 tokens/s，提升约 67.4%；固定 128-token raw decode 与 128/32 基本相同。
- 历史吞吐 profile `parallel 2 + 总 context 8192 + continuous batching` 的 S4 中位聚合吞吐约 48.81 tokens/s；关闭 continuous batching 仅约 31.71 tokens/s。parallel 3/4 因并发空正文或 tool call 失败被正确性闸门淘汰。该 profile 仍可通过环境变量手动覆盖，但不再是默认值。
- 历史吞吐 profile 的并发 4、100 请求流式测试：100/100 成功，聚合约 49.40 tokens/s，TTFT p50/p95 约 3.02/11.66 秒，端到端 p50/p95 约 6.13/16.20 秒；显存峰值约 21.75 GiB，最高 56°C，无 OOM/Xid。当前 256K 单槽 profile 优先保证 Claude Code 上下文，不能同时提供两路生成并发。
- 最终串行 100 请求同样 100/100；2K/4K 固定 seed 输出 SHA 完全一致，8 项 low 正确性、流式/非流式、JSON schema、tool call、多轮和 reasoning 均通过。

## 当前状态与操作

- 2026-08-11 完成 256K 固化后服务 PID 为 `734820`，监听 `10.255.1.238:8000`；本机已直接访问 `/health` 得到 HTTP 200，无需 SSH 隧道。服务日志确认 `n_slots=1`、`n_ctx_slot=262144`、F16 K/V。没有配置 systemd 或开机自启。
- 默认启动、停止、状态和健康检查：

```bash
/root/deepseek-v4-flash-0731/runtime/ds4-server.sh start
/root/deepseek-v4-flash-0731/runtime/ds4-server.sh stop
/root/deepseek-v4-flash-0731/runtime/ds4-server.sh status
/root/deepseek-v4-flash-0731/runtime/ds4-server.sh health
```

- OpenAI 兼容地址为 `http://10.255.1.238:8000/v1`。API Key 保存在 `/root/deepseek-v4-flash-0731/runtime/.api-key`，权限 `root:root 0600`；不要把密钥写入代码、日志或公开笔记，应读取后放入 Agent 的 secret 环境变量。
- llama.cpp 的 `/health` 与 `/v1/models` 为公开端点；无 Key 调用 `/v1/chat/completions` 返回 HTTP 401，带 `Authorization: Bearer <API_KEY>` 的非流式和流式请求均返回 200，算术答案为 323，SSE 含 usage 与 `[DONE]`。密钥未出现在进程参数或服务日志中。
- Claude Code 使用 Anthropic 兼容地址 `http://10.255.1.238:8000`，不要在 `ANTHROPIC_BASE_URL` 后追加 `/v1`。现网已验证 `/v1/messages/count_tokens`、普通消息的 `thinking+text`、强制 `tool_use` 以及 `message_start/content_block_delta/message_stop` 流事件。
- 当前 llama-server 默认启用精确前缀缓存。5,034-token 首次请求耗时 11.823 秒；完全相同请求复用 5,030 tokens 后仅 0.549 秒；相同长前缀只改末尾问题时复用 4,902 tokens，仅 0.881 秒。因此 Claude Code 连续对话不会每轮重算全部历史，但新增 token 仍需关注已有长上下文，160K/220K 阶段各新增约 60K 仍需约 5–6 分钟。
- Claude Code 自定义模型默认可能预留 32K 输出，必须显式设置 `CLAUDE_CODE_MAX_CONTEXT_TOKENS=262144` 与 `CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096`，否则会过早挤占可用输入窗口。
- 调用方建议显式传 `reasoning_effort=low` 且 `max_tokens>=512`；过小预算可能全部耗在 reasoning，得到 `finish_reason=length` 与空正文。
- 中文最终报告：`/root/ds4_3090_audit/results/final_report.md`；最终清单：`/root/ds4_3090_audit/results/final_manifest.sha256`。
- 旧 `/root/llama.cpp` 保持原 commit 且 clean；端口 30001 的既有 uvicorn 与原 Qwen 下载均未触碰。
