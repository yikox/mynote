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
- [ ] 后续（可选）：状态快照 fast-follow —— 给 agentLoop 加一条集成测试断言 `summarize` 按 `stateSnapshotEnabled` 注入/省略（当前仅 `makeSnapshotSummarizer` 单测覆盖该门控）。
- [ ] 后续（可选）：macOS 公证 / Windows 代码签名，消除"未签名"告警。
- [ ] 后续（可选）：若要任何人可下载，需将仓库改为 Public（发布前先确认历史无密钥）。

## 风险与阻塞
- 仓库私有 → Release 与安装包仅对有仓库权限的人可见（匿名用户 404）。
- 安装包未签名 → macOS 首次打开需在「隐私与安全性」放行；Windows 可能触发 SmartScreen。

## 最近更新
- 2026-06-21 - **v0.4.2 修复两枚 bug**（merge `9a0270b`，patch 发版，本地+CI dmg 均出）：① **进入已有会话不滚底**——`MessageList` 原先无任何滚动逻辑，进会话停在顶部；改为挂载/消息条数变化时若「贴底」则滚到底，用户上滚阅读（距底 >80px）不打扰（避免重蹈 `e0e092a` 强制滚动）。注意此前「会话列表底部锚定」是会话**侧栏** `SessionsList`，与聊天**消息列表**无关，故没覆盖到。② **AI 改笔记报 `io error: Is a directory (os error 21)`**——读会话 `2026-06-20-d8d35f2d` 实锤：模型连续编辑同一篇时漏传 `path`，`textArg` 取空串，后端 `resolve(root,'')` 塌缩到**工作区根目录**，写目录 → EISDIR；不是某 .md 变目录。**非写操作 Diff 回执 FS 层引入**，但大段 diff 回执疑似诱导模型省略 path（用户「后遗症」直觉方向对）。修复防御两层：工具层 `update_note.execute` path 为空直接回可执行报错（绝不带空路径下发）；Rust `write_file` 拒绝空路径与目录目标（`InvalidInput`），保护根目录。新增 TS 用例 + 2 条 Rust 用例，TS 494/494、Rust `core::notes` 16/16、`npm run build` 绿。
- 2026-06-21 - **v0.4.1 修复进入 AI 页面整窗白屏**（merge `--no-ff`，patch 发版）：systematic-debugging 定位根因——`ChatPanel` 的 `pendingImages` selector `useChatDraftsStore((s) => s.drafts[sessionId]?.images ?? [])` 在会话**尚无草稿**时每次 render 返回新 `[]` 引用，zustand v5（`useSyncExternalStore`）判定快照一直在变 → 无限重渲染（`Maximum update depth exceeded`）；项目无 ErrorBoundary → React 树崩溃 → 整窗白屏。**全新安装首次点 AI 聊天必现**，缺陷自 `chatDraftsStore` 特性起即潜伏（v0.3.0 同受影响），非状态快照引入。修复：selector 改用模块级稳定常量 `EMPTY_IMAGES`（commit `5331cf1`）。新增 jsdom 回归测试 `ChatPanel.test.tsx`（mock `invoke` 后渲染即复现，RED→GREEN 双向确认），全套 491/491 通过、`npm run build` 绿。已扫描全仓库无其他 `?? []`/`?? {}` 直接出现在 store selector 内。通用规则记入 knowledge-summary（zustand selector 禁内联新对象/数组，改稳定常量或 `useShallow`）。本地 dmg 已编译。
- 2026-06-21 - 合并 **上下文压缩前状态快照（Pre-Compaction State Snapshot）** 到 `main`（merge `--no-ff` `48cbb9b`，未发新版）：把 `contextBuilder` 中**未接线、只回退占位串**的 `summarize` 步骤，变为**由模型生成、带缓存+增量扩展的「状态快照」**（任务目标/关键决定/笔记最新状态/待办），超预算裁切旧轮前注入上下文顶部，解决朴素滑动窗口丢失关键状态。触发阈值**可配**（`snapshotTriggerRatio` 默认 `0.8`，对话层用到预算 80% 即提前压缩，`?? 1` 回退保旧测试）；**设置开关** `stateSnapshotEnabled`（默认开，仅门控**自动**触发）；现有空操作 `/compact` 接成**手动强制触发**（`compactSessionNow`，独立于开关、忽略阈值）。被裁轮次**绝不发模型**，完整历史留在 `sessionsStore`（不写回）。新增：`snapshotStore`（按 sessionId 纯内存缓存 `{coveredMsgCount,snapshotText}`，会话删除时清理）、`stateSnapshot.ts`（增量内核 `generateSnapshotFromOlder`：消息条数前缀单调、命中缓存零调用、失败保留旧快照不推进 covered、4000 字符代理对安全封顶；`buildSnapshotRequest` 全量/增量提示词；`makeSnapshotSummarizer` 自动闭包工厂；`compactSessionNow` 手动入口，按缓存 covered 判定真成功，失败如实提示）、`completion.ts`（一次性非流式 LLM 调用 `runCompletion`，复用 `aiService` 流式接口）。`contextBuilder` 导出 `splitTurns`/`splitOlderKept` 供自动+手动共享同一折叠+边界（**无漂移**）。设置→上下文管理加开关与阈值百分比控件。subagent 驱动开发：9 任务逐个 spec+quality 评审 + opus 全分支评审（修掉手动 /compact 失败误报成功 + compressing 重入守卫未接线，复评 Ready to merge）。全套 490/490 通过、`npm run build` 绿。spec/plan 见 `docs/superpowers/{specs,plans}/2026-06-21-pre-compaction-state-snapshot*`。完成原「待办」中的上下文压缩前钩子项。
- 2026-06-21 - 合并 **状态回执自动覆盖历史（写操作 Diff 回执）** 到 `main`（merge `--no-ff`，未发新版）：`update_note` 写成功后不再只回 `{ok,action,path}`，而是返回**「成功 + Diff」JSON 回执**，让模型在思维链中合并原文+差异、感知最新状态，免去为「确认」而重复 `read_note`、省上下文。`src/ai/tools/shared.ts` 新增 `buildWriteDiffReceipt`（复用 `buildLineDiff`/`boundDiff`，diff 渲染为带 `  `/`+ `/`- ` 前缀的文本字符串，`linesAdded/Removed` 取截断前完整 diff，渲染后按码元封顶 `RECEIPT_DIFF_CHAR_LIMIT=6000` < `MAX_TOOL_RESULT_CHARS=8000` 且不切断 UTF-16 代理对）；`boundDiff` 加可选 `charLimit`（默认 12000 不变）；`update_note.execute` 写前读 before、读失败回退无-diff 回执 + warning。UI 抽出共享 `DiffView`（行号双计数 + app 色板红/绿整行轻底色），`ConfirmToolDialog` 与聊天 `MessageItem` 的新 `DiffWriteResult` 共用（聊天默认展开、>20 行可折叠、截断提示、「打开」按钮）；仅默认系统提示词加「写后勿为确认重读」引导句。范围限 `update_note`（create/move/delete 不变；未做写后折叠；不注入自定义提示词）。subagent 驱动开发：5 任务逐个 spec+quality 评审 + 最终全分支评审（Ready to merge），全套 465/465 通过、`npm run build` 绿。spec/plan 见 `docs/superpowers/{specs,plans}/2026-06-20-write-diff-receipt*`。完成原「待办」中的状态回执项。
- 2026-06-20 - 合并 **AI 消息气泡时间戳** 到 `main`（merge `--no-ff`，未发新版）：每条 user/assistant 气泡显示发送时间，**< 30 分钟相对时间（刚刚 / N 分钟前）、≥ 30 分钟绝对时间（同日 HH:MM、跨日 M月D日 HH:MM、跨年带年）**，悬停 title 显示完整绝对时间。`Message` 增可选 `createdAt`（挂在共享 `CompressibleMessage` 上，零迁移），`agentLoop` 抽出 `buildUserMessage`/`newAssistantMessage` 在创建时打戳（流式只改 content 不动时间）；格式化逻辑独立为可测的 `messageTime.ts`；`MessageItem` 在角色标签旁渲染，tool/system 与无戳的旧消息不显示（用户选定）。新增 `messageTime.test.ts` + MessageItem/agentLoop 用例，全套 452/452 通过、`npm run build` 绿。完成原「待办」中的消息时间戳项。
- 2026-06-20 - 合并 **AI 会话列表底部锚定** 到 `main`（merge `--no-ff`，未发新版）：会话列表由「最新在顶部」改为聊天式「最新沉底」。顺序真源在 `sessionsStore.index`：`sortIndex` 改升序、`bumpIndex`/`newSession` 改为追加到末尾（最近活跃/新建会话落到底部）。`SessionsList` 给滚动容器 `<ul.sessions__list>` 加 ref + effect，仅在会话**数量增加**时（首次加载 0→N、新建 N→N+1）滚到底，活跃重排序（数量不变）与删除不强制滚动，避免上滚查看旧会话时被拽走。新增 `SessionsList.test.tsx` + 3 条 store 排序用例，全套 437/437 通过、`npm run build` 绿。完成原「待办」中的会话列表排序项。
- 2026-06-20 - 合并 **前台笔记标签页自动刷新** 到 `main`（merge `--no-ff`，未发新版）：前台打开的笔记被外部（AI 工具 `update_note`/`delete_note`/`move_note`）改动后编辑器自动同步。**复用既有基础设施**，Rust 无改动 —— `src-tauri/src/watcher.rs` 已对工作区递归 fs-watch 并 emit `notes://changed { kind, path }`，前端 `useNoteDraft` 新增订阅 + 按**内容比较**协调：回声（disk==当前草稿）忽略、干净（无未保存编辑）静默自动刷新并尽力保留滚动、脏且不同弹**非破坏性冲突提示条**（重新加载/保留我的修改，绝不自动覆盖）、`removed` 弹删除提示条并保留标签与内容。仅当前激活编辑器订阅（后台标签重激活时本就重读盘）。`MarkdownEditor` 渲染提示条并把滚动容器 ref 传入 hook。最终评审修掉 2 个定时器竞态（reloadFromDisk 取消挂起保存、回声分支清理过期提示条）。全套测试 432/432 通过、`npm run build` 绿。完成原「待办」中的前台自动刷新项。
- 2026-06-20 - 合并 **AI 输入框草稿持久化（切页面不丢失）** 到 `main`（merge `fd1ddf3`，未发新版）：新增按 `sessionId` 键控的纯内存 `chatDraftsStore`（`src/stores/chatDraftsStore.ts`），把输入框文本/附件文件/待发图片提升到 store，沿用 `aiRunsStore`/`pendingInput` 范式 —— 切换标签页导致 `ChatPanel`/`InputBox` 卸载后切回不丢失；纯内存不写盘，**重启不保留**（按需求）。`InputBox` 在有 `sessionId` 时走 store、无则回退本地 `useState`（保持旧测试通过，避免条件式 Hook）；发送/斜杠命令/Esc 成功路径清空草稿；`sessionsStore.remove` 删除会话时一并清理草稿避免内存残留。全套测试 422/422 通过，`npm run build` 绿。完成原「待办」中的草稿持久化项。
- 2026-06-20 - **移除 AI 活动工作集**（commit `0457456`），根除 `⟦已折叠…⟧`/`（已写入…）` 占位串回写笔记的死循环：工作集把历史正文替换成占位指针，模型会照抄回 `update_note` 的 content 覆盖真实笔记。系统性解决 = 直接删除工作集（`workingSet.ts`/`activeNotes.ts` 及测试、相关预算/breakdown/配置项与 UI、`foldWriteArgs` 变换）；正文改由对话中的 `read_note` 结果自然承载，超预算走既有 LLM 总结兜底。完成原「待办」中的占位符系统性问题。
- 2026-06-20 - 合并**全局快捷键扩展**到 `main`（merge `d38a1a5`，未发新版）：新增 5 个可重绑快捷键 —— `⌘E` 循环切换空间（`SPACE_ORDER` 有序，可扩展）、`⌘B` 切换侧边栏（折叠状态随 workspaceState 持久化）、`⌘S` 显式保存当前笔记（flush 单槽注册）、`⌘L` 聚焦 AI 聊天框（选最近活跃会话，无则新建）、`⌘P` 快速打开笔记（递归搜索 + ↑↓/Enter/Esc）。均接入快捷键配置 UI（设置→快捷键，新增「导航/编辑」分类）、macOS 原生菜单加速器与 Esc 关闭链。已构建 `Plexus_0.2.0_aarch64.dmg`。完成原「待办」中的快捷键补充项。
- 2026-06-20 - 发布 **v0.2.0**：笔记编辑器右键菜单（剪切/复制/粘贴/全选 + 问 AI）。抽出通用 `ContextMenu` 组件并让 NoteTree / SessionsList 共用去重。「问 AI」把选中文本带 `>` 引用注入最近活跃（或新建）AI 会话的输入框、不自动发送。适配模块编辑器的 block 渲染与窗口选区模型：复制/剪切走原生 execCommand，预览块存在选区时不进入编辑；修复 StrictMode 下「问 AI」二次注入。
- 2026-06-19 - 全项目改名 GitNote → Plexus（含无感数据迁移），文档与 OAuth env 一并更新。
- 2026-06-13 - 重写 `.github/workflows/release.yml`：改用「直接 `tauri build` + `softprops/action-gh-release`」三段式流程；新增 macOS universal 构建；`permissions: contents: write`。决定保持仓库私有、产物不签名、发布为 draft。
