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

