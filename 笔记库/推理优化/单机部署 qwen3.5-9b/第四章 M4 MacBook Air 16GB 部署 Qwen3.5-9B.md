> 本章将 M4 MacBook Air、16GB 统一内存作为独立部署目标，整理 Qwen3.5-9B 在 Apple Silicon 上的可行配置和现实边界。
>
> 状态：已完成 M4 MacBook Air 16GB 上的实机部署和第 4 节 API 验收。以下速度为本机短请求实测值；长上下文、持续运行和并发仍需单独压测。

## 结论

M4 MacBook Air 16GB 可以部署 Qwen3.5-9B，但应把目标限定为单用户、单请求、短到中等上下文的本地助手。推荐使用 MLX 生态的 4-bit 权重：

```text
模型：mlx-community/Qwen3.5-9B-4bit
运行时：MLX-VLM
上下文：日常 4K～8K，较长任务最多约 16K
并发：1
用途：中文问答、代码解释和小范围生成、文档摘要、截图理解、本地 API
```

这台机器的关键限制不是“能不能把模型加载起来”，而是加载后还要为 KV Cache、临时张量、macOS 和其他应用留下空间。原生 262K 上下文是模型能力上限，不是 16GB MacBook Air 的现实工作区间；128K/262K、并发服务和长时间高负载 Agent 循环不应作为本机目标。

## 1. 硬件与内存预算

目标机器为 M4 MacBook Air、16GB 统一内存，具体配置可能是 8 核或 10 核 GPU，统一内存带宽约 120GB/s，且采用无风扇散热。MLX 的 CPU/GPU 共享统一内存，不需要像独立显卡那样复制一份完整权重，但总内存仍由所有进程共同消耗。

推荐的 MLX 4-bit 模型文件约 5.95GB。运行时还需要：

| 部分 | 工程估算 |
| --- | ---: |
| 4-bit 权重 | 约 6GB |
| 运行缓冲区和临时张量 | 约 1～2GB |
| KV Cache | 随上下文长度增长 |
| macOS 与后台应用 | 数 GB |
| 模型进程合计 | 约 7～10GB，取决于请求 |

按材料中的粗略 BF16 KV Cache 估算：8K 约 256MB、16K 约 512MB、32K 约 1GB、128K 约 4GB、262K 约 8GB。这个估算还没有计入 Gated DeltaNet 状态、Prefill 临时张量、图片编码和系统内存，因此只能用于判断趋势。

建议把上下文设为：普通聊天 4K～8K，代码问答 8K，较长文档 16K；32K 仅用于关闭大型应用后的极限测试。图片输入会增加视觉 token 和 Prefill 内存，不能简单按文字上下文预算。

## 2. 量化和运行时选择

### 2.1 首选 4-bit MLX 模型

4-bit 是 16GB 统一内存下的平衡点。它给权重、KV Cache 和系统留下了可用余量，模型能力也比更激进的 3-bit 更稳定。

| 权重格式 | 本机判断 |
| --- | --- |
| 3-bit | 更省内存，但能力损失更明显 |
| **4-bit** | **首选** |
| 5-bit | 可以试验，但余量变小 |
| 6-bit | 不建议日常使用 |
| 8-bit | 容易触发内存压力或 Swap |
| BF16/FP16 | 无法为上下文和系统留下可靠余量 |

直接使用：

```text
mlx-community/Qwen3.5-9B-4bit
```

不建议一开始使用约 8.2GB 的混合精度版本或 8-bit 版本。更高精度带来的能力收益，通常抵不过 16GB 机器上的内存压力和 Swap 风险。

### 2.2 为什么选择 MLX-VLM

Qwen3.5-9B 是统一图文模型。MLX-VLM 同时覆盖文字、图片和 Thinking 模式，并适合 Apple Silicon 的统一内存；相较只面向纯文本的运行时，它可以保留截图分析能力。若明确只需要纯文本，可再比较 MLX-LM 等更窄的运行时，但本章基线使用 MLX-VLM。

## 3. 最小部署流程

### 3.1 创建隔离环境并安装

要求 Apple Silicon、macOS 14 或更新版本，以及原生 ARM 的 Python 3.10+：

```bash
mkdir -p ~/qwen35
cd ~/qwen35

python3 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
pip install --upgrade mlx-vlm
python -c "import platform; print(platform.processor(), platform.machine())"
```

应看到 `arm`/`arm64` 一类的原生架构输出；不要让 Python 通过 Rosetta 以 x86 方式运行。首次下载模型前预留 10～15GB 磁盘空间。

### 3.2 单次生成和交互式聊天

```bash
python -m mlx_vlm.generate \
  --model mlx-community/Qwen3.5-9B-4bit \
  --prompt "请用通俗的语言解释 CUDA Graph 的作用" \
  --max-tokens 512 \
  --temperature 0.6
```

模型会在第一次运行时从 Hugging Face 下载。交互式模式：

```bash
python -m mlx_vlm.chat \
  --model mlx-community/Qwen3.5-9B-4bit
```

### 3.3 Thinking 模式

复杂编程或方案设计可按需打开，并限制思考预算：

```bash
python -m mlx_vlm.generate \
  --model mlx-community/Qwen3.5-9B-4bit \
  --enable-thinking \
  --thinking-budget 512 \
  --prompt "设计一个支持任务依赖、失败重试和超时控制的任务调度系统" \
  --max-tokens 1024
```

建议普通问题关闭 Thinking；复杂问题使用 256～1024 的预算。不要把几千或上万 token 的思考预算设为默认值，因为无风扇机身会持续满载，延迟、温度和电池消耗都会上升。

### 3.4 图片和截图

```bash
python -m mlx_vlm.generate \
  --model mlx-community/Qwen3.5-9B-4bit \
  --image ~/Desktop/error.png \
  --prompt "分析截图中的报错，说明可能原因和排查步骤" \
  --max-tokens 800 \
  --temperature 0
```

单次尽量只输入一张图片，截图优先缩放到 1920×1920 以下；图片任务前关闭浏览器的大量标签页。

## 4. 暴露为 Agent 可调用的本地 API

### 4.0 本次实测配置与结果

本次实验使用 Apple Silicon 原生 Python 3.12、`mlx-vlm==0.6.8` 和本地 ModelScope 下载的 `mlx-community/Qwen3.5-9B-4bit`。模型目录为：

```text
/Users/zyc/qwen35/models/Qwen3.5-9B-4bit
```

服务绑定 `127.0.0.1:8080`，以 Bearer API key 保护，启动参数为：

```text
--max-kv-size 8192
--max-tokens 2048
--prefill-step-size 2048
--log-level INFO
```

服务运行在 tmux 会话 `qwen35-api` 中，日志位于 `/Users/zyc/qwen35/logs/server.log`。本次验收结果：

| 项目 | 结果 |
| --- | --- |
| `/health` | HTTP 200，模型已加载 |
| 非流式 `/v1/chat/completions` | 通过 |
| SSE 流式响应 | 通过 |
| OpenAI Python SDK | 通过 |
| 空闲后首个请求 | 12.6 秒；模型/Metal 预热阶段 Prefill 约 1.3 token/s |
| 稳态短请求 Prefill | 约 49～67 token/s（24 token 输入） |
| 稳态短请求 Decode | 非流式约 12～14 token/s；流式约 13～14 token/s |
| 128 token 流式输出 | TTFT 约 0.55～0.62 秒，总 Decode 约 10.7 token/s |
| 长输入 Prefill | 371/1427/5651 token 分别约 3.5/13.2/48.8 秒 |
| 峰值统一内存 | 约 8.95 GB（5651 token 输入） |
| 测试时系统 Swap | 已使用约 6.53 GB；需在低负载环境复测确认影响 |

当前 `mlx-vlm` 版本会把本地绝对路径作为模型 ID 返回。因此 Agent 请求中的 `model` 必须写成上面的绝对路径；写成 `qwen3.5-9b` 或 `mlx-community/Qwen3.5-9B-4bit` 会被当作 Hugging Face 仓库名重新查找，不能作为本次服务的别名。

按材料中的 MLX-VLM 服务方案，可以启动 OpenAI-compatible 接口（本次实测使用本地路径和 API key）：

```bash
mlx_vlm.server \
  --host 127.0.0.1 \
  --port 8080 \
  --model /Users/zyc/qwen35/models/Qwen3.5-9B-4bit \
  --max-kv-size 8192 \
  --max-tokens 2048 \
  --prefill-step-size 2048 \
  --api-key "$QWEN35_MLX_API_KEY"
```

启动后先检查健康状态，再调用 Chat Completions。健康检查和推理请求都要带 Bearer key：

```bash
export QWEN35_MLX_API_KEY="$(< /Users/zyc/qwen35/config/api_key)"

curl http://127.0.0.1:8080/health \
  -H "Authorization: Bearer $QWEN35_MLX_API_KEY"

curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Authorization: Bearer $QWEN35_MLX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "/Users/zyc/qwen35/models/Qwen3.5-9B-4bit",
    "messages": [{"role": "user", "content": "写一个简短的 C++ 线程池设计说明"}],
    "max_tokens": 512,
    "temperature": 0.6,
    "chat_template_kwargs": {"enable_thinking": false}
  }'
```

Python 客户端的核心配置：

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:8080/v1",
    api_key=os.environ["QWEN35_MLX_API_KEY"],
)
response = client.chat.completions.create(
    model="/Users/zyc/qwen35/models/Qwen3.5-9B-4bit",
    messages=[{"role": "user", "content": "解释 torch.compile 的基本工作流程"}],
    max_tokens=512,
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
)
print(response.choices[0].message.content)
```

首次使用前安装：

```bash
pip install openai
```

实际接入 Pi、Cursor 或其他 Agent 时，应先用 `curl` 和 OpenAI SDK 验证模型 ID、流式响应、错误返回和工具调用字段；不同版本的 MLX-VLM CLI/API 可能有参数差异，正式固定脚本前应以当前安装版本的 `--help` 和接口响应为准。

### 4.1 Pi Agent 接入

已在 `/Users/zyc/.pi/agent/models.json` 增加 `qwen35-mlx` provider，核心字段如下：

```json
{
  "baseUrl": "http://127.0.0.1:8080/v1",
  "api": "openai-completions",
  "apiKey": "$QWEN35_MLX_API_KEY",
  "authHeader": true,
  "model": "/Users/zyc/qwen35/models/Qwen3.5-9B-4bit",
  "contextWindow": 8192,
  "maxTokens": 2048
}
```

Pi 的实际验收命令：

```bash
export QWEN35_MLX_API_KEY="$(< /Users/zyc/qwen35/config/api_key)"
pi --offline --no-session --no-tools \
  --provider qwen35-mlx \
  --model /Users/zyc/qwen35/models/Qwen3.5-9B-4bit \
  --thinking off \
  -p "只回复：Pi 通过"
```

本机已通过 `/Users/zyc/.config/qwen35/load-mlx-key.zsh` 生成持久环境文件，并在 `~/.zshrc` 自动加载 `QWEN35_MLX_API_KEY`。它与远端服务使用的 `QWEN35_API_KEY` 分开，避免互相覆盖。新开 zsh 会话后实测返回 `持久环境通过`，说明 Pi → OpenAI-compatible API → MLX-VLM → Qwen3.5-9B 的最小链路已打通。

## 5. 推荐请求参数与速度预期

| 任务 | temperature | max_tokens | Thinking |
| --- | ---: | ---: | --- |
| 普通聊天 | 0.6 | 512～1024 | 关闭 |
| 代码/确定性任务 | 0～0.3 | 1024～2048 | 按需开启 |
| 摘要/信息提取 | 0 | 256～1024 | 关闭 |

本次 API 实测的短请求 Decode 约 12～14 token/s，明显低于此前 15～25 token/s 的工程估算；输出变长时速度会下降，256 token 非流式输出约 14.3 token/s，128 token 流式输出约 10.7 token/s。真正影响 Agent 体感的是 Prefill：约 1.4K 输入 token 首 token 约 13 秒，约 5.6K 输入 token 首 token 约 49 秒。不要把短 prompt 的 Decode 数字当成长 Agent 循环的稳定吞吐。

## 6. 适用范围与不适用范围

适合：

- 个人离线助手和隐私文档摘要；
- 中文问答、代码解释、小范围代码生成；
- 单张截图分析；
- 一个用户、一个请求的本地 OpenAI-compatible API。

不适合：

- 24 小时高负载服务、多用户并发或批量推理；
- 100K 以上文档和大型代码仓库的完整上下文；
- 大量图片批处理；
- 长时间自动化 Agent 循环；
- 把无风扇 MacBook Air 当作生产服务器。

若优先级是更低温度、更短等待和更好的电池续航，建议降到 Qwen3.5-4B 4-bit；若优先级是单机能力上限，则保留 9B 4-bit，并接受单并发、8K～16K 上下文和较长生成时间。

## 7. 本章状态与后续验收

当前结论是“方案可行、已完成本机最小 API 验收，并确认长上下文会明显变慢”。本次基准已经覆盖冷/稳态短请求、输出长度、输入长度、Thinking 开关、流式 TTFT 和 Swap 观察；后续仍应记录：

1. 模型冷启动时间、首次下载后的缓存位置和磁盘占用；
2. 4K、8K、16K 输入下的 TTFT、Decode token/s、峰值统一内存和 Swap；
3. `max_tokens=512/2048` 的短输出与长输出稳定性；
4. OpenAI-compatible API 的流式响应、错误处理和 Agent 工具调用；
5. Thinking 开关、单张图片输入和持续 30 分钟单并发运行后的温度/降频；
6. 发生内存压力时的安全降级顺序：关闭后台应用 → 降低上下文 → 降低输出预算 → 切换 4B 模型。

本章最准确的定位是：**M4 16GB 上 Qwen3.5-9B 4-bit 的个人本地助手部署基线**。要改善 Agent 体感，应优先限制每轮输入到 2K～4K token、关闭默认 Thinking、使用流式输出，并在关闭大型应用或重启后再评估 Swap；它仍不是 128K/16K 的高负载编码 Agent 服务。

## 参考

- [Qwen/Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B)
- [mlx-community/Qwen3.5-9B-4bit](https://huggingface.co/mlx-community/Qwen3.5-9B-4bit)
- [MLX Unified Memory](https://ml-explore.github.io/mlx/build/html/usage/unified_memory.html)
- [MLX 安装文档](https://ml-explore.github.io/mlx/build/html/install.html)
- [mlx-vlm README](https://github.com/Blaizzy/mlx-vlm/blob/main/README.md)
