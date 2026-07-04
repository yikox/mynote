# Plexus 项目知识摘要

> 模块化迁移日期：2026-07-02  
> 作用：保存可复用事实、命令、踩坑和决策；任务状态以 `project-management.md` 为准，模块边界以 `architecture/main-design.md` 为准。

## 1. Verified Commands

| 目的 | 命令 | 备注 |
| --- | --- | --- |
| 开发 | `npm run dev` | React/Vite + Tauri 开发入口 |
| Web 构建 | `npm run build` | 每次代码变更后至少运行 |
| Vitest | `npm run test` / `npm run test:run` | watch / run once |
| Rust 测试 | `npm run rust:test` | Tauri/Rust 侧测试 |
| Tauri 构建 | `npm exec tauri -- build` | 平台默认构建 |
| universal macOS | `npm exec tauri -- build --target universal-apple-darwin` | 旧 PM 记录用于本地 DMG |
| DMG 包 | `npm run build:dmg` | 需要打包时使用；可能依赖 macOS `hdiutil`，必要时用系统终端/提升执行 |

## 2. Stable Architecture Facts

- 技术栈：Tauri 2、React 19、TypeScript、Vite、Rust、Zustand、Tailwind/PostCSS。
- 编辑器不是 CodeMirror/Monaco，而是项目自研双模式 textarea 编辑 surface，围绕 Markdown 解析、预览同步、代码块、表格、目录和样式注入组织。
- AI 能力分为会话状态、上下文构建、工具执行、文件修改和规则注入；工具写入路径必须避免循环触发和折叠/展开状态污染。
- 笔记数据以本地 workspace + Markdown 文件为核心，配合文件树、标签索引、链接图谱和 Git 本地历史。
- 同步/发布链路包括本地 Git、远端 push/pull、冲突处理、GitHub release workflow 和 Tauri 构建配置。

## 3. Release / Version Notes

- 版本号载体需要同时关注：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`。
- Rust crate 版本变更后必须更新 `Cargo.lock`，否则 `--locked` 构建会继续使用旧版本。
- v0.4.8 是最近可确认的 GitHub Release；v0.4.9+ 因 GitHub Actions billing/spending limit 未能发布。
- 旧 workflow 使用 draft release 策略和 `softprops/action-gh-release` 上传 artifact，历史记录见 archive。

## 4. Troubleshooting Lessons

| 问题 | 结论 |
| --- | --- |
| tauri-action 无 artifacts | 切到手动上传 release artifact 更可靠 |
| Windows PATH 脚本 | `scripts/setup-windows-path.ps1` 负责修补 `cargo`/`rustc`/`npm` 路径 |
| draft release race | 发布前先删除同 tag draft，避免上传到旧草稿 |
| AI write loop | 工具参数折叠/展开状态写回可能触发重复循环；写入前后要校验状态快照 |
| Zustand selector 白屏 | 避免 selector 返回新对象导致无限更新，拆成原始 selector 后在组件内组合 |
| 空路径 `EISDIR` | 文件操作前确认 path 非空且指向文件 |
| 会话 JSON 调试 | 用结构化日志和快照比肉眼看 UI 更稳定 |
| 事件载荷兼容 | payload 需同时兼容直接对象与 `{ payload: ... }` 包裹形式 |
| rich 编辑器 IME 光标被重置 | 根因是 `ModuleTextarea.handleKeyDown` 未判断合成态,中文拼音候选确认阶段的 Enter/Backspace 等键被列表/表格/边界结构逻辑当真实编辑拦截；修复:顶部加 `event.nativeEvent.isComposing \|\| event.nativeEvent.keyCode === 229` 守卫,命中即完全放行给浏览器原生处理(与 `src/components/AIChat/InputBox.tsx` 已有同类判断手法一致) |
| rich 编辑器输入时视口往下跳/光标被甩到页面下方 | 根因:`ModuleTextarea` 的命令式 DOM 操作在滚动容器 `.markdown-editor__scroll`(`overflow-y:auto`)里引发浏览器被动滚动。①自适应高度 `height='auto'` → 读 `scrollHeight` 的重排会钳制容器 `scrollTop`,恢复 `height` 不还原它(每次按键都发生,主因);②`focus()`/`setSelectionRange()` 未用 `preventScroll`,会把焦点元素滚入视野。修复:用 `withNeutralScroll(textarea, run)` 包装(记录→执行→还原容器 scrollTop)包住三处 useLayoutEffect(挂载聚焦/caretNonce 重定位/自适应高度),并 `focus({ preventScroll: true })`。通用教训:滚动容器内做 textarea 自增高/聚焦/选区,务必冻结并还原祖先 scrollTop,否则输入时视口会漂移 |
| rich 编辑器滚动模型:仅换行时自动滚动 | 产品决策:编辑时**唯一**的自动滚动时机是回车换行,且仅当光标落点越过「阈值线」时才向下滚回该线。阈值是可调变量 `NEWLINE_SCROLL_CARET_RATIO`(默认 0.75 = 距视口顶 3/4 / 距底约 1/4);光标在上 3/4 内回车不滚,只向下滚不向上滚。实现要点:回车在 `ModuleTextarea.handleKeyDown`(IME 守卫之后)上报 `onNewline` → 父组件置 `pendingNewlineScrollRef` → 父组件 `useLayoutEffect([active])` 消费(React 布局副作用子先于父,故此时子的聚焦/自适应高度已完成、光标位置为最终态)→ `scrollCaretIntoNewlineZone`;纯计算 `newlineScrollDelta(caretY, viewportH, ratio)` 在 `caretMapping.ts`,光标行 y 用「逻辑行数×行高」近似(表格 wrap=off 精确) |
| block 编辑器"吸收尾随空行"是有意设计,不要当混乱来源删掉 | `parseMarkdownModules` 让每个块吸收其后一个空行,是为了"块末回车=块内加行,连敲两次才另起新块"(如表格块末尾回车只是想加一行,应仍属该块)；重构时应显式建模该语义(如 `contentEndOffset`/`moduleContent`),而不是取消 |
| block 编辑器不宜做"输入期完全不重解析"的会话层 | 现有测试与产品行为依赖逐键重解析识别块类型有机转变(如空段落敲 `- ` 实时变列表,这条路径走普通 onChange,不经结构性按键分支);若跳过重解析会破坏该行为,且影响草稿/自动保存/TOC 的逐键同步；如需推进需先解决这一前置问题 |

## 5. Modular Workflow Notes

- 当前 PM 根目录沿用 `/Users/zyc/notes/PM/plexus/`，不是项目内 `PM/plexus/`；`CLAUDE.md` 与 `AGENTS.md` 应指向这个外部记忆。
- `architecture/graphs/current-project.arch.json` 是机器可校验的模块图来源；模块文档和 rendered HTML/SVG 都应从它对齐。
- PM 文档只记录状态、索引、需求和验证证据，不能自行定义或漂移模块边界。
- 非平凡变更必须先判断 primary module、impacted modules、L0/L1/L2/L3 和 expected artifact。
- L1/L2/L3 工作开始时写 PM start，结束时写 PM completion；有可复用知识时同步更新本文档。

## 6. Decisions

| 日期 | 决策 | 状态 |
| --- | --- | --- |
| 2026-06-13 | 使用 draft release 作为默认 release workflow 产物状态 | accepted |
| 2026-06-13 | macOS release 优先产出 universal DMG | accepted |
| 2026-06-13 | 当前阶段保持 GitHub private | accepted |
| 2026-06-19 | 产品名从 GitNote 改为 Plexus | accepted |
| 2026-07-02 | 采用模块化工作流，架构基线优先，旧 PM 记录归档保留 | accepted |

## 7. Legacy Archive Pointers

- 迁移前完整 PM：`archives/legacy-project-management-before-modular-2026-07-02.md`
- 迁移前完整知识：`archives/legacy-knowledge-summary-before-modular-2026-07-02.md`
- 迁移前主架构：`archives/legacy-architecture-main-before-modular-2026-07-02.md`
- 迁移前模块索引：`archives/legacy-module-doc-index-before-modular-2026-07-02.md`
