---
format: arch-module/v0.1
name: Provider 配置与流式代理
described: 连接前端 provider 元数据、后端密钥读取和外部 OpenAI/Anthropic 风格 API
module_form: atomic
module_kind: adapter-io
secondary_kinds:
  - config-rule
  - event-message
main_subject: providers + ai_proxy
status: draft
review_status: not-reviewed
---

# Provider 配置与流式代理

## 模块定位

该模块是 AI 模型外部 API 边界。证据路径：`src/stores/providersStore.ts`、`src/services/providers.ts`、`src/services/secrets.ts`、`src/services/ai.ts`、`src-tauri/src/core/providers.rs`、`src-tauri/src/commands/ai.rs`、`src-tauri/src/core/ai_proxy.rs`、`src-tauri/src/commands/secrets.rs`。

## 外部契约

支持 OpenAI chat completions 风格 `/chat/completions` 流式 SSE；header 支持 `openai` bearer 和 `anthropic` x-api-key 两种风格。模型信息查询先请求 `/models/{id}`，失败后请求 `/models` 列表。

## 内外映射

前端 provider 元数据保存到 `~/.plexus/providers.json`；API key 保存到 `~/.plexus/secrets.json` 并只在 Rust 内部读取。`commands::ai::ai_chat` 读取 active provider 和 key 后调用 `ai_proxy::stream_chat()`。

## 失败模式

HTTP 非成功状态会 emit error event；SSE parse/断流会返回错误或 done fallback；模型信息缺失返回 NotFound。

## 可观测性

前端 agent loop 记录请求大小、首字节、总耗时、usage；后端通过 `StreamEvent` 传 token、tool delta、usage、done、error。

## 与其他模块关系

由 [AI Agent 循环](ai-agent-loop.md) 调用；配置由 [应用配置规则](app-config-rules.md) 管理；流事件通过 [Tauri 事件桥](event-bridge.md) 回到前端。

## 验证方式

使用 `ai_proxy` 单元测试、provider/settings 组件测试和 agent loop 测试。

