---
format: arch-module/v0.1
name: Tauri 事件桥
described: 在 Rust 后端异步事件和前端 stores/components 之间传递 watcher、AI stream、Git sync 与菜单事件
module_form: atomic
module_kind: event-message
secondary_kinds:
  - interface-object
main_subject: app.emit + listen()
status: draft
review_status: not-reviewed
---

# Tauri 事件桥

## 模块定位

该模块描述前后端事件通道。证据路径：`src-tauri/src/watcher.rs`、`src-tauri/src/commands/ai.rs`、`src-tauri/src/commands/git_remote.rs`、`src-tauri/src/commands/menu.rs`、`src/services/events.ts`、`src/services/ai.ts`、`src/services/gitRemote.ts`。

## 事件目录

| 事件 | 生产者 | 消费者 | 用途 |
| --- | --- | --- | --- |
| `notes://changed` | Rust watcher | `AppShell` / `workspaceStore` | 外部文件变更后作废目录缓存。 |
| `ai://stream:<requestId>` | `commands::ai` 转发任务 | `runAgent()` | 传 token、tool delta、usage、done、error。 |
| `git-sync-status` | Git pusher reporter | `gitRemoteStore` | 展示同步状态和错误。 |
| `app://menu-shortcut` | menu command | global hotkeys/menu handler | 触发应用快捷命令。 |

## 传递语义

Tauri event 是异步广播。AI stream 使用 request id 隔离不同请求；listener 由 `runAgent()` 在每次 attempt finally 中取消。

## 消费规则

订阅方必须持有并调用 unlisten，避免组件卸载后继续写状态。状态 store 接收事件时做幂等或缓存作废。

## 可靠性

事件 emit 失败目前多为忽略式处理；实际数据真源仍在文件系统、session store 或 Git 状态中。

## 与其他模块关系

连接 [工作区生命周期](workspace-lifecycle.md)、[AI Agent 循环](ai-agent-loop.md)、[远端 Git 同步调度器](git-remote-sync-pusher.md) 与 [前端状态 stores](ui-state-stores.md)。

## 验证方式

通过事件调用方测试、AI stream 测试和 Git remote store 测试间接验证。

