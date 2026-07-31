# Plexus 知识摘要

Last updated: 2026-07-31

## 已验证命令

- `npm run test:run`：2026-07-31 验证通过，161 个测试文件、1108 项测试。
- `npm run build`：2026-07-31 TypeScript 与 Vite 生产构建通过。
- `npm run install:local`：2026-07-31 验证通过；内部运行 `build:dmg`，生成并校验 DMG，完整替换 `/Applications/Plexus.app` 后重新启动。

## 架构与结构

- 前端由 kernel-frontend 与 file-tree、block-editor、agent、git 四个插件组成；桌面壳使用 Tauri 2。
- 本机安装脚本为仓库内的 `scripts/install-local.sh`，DMG 构建脚本为 `scripts/build-dmg.sh`。

## 约定

- 每次代码修改完成并通过相应测试后，必须以系统终端/提权方式执行 `npm run install:local`，不能只生成 Web 构建或 DMG。
- 安装必须完整替换应用包，不能在旧 `.app` 上增量复制，以免保留已经删除的资源。

## 故障排查

- Tauri 本地构建产物可能只有 linker ad-hoc 签名，`codesign --verify --deep --strict` 会报告资源未绑定；`build-dmg.sh` 会在本地包校验失败时补完整 ad-hoc bundle 签名，再生成 DMG。
- `hdiutil`、`/Applications` 写入与应用启动依赖 macOS 系统能力，沙箱内失败时应使用系统终端/提权执行。
- `install-local.sh` 在替换前停止 Plexus，并在临时目录保留旧应用；新应用复制或签名验证失败时自动恢复旧版本。

## 调查结果

- 2026-07-31：旧的手工安装结果有完整 ad-hoc bundle 签名，而 Tauri 新构建目录只有 linker-signed 可执行文件；这就是直接复制前签名校验失败的原因。

## 决策

- 将构建、补签、停止旧进程、失败回滚、完整替换与重新启动收敛为 `npm run install:local` 单一入口。
