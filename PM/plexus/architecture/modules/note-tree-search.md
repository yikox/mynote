---
format: arch-module/v0.1
name: 笔记树与搜索流
described: 加载目录树、缓存子目录、执行全文搜索并定位编辑器结果
module_form: atomic
module_kind: function-flow
secondary_kinds:
  - data-state
main_subject: NoteTree + workspaceStore + search helpers
status: draft
review_status: not-reviewed
---

# 笔记树与搜索流

## 模块定位

该模块覆盖笔记空间中的导航和搜索定位。证据路径：`src/components/NoteTree/NoteTree.tsx`、`src/components/Layout/GlobalSearchModal.tsx`、`src/components/Layout/searchHighlight.ts`、`src/stores/workspaceStore.ts`、`src/services/notes.ts`、`src-tauri/src/core/search.rs`。

## 主函数 / 主流程

1. 打开工作区后 `workspaceStore.openPath()` 调 `notesService.list()` 加载根 entries。
2. 展开目录时 `workspaceStore.loadChildren(path)` 按 path 缓存子目录。
3. 文件 watcher 事件触发 `invalidatePath()`，根级变化会刷新根 entries。
4. 搜索调用 `notesService.search(query, path)`，Rust `core::search` 用 literal regex 在 Markdown 文件中最多返回 50 条。
5. 点击结果后通过 tab/openNote 和 `uiStore.locateRequest` 定位编辑器。

## 输入与输出

输入是工作区相对路径、搜索 query、目录展开状态。输出是 `NoteEntry[]`、搜索 hit 列表和编辑器定位请求。

## 错误处理

工作区不存在、子路径不存在由后端返回错误；前端通常以 notice 或空状态降级。

## 与其他模块关系

依赖 [笔记文件仓储](note-file-repository.md) 提供 list/search，依赖 [Tauri 事件桥](event-bridge.md) 监听外部文件变更，向 [Markdown 模块编辑引擎](markdown-module-engine.md) 发起定位。

## 性能与复杂度

目录 children 按路径缓存；搜索使用 Rust `ignore` walk 和 grep searcher，并限制结果数为 50。

## 验证方式

使用 search/highlight/quick-open/NoteTree 相关测试和 Rust `core::search` 测试。

