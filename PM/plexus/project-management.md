# Plexus 项目管理

Last updated: 2026-06-27

## 概述
- Plexus：基于 Tauri 2 + React 的桌面 Markdown 笔记应用，笔记以本地文件存储并通过 git 同步，集成 AI 会话。
- 名称含义：Plexus 源自拉丁语，本意是"编织、交织成的网络"（如解剖学中的神经丛、血管网），兼具高级感与医学/生物学的严谨感。用作笔记软件之名，暗喻通过 AI 编织出的知识网，像人类大脑的神经网络一样紧密而充满生命。
- 仓库：`yikox/plexus`（GitHub，当前为 **私有**仓库）。
- 历史：原名 GitNote，于 2026-06-19 全项目改名为 Plexus（productName / bundle identifier `com.plexus.app` / crate `plexus`·`plexus_lib` / OAuth env `PLEXUS_GITHUB_OAUTH_CLIENT_ID`；数据目录 `~/.gitnote`→`~/.plexus`、工作区内 `.gitnote/`→`.plexus/`、localStorage `gitnote.*`→`plexus.*` 均带无感迁移）。

## 设计文档

| 类型 | 路径 | 状态 | 备注 |
| --- | --- | --- | --- |
| 主设计文档 | architecture/main-design.md | implemented | 系统范围、模块地图、核心流程、共享约束、跨模块决策 |
| 模块: 编辑器 Editor | architecture/modules/editor.md | implemented | 双模式 Markdown 编辑、查找、跳转高亮、代码块语法高亮、列表项级编辑、表格编辑/智能渲染 |
| 变更设计: 编辑器块内子块渲染 | architecture/modules/editor/changes/2026-06-24-block-subblock-rendering.md | implemented | 2026-06-24 已落地：list 块活动态下沉到列表项级；2026-06-25 真机修复 4 项列表体验 |
| 变更设计: 表格编辑体验 | architecture/modules/editor/changes/2026-06-24-table-editing-experience.md | implemented | 2026-06-25 已落地：整表 textarea 内 Tab/Shift+Tab/Enter 导航、自动补行/退出、CJK 宽度源码对齐 |
| 变更设计: Markdown 表格智能渲染 | architecture/modules/editor/changes/2026-06-27-smart-table-rendering.md | implemented | 2026-06-27 已落地：容器测量、列类型识别、贪心列宽收缩、自然断点、简单 inline Markdown |
| 模块: AI Agent | architecture/modules/ai-agent.md | implemented | 会话编排、上下文预算/压缩、状态快照、预设 agent |
| 模块: AI 工具 AI Tools | architecture/modules/ai-tools.md | implemented | 工具定义/注册、写守卫、Diff 回执 |
| 模块: 笔记 Notes | architecture/modules/notes.md | implemented | 笔记 CRUD/检索/监听，落盘真相在 Rust |
| 模块: UI 外壳 UI Shell | architecture/modules/ui-shell.md | implemented | 布局、导航、弹框、全局快捷键、引导页 |
| 模块: 同步 Sync | architecture/modules/sync.md | implemented | git 远程同步、GitHub OAuth 与仓库管理 |

## 当前状态
- Version: 0.4.11（5 个版本文件一致；Cargo.lock 仅 bump `plexus` crate，第三方 `erased-serde` 恰为 0.4.10 不动）；tag `v0.4.11` 已推送。本地 `Plexus_0.4.11_aarch64.dmg`（11M）已出（路径 `src-tauri/target/release/bundle/dmg/`）。**CI 账单限额仍阻断**：v0.4.11 release run 同样在 `Validate tag` 即被账单门阻断（3s 失败，run 27912776834），Build 三平台未起、无产物 → `gh run download` 兜底失效。故 v0.4.11 **尚未建 GitHub Release**，仅本地 dmg。
- v0.4.10（内置预设 agent）、v0.4.9（词级跳转高亮）：同样仅本地 dmg、未建 Release（账单阻断）。
- v0.4.8 已**正式发布**（6 安装包齐全，当时构建作业成功、仅 Publish 被阻）：https://github.com/yikox/plexus/releases/tag/v0.4.8 。
- **⚠️ 阻塞项：GitHub Actions 账单/spending limit 需在 Settings → Billing & plans 修复**，否则后续发版的整条 release 流水线都会在第一步被阻断；修复后可对失败 run 用 `gh run rerun --failed`。
- State: 开发中；连发多个补丁/小版本（…、v0.4.9 词级跳转高亮、v0.4.10 内置预设 agent、v0.4.11 上下文预算窗口优先）。
- Current focus: 编辑器/AI 会话体验打磨。搜索三件套全部完成；跳转高亮已迭代到词级（v0.4.9）；内置 4 个预设 agent（v0.4.10）；上下文预算/压缩按模型真实窗口（v0.4.11）。

## 进行中任务
- （无进行中任务）

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
- v0.4.9（2026-06-21）：词级跳转高亮——把 v0.4.8 的整块渐隐收窄为只高亮**被检索的词**（Custom Highlight API，深色 `--color-accent`，10s）。SDD 流程产出后用户实测连修 3 处：① 跳下一个不清上一个 → `highlightRange` 改注册一次的单例 `Highlight`，每次 `clear()+add()` 复用（new+set 在 WebKit 不能可靠抹旧绘制）；② 大模块里词在折叠区下方看不见高亮 → 滚到 `range.getBoundingClientRect()` 匹配词而非模块顶部；③ 顶贴生硬 → 目标定位到视口约 1/4 处（`clientHeight*0.25`，scrollTop 自动钳位，文末自然落底）。
- v0.4.10（2026-06-22）：内置 4 个预设 agent——复用既有多模板基础设施，内置「通用助手（default-agent 改名）/研究助手/笔记管家/写作助手」，各带定制系统提示词、工具集（笔记读写全开、写操作手动确认）、温度（研究 0.3/写作 0.8）与联网开关（研究开、管家/写作关）；自动出现在输入框 Agent 下拉与配置弹框。一次性版本批次播种（`presetSeedVersion`，删除不复活）；恢复默认按 id（`builtinTemplateDefaults`）修复 4 同 id bug；`.plexus/system-prompt.md` 兼容式分层注入到预设（通用助手行为不变）。
- v0.4.11（2026-06-22）：上下文预算改为模型窗口优先——抽出 `contextBudgetTokens(limits, config)`，设了模型上下文窗口就用「窗口−输出预留−安全余量」、**不再被默认上限封顶**（大窗口模型如 1M 不再过早压缩）；默认上限 `budgetCapTokens` 120000→`256*1024`（1K=1024，`formatK` 显示恰为 256K，此前 120000÷1024≈117 才显示成迷惑的「117K」）；老配置一次性迁移（播种 v2 空批次触发，仅旧 stock 值 120000 提升、自定义值不动）；ChatPanel 分母与压缩对齐（运行时用 `breakdown.budgetTokens`、空闲同样窗口优先）。

## 需求待办

| ID | 需求 | 状态 | 主模块 | 修改摘要 | 范围 / 影响点 | 设计文档 | 下一步 / 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |

（暂无未实现需求。新增需求先进入本节，再按生命周期进入设计和实现。）

## 待办
- [ ] 后续（可选）：代码高亮性能 fast-follow —— `MarkdownModulePreview` 未 memo，`highlightCode` 每次按键对非活动预览重跑（`highlightAuto` 扫 ~37 语言）；代码密集笔记若卡顿，用 `React.memo` 或按 `(text, language)` 缓存。
- [ ] 后续（可选）：状态快照 fast-follow —— 给 agentLoop 加一条集成测试断言 `summarize` 按 `stateSnapshotEnabled` 注入/省略（当前仅 `makeSnapshotSummarizer` 单测覆盖该门控）。
- [ ] 后续（可选）：macOS 公证 / Windows 代码签名，消除"未签名"告警。
- [ ] 后续（可选）：若要任何人可下载，需将仓库改为 Public（发布前先确认历史无密钥）。

## 任务归档
- [x] 内置几个 agent（v0.4.10 完成：通用/研究/笔记管家/写作 4 个预设）。
- [x] 做代码格式的渲染（2026-06-23 完成：highlight.js/lowlight 语法高亮，编辑器预览 + AI 聊天，已 merge 到 main、未发版）。
- [x] 编辑器块内子块渲染（2026-06-24 完成，仅 list 块）：设计 `architecture/modules/editor/changes/2026-06-24-block-subblock-rendering.md`，merge `e08cd29`，后续修复 `e4b39be`。
- [x] 表格编辑体验（2026-06-25 完成，未发版）：设计 `architecture/modules/editor/changes/2026-06-24-table-editing-experience.md`，提交 `f433e8c`/`f8331ca`/`0012885`/`cf271e7`，修复 `462a06f`。
- [x] Markdown 表格智能渲染（2026-06-27 完成，未发版）：设计 `architecture/modules/editor/changes/2026-06-27-smart-table-rendering.md`，提交 `cecc07d` 并推送 `origin/main`。

## 风险与阻塞
- **GitHub Actions 账单限额（2026-06-21 起，已升级）**：起初（v0.4.8）仅最后的 Publish 作业被「recent account payments have failed or your spending limit needs to be increased」阻断，构建作业仍成功、产物可下，故能 `gh run download` 兜底。到 v0.4.9 升级为**整条流水线第一步 `Validate tag` 即被阻断（4s 失败），Build 作业根本不起、无产物上传**，`gh run download` 兜底**失效**。需在 Settings → Billing & plans 修复；未修复前发版只能拿本地构建产物 `gh release create`（但本地仅 macOS dmg，缺 win/linux）。
- 仓库私有 → Release 与安装包仅对有仓库权限的人可见（匿名用户 404）。
- 安装包未签名 → macOS 首次打开需在「隐私与安全性」放行；Windows 可能触发 SmartScreen。

## 最近更新

> 2026-06-27 已压缩主 PM 历史；完整旧记录见 `archives/project-management-history-2026.md`。

- 2026-06-27 - **PM 审计清理与压缩**：补齐设计索引、变更设计元信息、Editor 架构基线和智能表格渲染知识；将详细历史归档到 `archives/project-management-history-2026.md`。
- 2026-06-27 - **Markdown 表格智能渲染落地**（提交 `cecc07d`，已推送 `origin/main`，未发版）：`smartTableLayout` + `SmartTablePreview` 按容器宽度分配列宽，状态列不拆英文，路径/URL 自然断点，超宽时贪心压缩可换行列并保留横向滚动；单元格支持简单 inline Markdown。
- 2026-06-25 - **表格源码字符级对齐修复**（未发版）：table textarea 改为等宽字体、禁用连字、`wrap=off` 与横向滚动，保证源码字符层管道符对齐；验证 `npm test -- tableEditing ModuleMarkdownEditor` 69/69，`npm run build` 通过。
- 2026-06-25 - **表格编辑体验完成**（已在 main、未发版）：整表 textarea 内支持 Tab/Shift+Tab/Enter 单元格导航、自动补行/退出、CJK 宽度源码对齐；设计见 `architecture/modules/editor/changes/2026-06-24-table-editing-experience.md`。
- 2026-06-25 - **列表块编辑态体验修复**（提交 `e4b39be`，未发版）：修复新建列表光标、空项退出、编辑/渲染缩进对齐、深缩进反缩进 4 类真机问题；详细根因已归档。
- 2026-06-24 - **编辑器列表块块内子块渲染**（merge `e08cd29`，未发版）：list 块进入编辑态后仅光标所在列表项为 textarea，其余项保持列表渲染；设计见 `architecture/modules/editor/changes/2026-06-24-block-subblock-rendering.md`。
- 2026-06-23 - **代码块语法高亮**（merge 到 main，未发版）：编辑器预览与 AI 聊天接入 lowlight/highlight.js；记录了 `highlightAuto` 空 children 兜底和 token span 测试断言调整经验。
- 2026-06-22 - **v0.4.11 上下文预算窗口优先**：模型窗口优先计算上下文预算，默认 cap 调整为 256K；本地 dmg 已出，CI release 仍受账单限额阻断。
