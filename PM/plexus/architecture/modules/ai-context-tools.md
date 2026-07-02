---
format: arch-module/v0.1
name: 上下文与工具注册
described: 管理 agent 模板、上下文预算、状态快照、工具 schema 和工具执行配置
module_form: atomic
module_kind: config-rule
secondary_kinds:
  - function-flow
  - utility-support
main_subject: buildModelContext() + TOOL_REGISTRY
status: draft
review_status: not-reviewed
---

# 上下文与工具注册

## 模块定位

该模块定义模型上下文和工具能力的规则层。证据路径：`src/ai/contextBuilder.ts`、`src/ai/contextTransforms.ts`、`src/ai/stateSnapshot.ts`、`src/ai/tools/registry.ts`、`src/ai/tools/defs/*`、`src/stores/aiConfigStore.ts`、`src/ai/systemPrompt.ts`。

## 配置结构

`aiConfigStore` 持有 agent templates、model behavior、tools、loop、context 配置。默认预设包括通用助手、研究助手、笔记管家和写作助手。工具注册表包含 `list_notes`、`read_note`、`search_notes`、`create_note`、`update_note`、`delete_note`、`move_note`、`web_search`。

## 合并与优先级

运行时使用 active agent template；若 template 未指定 provider，则使用 active provider。工具配置由 registry default 与用户 settings 合并。旧配置字段通过 migration 迁入新结构。

## 校验规则

写工具默认需要确认，除非 `perToolWriteAutoAllow` 为特定工具开启。上下文预算优先使用 provider 的 context window，否则使用 agent 默认上限。

## 生效时机

每次 `runAgent()` 调用时重新构建上下文，应用最新 agent 配置、provider 限制、系统提示、工具 schema 和状态快照。

## 与其他模块关系

服务 [AI Agent 循环](ai-agent-loop.md)，工具执行通过 [Tauri 前端服务适配](tauri-service-adapters.md) 进入 [笔记文件仓储](note-file-repository.md) 或 web search。

## 验证方式

使用 `contextBuilder.test.ts`、`contextTransforms.test.ts`、`systemPrompt.test.ts`、`tools/registry.test.ts` 和各 tool defs 测试。

