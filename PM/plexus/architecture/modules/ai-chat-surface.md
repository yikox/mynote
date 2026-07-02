---
format: arch-module/v0.1
name: AI 聊天界面
described: 展示会话消息、输入、附件、上下文预算和 agent 状态窗口
module_form: atomic
module_kind: layout-style
secondary_kinds:
  - data-state
main_subject: ChatPanel
status: draft
review_status: not-reviewed
---

# AI 聊天界面

## 模块定位

该模块是 AI 空间的用户界面层。证据路径：`src/components/AIChat/ChatPanel.tsx`、`src/components/AIChat/MessageList.tsx`、`src/components/AIChat/InputBox.tsx`、`src/components/AIChat/ToolCallBubble.tsx`、`src/components/AgentStatus/AgentStatusWindow.tsx`、`src/styles/chat.css`。

## 主体结构

`ChatPanel` 加载会话、provider、agent 配置、上下文预算和运行态；`MessageList` 展示消息；`InputBox` 管理文字、笔记附件和图片附件；`AgentStatusWindow` 展示运行阶段、工具、usage 与上下文 breakdown。

## 状态变化

发送消息会清空待发图片、创建 AI run AbortController、设置 agent phase，并调用 `runAgent()`。停止只 abort 当前 session run；切换 tab 不中断后台运行。

## 输入与输出

输入是用户文本、可选笔记附件、图片附件和当前 agent 模板。输出是会话消息流、状态提示和持久化会话。

## 与其他模块关系

触发 [AI Agent 循环](ai-agent-loop.md)，读取 [前端状态 stores](ui-state-stores.md)，通过 [会话与内部资源存储](session-artifact-store.md) 保存会话与 chat assets。

## 约束与非目标

该模块不直接调用外部模型 API；模型请求和流处理由 agent loop 与 provider proxy 完成。

## 验证方式

使用 `src/components/AIChat/*.test.tsx`、`AgentStatusWindow.test.tsx` 和 `npm run build`。

