---
format: arch-module/v0.1
name: AI Agent 循环
described: 构造模型请求、消费流式事件、聚合工具调用并执行多轮 agent loop
module_form: atomic
module_kind: function-flow
secondary_kinds:
  - event-message
  - interface-object
main_subject: runAgent()
status: draft
review_status: not-reviewed
---

# AI Agent 循环

## 模块定位

该模块是前端 agent 的控制流核心。证据路径：`src/ai/agentLoop.ts`、`src/services/ai.ts`、`src/stores/aiRunsStore.ts`、`src/stores/agentStatusStore.ts`。

## 主函数 / 主流程

1. `runAgent()` 读取当前 session、provider、agent template 和系统提示。
2. 构造 user message 并写入 `sessionsStore`。
3. 每轮创建 assistant 占位消息，构建上下文和工具 schema。
4. 通过 `aiService.chat(requestId, body)` 请求 Rust 后端，并订阅 `ai://stream:<requestId>`。
5. 累积 token、usage 和 tool call delta；失败时按配置重试。
6. 若模型返回 tool calls，按 registry 派发工具并追加 tool message，继续下一轮。

## 输入与输出

输入是 session id、用户文本、图片引用、system prompt、agent 配置和 AbortSignal。输出是更新后的 session messages、agent status 和工具执行结果。

## 错误处理

包含总时长超时、idle 超时、流错误重试、工具调用超时、用户拒绝写工具和 abort 兜底。空回复会写入提示性 assistant 消息。

## 时序与调用关系

`ChatPanel.send()` 调用 `runAgent()`；`runAgent()` 调用 [上下文与工具注册](ai-context-tools.md)、[Provider 配置与流式代理](provider-config-proxy.md) 和 note/web search 工具。

## 性能与复杂度

上下文构建按 token 预算裁剪；tool result 限制为 8000 字符；流事件直接增量更新会话状态。

## 验证方式

使用 `agentLoop.test.ts`、`completion.test.ts`、tool preview/display 测试和组件集成测试。

