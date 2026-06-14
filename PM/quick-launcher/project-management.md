# QuickLauncher 项目管理

Last updated: 2026-06-14

## Overview
- macOS 菜单栏快捷启动器：YAML 配置快捷指令，全局热键（默认 `⌥Space`）唤起面板，模糊搜索后回车执行。
- 支持三种动作：`open`（打开路径/URL，可指定 app、透传 `args`）、`shell`、`terminal`。
- 本地路径：`/Users/zyc/work/2026/quick-launcher`
- 远端：GitHub `yikox/quick-launcher`（**私有**），分支 `main`。

## Current Status
- Version: 1.0.0
- State: 源码已推送私有库；本地可产出可用 DMG（ad-hoc 签名）。
- Current focus: 刚完成「打开其他软件 / 指定路径 VSCode」扩展——`open` 加 `args`、新增 HTML 配方手册、扩充示例配置。

## Active Tasks
- 无进行中任务（上一轮需求已交付）。

## Milestones
- 初始仓库 + 首版功能（open/shell/terminal、热键、模糊搜索）。
- 2026-06-14：`open.args` 能力 + 配方手册（manual.html）+ 扩充示例配置（7 条配方）。

## Todo
- （可选）正式签名 / 公证，免去 Gatekeeper 手动放行。
- （可选）若需放到其他账户/组织，迁移仓库。

## Blockers and Risks
- DMG 为 ad-hoc 签名：首次打开可能被 Gatekeeper 拦，需 `xattr -dr com.apple.quarantine /Applications/QuickLauncher.app`。
- `ConfigLoader.ensureExists()` **不覆盖已存在的 `commands.yaml`**：老用户升级后看不到新示例，需手动删除旧配置重生（保护用户改动，是预期行为）。

## Recent Updates
- 2026-06-14 - 实现 `open.args` + 配方手册 + 扩充示例；初始化 git 并推送到私有库 `yikox/quick-launcher`；补充 README；本地产出 `build/QuickLauncher-1.0.0.dmg`（790K，未提交）。
