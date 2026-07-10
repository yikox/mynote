---
format: arch-module/v0.1
name: 应用 Shell 布局
described: 组合顶栏、活动栏、侧栏、标签栏、主区域、状态栏和全局弹窗
module_form: atomic
module_kind: layout-style
secondary_kinds:
  - data-state
main_subject: AppShell
status: draft
review_status: not-reviewed
---

# 应用 Shell 布局

## 模块定位

该模块定义 React 前端的应用框架和第一层布局。证据路径：`src/App.tsx`、`src/components/Layout/AppShell.tsx`、`src/components/Layout/MainArea.tsx`、`src/components/Layout/Sidebar.tsx`、`src/styles/shell.css`。

## 主体结构

- `App` 加载主题并渲染 `AppShell`。
- `AppShell` 挂载 `TopBar`、`ActivityBar`、`Sidebar`、`TabBar`、`MainArea`、`StatusBar`。
- 全局浮层集中挂载在 Shell 末尾：Settings、AI Config、ConfirmTool、Prompt、QuickOpen、GlobalSearch 和 AppConfirm。
- `MainArea` 依据当前 tab kind 切换 `MarkdownEditor` 或 `ChatPanel + AgentStatusWindow`。

## 样式规则

布局主要由 `app-shell`、`app-shell__body`、`app-shell__sidebar`、`app-shell__main`、`main-area` 类名驱动。侧栏宽度来自 `settingsStore.sidebarWidth`，AI 主区通过 CSS 变量接收侧栏宽度。

## 响应式与状态变化

`settingsStore.sidebarCollapsed` 控制侧栏是否渲染；`tabsStore.activeSpace` 决定侧栏显示笔记树还是 AI 会话列表。未打开 tab 时显示 Notes/Ai welcome。

## 与其他模块关系

读取 [前端状态 stores](ui-state-stores.md)，通过 [Tauri 前端服务适配](tauri-service-adapters.md) 恢复工作区状态，挂载 [笔记作者体验组合](note-authoring-module.md) 和 [AI Agent 工作台组合](ai-agent-workbench.md)。

## 约束与非目标

Shell 不直接读写文件、不构造 AI 请求、不处理 Git 同步细节；它只负责布局装配和启动/持久化编排。

## 验证方式

使用布局组件测试、全局快捷键测试、`npm run build` 验证。

