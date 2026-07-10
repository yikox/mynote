---
format: arch-module/v0.1
name: 笔记作者体验组合
described: 覆盖笔记树、搜索、自动保存草稿和模块化 Markdown 编辑体验
module_form: composite
module_kind: function-flow
main_subject: NoteTree + MarkdownEditor + editor helpers
status: draft
review_status: not-reviewed
---

# 笔记作者体验组合

## 模块定位

该组合负责用户在笔记空间中的主要工作：浏览笔记树、创建/打开笔记、搜索定位、编辑 Markdown、插入图片、处理外部修改和保存状态。

## 子模块清单

| 子模块 | module_kind | 职责 |
| --- | --- | --- |
| [笔记树与搜索流](note-tree-search.md) | `function-flow` | 从 workspace store 读取目录树，按需加载子目录，处理搜索定位。 |
| [编辑器草稿生命周期](editor-draft-lifecycle.md) | `data-state` | 管理笔记草稿、自动保存、防抖、脏标记、外部变更协调。 |
| [Markdown 模块编辑引擎](markdown-module-engine.md) | `function-flow` | 解析 Markdown 块并渲染可编辑预览、表格、列表、数学和 Mermaid。 |

## 组合边界

组合内只处理前端编辑体验和本地草稿状态；持久化由 `note-file-repository` 完成，图片二进制由 `asset-image-pipeline` 完成。

## 内部关系

`MarkdownEditor` 是组合入口：它使用 `useNoteDraft` 提供 `draft/setDraft`，再把文档交给 `ModuleMarkdownEditor` 或 `PlainTextEditor`。目录与搜索定位通过 `workspaceStore`、`uiStore.locateRequest` 和编辑器跳转函数协作。

## 对外入口

`MainArea` 在 note tab 激活时渲染 `MarkdownEditor`。Sidebar 的新建按钮通过 `createUntitledNote()` 和 `tabsStore.openNote()` 进入该组合。

## 禁止依赖

编辑器和笔记树不应直接访问本机文件系统或自行拼接绝对路径；所有笔记读写、搜索、reveal 和图片二进制读写必须经由 services 与后端安全路径边界。

## 演进规则

新增 Markdown 块能力时优先放在 `src/components/Editor` 的解析/渲染/编辑 helper 中；涉及文件读写时通过 `notesService`，不要绕过后端路径安全边界。

## 验证方式

使用 `src/components/Editor/*.test.*`、`src/components/Layout/*search*.test.*` 和 `npm run build` 验证。
