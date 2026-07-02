---
format: arch-module/v0.1
name: 前端 Shell 与状态组合
described: 组织应用框架、全局状态恢复和 Tauri 前端适配的组合模块
module_form: composite
module_kind: layout-style
main_subject: AppShell + Zustand stores + services/*
status: draft
review_status: not-reviewed
---

# 前端 Shell 与状态组合

## 模块定位

该组合是 React 前端的运行入口层。它把布局区域、全局弹窗、工作区恢复、标签恢复、全局快捷键、Tauri invoke/event service 封装连接起来。

## 子模块清单

| 子模块 | module_kind | 职责 |
| --- | --- | --- |
| [应用 Shell 布局](app-shell-layout.md) | `layout-style` | 负责应用主框架、侧栏/主区/状态栏和全局弹窗挂载。 |
| [前端状态 stores](ui-state-stores.md) | `data-state` | 持有 workspace、tabs、settings、sessions、AI run 等 UI 运行态。 |
| [Tauri 前端服务适配](tauri-service-adapters.md) | `interface-object` | 把 UI 和 stores 的调用转换成 Tauri `invoke` / `listen` 契约。 |

## 组合边界

组合内负责前端运行态和前端到后端的调用边界；不拥有 Rust 后端的文件系统、Git、网络或密钥逻辑。

## 内部关系

`AppShell` 读取 stores 并调用 services 恢复状态。stores 的异步动作通过 services 访问 Tauri 命令。事件 services 将 watcher、AI stream、Git sync 状态写回 stores。

## 对外入口

外部主要通过 `src/main.tsx` 挂载 `<App />`，由 `App` 加载主题并渲染 `AppShell`。

## 禁止依赖

Shell 和 stores 不应直接绕过 `src/services/*` 调用 Rust 命令，也不应直接持有后端文件系统、Git 远端或密钥细节。后端逻辑变更应先落在 Tauri commands/core，再通过服务适配进入前端。

## 演进规则

新增全局 UI 或持久运行态时优先扩展现有 store/service 模式；只有当状态属于后端真源时才新增 Rust 命令。

## 验证方式

使用现有 React/Vitest 测试覆盖 stores、布局组件和服务调用方；整体编译通过 `npm run build`。
