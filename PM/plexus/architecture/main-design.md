# Plexus 主设计文档

Last updated: 2026-06-23

Status: implemented（现状梳理；个别条目标注 planned）

## 概述

Plexus 是一款基于 **Tauri 2 + React 19** 的桌面 Markdown 笔记应用：笔记以本地 `.md` 文件存储、通过 git 同步，并深度集成可调用工具的 AI 会话。前端为 Vite + React + TypeScript（状态用 zustand），后端为 Rust（`src-tauri/`，bundle id `com.plexus.app`，crate `plexus`/`plexus_lib`）。数据目录 `~/.plexus`，工作区内元数据目录 `.plexus/`。

详细的版本进度、里程碑、风险见 `project-management.md`；可复用的命令/排查/约定见 `knowledge-summary.md`。

## 系统范围

- **范围内**：本地笔记的 CRUD 与全文检索、双模式 Markdown 编辑器、AI 会话与工具调用、上下文预算/压缩、git 远程同步与 GitHub OAuth 接入、会话/配置/密钥的本地持久化。
- **范围外**：多人实时协作、服务端账户体系、云端笔记存储（同步完全依赖用户自有 git 远程）、移动端。
- **运行形态**：单机桌面应用，前后端通过 Tauri `invoke` 命令 + 事件通道通信；AI 请求经 Rust 端代理流式转发到用户配置的 OpenAI 兼容 provider。

## 界面区域总览

应用主窗口的顶层区域划分如下（详细分区与各空间内容见 `architecture/modules/ui-shell.md`）：

```
┌──────────────────────────────────────────────────────────┐
│ T  TopBar（标题/窗口控制）                                  │
├────┬───────────────┬───────────────────────────────────────┤
│    │               │ M1 TabBar（标签页）                    │
│ A  │ S  Sidebar    ├───────────────────────────────────────┤
│ 活 │ （随空间切换： │ M2 MainArea                            │
│ 动 │  笔记树 /      │   · 笔记空间 → 编辑器 Editor           │
│ 栏 │  会话列表）    │   · AI 空间  → 聊天 ChatPanel          │
│    │               │   · 无标签页 → 引导页 Welcome          │
├────┴───────────────┴───────────────────────────────────────┤
│ B  StatusBar（状态栏）                                      │
└──────────────────────────────────────────────────────────┘
   （叠加层 O：设置/AI 配置/工具确认/快速打开/全局搜索等弹框）
```

| 代号 | 区域 | 作用 | 归属模块 |
| --- | --- | --- | --- |
| T | TopBar | 标题与窗口级操作 | UI Shell |
| A | ActivityBar | 切换工作空间（笔记 / AI），即 `activeSpace` | UI Shell |
| S | Sidebar | 随空间显示笔记树或 AI 会话列表（可折叠/调宽） | UI Shell + Notes / AIChat |
| M1 | TabBar | 已打开标签页与活动标签页 | UI Shell |
| M2 | MainArea | 按空间与活动标签分发编辑器/聊天/引导页 | UI Shell（分发）+ Editor / AIChat |
| B | StatusBar | 全局状态展示 | UI Shell |
| O | 叠加层 Overlays | 全屏/居中弹框（设置、AI 配置、工具确认、⌘P、⌘⇧F 等） | UI Shell |

## 模块地图

| 模块 | 职责 | 设计文档 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 编辑器 Editor | 双模式（rich 块 / plain 文本）Markdown 编辑、查找、跳转高亮、TOC、KaTeX/Mermaid 渲染 | architecture/modules/editor.md | implemented | 纯前端，基于 `<textarea>` |
| AI Agent | AI 会话编排：agent loop、上下文构建/预算、状态快照、压缩、系统提示分层、模型限额 | architecture/modules/ai-agent.md | implemented | 前端编排 + Rust `ai_proxy` 流式 |
| AI 工具 AI Tools | 供 agent 调用的工具定义与注册表（笔记读写、检索、联网搜索）+ 写操作确认/Diff 回执 | architecture/modules/ai-tools.md | implemented | 工具经 services 落到 Rust 命令 |
| 笔记 Notes | 笔记文件模型：树、CRUD、全文 grep、快速打开、资源/图片，跨前端 service 与 Rust `core::notes` | architecture/modules/notes.md | implemented | 落盘真相在 Rust 端 |
| UI 外壳 UI Shell | 应用布局、导航（活动栏/侧栏/标签页）、各类弹框、全局快捷键、空状态引导 | architecture/modules/ui-shell.md | implemented | 组合各模块 UI |
| 同步 Sync | git 远程配置、推送/同步状态、GitHub 设备流 OAuth 与仓库创建/连接 | architecture/modules/sync.md | implemented | Rust `core::git*` + `github_oauth` |

> 跨模块的共享状态由 `src/stores/` 下的 zustand store 承载（见各模块「数据与状态」与下方共享约束）；前端→后端的所有调用经 `src/services/` 薄封装层包裹 Tauri `invoke`。

## 核心流程

- **编辑笔记**：UI Shell 打开标签页 → Editor 加载草稿 → 编辑落到 store/草稿 → service `update_note` → Rust `core::notes` 写盘 → 文件 watcher 通知前台标签页（干净则静默刷新、脏则提示冲突）。
- **AI 会话一轮**：用户在 InputBox 发送（可带 `@` 引用笔记/图片）→ AI Agent 构建上下文（系统提示分层 + 历史 + 按模型窗口算预算，超阈值先注入状态快照再压缩）→ 经 service `ai_chat` 到 Rust `ai_proxy` 流式拉取 → 模型发起工具调用 → AI Tools 执行（写操作按策略弹确认、成功返回 Diff 回执）→ 结果回灌历史继续循环 → 落 `sessions` 持久化。
- **全文检索/跳转**：⌘⇧F 全局搜索经 service `search_notes`（Rust grep）→ 命中投递 `uiStore.locateRequest{path,line,query}` → 打开笔记并在 Editor 内定位、对被检索词做词级渐隐高亮。
- **同步**：用户配置 git 远程或走 GitHub 设备流 OAuth 连接/创建仓库 → 写操作后由 Rust 端 pusher/sync 推送 → 前端 `gitRemoteStore` 反映同步状态。
- **启动/迁移**：打开工作区 → 加载 workspace state、providers、AI 配置（含一次性配置迁移/预设播种）、会话列表 → 渲染 AppShell。

## 共享约束

- **前后端边界**：前端不直接碰文件系统/网络；一切经 `services/*` → Tauri 命令 → `core::*`。落盘与同步的「真相」在 Rust 端。
- **zustand selector 纪律**：selector 绝不能内联 `?? []`/`?? {}` 返回新引用（zustand v5 + `useSyncExternalStore` 会判定快照恒变 → 无限重渲染 → 因无 ErrorBoundary 而整窗白屏）。返回模块级稳定常量或用 `useShallow`。
- **上下文折叠纪律**：绝不把「会被回传、长得像正文/参数的占位串」放进模型自己的 tool_call 参数（模型会照抄回写覆盖笔记）；只折叠 *工具结果*（如重复读取去重）相对安全。
- **路径安全**：任何接受相对路径的写命令先校验非空 —— 空相对路径在 `resolve(root,"")` 下塌缩到工作区根目录，是危险隐式目标。
- **配置迁移**：AI 配置改动通过「版本批次播种 + remap 旧 stock 值」迁移，自定义值不动；改名/默认值变更须按 id/旧值精确判定。
- **发布版本一致性**：5 个文件的版本号须与 tag 一致；`Cargo.lock` 改 `plexus` 时须避开同号第三方 crate（见 knowledge-summary）。

## 跨模块决策

| Date | 决策 | 模块 | 备注 |
| --- | --- | --- | --- |
| 2026-06-13 | 仓库保持私有、产物不签名、发布为 draft、macOS 出 universal 包、产物用 softprops 上传（非 tauri-action） | sync/发布 | 见 knowledge-summary Decisions |
| 2026-06-20 | 移除「活动工作集」上下文机制，笔记正文改由对话中 `read_note` 结果自然承载 | ai-agent / ai-tools | 根除占位串回写死循环 |
| 2026-06-21 | zustand selector 禁止内联返回新引用（统一用稳定常量/useShallow） | state（跨模块） | 修整窗白屏 |
| 2026-06-22 | 上下文预算改为「模型窗口优先」，不再被默认上限封顶；默认上限 256K（1K=1024） | ai-agent | v0.4.11 |
| 2026-06-22 | 内置 4 个预设 agent（通用/研究/笔记管家/写作），按版本批次播种、按 id 恢复默认、system-prompt 分层注入 | ai-agent | v0.4.10 |

## 待实现设计（已有 spec）

> 设计文档只记录**已写 spec、尚未实现**的变更；无 spec 的想法/待办不入设计文档，留在 PM 的 `待办`/`进行中任务`。

| 设计变更 | 主模块 | Spec | 状态 |
| --- | --- | --- | --- |
| 代码块语法高亮渲染 | 编辑器 Editor（兼及 AI 聊天 MessageItem） | docs/superpowers/specs/2026-06-23-code-syntax-highlighting-design.md（分支 `feat/code-syntax-highlighting`） | 已批准待实现 |

## 开放问题

- 无 ErrorBoundary：当前靠 zustand selector 纪律规避白屏，是否补一层全局 ErrorBoundary 兜底仍待定。
