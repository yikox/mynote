# QuickLauncher 知识摘要

Last updated: 2026-06-14

## Verified Commands
- `swift build` — 编译。
- `swift run LauncherCoreTests` — 跑测试（自制微型测试运行器，非 XCTest；输出 `N passed, M failed`）。
- `./run.sh` — 编译 debug 并启动（会先 `pkill` 旧实例）。
- `swift run QuickLauncher` — 直接运行 debug。
- `./scripts/build-app.sh` — 打包 `build/QuickLauncher.app`（release + ad-hoc 签名）。
- `./scripts/build-app.sh --dmg` — 额外生成 `build/QuickLauncher-1.0.0.dmg`。
- `hdiutil verify <dmg>` — 校验 DMG。

## Architecture and Structure
- `Sources/Core`（SwiftPM target `LauncherCore`，纯逻辑库，依赖 Yams）：Models（Action/Command/LauncherConfig）、Config（ConfigLoader/ConfigParser/ConfigWatcher）、Runner（ActionRunner/ProcessExecutor/TerminalScript）、Search（CommandFilter）、Util（PathUtil）。
- `Sources/App`（target `QuickLauncher`，菜单栏 app，`LSUIElement`）：热键、面板窗口、SwiftUI 视图。
- `Tests/CoreTests`（可执行 target）：`main.swift` 里注册各测试组后 `Test.run()`。
- 配置位置优先级：显式 > 环境变量 `QUICKLAUNCHER_CONFIG` > `~/.config/quicklauncher/commands.yaml`；`manual.html` 与配置同目录。
- 平台：macOS 14+，仅需 Command Line Tools（无 XCTest，故自制测试运行器）。

## Conventions
- 代码注释、文档、提交信息均用中文。
- `Action.open` 关联值为 `(target:app:args:)`，`args` 无默认值，所有调用点须显式传 `args:`。
- 新增测试：在对应 `XxxTests.swift` 里 `Test.register(...)`，并确保 `Tests/CoreTests/main.swift` 注册了该测试组。
- `ConfigLoader.sampleConfig` 用占位符 `{{MANUAL_PATH}}` / `{{CONFIG_PATH}}`，写入时由 `renderedSampleConfig()` 替换成真实路径；静态串本身保持合法 YAML（测试直接解析原串不应告警）。

## Troubleshooting
- **编译报 `precompiled file ... compiled with module cache path .../agent-center/...`**：`.build/` 是从别的项目拷来的，ModuleCache 路径失效。解决：`rm -rf .build/*/debug/ModuleCache .build/*/release/ModuleCache` 后重建。
- **配置文件被神秘改回旧内容**：有别处旧 QuickLauncher 实例在后台运行抢写（曾发现 `agent-center/build/QuickLauncher.app` 的进程）。`pgrep -lf QuickLauncher` 查、`kill` 掉再操作。

## Investigation Results
- **`open --args` 投递行为（已实测，用最小探针 app）**：参数只在 app **冷启动那一刻**注入 argv。app 已运行时（无 `-n`）参数被**静默丢弃**，仅激活窗口；加 `-n` 会开新实例并收到参数。→ 对常驻 app（如 VSCode）加参数不可靠。
- **用 VSCode 打开指定路径，最稳是 `shell: "code -n <path>"`**（CLI 经 IPC 通已运行实例，开没开都行；需先在 VSCode 装 `code` 命令）。`open -a "Visual Studio Code" <path>` 不依赖 CLI 但已运行时只激活。
- 该机器已装：VSCode + `/usr/local/bin/code` CLI、Cursor。

## Decisions
- `args` 字段照加但定位「冷启动型 app」；不自动加 `-n`、不做 bundle id 打开、不做更细报错（YAGNI）。坑写进配方手册。
- 配方手册（manual.html，教程，给人看）与配置文件（commands.yaml，操作台）**刻意分开**。手册做成示例配置第一条，装完即见。
- 设计文档在 `docs/superpowers/specs/2026-06-14-launch-apps-and-recipe-manual-design.md`。
