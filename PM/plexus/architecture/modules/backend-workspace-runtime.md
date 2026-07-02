---
format: arch-module/v0.1
name: 后端工作区运行时组合
described: 管理 Tauri 命令、工作区打开、文件仓储、图片资产和会话资源
module_form: composite
module_kind: adapter-io
main_subject: src-tauri/src/commands + src-tauri/src/core
status: draft
review_status: not-reviewed
---

# 后端工作区运行时组合

## 模块定位

该组合是应用和本机文件系统之间的主要边界。它负责打开工作区、创建内部目录、读写笔记、写入图片、保存会话和暴露 Tauri 命令。

## 子模块清单

| 子模块 | module_kind | 职责 |
| --- | --- | --- |
| [工作区生命周期](workspace-lifecycle.md) | `interface-object` | 打开/恢复工作区，确保 Git 与 `.plexus` 结构，启动 watcher/pusher。 |
| [笔记文件仓储](note-file-repository.md) | `adapter-io` | 安全解析路径，读写/移动/删除 Markdown 文件，提供搜索入口。 |
| [图片资产管线](asset-image-pipeline.md) | `adapter-io` | 解码、嗅探、限制和读写编辑器/聊天图片。 |
| [会话与内部资源存储](session-artifact-store.md) | `resource-file` | 管理 `.plexus/sessions`、chat assets 和 workspace state 文件。 |

## 组合边界

组合内负责本机 IO 和工作区私有资源；不拥有前端 UI 状态，也不直接构造 LLM 请求。

## 内部关系

`commands` 从 `AppState` 读取 active workspace，再调用 `core` 函数。写笔记命令调用 `core::git::commit_all()`，并通知远端同步模块。

## 对外入口

`src-tauri/src/lib.rs` 的 `tauri::generate_handler!` 注册所有命令。前端通过 `src/services/*` 调用这些命令。

## 禁止依赖

Rust `core` 不应反向依赖前端 UI 状态或 Tauri window；需要前端事件、AppState 或系统对话框时应放在 `commands` / watcher / pusher 适配层。文件 IO 不应绕过 `notes::resolve` 的工作区边界。

## 演进规则

新增文件 IO 能力时应在 `core` 中实现可测试纯逻辑，再用 `commands` 封装 Tauri 状态和参数。

## 验证方式

使用 Rust 单元测试、Tauri 命令调用方测试和 `npm run build` / `npm run rust:test`。
