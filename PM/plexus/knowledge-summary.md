# Plexus Knowledge Summary

Last updated: 2026-06-20（移除活动工作集，根除折叠占位串回写死循环；commit 0457456）

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
- **网页**：Releases 页 → `Plexus vX.Y.Z`（Draft 标记）→ 确认 6 个安装包都在 → **Edit** → **Publish release**。
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
- 桌面应用：Tauri 2（Rust 后端在 `src-tauri/`，标识符 `com.plexus.app`）。
- 前端：Vite + React 19 + TypeScript，状态用 zustand；编辑器为自研的双模式 Markdown 编辑器（`rich` 模块/块模式与 `plain` 纯文本，均基于 `<textarea>`），支持 KaTeX、Mermaid。
- 编辑器右键菜单：通用组件 `src/components/common/ContextMenu.tsx`（NoteTree / SessionsList / 编辑器共用）；编辑器菜单逻辑在 `src/components/Editor/useEditorContextMenu.tsx`。模块编辑器把文档渲染成多个预览块、只有活动块是 textarea，复制/剪切由其 `onCopy/onCut`（跨块→markdown）接管，故菜单基于实时选区走原生 execCommand、按钮 `preventDefault(mousedown)` 保住选区。
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
- **AI 会话对同一笔记反复 `update_note` 死循环 / 笔记被覆盖成一行占位文字**（2026-06-20 排查并彻底修复，commit `0457456`）：根因是「活动工作集」机制——`contextBuilder` 的 `foldWriteArgs` 把历史里 `update_note`/`create_note` 的长 `content` 折叠成「长得像正文的占位串」省 token，模型重试时**照抄自己上一条调用的参数**把占位串当真实内容写回，覆盖整篇笔记；读回又被折叠看不到磁盘真相 → 道歉重写 → 又被折叠 → 无限自我覆盖。最终方案：**直接移除整个活动工作集机制**（见下方 Decisions），占位串不再产生，问题根除。（中途曾试过「换哨兵标记 + 写工具守卫」的补丁，已被移除方案取代。）

- **进入 AI 页面整窗白屏 / `Maximum update depth exceeded`**（2026-06-21 排查，修复 commit `5331cf1`，自 `chatDraftsStore` 特性起即潜伏、v0.3.0 同样受影响，**全新安装首次点 AI 聊天必现**）：根因是 zustand v5 selector 返回**新引用**。`ChatPanel` 的 `useChatDraftsStore((s) => s.drafts[sessionId]?.images ?? [])` 在会话尚无草稿时每次 render 都返回新 `[]`，zustand v5 用 `useSyncExternalStore`、快照引用每次变 → 无限重渲染；项目**无 ErrorBoundary**，React 树崩溃 → 整窗白屏。修复：selector 改用模块级稳定常量 `EMPTY_IMAGES`。**通用规则：zustand selector 绝不能内联 `?? []`/`?? {}`/`?? {…}` 返回新对象/数组**——要么返回稳定常量引用，要么用 `useShallow` 包裹（如 `AgentStatusWindow` 那样 `?? DEFAULT_ENTRY` + `useShallow`）。排查手法：jsdom 里 mock `@tauri-apps/api/core` 的 `invoke` 后 `render(<ChatPanel/>)` 即可稳定复现，无需打包。

- **AI 改笔记报 `io error: Is a directory (os error 21)`**（2026-06-21 修复 `df1a9ae`/v0.4.2）：根因是写工具**漏传/传空 `path`**。`textArg(args,'path')` 取到空串后，Rust `core/notes.rs::resolve(root, "")` 把空相对路径塌缩到**工作区根目录**，`write_file` 对目录调 `fs::write` → EISDIR。修复防御两层：① 工具层 `update_note.execute` 检测 `path` 为空直接回 `{ok:false,error:'缺少 path…'}`，绝不带空路径下发后端；② Rust `write_file` 拒绝空 `rel` 与「目标是目录」（`AppError::InvalidInput`），从根上保护根目录不被误写。**通用规则：任何接受相对路径的写命令都要先校验非空**——空相对路径在 `resolve` 下等于根目录，是危险的隐式目标。
- **排查 AI 工具行为的实锤手法**：Plexus 会话持久化在 `<workspace>/.plexus/sessions/*.json`（含完整 messages + `tool_calls` 的 `function.arguments`）。`grep -l "错误串" .plexus/sessions/*.json` 找到出事会话，再用 python 遍历 `messages[*].tool_calls` 打印每次调用的工具名+参数，即可复现「模型到底传了什么」。本次正是借此发现模型从某轮起连发**无 path** 的 `update_note`。

## 关键原则（上下文折叠）
- **绝不能把「会被回传的、长得像正文/参数的占位串」放进模型自己的 tool_call 参数里**——LLM 会模仿自己的历史动作把它照抄回去，若该参数会落盘就会造成数据丢失+死循环。这正是工作集 `foldWriteArgs` 被移除的原因。
- 折叠 *tool 结果*（如保留的 `foldNoteReads` 重复读取去重、`foldWebSearch`）相对安全，因为模型不会把工具结果当调用参数照抄。这类去重可保留。

## Decisions
- **移除「活动工作集」上下文机制**（2026-06-20，commit `0457456`）：删 `workingSet.ts`/`activeNotes.ts`/`foldWriteArgs` 及 `workingSetMaxTokens` 等配置与 UI。原机制把笔记当前内容单独注入一层、并把对话历史里的读/写正文折叠成指针，但折叠写工具调用参数会被模型照抄回写覆盖笔记（见 Troubleshooting）。现笔记正文由对话中的 `read_note` 结果自然承载；保留 `foldNoteReads`（同路径重复读取仅留最近一份）、`recentTurnsKept` + 超预算 LLM 总结兜底。
- 仓库保持 **私有**（2026-06-13）：因此 Release 仅协作者可见；要公开下载须改 Public（无"私有仓库+公开 release"组合）。
- 安装包 **不做代码签名/公证**（先用未签名版，后续再加）。
- 发布为 **draft**，人工 Review 后再 Publish。
- macOS 出 **universal** 包（同时兼容 Apple Silicon 与 Intel）。
- 发布产物上传用 **softprops/action-gh-release** 而非 tauri-action（见 Troubleshooting）。
