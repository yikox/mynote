---
format: arch-module/v0.1
name: 同步与配置运行时组合
described: 覆盖本地 Git、远端同步调度、事件桥和应用配置规则
module_form: composite
module_kind: event-message
main_subject: git + git_pusher + config stores + Tauri events
status: draft
review_status: not-reviewed
---

# 同步与配置运行时组合

## 模块定位

该组合负责笔记库的版本历史、远端推送、状态事件和配置持久化。它横跨 Rust core、Tauri events、前端 stores 和本地/工作区配置文件。

## 子模块清单

| 子模块 | module_kind | 职责 |
| --- | --- | --- |
| [本地 Git 历史](git-local-history.md) | `adapter-io` | 初始化仓库、提交全部改动、计算 ahead/behind。 |
| [远端 Git 同步调度器](git-remote-sync-pusher.md) | `event-message` | 接收 commit/config/foreground/sync 信号并执行 fetch/push。 |
| [Tauri 事件桥](event-bridge.md) | `event-message` | 传递 `notes://changed`、`ai://stream:*`、`git-sync-status` 等事件。 |
| [应用配置规则](app-config-rules.md) | `config-rule` | 记录 localStorage、`~/.plexus`、`.plexus` 中的配置归属和迁移。 |

## 组合边界

组合内处理配置、状态事件和 Git 同步；不处理 Markdown 编辑算法或具体聊天 UI 布局。

## 内部关系

笔记写操作触发本地 commit 后发送 `CommitMade`。`GitPusher` 基于 `.plexus/git.json`、密钥和前后台信号执行同步，并 emit `git-sync-status`。配置 stores 和 Rust config 模块各自拥有不同持久化位置。

## 对外入口

前端设置页、Git remote store、工作区打开流程和笔记写命令都会进入该组合。

## 禁止依赖

Git 同步调度不应直接操作编辑器草稿或聊天 UI；它只消费 Git/config/foreground/commit 信号并发布同步状态。配置模块不应把密钥写入 provider、workspace state 或前端 localStorage。

## 演进规则

新增配置时必须明确持久化位置和迁移来源；新增同步状态时同步更新 Rust payload、TS 类型和 store reducer。

## 验证方式

使用 `git_pusher`、`git_remote`、`git_config`、前端 store 测试和 renderer/编译校验。
