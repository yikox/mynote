---
format: arch-module/v0.1
name: 远端 Git 同步调度器
described: 基于 commit/config/foreground/sync 信号调度 fetch/push 并发布同步状态
module_form: atomic
module_kind: event-message
secondary_kinds:
  - adapter-io
  - data-state
main_subject: GitPusher
status: draft
review_status: not-reviewed
---

# 远端 Git 同步调度器

## 模块定位

该模块负责可选的远端 Git 自动同步。证据路径：`src-tauri/src/core/git_pusher.rs`、`src-tauri/src/core/git_remote.rs`、`src-tauri/src/core/git_sync.rs`、`src-tauri/src/core/git_config.rs`、`src-tauri/src/commands/git_remote.rs`、`src/stores/gitRemoteStore.ts`。

## 事件目录

- `Signal::ConfigChanged`：重读 `.plexus/git.json`，刷新状态并安排间隔。
- `Signal::CommitMade`：写操作提交后更新 pending/unpushed。
- `Signal::SyncNow`：立即执行同步。
- `Signal::ForegroundChanged(bool)`：前后台切换时执行或暂停间隔同步。
- `Signal::Shutdown`：关闭任务。
- Tauri event `git-sync-status`：发布 status、unpushed、behind、last error、last sync time。

## 传递语义

内部使用 tokio mpsc channel，状态保存在 `Arc<Mutex<StatusSnapshot>>`。auth 错误会 lock，直到配置变化解除。

## 消费规则

前端 `gitRemoteStore.hydrate()` 读取当前配置与状态并订阅 `git-sync-status`；auth/diverged 错误只弹一次 notice，直到错误消失或变化。

## 可靠性

同步失败分类为 network/auth/diverged/no_remote/other。远端 push 使用 `ensure_origin()` 保持 origin URL 与配置一致。

## 与状态关系

读取 `.plexus/git.json` 和对应 secret；读取本地 Git ahead/behind；将 status 快照 emit 给前端。

## 验证方式

使用 `git_pusher` 异步测试、`git_remote` local bare repo 测试、`git_config` 测试和前端 store 测试。

