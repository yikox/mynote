---
format: arch-module/v0.1
name: 工作区生命周期
described: 打开工作区、确保 Git 与内部目录、恢复 active workspace 并启动 watcher/pusher
module_form: atomic
module_kind: interface-object
secondary_kinds:
  - adapter-io
  - config-rule
main_subject: open_workspace()
status: draft
review_status: not-reviewed
---

# 工作区生命周期

## 模块定位

该模块管理 active workspace 的后端生命周期。证据路径：`src-tauri/src/commands/workspace.rs`、`src-tauri/src/state.rs`、`src-tauri/src/core/config.rs`、`src-tauri/src/watcher.rs`、`src/services/workspace.ts`、`src/stores/workspaceStore.ts`。

## 对外接口

Tauri 命令包括 `pick_workspace`、`open_workspace`、`get_active_workspace`、`load_workspace_state`、`save_workspace_state`。

## 生命周期

`open_workspace()` 校验目录、调用 `ensure_workspace_setup()`、写入 `AppState.workspace`、启动 watcher、重启 Git pusher、保存 app-level active workspace，并返回 `WorkspaceInfo`。

## 内部状态

Rust `AppState` 持有 active workspace、watcher handle、git pusher handle、GitHub OAuth 临时状态。前端 `workspaceStore` 持有 path 与目录缓存。

## 协作对象

依赖 [本地 Git 历史](git-local-history.md) 初始化仓库和提交 `.gitignore`，启动 [Tauri 事件桥](event-bridge.md) watcher，启动 [远端 Git 同步调度器](git-remote-sync-pusher.md)。

## 兼容性约束

打开旧工作区时会把 `.gitnote` 迁移为 `.plexus`，并把 `.gitignore` 中旧忽略项替换为 `.plexus/`。

## 验证方式

使用 workspace 命令调用方测试、Rust config/workspace_state 测试和端到端构建。

