# Plexus 项目管理

Last updated: 2026-07-31

## 项目概况

- Tauri 2 + React 19 的本地 Markdown 笔记应用，包含知识节点、Git 版本管理与带工具的 AI Agent。

## 当前状态

- Version: 0.8.1
- State: 活跃开发；最新本地构建已安装并运行于 `/Applications/Plexus.app`。
- Current focus: 根据实际试用反馈持续优化界面与键盘交互。

## 活跃任务

- 试用 AI 会话模型选择菜单的新键盘操作与焦点恢复行为。

## 里程碑

- 快速捕获能力已完整拆除，历史 `inbox/` 笔记保留为普通节点。
- 模型选择菜单已支持方向键、Home/End、Enter/Space 与 Escape。
- 本机重新安装流程已自动化。

## 待办

- 后续每次代码修改完成后运行 `npm run install:local`，让用户直接试用最新版本。

## 阻塞与风险

- 当前无已知阻塞。

## 最近更新

- 2026-07-31 - 建立并验证测试、打包、签名、完整替换和重启的一键本机安装流程。
