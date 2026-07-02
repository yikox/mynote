---
format: arch-module/v0.1
name: 前端状态 stores
described: 用 Zustand 管理 workspace、tabs、settings、sessions、AI run 和同步状态
module_form: atomic
module_kind: data-state
secondary_kinds:
  - event-message
  - config-rule
main_subject: src/stores/*
status: draft
review_status: not-reviewed
---

# 前端状态 stores

## 模块定位

该模块是前端运行态真源。证据路径：`src/stores/workspaceStore.ts`、`src/stores/tabsStore.ts`、`src/stores/sessionsStore.ts`、`src/stores/settingsStore.ts`、`src/stores/aiConfigStore.ts`、`src/stores/providersStore.ts`、`src/stores/gitRemoteStore.ts`、`src/stores/agentStatusStore.ts`、`src/stores/aiRunsStore.ts`。

## 数据模型

- `workspaceStore`：active workspace、根目录 entries、children cache、expanded dirs、revealed path。
- `tabsStore`：notes/ai 空间、tabs、各空间 active id、dirty 标记。
- `sessionsStore`：会话索引、会话消息、pending input、会话持久化动作。
- `settingsStore`：主题、侧栏宽度/折叠、快捷键，主要存 localStorage。
- `aiConfigStore`：agent 模板、工具开关、循环参数、上下文预算。
- `providersStore`：provider 列表、active provider、密钥是否存在。
- `gitRemoteStore`：远端 Git 配置、同步状态、错误 toast 去重。

## 状态流转

启动恢复由 `AppShell` 触发：打开工作区 -> 读取 workspace state -> hydrate tabs/settings -> load sessions -> hydrate Git remote。运行时事件通过 services 写回对应 store。

## 读写路径

UI 组件通过 hooks 读取 store。异步动作通过 `src/services/*` 访问后端；只有 UI 配置类状态直接写 localStorage。

## 一致性与并发

`tabsStore.close()` 会中断 AI run 并清理状态。`sessionsStore` 更新会话时同步更新 index 排序。`workspaceStore.invalidatePath()` 对子目录缓存进行局部作废。

## 与其他模块关系

被 [应用 Shell 布局](app-shell-layout.md)、[编辑器草稿生命周期](editor-draft-lifecycle.md)、[AI Agent 循环](ai-agent-loop.md)、[远端 Git 同步调度器](git-remote-sync-pusher.md) 读写。

## 验证方式

使用 `src/stores/*.test.ts` 和依赖这些 stores 的组件测试。

