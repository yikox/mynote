---
format: arch-module/v0.1
name: Markdown 模块编辑引擎
described: 将 Markdown 解析为可编辑块并处理预览、列表、表格、数学、Mermaid 和图片
module_form: atomic
module_kind: function-flow
secondary_kinds:
  - layout-style
  - utility-support
main_subject: ModuleMarkdownEditor + parseMarkdownModules()
status: draft
review_status: not-reviewed
---

# Markdown 模块编辑引擎

## 模块定位

该模块负责当前富编辑体验。证据路径：`src/components/Editor/ModuleMarkdownEditor.tsx`、`src/components/Editor/markdownModules.ts`、`src/components/Editor/tableEditing.ts`、`src/components/Editor/listTree.ts`、`src/components/Editor/smartTableLayout.ts`、`src/components/Markdown/mermaid.tsx`、`src/components/Markdown/katex.tsx`。

## 主函数 / 主流程

1. `parseMarkdownModules(markdown)` 按行识别 frontmatter、heading、paragraph、list、table、codeBlock、image、blockquote、hr、html、blank。
2. `ModuleMarkdownEditor` 渲染每个模块的 preview 或 textarea 编辑槽。
3. 点击预览区域时将渲染偏移映射回源码偏移，进入局部编辑。
4. 表格、列表、任务项、代码高亮、数学和 Mermaid 使用专门 helper 渲染或编辑。
5. 变更通过 `replaceMarkdownModule()` 回写整篇 Markdown。

## 输入与输出

输入是完整 Markdown 字符串、note path 和链接/图片处理回调。输出是新的 Markdown 字符串以及 UI 预览。

## 错误处理

Mermaid 渲染失败时显示错误 fallback 和源文本；图片解析失败时由 `LocalImage`/资产服务降级；解析器尽量把未知块归为 paragraph/html。

## 性能与复杂度

解析以行扫描为主。智能表格会测量容器宽度并使用 `ResizeObserver` 调整列宽。

## 与其他模块关系

由 [编辑器草稿生命周期](editor-draft-lifecycle.md) 驱动；图片写入依赖 [图片资产管线](asset-image-pipeline.md)；内部链接跳转回到 [笔记树与搜索流](note-tree-search.md)。

## 验证方式

使用 `markdownModules.test.ts`、`ModuleMarkdownEditor.test.tsx`、`tableEditing.test.ts`、`smartTableLayout.test.ts`、`mermaid.test.tsx` 等测试。

