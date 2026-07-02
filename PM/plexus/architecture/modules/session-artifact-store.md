---
format: arch-module/v0.1
name: 会话与内部资源存储
described: 管理 workspace 内部 .plexus 会话、workspace 状态、chat assets 和历史清理
module_form: atomic
module_kind: resource-file
secondary_kinds:
  - data-state
  - adapter-io
main_subject: .plexus/sessions + workspace.json
status: draft
review_status: not-reviewed
---

# 会话与内部资源存储

## 模块定位

该模块描述工作区私有资源文件结构。证据路径：`src-tauri/src/core/sessions.rs`、`src-tauri/src/commands/sessions.rs`、`src-tauri/src/core/workspace_state.rs`、`src/services/sessions.ts`、`src/services/workspaceState.ts`、`src/stores/sessionsStore.ts`。

## 文件结构

- `.plexus/workspace.json`：open tabs、active tab、sidebar width、active space、space active ids。
- `.plexus/sessions/<id>.json`：AI 会话 JSON，由前端定义具体结构，Rust 端透传。
- `.plexus/chat-assets/<session>/<uuid>.<ext>`：聊天图片附件。
- `.plexus/context-blobs/<session>`：旧上下文归档目录，仅保留删除清理函数。

## 格式规则

会话 id 不允许为空、`.`、`..`、斜杠、反斜杠或包含 `..`。`workspace_state` 使用 camelCase serde，缺失字段默认。

## 加载与解析

前端 `sessionsStore.loadIndex()` 先列 ids，再逐个加载 session meta。`workspaceStateService.load()` 在打开工作区后恢复 tabs/settings。

## 引用关系

`ChatPanel`、`sessionsStore` 和 agent loop 写会话；`AppShell` 读写 workspace state；删除 session 会连带清理 chat assets 和旧 context artifacts。

## 版本与迁移

`.plexus` 是 `.gitnote` 的后继内部目录，打开工作区时由工作区生命周期模块迁移。

## 验证方式

使用 `sessions.rs`、`workspace_state.rs` Rust 测试和 `sessionsStore.test.ts`。

