---
format: arch-module/v0.1
name: Tauri 前端服务适配
described: 将前端调用封装为稳定的 invoke/listen 服务对象
module_form: atomic
module_kind: interface-object
secondary_kinds:
  - adapter-io
main_subject: src/services/*
status: draft
review_status: not-reviewed
---

# Tauri 前端服务适配

## 模块定位

该模块保护前端和 Tauri 命令之间的调用契约。证据路径：`src/services/notes.ts`、`src/services/workspace.ts`、`src/services/workspaceState.ts`、`src/services/ai.ts`、`src/services/gitRemote.ts`、`src/services/providers.ts`、`src/services/secrets.ts`、`src/services/assets.ts`、`src/services/events.ts`。

## 对外接口

服务对象按资源分组：`notesService`、`workspaceService`、`workspaceStateService`、`aiService`、`gitRemoteService`、`providersService`、`secretsService`、`assetsService`。事件订阅通过 `onNotesChanged()`、`onSyncStatus()`、`aiService.subscribe()`。

## 生命周期

services 自身无持久生命周期；由 stores 或组件在需要时调用。事件订阅方负责保存并调用 `UnlistenFn`。

## 内部状态

该模块不持有业务状态，只定义命令名、参数名和 TS 返回类型。

## 协作对象

上游是 React components/stores/agent loop；下游是 Tauri `commands`。该模块也是命令名变化时需要同步更新的主要边界。

## 兼容性约束

参数名必须匹配 Rust `#[tauri::command]` 函数签名，例如 `stateJson`、`requestId`、`providerId`、`private` 等。

## 验证方式

通过调用方测试和 TypeScript 编译验证。涉及事件名时检查 Rust emit 常量与前端 listen 名称一致。

