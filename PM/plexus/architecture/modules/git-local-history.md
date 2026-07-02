---
format: arch-module/v0.1
name: 本地 Git 历史
described: 初始化工作区 Git 仓库、提交全部文件改动并计算本地/远端差异
module_form: atomic
module_kind: adapter-io
secondary_kinds:
  - function-flow
main_subject: core::git
status: draft
review_status: not-reviewed
---

# 本地 Git 历史

## 模块定位

该模块封装 libgit2 本地仓库操作。证据路径：`src-tauri/src/core/git.rs`、`src-tauri/src/commands/workspace.rs`、`src-tauri/src/commands/notes.rs`。

## 外部契约

提供 `is_repo()`、`init_repo()`、`commit_all()`、`current_branch()`、`behind_count()`、`unpushed_count()`。

## 内外映射

`commit_all()` 使用 index `add_all("*")`、写 tree、读取 repo signature 或 fallback Plexus signature，并在 tree 未变化时返回 `Ok(false)`。

## 失败模式

Git 仓库打开、签名、写 index/tree、detached HEAD 等错误映射为 `AppError::Git`。未找到远端 ref 时 ahead/behind 计算按 0 或完整本地历史处理。

## 与其他模块关系

被 [工作区生命周期](workspace-lifecycle.md) 初始化仓库，被 [笔记文件仓储](note-file-repository.md) 写命令触发 commit，被 [远端 Git 同步调度器](git-remote-sync-pusher.md) 用来计算 unpushed/behind。

## 验证方式

使用 `core::git` Rust 测试，包括 init、commit、clean tree、branch、unpushed/behind 计算。

