# Plexus 项目管理

Last updated: 2026-06-20

## 概述
- Plexus：基于 Tauri 2 + React 的桌面 Markdown 笔记应用，笔记以本地文件存储并通过 git 同步，集成 AI 会话。
- 名称含义：Plexus 源自拉丁语，本意是"编织、交织成的网络"（如解剖学中的神经丛、血管网），兼具高级感与医学/生物学的严谨感。用作笔记软件之名，暗喻通过 AI 编织出的知识网，像人类大脑的神经网络一样紧密而充满生命。
- 仓库：`yikox/plexus`（GitHub，当前为 **私有**仓库）。
- 历史：原名 GitNote，于 2026-06-19 全项目改名为 Plexus（productName / bundle identifier `com.plexus.app` / crate `plexus`·`plexus_lib` / OAuth env `PLEXUS_GITHUB_OAUTH_CLIENT_ID`；数据目录 `~/.gitnote`→`~/.plexus`、工作区内 `.gitnote/`→`.plexus/`、localStorage `gitnote.*`→`plexus.*` 均带无感迁移）。

## 当前状态
- Version: 0.2.0（`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 一致）；tag `v0.2.0` 已推送。
- State: 开发中；改名收尾完成，新增编辑器交互特性。
- Current focus: 编辑器/AI 会话体验打磨。

## 进行中任务
- （无进行中阻塞项）

## 里程碑
- v0.1.0：首个可下载构建（Tauri 三平台 Release 流程就绪）。
- v0.2.0（2026-06-20）：笔记编辑器右键菜单（基础编辑 + 问 AI）首次随版本发布。

## 待办
- 后续（可选）：macOS 公证 / Windows 代码签名，消除"未签名"告警。
- 后续（可选）：若要任何人可下载，需将仓库改为 Public（发布前先确认历史无密钥）。

## 风险与阻塞
- 仓库私有 → Release 与安装包仅对有仓库权限的人可见（匿名用户 404）。
- 安装包未签名 → macOS 首次打开需在「隐私与安全性」放行；Windows 可能触发 SmartScreen。

## 最近更新
- 2026-06-20 - 发布 **v0.2.0**：笔记编辑器右键菜单（剪切/复制/粘贴/全选 + 问 AI）。抽出通用 `ContextMenu` 组件并让 NoteTree / SessionsList 共用去重。「问 AI」把选中文本带 `>` 引用注入最近活跃（或新建）AI 会话的输入框、不自动发送。适配模块编辑器的 block 渲染与窗口选区模型：复制/剪切走原生 execCommand，预览块存在选区时不进入编辑；修复 StrictMode 下「问 AI」二次注入。
- 2026-06-19 - 全项目改名 GitNote → Plexus（含无感数据迁移），文档与 OAuth env 一并更新。
- 2026-06-13 - 重写 `.github/workflows/release.yml`：改用「直接 `tauri build` + `softprops/action-gh-release`」三段式流程；新增 macOS universal 构建；`permissions: contents: write`。决定保持仓库私有、产物不签名、发布为 draft。