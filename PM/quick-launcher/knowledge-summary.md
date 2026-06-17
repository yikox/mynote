# QuickLauncher 知识摘要

最后更新：2026-06-17

> 本笔记汇总 QuickLauncher 项目已验证的命令、架构、约定、故障排查经验、调查结论与关键决策。

## 一、已验证命令

| 命令 | 说明 |
| --- | --- |
| `swift build` | 编译项目 |
| `swift run LauncherCoreTests` | 跑测试（自制微型测试运行器，非 XCTest；输出 `N passed, M failed`） |
| `./run.sh` | 编译 debug 并启动（会先 `pkill` 旧实例） |
| `swift run QuickLauncher` | 直接运行 debug 版本 |
| `./scripts/build-app.sh` | 打包 `build/QuickLauncher.app`（release + ad-hoc 签名） |
| `./scripts/build-app.sh --dmg` | 额外生成 `build/QuickLauncher-<version>.dmg` |
| `hdiutil verify <dmg>` | 校验 DMG 完整性 |
| `brew install yikox/tap/quicklauncher` | Homebrew 安装（从源码构建，2026-06-17 实测通过） |
| `git tag -a vX.Y.Z && git push origin vX.Y.Z` | 发版：tag 触发 GitHub Actions 自动发 Release（DMG）+ 更新 tap formula |

## 二、分发（Homebrew）

- 通过公开 tap **`yikox/homebrew-tap`** 分发。`Formula/quicklauncher.rb` **从源码构建**：执行 `./scripts/build-app.sh`，把 `QuickLauncher.app` 装进 keg，并加 `quicklauncher` CLI 包装 `open` 启动它。
- 源仓库 `yikox/quick-launcher` **必须公开**：Homebrew 是**未认证**直接拉取 `archive/refs/tags/*.tar.gz`，私有库会返回 404，谁都装不了。
- formula **不写 `depends_on xcode`**：只需 Command Line Tools 自带的 swift（AppKit、SwiftUI、Yams 都在 CLT 的 SDK 内）；若写了，对没装完整 Xcode 的用户会报 "Xcode can be installed from the App Store"。
- formula 设置 `ENV["EXTRA_SWIFT_FLAGS"] = "--disable-sandbox"`：Homebrew 自身沙箱里 SwiftPM 解析 manifest 会嵌套调 `sandbox-exec` 被拒。
- **CI 自动化**：tag 触发 `Release` + `Update Homebrew Tap`（后者重算 sha256 并提交新 url/sha 到 tap，需 secret `TAP_GITHUB_TOKEN`）。CI 只 sed `url`/`sha256`，formula 其它改动（依赖、install 逻辑）须手动提交到 tap。

## 三、架构与目录结构

- **`Sources/Core`**（SwiftPM target `LauncherCore`，纯逻辑库，依赖 Yams）
  - **Models**：`Action` / `Command` / `LauncherConfig`
  - **Config**：`ConfigLoader` / `ConfigParser` / `ConfigWatcher`
  - **Runner**：`ActionRunner` / `ProcessExecutor` / `TerminalScript`
  - **Search**：`CommandFilter`
  - **Util**：`PathUtil`
- **`Sources/App`**（target `QuickLauncher`，菜单栏 app，`LSUIElement`）：负责热键、面板窗口、SwiftUI 视图。
- **`Tests/CoreTests`**（可执行 target）：在 `main.swift` 中注册各测试组后调用 `Test.run()`。
- **配置位置优先级**：显式传入 > 环境变量 `QUICKLAUNCHER_CONFIG` > `~/.config/quicklauncher/commands.yaml`；`manual.html` 与配置文件同目录。
- **运行平台**：macOS 14+，仅需 Command Line Tools（无 XCTest，故自制测试运行器）。

## 四、约定

- 代码注释、文档、提交信息统一使用**中文**。
- `Action.open` 的关联值为 `(target:app:args:)`，`args` **无默认值**，所有调用点须显式传 `args:`。
- **新增测试**：在对应 `XxxTests.swift` 里 `Test.register(...)`，并确保 `Tests/CoreTests/main.swift` 已注册该测试组。
- `ConfigLoader.sampleConfig` 使用占位符 `{{MANUAL_PATH}}` / `{{CONFIG_PATH}}`，写入时由 `renderedSampleConfig()` 替换为真实路径；**静态串本身保持合法 YAML**（测试直接解析原串时不应告警）。

## 五、故障排查

- **编译报 `precompiled file ... compiled with module cache path .../agent-center/...`**
  - 原因：`.build/` 是从别的项目拷来的，ModuleCache 路径失效。
  - 解决：`rm -rf .build/*/debug/ModuleCache .build/*/release/ModuleCache` 后重建。

- **配置文件被神秘改回旧内容**
  - 原因：有别处的旧 QuickLauncher 实例在后台运行抢写（曾发现 `agent-center/build/QuickLauncher.app` 的进程）。
  - 排查：`pgrep -lf QuickLauncher` 查询，`kill` 掉再操作。

- **brew 装的 app 点了没反应 / 后台也没有（v1.1.3 之前）**
  - 现象：打包后启动即崩，因找不到资源 bundle。
  - 根因：见"调查结果"小节。
  - 复现：把本地 `.build` 改名，再直接跑 `build/QuickLauncher.app/Contents/MacOS/QuickLauncher`。
  - 修复：v1.1.3。

- **`brew install` 报 `Error: An unsatisfied requirement failed this build` / "Xcode can be installed from the App Store"**
  - 原因：formula 不应 `depends_on xcode`（已去掉）。
  - 若 `swift` 找不到：`xcode-select -p` 若指向已删除的 Xcode.app，执行 `sudo xcode-select --switch /Library/Developer/CommandLineTools`；未装 CLT 则 `xcode-select --install`。

- **`brew install` 报 `sandbox-exec: sandbox_apply: Operation not permitted`**
  - 原因：SwiftPM 在 Homebrew 沙箱内嵌套沙箱被拒。
  - 解决：formula 需 `swift build --disable-sandbox`（经 `EXTRA_SWIFT_FLAGS`）。

## 六、调查结果

- **打包后启动崩溃根因（2026-06-16 实测定位）**
  - App 是 SwiftPM `executableTarget` + `resources:[.process("Resources")]`，生成的 `Bundle.module` accessor 只查两处：`Bundle.main.bundleURL/QuickLauncher_QuickLauncher.bundle`（对 .app 来说是 **.app 根**，**不是** `Contents/Resources`）和**烤死的 `.build/<arch>/release/...` 绝对路径**。
  - 本地一直靠 `.build` 续命；`brew` 在 `/private/tmp` 构建完删掉 `.build` 即崩。
  - 把 bundle 放 .app 根能被找到，但 codesign 报 `unsealed contents present in the bundle root`（.app 顶层只能有 `Contents/`）。
  - **修复**：菜单栏图标改走 `Bundle.main` 读 `Contents/Resources`（开发态回退 `Bundle.module`），`build-app.sh` 平铺 `MenuBarIcon.png` 进 `Contents/Resources` 并自检（v1.1.3）。

- **算 Homebrew 用的 sha256 要点**
  - `gh api .../tarball/REF` 与公开 `archive/refs/tags/TAG.tar.gz` **字节不同 → sha 不同**。
  - Homebrew 下的是 archive URL，因此 sha 必须从 archive URL 算（CI 的 ubuntu runner 上 `curl|sha256sum` 即可；本地 Claude 沙箱无外网会取到假的 "Not Found"）。

- **`open --args` 投递行为（已实测，用最小探针 app）**
  - 参数只在 app **冷启动那一刻**注入 argv。
  - app 已运行时（不加 `-n`）参数被**静默丢弃**，仅激活窗口。
  - 加 `-n` 会开新实例并收到参数。
  - → 对常驻 app（如 VSCode）加参数不可靠。

- **用 VSCode 打开指定路径**
  - 最稳是 `shell: "code -n <path>"`（CLI 经 IPC 通知已运行实例，开没开都行；需先在 VSCode 装 `code` 命令）。
  - `open -a "Visual Studio Code" <path>` 不依赖 CLI，但已运行时只激活窗口。

- **该机器已装**：VSCode + `/usr/local/bin/code` CLI、Cursor。

## 七、决策

- **分发走 Homebrew（从源码构建）而非只发 DMG**
  - 为此把仓库设为公开（2026-06-16）。
  - formula 不依赖完整 Xcode，只用 CLT。

- **`args` 字段照加，但定位为「冷启动型 app」**
  - 不自动加 `-n`、不做 bundle id 打开、不做更细报错（YAGNI）。
  - 坑写进配方手册。

- **配方手册（manual.html，教程，给人看）与配置文件（commands.yaml，操作台）刻意分开**
  - 手册做成示例配置的第一条，装完即见。

- **设计文档**位于 `docs/superpowers/specs/2026-06-14-launch-apps-and-recipe-manual-design.md`。
