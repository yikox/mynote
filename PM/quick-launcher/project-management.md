# QuickLauncher 项目管理

Last updated: 2026-06-24

## Overview
- macOS 菜单栏快捷启动器：YAML 配置快捷指令，全局热键（默认 `⌥Space`）唤起面板，模糊搜索后回车执行。
- 支持三种动作：`open`（打开路径/URL，可指定 app、透传 `args`）、`shell`、`terminal`。
- 本地路径：`/Users/zyc/work/2026/quick-launcher`
- 远端：GitHub `yikox/quick-launcher`（**公开**，2026-06-16 由私有改为公开），分支 `main`。
- Homebrew tap：`yikox/homebrew-tap`（公开）。

## Current Status
- Version: 1.2.2
- State: v1.2.2 修正「用 AI 配置」默认提示词；窗口看板 demo 已按“窗口状态与内容预览”方向修正（未发布）。
- Current focus: 无进行中需求。

## Active Tasks
- 无进行中任务。

## Milestones
- 初始仓库 + 首版功能（open/shell/terminal、热键、模糊搜索）。
- 2026-06-14：`open.args` 能力 + 配方手册（manual.html）+ 扩充示例配置（7 条配方）。
- 2026-06-15：两层指令结构（组/子项 + 分层搜索 + 子项 MRU）；App/菜单栏图标；tag 触发 Release CI。
- 2026-06-16：更换为新图标；搭建 Homebrew 分发（公开仓库 + tap + 源码构建 + tag 自动更新 formula）。
- 2026-06-17：修复 brew 安装后启动崩溃（资源路径，v1.1.3）+ 去掉 Xcode 依赖（仅需 CLT）；brew 全链路实测通过。
- 2026-06-17：工作区(workspace)启动（一键拉起多窗口、同路径、按比例排布、防重复）+ 命令类型角标（工作区/单层/双层不同色胶囊），v1.2.0。
- 2026-06-18：格式说明从 commands.yaml 注释抽成版本化的 manual.md（每次启动覆盖刷新，升级老用户也更新）+ 默认「用 AI 配置」改两层组(Claude/Codex/Agent) + 菜单栏「打开使用手册」，v1.2.1。

## Todo
- （可选）正式签名 / 公证，免去 Gatekeeper 手动放行。
- （可选）README 顶部加版本/安装徽章。

## Blockers and Risks
- 2026-06-24：窗口预览 demo 当前使用 `CGWindowListCreateImage`，macOS 14 起已 deprecated；若产品化需要迁到 ScreenCaptureKit，并处理屏幕录制权限体验。
- DMG 为 ad-hoc 签名：首次打开可能被 Gatekeeper 拦，需 `xattr -dr com.apple.quarantine /Applications/QuickLauncher.app`（Homebrew 从源码本地构建则无此问题）。
- `ConfigLoader.ensureExists()` **不覆盖已存在的 `commands.yaml`**：老用户升级后看不到新示例，需手动删除旧配置重生（保护用户改动，是预期行为）。
- CI 的 `Update Homebrew Tap` 依赖 secret `TAP_GITHUB_TOKEN`（fine-grained PAT，对 homebrew-tap Contents:write）；过期/失效会导致 tag 后 formula 不自动更新。

## Recent Updates
- 2026-06-24 - 窗口看板 demo 方向修正（未发布）：去掉误导性的终端任务启动器，改为通用窗口监控；右侧展示选中窗口状态、窗口内容预览、Terminal.app busy/idle 探测，并保留打开 App 以产生新窗口。验证：`swift build` 通过，`swift run LauncherCoreTests` 76/76 通过。
- 2026-06-18 - v1.2.2：修正「用 AI 配置」默认提示词——点名让 AI「读取并阅读 manual.md + commands.yaml 再增改写回」。旧词只说「阅读…格式说明」，AI 启动后没真正打开文件，表现为「没识别到提示词」。
- 2026-06-18 - 版本化使用手册 manual.md + AI 配置两层(Claude/Codex/Agent) + 菜单「打开使用手册」，v1.2.1 发布。解决「升级后看不到新格式说明」（旧文档塞在 commands.yaml 注释、ensureExists 不覆盖）。
- 2026-06-17 - 工作区(workspace) + 命令类型角标，v1.2.0 发布。工作区用 System Events AppleScript 排布窗口，需「辅助功能」权限（非 Apple Events「想要控制」）。
- 2026-06-17 - 修复打包后启动崩溃（菜单栏图标资源走 Bundle.main，v1.1.3）；formula 去掉 `depends_on xcode`（仅 CLT）；`brew install yikox/tap/quicklauncher` 实测通过。
- 2026-06-16 - 换新图标；仓库改公开；建 tap `yikox/homebrew-tap`，formula 从源码构建；加 tag 触发的 `Update Homebrew Tap` CI（重算 sha 提交到 tap）。
- 2026-06-14 - 实现 `open.args` + 配方手册 + 扩充示例；初始化 git 并推送到（当时）私有库；补充 README。
