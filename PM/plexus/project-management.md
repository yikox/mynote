# Plexus 项目管理

Last updated: 2026-06-20

## 概述
- Plexus：基于 Tauri 2 + React 的桌面 Markdown 笔记应用，笔记以本地文件存储并通过 git 同步，集成 AI 会话。
- 名称含义：Plexus 源自拉丁语，本意是"编织、交织成的网络"（如解剖学中的神经丛、血管网），兼具高级感与医学/生物学的严谨感。用作笔记软件之名，暗喻通过 AI 编织出的知识网，像人类大脑的神经网络一样紧密而充满生命。
- 仓库：`yikox/plexus`（GitHub，当前为 **私有**仓库）。
- 历史：原名 GitNote，于 2026-06-19 全项目改名为 Plexus（productName / bundle identifier `com.plexus.app` / crate `plexus`·`plexus_lib` / OAuth env `PLEXUS_GITHUB_OAUTH_CLIENT_ID`；数据目录 `~/.gitnote`→`~/.plexus`、工作区内 `.gitnote/`→`.plexus/`、localStorage `gitnote.*`→`plexus.*` 均带无感迁移）。

## 当前状态
- Version: 0.2.0（`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 一致）；tag `v0.2.0` 已推送。`main` 已领先 tag：合并了快捷键扩展（未发新版）。
- State: 开发中；改名收尾完成，新增编辑器交互特性 + 全局快捷键扩展。
- Current focus: 编辑器/AI 会话体验打磨、键盘可达性。

## 进行中任务
- （无进行中阻塞项）

## 里程碑
- v0.1.0：首个可下载构建（Tauri 三平台 Release 流程就绪）。
- v0.2.0（2026-06-20）：笔记编辑器右键菜单（基础编辑 + 问 AI）首次随版本发布。

## 待办
- AI 输入框需要保存草稿：切换到其他页面后再切回，已输入的内容不应丢失。
- **上下文优化（Agent 会话消息管理）**：① 状态回执自动覆盖历史——LLM 调用修改工具后，工具返回的「成功+Diff」回执使模型在思维链中自然合并原始文本与差异、感知最新状态，无需重复 read；② 压缩前钩子（Pre-Compaction Hook）——当对话轮次过长触发上下文压缩时，先由模型将最终代码/笔记状态提炼为 State Snapshot，旧历史裁切后将该快照重新注入上下文顶部，避免简单滑动窗口导致关键状态丢失。
- **AI 会话列表排序**：新建/最近活跃会话目前出现在列表顶部，应改为底部锚定（最新会话沉底），符合聊天应用习惯；同时需确保列表自动滚动到底部。
- **AI 消息泡增加时间戳**：每条消息气泡显示发送时间（相对时间如"3 分钟前"或绝对时间），便于回溯对话节奏。
- 后续（可选）：macOS 公证 / Windows 代码签名，消除"未签名"告警。
- 后续（可选）：若要任何人可下载，需将仓库改为 Public（发布前先确认历史无密钥）。

## 风险与阻塞
- 仓库私有 → Release 与安装包仅对有仓库权限的人可见（匿名用户 404）。
- 安装包未签名 → macOS 首次打开需在「隐私与安全性」放行；Windows 可能触发 SmartScreen。

## 最近更新
- 2026-06-20 - **移除 AI 活动工作集**（commit `0457456`），根除 `⟦已折叠…⟧`/`（已写入…）` 占位串回写笔记的死循环：工作集把历史正文替换成占位指针，模型会照抄回 `update_note` 的 content 覆盖真实笔记。系统性解决 = 直接删除工作集（`workingSet.ts`/`activeNotes.ts` 及测试、相关预算/breakdown/配置项与 UI、`foldWriteArgs` 变换）；正文改由对话中的 `read_note` 结果自然承载，超预算走既有 LLM 总结兜底。完成原「待办」中的占位符系统性问题。
- 2026-06-20 - 合并**全局快捷键扩展**到 `main`（merge `d38a1a5`，未发新版）：新增 5 个可重绑快捷键 —— `⌘E` 循环切换空间（`SPACE_ORDER` 有序，可扩展）、`⌘B` 切换侧边栏（折叠状态随 workspaceState 持久化）、`⌘S` 显式保存当前笔记（flush 单槽注册）、`⌘L` 聚焦 AI 聊天框（选最近活跃会话，无则新建）、`⌘P` 快速打开笔记（递归搜索 + ↑↓/Enter/Esc）。均接入快捷键配置 UI（设置→快捷键，新增「导航/编辑」分类）、macOS 原生菜单加速器与 Esc 关闭链。已构建 `Plexus_0.2.0_aarch64.dmg`。完成原「待办」中的快捷键补充项。
- 2026-06-20 - 发布 **v0.2.0**：笔记编辑器右键菜单（剪切/复制/粘贴/全选 + 问 AI）。抽出通用 `ContextMenu` 组件并让 NoteTree / SessionsList 共用去重。「问 AI」把选中文本带 `>` 引用注入最近活跃（或新建）AI 会话的输入框、不自动发送。适配模块编辑器的 block 渲染与窗口选区模型：复制/剪切走原生 execCommand，预览块存在选区时不进入编辑；修复 StrictMode 下「问 AI」二次注入。
- 2026-06-19 - 全项目改名 GitNote → Plexus（含无感数据迁移），文档与 OAuth env 一并更新。
- 2026-06-13 - 重写 `.github/workflows/release.yml`：改用「直接 `tauri build` + `softprops/action-gh-release`」三段式流程；新增 macOS universal 构建；`permissions: contents: write`。决定保持仓库私有、产物不签名、发布为 draft。
