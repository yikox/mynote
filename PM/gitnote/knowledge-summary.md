# GitNote Knowledge Summary

Last updated: 2026-06-14

## Verified Commands
- 前端开发：`npm run dev`
- 前端构建：`npm run build`（`tsc && vite build`）
- 前端测试：`npm run test` / `npm run test:run`（vitest）
- Rust 测试：`npm run rust:test`（`cd src-tauri && cargo test`）
- Tauri 本地打包：`npm exec tauri -- build`（CI 中验证可用，产物在 `src-tauri/target/release/bundle/**`）
- macOS 通用包：`npm exec tauri -- build --target universal-apple-darwin`（产物在 `src-tauri/target/universal-apple-darwin/release/bundle/**`）

## 发布一个 Release（完整流程）

三条硬性规则（CI 会校验，不满足直接失败）：
- tag 格式必须是 `vX.Y.Z`（如 `v0.2.0`）。
- `package.json` 与 `src-tauri/tauri.conf.json` 的 `version` 必须都等于 tag 去掉 `v` 的值。
- tag 必须指向 `main` 上的提交。

### 第 1 步：改版本号并提交（命令）
以 `v0.2.0` 为例：
```bash
npm version 0.2.0 --no-git-tag-version          # 改 package.json
# 手动把 src-tauri/tauri.conf.json 的 "version" 也改成 0.2.0
git add package.json src-tauri/tauri.conf.json
git commit -m "release: v0.2.0"
git push origin main
```
> 两个文件都要改，漏改 tauri.conf.json 会在「Validate tag」步骤失败。

### 第 2 步：打 tag 触发构建
- **方式 A（命令，推荐）**：
  ```bash
  git tag v0.2.0 && git push origin v0.2.0
  ```
- **方式 B（网页打 tag）**：Releases 页 → **Draft a new release** → Choose a tag 输入 `v0.2.0` → **Create new tag on publish** → Target 选 `main` → **Save draft**（保存即创建 tag、触发 CI）。前提是已完成第 1 步。
- **方式 C（网页 Actions 手动触发，tag 需已存在）**：Actions → **Release Build** → **Run workflow** → 填 `tag=v0.2.0`。命令等价：`gh workflow run release.yml -f tag=v0.2.0`。

### 第 3 步：盯构建（可选，约 10–15 分钟）
```bash
gh run watch $(gh run list --workflow=release.yml -L1 --json databaseId --jq '.[0].databaseId')
```
成功后 CI 自动创建/更新 **draft** release 并挂上 6 个安装包（dmg/exe/msi/AppImage/deb/rpm）。草稿不会自动公开。

### 第 4 步：检查并正式发布草稿
- **网页**：Releases 页 → `GitNote vX.Y.Z`（Draft 标记）→ 确认 6 个安装包都在 → **Edit** → **Publish release**。
- **命令**：
  ```bash
  gh release view v0.2.0 --web          # 浏览器检查
  gh release edit v0.2.0 --draft=false  # 正式发布
  ```
> 仓库目前私有，发布后也只有有仓库权限的人可见可下载。

### 速查表
```bash
git add package.json src-tauri/tauri.conf.json && git commit -m "release: v0.2.0" && git push origin main
git tag v0.2.0 && git push origin v0.2.0
# 等构建成功后：
gh release edit v0.2.0 --draft=false
```

## Architecture and Structure
- 桌面应用：Tauri 2（Rust 后端在 `src-tauri/`，标识符 `com.gitnote.app`）。
- 前端：Vite + React 19 + TypeScript，编辑器用 CodeMirror / Milkdown，支持 KaTeX、Mermaid；状态用 zustand。
- 发布 CI：`.github/workflows/release.yml`，触发条件为 push `v*` tag 或 workflow_dispatch。
  - 三个 job：`prepare`（校验 tag/分支/版本号）→ `build`（matrix：macos/linux/windows，各自构建并按平台上传安装包 artifact）→ `release`（汇总下载后用 softprops 创建单个 draft release）。

## Conventions
- Release tag 必须匹配 `^v[0-9]+\.[0-9]+\.[0-9]+$`（如 `v0.1.0`）。
- tag 必须是 `origin/main` 的祖先（只能从 main 上的提交发布）。
- `package.json` 与 `src-tauri/tauri.conf.json` 的 `version` 必须等于 tag 去掉 `v` 后的值，否则 CI 的版本校验会失败。

## Troubleshooting
- **tauri-action 报 `No artifacts were found`（即使 build 成功）**：tauri-action 的产物探测在没有 updater 签名密钥时会期待 `.sig`/`.zip` 更新器产物而判定为空。解决方案：不用 tauri-action 的构建+上传，改为 `npm exec tauri -- build` 直接构建，再用 `softprops/action-gh-release` 按显式文件 glob 上传安装包（`.dmg/.AppImage/.deb/.rpm/.msi/-setup.exe`）。
- **package.json 的 `tauri` 脚本含 `PATH="$HOME/.cargo/bin:$PATH"` 前缀**：在 Windows runner 的 cmd 下可能异常；CI 里用 `npm exec tauri --`（直接调用 `node_modules/.bin` 的二进制）可绕过该包装脚本。
- 矩阵作业各自创建 draft release 会有竞态/重复草稿风险：用独立的 `release` 汇总 job 一次性创建，避免竞态。

## Decisions
- 仓库保持 **私有**（2026-06-13）：因此 Release 仅协作者可见；要公开下载须改 Public（无"私有仓库+公开 release"组合）。
- 安装包 **不做代码签名/公证**（先用未签名版，后续再加）。
- 发布为 **draft**，人工 Review 后再 Publish。
- macOS 出 **universal** 包（同时兼容 Apple Silicon 与 Intel）。
- 发布产物上传用 **softprops/action-gh-release** 而非 tauri-action（见 Troubleshooting）。
