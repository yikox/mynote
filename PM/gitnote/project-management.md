# GitNote Project Management

Last updated: 2026-06-13

## Overview
- GitNote：基于 Tauri 2 + React 的桌面 Markdown 笔记应用，笔记以本地文件存储并通过 git 同步。
- 仓库：`yikox/gitnote`（GitHub，当前为 **私有**仓库）。

## Current Status
- Version: 0.1.0（`package.json` 与 `src-tauri/tauri.conf.json` 一致）
- State: 开发中；正在搭建首个对外可下载的 Release 发布流程
- Current focus: 通过 GitHub Actions 把各平台编译产物发布到 Release 页面

## Active Tasks
- 配置 GitHub Release 自动发布（macOS / Windows / Linux 安装包）—— 工作流已就绪，等待首次构建验证

## Milestones
- v0.1.0：首个可下载构建（draft release，待 build 成功后手动 Publish）

## Todo
- 验证 Actions 运行 `27471556379`（tag v0.1.0）成功并生成 draft release
- 成功后在 Releases 页面检查 draft 并手动 Publish
- 后续（可选）：macOS 公证 / Windows 代码签名，消除"未签名"告警
- 后续（可选）：若要任何人可下载，需将仓库改为 Public（发布前先确认历史无密钥）

## Blockers and Risks
- 仓库私有 → Release 与安装包仅对有仓库权限的人可见（匿名用户 404）
- 安装包未签名 → macOS 首次打开需右键→打开绕过 Gatekeeper；Windows 可能触发 SmartScreen

## Recent Updates
- 2026-06-13 - 重写 `.github/workflows/release.yml`：改用「直接 `tauri build` + `softprops/action-gh-release`」三段式流程，替换会报 "No artifacts were found" 的 tauri-action；新增 macOS universal 构建；`permissions: contents: write`。决定保持仓库私有、产物不签名、发布为 draft。
