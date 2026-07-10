---
format: arch-module/v0.1
name: 笔记文件仓储
described: 以工作区安全相对路径读写、移动、删除、列出和搜索 Markdown 笔记
module_form: atomic
module_kind: adapter-io
secondary_kinds:
  - resource-file
  - function-flow
main_subject: core::notes + commands::notes
status: draft
review_status: not-reviewed
---

# 笔记文件仓储

## 模块定位

该模块是笔记文件系统边界。证据路径：`src-tauri/src/core/notes.rs`、`src-tauri/src/commands/notes.rs`、`src-tauri/src/core/search.rs`、`src/services/notes.ts`、`src/types/note.ts`。

## 外部契约

前端通过 `list_notes/read_note/create_note/create_dir/update_note/delete_note/move_note/reveal_note/search_notes` 访问。路径均为相对工作区根的 POSIX 风格路径。

## 内外映射

`core::notes::resolve()` 拒绝绝对路径、父级穿越和非法 component。`list_dir()` 将文件系统 metadata 映射为 `NoteEntry`，目录优先并按名称排序。`search()` 只搜索 `.md` 文件。

## 失败模式

不存在路径返回 NotFound；空写入路径和目录写入返回 InvalidInput；越界路径返回 Forbidden。`reveal_note` 使用平台命令打开系统文件管理器。

## 与状态关系

写操作由 `commands::notes` 包装，成功写文件后调用 `core::git::commit_all()` 并通知 Git pusher。前端保存状态由 [编辑器草稿生命周期](editor-draft-lifecycle.md) 持有。

## 与其他模块关系

服务 [笔记树与搜索流](note-tree-search.md)、[编辑器草稿生命周期](editor-draft-lifecycle.md)、[上下文与工具注册](ai-context-tools.md) 中的工具执行和 [图片资产管线](asset-image-pipeline.md) 的安全路径复用。

## 验证方式

使用 `core::notes`、`core::search` Rust 测试，以及前端 notes service 调用方测试。

