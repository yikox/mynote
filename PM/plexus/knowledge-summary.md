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
