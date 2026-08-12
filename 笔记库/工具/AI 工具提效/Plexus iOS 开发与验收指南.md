这份笔记记录 Plexus 从桌面 Tauri 应用适配到 iOS/iPadOS 时已经验证过的工程约定。后续新增移动端能力时，先判断它属于共享逻辑、iOS 平台适配，还是暂不支持的桌面能力。

## 1. 技术边界

Plexus 仍然是 Tauri 2 + React + Rust 应用：

- React 页面和大部分业务逻辑在桌面、iOS 共用。
- Rust 内核负责工作区、笔记文件、Git、密钥和插件命令。
- iOS 通过 `src-tauri/gen/apple` 的 Xcode 工程承载同一套 Rust/前端应用。
- 平台差异收敛在 `#[cfg(target_os = "ios")]`、`#[cfg(desktop)]` 或移动端专用组件中，不能让桌面 API 渗透到共享路径。

已验证：

- `aarch64-apple-ios` 真机 Rust 编译。
- `aarch64-apple-ios-sim` Apple Silicon Simulator 编译。
- iPad 真机 Debug 构建、安装和启动命令链路（实际启动前设备需解锁）。
- iOS 横屏、竖屏和窄屏 onboarding 的基本布局。

暂不承诺：iOS 挂起期间后台同步、系统文件夹授权、Keychain、TestFlight/App Store 发布和推送通知。

## 2. 开发机与签名

### 环境

- macOS + 完整版 Xcode（通常在 `/Applications/Xcode.app`）。
- Rust、Node.js、项目依赖和 Xcode 命令行工具。
- 已信任本机的 iPhone/iPad，USB 连接时保持解锁。

检查工具链：

```bash
xcodebuild -version
xcode-select -p
xcrun simctl list devices
```

如果 `xcode-select -p` 指向 `/Library/Developer/CommandLineTools`，Tauri iOS 构建可能无法执行完整 Xcode 脚本。没有管理员权限切换全局路径时，给单次命令指定：

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

不要把开发机绝对路径写入项目配置。

### Apple Team

本地 Simulator 和真机 Debug 可以使用 Xcode Personal Team，不要求付费账号。TestFlight、App Store、稳定分发签名、推送通知等能力需要付费 Apple Developer 账号。

在 Xcode 打开 `src-tauri/gen/apple/plexus.xcodeproj`，选择 `plexus_iOS` target：

1. 勾选 Automatically manage signing。
2. 选择自己的 Team。
3. 保持或替换唯一 Bundle Identifier：`com.plexus.notes.ios`。

`Failed Registering Bundle Identifier` 或 `No profiles ... were found` 优先检查 Team、Bundle ID、设备信任和自动签名，不要先修改 Rust 代码。

## 3. 构建与安装

### 生成/更新工程

只有 `src-tauri/gen/apple` 不存在或 Tauri 配置发生结构性变化时才重新初始化：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
npm run tauri -- ios init
```

重新生成后检查：

- `src-tauri/gen/apple/project.yml` 的 Bundle ID、部署版本和 iPad 横竖屏方向。
- Rust Build Phase 使用稳定路径 `node .../node_modules/@tauri-apps/cli/tauri.js`。
- iOS target 链接 `libz.tbd`、`libiconv.tbd`、Metal、WebKit、Security 等依赖。
- `src-tauri/tauri.ios.conf.json` 的 identifier。

### 共享代码验证

```bash
npx tsc --noEmit
npm run test:run
npm run rust:test
npm run build
```

### Tauri Debug 构建

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
npm run tauri -- ios build --debug --target aarch64 --ci
```

IPA 通常在：

```text
src-tauri/gen/apple/build/arm64/Plexus.ipa
```

如果 `ios build` 最后导出阶段出现临时 `exportOptionsPlist` 竞态，但 Xcode target 已成功编译，可直接使用 Xcode 生成的 `.app` 安装真机。

### 真机安装与启动

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
xcrun devicectl list devices

DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
xcrun devicectl device install app \
  --device <UDID> \
  "$HOME/Library/Developer/Xcode/DerivedData/plexus-*/Build/Products/Debug-iphoneos/Plexus.app"

DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
xcrun devicectl device process launch \
  --device <UDID> \
  com.plexus.notes.ios
```

如果返回 `device ... is locked`，先解锁 iPad 再启动；这不是安装失败。

## 4. iOS 沙盒与工作区

iOS 不能把沙盒根目录当作普通可写目录。Rust 通过 Foundation `NSHomeDirectory()` 获取容器，并将设备级数据统一放到：

```text
<App Container>/Library/Application Support/.plexus/
```

布局：

```text
Library/Application Support/.plexus/
├── config.json                    # active workspace 等设备配置
├── secrets.json                   # API key / Git PAT，仅设备本地
├── providers.json                 # 模型提供商配置
└── workspaces/
    └── <name>/
        ├── .git/
        ├── .plexus/
        │   ├── workspace.json
        │   ├── git.json
        │   └── agent/             # 助手运行时私有数据
        ├── .plexus-assistant/     # 可随 Git 同步的助手长期知识
        ├── assets/
        └── *.md
```

规则：

- 设备配置、凭据和工作区容器不进入 Git。
- 笔记、图片、`.plexus-assistant/` 和根级 `.plexus-order.json` 属于工作区数据，可进入 Git。
- `.plexus/` 整体保持忽略，不为同步单个运行时文件添加反向例外。
- 共享命令通过 `AppState.workspace` 获取当前工作区根目录，不能依赖 `$HOME`、当前进程目录或前端传入的绝对路径。
- 旧版本沙盒根下的 `.plexus`/`.gitnote` 会由 `config::app_home()` 幂等迁移到 Application Support，并重写 active workspace 路径。

## 5. 移动端工作区与 GitHub 导入

iOS 暂不实现桌面式原生文件夹选择器，移动端使用“新建工作区”或“GitHub 登录导入”。

### 新建

```text
create_mobile_workspace(name)
  → <Application Support>/.plexus/workspaces/<name>
open_workspace(path)
```

名称必须是单个安全路径段，不能包含 `/`、`\\`、`.`、`..` 或空字符串。创建后统一经过 `open_workspace()`，让 Git、watcher、agent 的 workspace-opened 生命周期只有一个入口。

### GitHub 导入

```text
start_github_device_flow
  → 用户输入 device code
poll_github_device_flow
  → list_github_repositories
  → 用户选择仓库
clone_mobile_github_repository(repository_url, workspace_name)
  → open_workspace(path)
```

约束：

- 只接受 GitHub API 返回的 `https://github.com/...` 仓库地址。
- 前端不要求用户输入 PAT；凭据只暂存在 GitState，克隆成功后写设备级 secrets。
- Git PAT 永远不写入笔记库、Git 配置或前端持久化状态。
- 如果目标目录已经是同一远端仓库，复用现有克隆；如果绑定其他远端，拒绝覆盖并提示换名称。
- 克隆失败必须清理本次新建的空目录。

## 6. 前台生命周期与同步

iOS 不能依赖桌面常驻进程或关闭时继续运行。前端监听 `visibilitychange`、`pageshow`、`pagehide`，将页面是否可见映射到 `set_git_foreground(focused)`。

- Git pusher 只在前台运行。
- 恢复前台时触发一次同步。
- 网络失败交给状态条和手动重试。
- 不承诺挂起期间继续同步。

新增移动端后台能力前，必须单独设计 BackgroundTasks、网络恢复和任务幂等，不能直接搬用桌面 timer。

## 7. 助手数据跨设备分类

### 随 Git 同步的长期知识

```text
.plexus-assistant/user-profile.json       # 全局用户画像
.plexus-assistant/library-charter.json    # 当前笔记库章程
.plexus-assistant/memories.json           # 用户确认后的长期记忆
```

这些文件由 Rust 助手存储层从当前工作区根目录读写。旧版本设备级画像和 `.plexus/agent/assistant/` 下的记忆会作为兼容回退，并在读取时尽力提升到根目录。工作区根目录已经定义了文件边界，因此嵌入 JSON 的桌面端 workspace ID 在另一台设备恢复时会归一化为本地 workspace ID。

### 设备私有运行时

```text
.plexus/agent/assistant/                  # index、runs、observations、inquiries 等
.plexus/agent/sessions/                   # 会话和上下文快照
```

这些数据包含设备运行状态、会话恢复和任务过程，不参与 Git 同步。若以后要同步对话历史，必须先定义冲突合并、隐私和设备并发策略，不能直接把整个 `.plexus/` 放进 Git。

## 8. 最小验收清单

1. 首次打开无工作区时，横屏和竖屏都能看到新建 / GitHub 导入引导。
2. iPad 横屏侧栏是可用抽屉，窄屏不遮住主内容，底部没有白条遮挡。
3. 新建工作区后可以创建、打开、编辑和保存 Markdown 笔记。
4. GitHub Device Flow 能登录、列出仓库并导入，不要求本地目录路径或 PAT。
5. Git 只在前台同步；切后台再恢复时能触发同步或显示可重试错误。
6. 重装后已有沙盒工作区、配置和凭据能恢复，同一远端不会被重复克隆覆盖。
7. Git 同步后的 `.plexus-assistant/` 能恢复用户画像、章程和长期记忆。
8. 锁屏、断网、空仓库、重复工作区名称和远端不一致均以可读错误展示。

## 9. 常见故障

| 现象 | 优先检查 |
| --- | --- |
| `io error: Operation not permitted` | 是否仍使用沙盒根或 `$HOME`；改用 `Library/Application Support/.plexus` |
| `workspace already exists and is not empty` | 目标目录是否已有同一远端；同远端复用，不同远端换名称 |
| `Failed Registering Bundle Identifier` | Team、Bundle ID、自动签名和设备信任 |
| `No profiles ... were found` | 选择 Personal Team/开发团队后让 Xcode 重新管理签名 |
| `PhaseScriptExecution failed` | `DEVELOPER_DIR` 是否指向完整 Xcode；Build Phase 是否使用稳定 CLI 路径 |
| 安装成功但无法启动 | 设备是否锁定；先解锁再 `devicectl process launch` |
| iOS 仍要求重新了解助手 | 工作区是否包含 `.plexus-assistant/`，打开的是否是 Git 导入后的同一工作区 |
| 横屏底部遮挡内容 | 应用壳是否使用 `100dvh` 和 safe-area，而不是仅使用 `100vh` |

排查时先看原生错误和当前工作区路径，不要通过删除整个 App 沙盒来“修复”问题，否则会掩盖迁移和恢复缺陷。

## 10. 后续优先级

1. 用 iPad 横竖屏、分屏和外接键盘补齐 UI/快捷键验收。
2. 增加 DocumentPicker + security-scoped bookmark，允许选择 App 沙盒外的笔记库。
3. 将设备级 token 迁移到 iOS Keychain，并评估 Git 凭据刷新策略。
4. 设计 BackgroundTasks 后再开放后台 Git 同步或定时助手任务。
5. 配置稳定签名、TestFlight 和 App Store 发布流水线。
