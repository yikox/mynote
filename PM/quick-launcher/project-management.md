# QuickLauncher 项目管理

最后更新：2026-06-17

> 状态：分发链路已收尾，无进行中需求。下文为项目概览、里程碑、待办、风险与近期变更的速查。

## 一、项目概览

| 维度 | 内容 |
| --- | --- |
| **产品定位** | macOS 菜单栏快捷启动器：YAML 配置快捷指令，全局热键（默认 `⌥Space`）唤起面板，模糊搜索后回车执行 |
| **支持动作** | `open`（打开路径/URL，可指定 app、透传 `args`）/ `shell` / `terminal` |
| **当前版本** | v1.1.3 |
| **本地路径** | `/Users/zyc/work/2026/quick-launcher` |
| **远端仓库** | GitHub `yikox/quick-launcher`（**公开**，2026-06-16 由私有转公开），分支 `main` |
| **Homebrew tap** | `yikox/homebrew-tap`（公开） |

## 二、当前状态

- **分发**：源码已公开；Homebrew 全链路打通（`brew install yikox/tap/quicklauncher` 2026-06-17 实测可装可启动）；tag 触发 CI 自动发 Release（DMG） + 更新 tap formula。
- **当前焦点**：无进行中需求；分发链路刚收尾。

## 三、进行中任务

- 无。

## 四、里程碑

| 日期 | 节点 |
| --- | --- |
| 2026-06-17 | 修复 brew 安装后启动崩溃（资源路径，v1.1.3）；去掉 Xcode 依赖（仅需 CLT）；brew 全链路实测通过 |
| 2026-06-16 | 更换新图标；搭建 Homebrew 分发（公开仓库 + tap + 源码构建 + tag 自动更新 formula） |
| 2026-06-15 | 两层指令结构（组/子项 + 分层搜索 + 子项 MRU）；App/菜单栏图标；tag 触发 Release CI |
| 2026-06-14 | `open.args` 能力 + 配方手册（manual.html）+ 扩充示例配置（7 条配方） |
| 起点 | 初始仓库 + 首版功能（open/shell/terminal、热键、模糊搜索） |

## 五、待办（可选）

- 正式签名 / 公证，免去 Gatekeeper 手动放行。
- README 顶部加版本/安装徽章。

## 六、风险与注意事项

- **DMG 走 ad-hoc 签名**：首次打开可能被 Gatekeeper 拦截，需 `xattr -dr com.apple.quarantine /Applications/QuickLauncher.app`（Homebrew 从源码本地构建则无此问题）。
- **`ConfigLoader.ensureExists()` 不覆盖已存在的 `commands.yaml`**：老用户升级后看不到新示例，需手动删除旧配置重生（**保护用户改动，是预期行为**）。
- **CI 的 `Update Homebrew Tap` 依赖 secret `TAP_GITHUB_TOKEN`**：fine-grained PAT，对 `homebrew-tap` 仓库需 `Contents:write` 权限；过期或失效会导致 tag 后 formula 不自动更新。

## 七、近期变更

- **2026-06-17** — 修复打包后启动崩溃（菜单栏图标资源改走 `Bundle.main`，v1.1.3）；formula 去掉 `depends_on xcode`（仅 CLT）；`brew install yikox/tap/quicklauncher` 实测通过。
- **2026-06-16** — 换新图标；仓库改公开；建 tap `yikox/homebrew-tap`，formula 从源码构建；加 tag 触发的 `Update Homebrew Tap` CI（重算 sha 提交到 tap）。
- **2026-06-14** — 实现 `open.args` + 配方手册 + 扩充示例；初始化 git 并推送到（当时）私有库；补充 README。
