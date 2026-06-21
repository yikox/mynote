# Plexus 项目管理

Last updated: 2026-06-20

## 概述
- Plexus：基于 Tauri 2 + React 的桌面 Markdown 笔记应用，笔记以本地文件存储并通过 git 同步，集成 AI 会话。
- 名称含义：Plexus 源自拉丁语，本意是"编织、交织成的网络"（如解剖学中的神经丛、血管网），兼具高级感与医学/生物学的严谨感。用作笔记软件之名，暗喻通过 AI 编织出的知识网，像人类大脑的神经网络一样紧密而充满生命。
- 仓库：`yikox/plexus`（GitHub，当前为 **私有**仓库）。
- 历史：原名 GitNote，于 2026-06-19 全项目改名为 Plexus（productName / bundle identifier `com.plexus.app` / crate `plexus`·`plexus_lib` / OAuth env `PLEXUS_GITHUB_OAUTH_CLIENT_ID`；数据目录 `~/.gitnote`→`~/.plexus`、工作区内 `.gitnote/`→`.plexus/`、localStorage `gitnote.*`→`plexus.*` 均带无感迁移）。

## 当前状态
- Version: 0.4.2（5 个版本文件一致）；tag `v0.4.2` 已推送，CI 6 安装包构建成功，Release 已**正式发布**：https://github.com/yikox/plexus/releases/tag/v0.4.2 。本地 `Plexus_0.4.2_aarch64.dmg` 已编译。
- State: 开发中；连发 3 个补丁（v0.4.1 白屏、v0.4.2 滚底+空路径写根目录）。
- Current focus: 编辑器/AI 会话体验打磨。

## 进行中任务
- （无进行中阻塞项）

## 里程碑
- v0.1.0：首个可下载构建（Tauri 三平台 Release 流程就绪）。
- v0.2.0（2026-06-20）：笔记编辑器右键菜单（基础编辑 + 问 AI）首次随版本发布。
- v0.3.0（2026-06-21）：写操作 Diff 回执（`update_note` 写成功返回「成功 + Diff」状态回执）首次随版本发布；CI 构建 6 安装包并正式发布 Release。
- v0.4.0（2026-06-21）：上下文压缩前状态快照（自动按 80% 阈值 + 手动 `/compact`，模型蒸馏任务进展/笔记最新状态注入上下文顶部）首次随版本发布；CI 构建 6 安装包并正式发布 Release。
- v0.4.1（2026-06-21）：补丁版——修复进入 AI 页面整窗白屏（zustand v5 selector 无限重渲染崩溃，全新安装必现）。
- v0.4.2（2026-06-21）：补丁版——① 聊天消息进入已有会话自动滚到底部（上滚阅读不打扰）；② `update_note` 漏传 path 不再把空路径写到工作区根目录（`Is a directory`），工具层回可执行报错 + Rust `write_file` 拒绝空路径/目录目标。

## 待办
- [ ] **全文搜索（⌘P 扩展）**：当前 ⌘P 快速打开仅递归搜索笔记标题，需扩展为全文内容搜索，匹配行带关键词高亮预览，支持 ↑↓ 浏览命中、Enter 跳转到对应笔记并定位到匹配行。
- [ ] **AI 对话 @ 笔记引用**：当前引用笔记需用鼠标在顶部「引用的笔记」区域点击添加，应支持在输入框中通过 `@` 唤起笔记搜索下拉（与 ⌘P 共享搜索能力但轻量），选中后注入为引用，键盘流无需离开输入框。
- [ ] **空状态占位页**：当无笔记标签页打开时，笔记区域显示引导页（快捷操作：打开笔记 / 新建笔记 / 最近修改列表）；AI 会话列表为空时同理（新建会话入口 + 使用提示）。
- [ ] 后续（可选）：状态快照 fast-follow —— 给 agentLoop 加一条集成测试断言 `summarize` 按 `stateSnapshotEnabled` 注入/省略（当前仅 `makeSnapshotSummarizer` 单测覆盖该门控）。
- [ ] 后续（可选）：macOS 公证 / Windows 代码签名，消除"未签名"告警。
- [ ] 后续（可选）：若要任何人可下载，需将仓库改为 Public（发布前先确认历史无密钥）。

## 风险与阻塞
- 仓库私有 → Release 与安装包仅对有仓库权限的人可见（匿名用户 404）。
- 安装包未签名 → macOS 首次打开需在「隐私与安全性」放行；Windows 可能触发 SmartScreen。

## 最近更新
- 2026-06-21 - **v0.4.2 修复两枚 bug**（merge `9a0270b`，patch 发版，本地+CI dmg 均出）：① **进入已有会话不滚底**——`MessageList` 原先无任何滚动逻辑，进会话停在顶部；改为挂载/消息条数变化时若「贴底」则滚到底，用户上滚阅读（距底 >80px）不打扰。注意此前「会话列表底部锚定」是会话**侧栏** `SessionsList`，与聊天**消息列表**无关，故没覆盖到。② **AI 改笔记报 `io error: Is a directory (os error 21)`**——读会话 `2026-06-20-d8d35f2d` 实锤：模型连续编辑同一篇时漏传 `path`，`textArg` 取空串，后端 `resolve(root,'')` 塌缩到**工作区根目录**，写目录 → EISDIR。修复防御两层：工具层 `update_note.execute` path 为空直接回可执行报错；Rust `write_file` 拒绝空路径与目录目标（`InvalidInput`）。新增 TS 用例 + 2 条 Rust 用例，TS 494/494、Rust `core::notes` 16/16、`npm run build` 绿。
- 2026-06-21 - **v0.4.1 修复进入 AI 页面整窗白屏**（merge `--no-ff`，patch 发版）：`ChatPanel` 的 `pendingImages` selector 在会话尚无草稿时每次 render 返回新 `[]` 引用，zustand v5 判定快照一直在变 → 无限重渲染（`Maximum update depth exceeded`）；项目无 ErrorBoundary → React 树崩溃 → 整窗白屏。**全新安装首次点 AI 聊天必现**。修复：selector 改用模块级稳定常量 `EMPTY_IMAGES`（commit `5331cf1`）。新增 jsdom 回归测试 `ChatPanel.test.tsx`，全套 491/491 通过。已扫描全仓库无其他 `?? []`/`?? {}` 直接出现在 store selector 内。
- 2026-06-21 - 合并 **上下文压缩前状态快照（Pre-Compaction State Snapshot）** 到 `main`（merge `--no-ff` `48cbb9b`，未发新版）：由模型生成、带缓存+增量扩展的「状态快照」（任务目标/关键决定/笔记最新状态/待办），超预算裁切旧轮前注入上下文顶部。触发阈值可配（`snapshotTriggerRatio` 默认 `0.8`）；设置开关 `stateSnapshotEnabled`（默认开）；手动 `/compact` 强制触发。新增 `snapshotStore`、`stateSnapshot.ts`、`completion.ts`。全套 490/490 通过。完成原「待办」中的上下文压缩前钩子项。
- 2026-06-21 - 合并 **状态回执自动覆盖历史（写操作 Diff 回执）** 到 `main`（merge `--no-ff`，未发新版）：`update_note` 写成功后返回「成功 + Diff」JSON 回执，让模型在思维链中合并原文+差异、感知最新状态，免去为确认而重复 `read_note`。UI 共享 `DiffView`，聊天默认展开、>20 行可折叠。全套 465/465 通过。完成原「待办」中的状态回执项。
- 2026-06-20 - 合并 **AI 消息气泡时间戳** 到 `main`（merge `--no-ff`，未发新版）：每条气泡显示发送时间，< 30 分钟相对时间、≥ 30 分钟绝对时间，悬停 title 显示完整时间。`Message` 增可选 `createdAt`，`agentLoop` 在创建时打戳。新增 `messageTime.test.ts`。完成原「待办」中的消息时间戳项。
- 2026-06-20 - 合并 **AI 会话列表底部锚定** 到 `main`（merge `--no-ff`，未发新版）：`sortIndex` 改升序，新建/最近活跃会话沉底；仅数量增加时滚底，活跃重排序不强制滚动。完成原「待办」中的会话列表排序项。
- 2026-06-20 - 合并 **前台笔记标签页自动刷新** 到 `main`（merge `--no-ff`，未发新版）：前台笔记被外部改动后，干净状态静默自动刷新并保留滚动、脏状态弹非破坏性冲突提示条。复用既有 Rust fs-watch 基础设施。完成原「待办」中的前台自动刷新项。
- 2026-06-20 - 合并 **AI 输入框草稿持久化** 到 `main`（merge `fd1ddf3`，未发新版）：新增按 sessionId 键控的 `chatDraftsStore`，切换页面不丢失；纯内存不写盘，重启不保留。完成原「待办」中的草稿持久化项。
- 2026-06-20 - **移除 AI 活动工作集**（commit `0457456`），根除占位串回写笔记的死循环。完成原「待办」中的占位符系统性问题。
- 2026-06-20 - 合并**全局快捷键扩展**到 `main`（merge `d38a1a5`）：⌘E/⌘B/⌘S/⌘L/⌘P。完成原「待办」中的快捷键补充项。
- 2026-06-20 - 发布 **v0.2.0**：笔记编辑器右键菜单（剪切/复制/粘贴/全选 + 问 AI）。
- 2026-06-19 - 全项目改名 GitNote → Plexus（含无感数据迁移），文档与 OAuth env 一并更新。
- 2026-06-13 - 重写 `.github/workflows/release.yml`：改用「直接 `tauri build` + `softprops/action-gh-release`」三段式流程；新增 macOS universal 构建；`permissions: contents: write`。决定保持仓库私有、产物不签名、发布为 draft。
