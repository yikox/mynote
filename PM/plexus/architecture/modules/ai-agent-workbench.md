---
format: arch-module/v0.1
name: AI Agent 工作台组合
described: 组织聊天界面、上下文预算、工具执行、provider 配置和流式代理
module_form: composite
module_kind: function-flow
main_subject: ChatPanel + runAgent() + provider proxy
status: draft
review_status: not-reviewed
---

# AI Agent 工作台组合

## 模块定位

该组合负责 AI 对话体验和 agent 执行链路。前端生成模型请求、维护会话和工具执行，Rust 后端负责 provider 配置读取、密钥读取、HTTP/SSE 代理和模型信息查询。

## 子模块清单

| 子模块 | module_kind | 职责 |
| --- | --- | --- |
| [AI 聊天界面](ai-chat-surface.md) | `layout-style` | 展示消息、输入框、附件、状态窗口和上下文预算。 |
| [AI Agent 循环](ai-agent-loop.md) | `function-flow` | 构造请求、订阅流、重试、聚合 tool calls、派发工具。 |
| [上下文与工具注册](ai-context-tools.md) | `config-rule` | 管理工具 schema、工具开关、上下文预算和状态快照。 |
| [Provider 配置与流式代理](provider-config-proxy.md) | `adapter-io` | 连接前端 provider 设置、后端密钥读取和外部模型 API。 |

## 组合边界

组合内不直接读写 workspace 文件系统；所有笔记工具走 `notesService`，所有外部模型请求走 Rust `ai_proxy`。

## 内部关系

`ChatPanel.send()` 建立 system prompt 和 AbortController 后调用 `runAgent()`。`runAgent()` 通过 `buildModelContext()` 和 `llmToolSchemas()` 生成 payload，通过 `aiService.chat()` 请求后端，并通过 `aiService.subscribe()` 消费 `ai://stream:<requestId>`。

## 对外入口

`MainArea` 在 AI tab 激活时渲染 `ChatPanel` 和 `AgentStatusWindow`。Sidebar 的 AI 空间通过 `SessionsList` 和 `sessionsStore` 管理会话入口。

## 禁止依赖

前端 agent 不应读取或持有 API key；模型网络请求必须通过 Rust provider proxy。AI 工具不应绕过 `notesService`、`webSearchService` 或显式工具 registry 增加隐藏能力。

## 演进规则

新增模型 provider 时优先扩展 provider 配置和 Rust header/endpoint 适配；新增工具时优先注册在 `src/ai/tools/defs` 并让 agent 配置控制启用与写权限。

## 验证方式

使用 `src/ai/*.test.ts`、`src/ai/tools/**/*.test.ts`、`src/components/AIChat/*.test.tsx` 和后端 `ai_proxy` 测试。
