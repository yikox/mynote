# QuickLauncher 知识摘要

Last updated: 2026-06-18 (v1.2.1)

## Verified Commands
- `swift build` — 编译。
- `swift run LauncherCoreTests` — 跑测试（自制微型测试运行器，非 XCTest；输出 `N passed, M failed`）。
- `./run.sh` — 编译 debug 并启动（会先 `pkill` 旧实例）。
- `swift run QuickLauncher` — 直接运行 debug。
- `./scripts/build-app.sh` — 打包 `build/QuickLauncher.app`（release + ad-hoc 签名）。
- `./scripts/build-app.sh --dmg` — 额外生成 `build/QuickLauncher-<version>.dmg`。
- `hdiutil verify <dmg>` — 校验 DMG。
- `brew install yikox/tap/quicklauncher` — Homebrew 安装（从源码构建，2026-06-17 实测通过）。
- 发版：`git tag -a vX.Y.Z && git push origin vX.Y.Z` → GitHub Actions 自动发 Release(DMG) + 更新 tap formula。

## 分发（Homebrew）
- 通过公开 tap **`yikox/homebrew-tap`** 分发，`Formula/quicklauncher.rb` **从源码构建**（跑 `./scripts/build-app.sh`，装 `QuickLauncher.app` 进 keg，并加 `quicklauncher` CLI 包装 `open` 它）。
- 源仓库 `yikox/quick-launcher` **必须公开**：Homebrew 是**未认证**去拉 `archive/refs/tags/*.tar.gz`，私有库会 404，谁都装不了。
- formula **不写 `depends_on xcode`**：只需 Command Line Tools 的 swift（AppKit/SwiftUI/Yams 都在 CLT 的 SDK 内）；写了会对没装完整 Xcode 的用户报 "Xcode can be installed from the App Store"。
- formula 设 `ENV["EXTRA_SWIFT_FLAGS"] = "--disable-sandbox"`：Homebrew 自身沙箱里 SwiftPM 解析 manifest 会嵌套调 `sandbox-exec` 被拒。
- CI 自动化：tag 触发 `Release` + `Update Homebrew Tap`（后者重算 sha256 并提交新 url/sha 到 tap，需 secret `TAP_GITHUB_TOKEN`）。CI 只 sed `url`/`sha256`，formula 其它改动（依赖、install 逻辑）须手动提交到 tap。

## Architecture and Structure
- `Sources/Core`（SwiftPM target `LauncherCore`，纯逻辑库，依赖 Yams）：Models（Action/Command/LauncherConfig/Workspace）、Config（ConfigLoader/ConfigParser/ConfigWatcher）、Runner（ActionRunner/ProcessExecutor/TerminalScript/WorkspaceRunner/WindowArranger/WindowGeometry）、Search（CommandFilter）、Util（PathUtil）。
- **工作区(workspace)（v1.2.0）**：指令用 `workspace:` 替代 `actions:`/`children:` → `CommandKind.workspace`。`WorkspaceRunner` 逐窗口「防重复（查窗口标题含目录名）→ 打开/复用 → 排布」。排布走 System Events AppleScript（`WindowArranger` 生成 `set position/size`），`WindowGeometry` 做 Cocoa↔System Events 的 y 翻转。仅主屏。frame `[x,y,w,h]` 为可见区 0~1 占比、y 从顶。面板里三类指令有不同色胶囊角标（工作区紫/单层蓝/双层橙）。
- `Sources/App`（target `QuickLauncher`，菜单栏 app，`LSUIElement`）：热键、面板窗口、SwiftUI 视图。
- `Tests/CoreTests`（可执行 target）：`main.swift` 里注册各测试组后 `Test.run()`。
- 配置位置优先级：显式 > 环境变量 `QUICKLAUNCHER_CONFIG` > `~/.config/quicklauncher/commands.yaml`。
- **使用手册 manual.md（v1.2.1）**：格式说明的唯一数据源是 `ConfigLoader.manualMarkdown`（Swift 常量），`ensureManual()` 在 `AppState.bootstrap()` 里**每次启动无条件覆盖**写到配置同目录 `manual.md`（随版本刷新、不动 commands.yaml）。`commands.yaml` 注释已瘦身为指引。菜单栏「打开使用手册」→ `openManual()`。默认「用 AI 配置」是两层组（Claude/Codex/Agent，各跑对应 CLI 读 manual.md）。注意 `ensureExists()` 不覆盖已存在 commands.yaml，故新默认组只对全新安装生效；老 `manual.html` 早已不存在（被注释块取代，现又抽成 manual.md）。
- 平台：macOS 14+，仅需 Command Line Tools（无 XCTest，故自制测试运行器）。

## Conventions
- 代码注释、文档、提交信息均用中文。
- `Action.open` 关联值为 `(target:app:args:)`，`args` 无默认值，所有调用点须显式传 `args:`。
- 新增测试：在对应 `XxxTests.swift` 里 `Test.register(...)`，并确保 `Tests/CoreTests/main.swift` 注册了该测试组。
- `ConfigLoader.sampleConfig` 用占位符 `{{MANUAL_PATH}}` / `{{CONFIG_PATH}}`，写入时由 `renderedSampleConfig()` 替换成真实路径；静态串本身保持合法 YAML（测试直接解析原串不应告警）。

## Troubleshooting
- **编译报 `precompiled file ... compiled with module cache path .../agent-center/...`**：`.build/` 是从别的项目拷来的，ModuleCache 路径失效。解决：`rm -rf .build/*/debug/ModuleCache .build/*/release/ModuleCache` 后重建。
- **配置文件被神秘改回旧内容**：有别处旧 QuickLauncher 实例在后台运行抢写（曾发现 `agent-center/build/QuickLauncher.app` 的进程）。`pgrep -lf QuickLauncher` 查、`kill` 掉再操作。
- **brew 装的 app 点了没反应/后台也没有（v1.1.3 前）**：打包后启动即崩，因找不到资源 bundle。根因见 Investigation。复现：把本地 `.build` 改名再直接跑 `build/QuickLauncher.app/Contents/MacOS/QuickLauncher`。已在 v1.1.3 修复。
- **`brew install` 报 `Error: An unsatisfied requirement failed this build` / "Xcode can be installed from the App Store"**：formula 不应 `depends_on xcode`（已去掉）。若 `swift` 找不到：`xcode-select -p` 若指向已删的 Xcode.app，执行 `sudo xcode-select --switch /Library/Developer/CommandLineTools`；没装 CLT 则 `xcode-select --install`。
- **`brew install` 报 `sandbox-exec: sandbox_apply: Operation not permitted`**：SwiftPM 在 Homebrew 沙箱内嵌套沙箱被拒，formula 需 `swift build --disable-sandbox`（经 `EXTRA_SWIFT_FLAGS`）。

## Investigation Results
- **工作区分屏「给了权限还是不生效」根因（2026-06-17 实测）**：排布窗口需 **「辅助功能」权限**（`AXIsProcessTrusted`），跟首次弹的 Apple Events「想要控制」**是两回事**——macOS 不会为辅助功能自动弹框，须代码主动触发（`AXIsProcessTrustedWithOptions` + 打开设置面板）。更隐蔽的坑：`build-app.sh` 用 **ad-hoc 签名**（`codesign --sign -`），**每次重新编译都换 cdhash**，致先前授权的二进制不再被认；设置里那行**还勾着**（残留条目）但 `AXIsProcessTrusted=false`，反复弹框。解决：删掉列表里所有 QuickLauncher 条目 → 装到**固定位置**（/Applications）→ 授权后**别再重新编译**。System Events 未授权报错码 `-25211`/`-1719`（数字跨语言稳定），中文文案「不允许辅助访问」，`WorkspaceRunner.isPermissionError` 已兼容。
- **打包后启动崩溃根因（2026-06-16 实测定位）**：App 是 SwiftPM `executableTarget` + `resources:[.process("Resources")]`，生成的 `Bundle.module` accessor 只查两处——`Bundle.main.bundleURL/QuickLauncher_QuickLauncher.bundle`（对 .app 来说是 **.app 根**，**不是** `Contents/Resources`）和**烤死的 `.build/<arch>/release/...` 绝对路径**。本地一直靠 `.build` 续命；`brew` 在 `/private/tmp` 构建完删掉 `.build` 即崩。把 bundle 放 .app 根能被找到但 codesign 报 `unsealed contents present in the bundle root`（.app 顶层只能有 `Contents/`）。**修复**：菜单栏图标改走 `Bundle.main` 读 `Contents/Resources`（开发态回退 `Bundle.module`），`build-app.sh` 平铺 `MenuBarIcon.png` 进 `Contents/Resources` 并自检（v1.1.3）。
- **算 Homebrew 用的 sha256 要点**：`gh api .../tarball/REF` 与公开 `archive/refs/tags/TAG.tar.gz` **字节不同 → sha 不同**；Homebrew 下的是 archive URL，故 sha 必须从 archive URL 算（CI 的 ubuntu runner 上 `curl|sha256sum` 即可，本地 Claude 沙箱无外网会取到假 "Not Found"）。
- **`open --args` 投递行为（已实测，用最小探针 app）**：参数只在 app **冷启动那一刻**注入 argv。app 已运行时（无 `-n`）参数被**静默丢弃**，仅激活窗口；加 `-n` 会开新实例并收到参数。→ 对常驻 app（如 VSCode）加参数不可靠。
- **用 VSCode 打开指定路径，最稳是 `shell: "code -n <path>"`**（CLI 经 IPC 通已运行实例，开没开都行；需先在 VSCode 装 `code` 命令）。`open -a "Visual Studio Code" <path>` 不依赖 CLI 但已运行时只激活。
- 该机器已装：VSCode + `/usr/local/bin/code` CLI、Cursor。

## Decisions
- **分发走 Homebrew（从源码构建）而非只发 DMG**：为此把仓库设为公开（2026-06-16）。formula 不依赖完整 Xcode，只用 CLT。
- `args` 字段照加但定位「冷启动型 app」；不自动加 `-n`、不做 bundle id 打开、不做更细报错（YAGNI）。坑写进配方手册。
- 配方手册（manual.html，教程，给人看）与配置文件（commands.yaml，操作台）**刻意分开**。手册做成示例配置第一条，装完即见。
- 设计文档在 `docs/superpowers/specs/2026-06-14-launch-apps-and-recipe-manual-design.md`。
