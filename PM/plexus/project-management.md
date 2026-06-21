# Plexus 项目管理

Last updated: 2026-06-21

## 概述
- Plexus：基于 Tauri 2 + React 的桌面 Markdown 笔记应用，笔记以本地文件存储并通过 git 同步，集成 AI 会话。
- 名称含义：Plexus 源自拉丁语，本意是"编织、交织成的网络"（如解剖学中的神经丛、血管网），兼具高级感与医学/生物学的严谨感。用作笔记软件之名，暗喻通过 AI 编织出的知识网，像人类大脑的神经网络一样紧密而充满生命。
- 仓库：`yikox/plexus`（GitHub，当前为 **私有**仓库）。
- 历史：原名 GitNote，于 2026-06-19 全项目改名为 Plexus（productName / bundle identifier `com.plexus.app` / crate `plexus`·`plexus_lib` / OAuth env `PLEXUS_GITHUB_OAUTH_CLIENT_ID`；数据目录 `~/.gitnote`→`~/.plexus`、工作区内 `.gitnote/`→`.plexus/`、localStorage `gitnote.*`→`plexus.*` 均带无感迁移）。

## 当前状态
- Version: 0.4.8（5 个版本文件一致）；tag `v0.4.8` 已推送。**CI 构建（mac/win/linux 三平台）均成功，但最后的 Publish 作业被 GitHub Actions 账单限额阻断未起**；已手动从构建产物建 Release（`gh run download` 6 安装包 → `gh release create`，走 API 不消耗 Actions 额度）。v0.4.8 已**正式发布**（6 安装包齐全）：https://github.com/yikox/plexus/releases/tag/v0.4.8 。本地 `Plexus_0.4.8_aarch64.dmg` 已出。
- **⚠️ 阻塞项：GitHub Actions 账单/spending limit 需在 Settings → Billing & plans 修复**，否则后续版本的自动发布（Publish 作业）会继续被阻断；修复后可对失败 run 用 `gh run rerun --failed`，或继续沿用「产物手动建 Release」兜底。
- v0.4.7 已**正式发布**（6 安装包齐全）：https://github.com/yikox/plexus/releases/tag/v0.4.7 。
- State: 开发中；连发多个补丁/小版本（…、v0.4.6 ⌘⇧F 全局全文搜索、v0.4.7 ⌘F 标签内查找、v0.4.8 跳转渐隐高亮）。
- Current focus: 编辑器/AI 会话体验打磨。搜索三件套（⌘P 文件选择器 / ⌘⇧F 全局全文搜索 / ⌘F 标签内查找）**全部完成**。

## 进行中任务
- （无进行中阻塞项）

## 里程碑
- v0.1.0：首个可下载构建（Tauri 三平台 Release 流程就绪）。
- v0.2.0（2026-06-20）：笔记编辑器右键菜单（基础编辑 + 问 AI）首次随版本发布。
- v0.3.0（2026-06-21）：写操作 Diff 回执（`update_note` 写成功返回「成功 + Diff」状态回执）首次随版本发布；CI 构建 6 安装包并正式发布 Release。
- v0.4.0（2026-06-21）：上下文压缩前状态快照（自动按 80% 阈值 + 手动 `/compact`，模型蒸馏任务进展/笔记最新状态注入上下文顶部）首次随版本发布；CI 构建 6 安装包并正式发布 Release。
- v0.4.1（2026-06-21）：补丁版——修复进入 AI 页面整窗白屏（zustand v5 selector 无限重渲染崩溃，全新安装必现）。
- v0.4.2（2026-06-21）：补丁版——① 聊天消息进入已有会话自动滚到底部（上滚阅读不打扰）；② `update_note` 漏传 path 不再把空路径写到工作区根目录（`Is a directory`），工具层回可执行报错 + Rust `write_file` 拒绝空路径/目录目标。
- v0.4.3（2026-06-21）：补丁版——给写工具补齐 `path` 参数说明（`update_note`/`delete_note`/`move_note` 描述显式要求每次传相对路径、`.md` 结尾、不可省略），降低模型漏传 path 概率。
- v0.4.4（2026-06-21）：空状态引导页——无标签页打开时，笔记主区域显示引导页（打开笔记 / 新建笔记 / 最近 5 条修改），AI 主区域显示引导页（新建会话 + 使用提示）。
- v0.4.5（2026-06-21）：AI 输入框 `@` 笔记引用——在聊天输入框词边界处敲 `@` 即弹出现有「引用笔记」树形选择器（NotePicker），键盘选中后作为引用 chip 注入，全程不离开输入框。
- v0.4.6（2026-06-21）：⌘⇧F 全局全文搜索——弹框对所有笔记做全文内容搜索（复用 Rust grep 后端），匹配行带关键词高亮预览，↑↓ 浏览、Enter 打开笔记并定位到匹配行。
- v0.4.7（2026-06-21）：⌘F 当前标签页内查找——编辑器右上角 VSCode 风格查找框，搜源码、显示当前/总数、↑↓/Enter 环绕导航；纯文本模式 textarea 精确选中、模块模式滚到匹配所在模块。搜索三件套收齐。
- v0.4.8（2026-06-21）：跳转目标渐隐高亮——检索/定位跳转后，模块模式给目标模块加约 1.4s 渐隐高亮、纯文本模式定位改为选中整行，让用户看清落点（改 `handleJump` 一处覆盖 ⌘⇧F/⌘F/TOC 所有跳转）。

## 待办
- [ ] 内置几个 agent , 一个是研究型 agent 当我想了解一些不了解的内容时使用；一个是助手型 agent 当我想整理笔记，修改笔记，整理笔记内容时使用；一个是shen
- [ ] 后续（可选）：状态快照 fast-follow —— 给 agentLoop 加一条集成测试断言 `summarize` 按 `stateSnapshotEnabled` 注入/省略（当前仅 `makeSnapshotSummarizer` 单测覆盖该门控）。
- [ ] 后续（可选）：macOS 公证 / Windows 代码签名，消除"未签名"告警。
- [ ] 后续（可选）：若要任何人可下载，需将仓库改为 Public（发布前先确认历史无密钥）。

## 风险与阻塞
- **GitHub Actions 账单限额（2026-06-21 起）**：v0.4.8 发布时 Publish 作业因「recent account payments have failed or your spending limit needs to be increased」未起（构建作业本身成功、产物已上传）。需在 Settings → Billing & plans 修复；未修复前每次发版的 Publish 作业都会被阻断，需走「`gh run download` 产物 → `gh release create`」手动兜底。
- 仓库私有 → Release 与安装包仅对有仓库权限的人可见（匿名用户 404）。
- 安装包未签名 → macOS 首次打开需在「隐私与安全性」放行；Windows 可能触发 SmartScreen。

## 最近更新
- 2026-06-21 - **v0.4.8 跳转目标渐隐高亮**（merge `--no-ff`，patch 发版；**发布遇 GitHub Actions 账单限额**：三平台构建均成功、产物已上传，但 Publish 作业未起，遂 `gh run download` 6 安装包 + `gh release create` 手动建 Release，本地 dmg 亦已出）：用户反馈检索跳转后看不出落点。改 `MarkdownEditor.handleJump`（所有跳转汇聚点，一处覆盖 ⌘⇧F 定位/⌘F 富文本查找/TOC）。新增纯函数 `flashJumpTarget(el, className, durationMs)`（移除→reflow→加 class→定时移除，返回取消函数防悬挂 timer）。**rich 模式**滚到目标模块后加 `module-markdown-editor__module--flash`（CSS `@keyframes editor-jump-flash` 背景 `--color-accent-soft`→透明，1.4s ease-out），用 `flashCancelRef` 连续跳转取消上一个、组件卸载清理。**plain 模式**把定位的塌缩光标改为选中整行（`lastIndexOf('\n')`/`indexOf('\n')` 算行首尾），靠选区高亮（textarea 无法叠渐隐层）；既有 locate 测试只断言 `selectionStart`=行首故不破。全套 563/563（+3）、tsc + build 绿。
- 2026-06-21 - **v0.4.7 ⌘F 当前标签页内查找**（merge `--no-ff`，patch 发版，本地 dmg + CI 构建）：编辑器右上角 VSCode 风格查找框，统一搜**源码字符串**（`draft`）。新增纯函数 `findMatches`（大小写不敏感、不重叠匹配偏移）、`stepIndex`（环绕步进）；新组件 `EditorFindBar`（受控：输入 + `n/total` 计数 + 上/下/关闭，Enter/Shift+Enter/Esc、focusNonce 聚焦）；uiStore 加 `findOpen`/`findNonce` + `openFind`/`closeFind`/`toggleFind`；快捷键 `find`=⌘F（与 ⌘⇧F globalSearch 靠 shift 区分，已测不冲突）+ escapeBack 关闭；`MarkdownEditor` 持 query/index 状态，`navigateToMatch` 按模式分叉——**plain 模式** textarea `setSelectionRange`+滚动（不抢查找框焦点）、**rich 模式**复用 `handleJump(offset)` 滚到模块（块级，无行内高亮）。index 用 `Math.min` 钳制防 query 变短时越界。搜索三件套（⌘P/⌘⇧F/⌘F）收齐。全套 560/560（+22）、tsc + build 绿。
- 2026-06-21 - **v0.4.6 ⌘⇧F 全局全文搜索**（merge `--no-ff`，patch 发版，本地 dmg + CI 构建）：纯前端组装，后端 `search_notes`（Rust grep，字面量、.md、上限 50，返回 `{path,line,content}`）与编辑器 `handleJump(pos)` 均复用。新增纯函数 `lineToOffset`（1-based 行号→字符偏移，越界收敛文末）、`highlightSegments`（大小写不敏感切高亮段）；新组件 `GlobalSearchModal`（复用 `.quick-open` 弹框壳、输入 150ms 防抖、扁平行列表 + `<mark>` 高亮、↑↓/Enter/Esc）；uiStore 加 `globalSearchOpen` 开关 + `locateRequest{path,line,nonce}` 投递（仿 `chatFocusNonce` nonce 范式）；`MarkdownEditor` effect 监听 locateRequest，命中本 path 且 loaded 时 `handleJump(lineToOffset(draft,line))`（rAF 等 DOM、ref 防重复）；快捷键加 `globalSearch`=⌘⇧F + escapeBack 关闭。**需求反复**：原 todo「全文搜索（⌘P 扩展）」被用户重定为三件套（⌘P 保持 / ⌘⇧F 全局 / ⌘F 标签内），按 brainstorm scope-check 拆分、先做 ⌘⇧F。全套 538/538（+21）、tsc + build 绿。
- 2026-06-21 - **v0.4.5 AI 输入框 @ 笔记引用**（merge `--no-ff`，patch 发版，本地 dmg + CI 构建）：聊天输入框词边界（行首或空白后）敲 `@` 即弹出现有「引用笔记」树形选择器（NotePicker），`@` 字符即时移除，键盘浏览树→选中→走现有 `attachNote` 注入引用 chip，全程不离开输入框。新增纯函数 `mentionQuery.ts`（`detectMention` 词边界检测 + `removeMention` 移除 token）。**设计反复**：初版按 spec 做成「⌘P 风格扁平搜索下拉」（`collectNoteFiles`+`filterNoteFiles`+键盘导航+懒加载），用户实测后觉得不合适，要求复用「引用文件」树形窗口而非 ⌘P 窗口；遂在合并到 main（未推送、未发版）后开 `fix/` 分支重构为纯触发树形选择器，删掉扁平菜单/键盘导航/懒加载/mention-menu 样式，仅保留 `detectMention`/`removeMention`。教训：交互细节（用哪种选择器窗口）值得在 brainstorm 时用可视化或更具体的选项确认，避免按字面 spec（「搜索下拉」）做出非预期实现。全套 516/516、tsc + build 绿。
- 2026-06-21 - **v0.4.4 空状态引导页**（merge `--no-ff` `d34c386`，patch 发版，本地 dmg 已出、CI 构建中）：把 `MainArea` 无标签页时的一行纯文本占位换成带快捷操作的引导页。新增纯函数 `collectRecentNotes`（递归取最近 5 条 `.md`，`modifiedMs` 倒序、null 排末尾）+ 两个自包含组件 `NotesWelcome`（打开笔记→`openQuickOpen` / 新建笔记→`createUntitledNote`→`refreshRoot`→`openNote` / 最近列表点开）与 `AiWelcome`（新建会话→`newSession`→`openAi` + 3 条使用提示）；`MainArea` 按 `activeSpace` 分发。侧栏空状态（`SessionsList`/`Sidebar`）按设计保持不动。全套 502/502（+8）、tsc 绿。走 brainstorm→spec→plan→内联 TDD 执行流程。
- 2026-06-21 - **v0.4.3 写工具 path 描述补齐**（merge `0491c22`，patch 发版，本地+CI dmg 均出）：审查给 AI 的工具描述，发现写工具 `path` 参数说明缺失/不足。`update_note`/`delete_note`/`move_note` 的描述与参数 schema 补上"每次必须显式传相对路径、`.md` 结尾、不可省略沿用上次"，从描述层降低模型漏传 path（v0.4.2 的 `Is a directory` 根因）的概率。`readNote`/`listNotes`/`searchNotes`/`createNote` 等审查后无需改。TS 494/494 绿。
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
