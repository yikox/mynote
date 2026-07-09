---
title: 渲染器本地服务模式 + 多层嵌套 group
level: L3
status: implemented
review_status: reviewed
primary_module: graph-renderer
impacted_modules: [shared-references, modular-skills, examples]
---

# 渲染器本地服务模式 + 多层嵌套 group

## Request

1. 把图渲染从「一次性生成静态 HTML」扩展为「本地动态网站服务」，且服务应是规划完善的多项目浏览应用而非单图渲染逻辑：仿笔记软件，打开一个根目录（下含多个项目管理文件夹，每项目一个文件夹），点击 `.arch.json` 渲染架构图，点击图中模块跳转到对应文档（2026-07-03 用户扩容）。
2. 支持多层嵌套复合模块（group 套 group）。当前只支持一层（group 装 object），导致两层嵌套结构（如 optimization-components 内含 cache）必须拆成两张图。

用户已确认的方向：

- 静态导出（CLI 生成 HTML 文件）保留，服务是新增模式；
- 服务端渲染，复用现有 Python 布局 + SVG 管线，不做前端 JS 渲染引擎。

## Current Baseline

- `render_modular_graph.py`（约 2100 行，单文件，仅 Python 3 标准库）：CLI `<graph.arch.json> -o <out.html> [--svg-output]`，一次性解析 → 布局 → SVG → 自包含 HTML 文件。
- 图格式 `arch-graph/v0.2`：`groups[].contains` 只接受 object ID；解析时非 object 的 child 被静默跳过（`load_graph()` 中 `if child_id not in object_ids: continue`），布局 `group_frame_bounds()`/`group_bounds()` 只算一层外框。
- 同层关系规则基于两层 scope：顶层 scope 与单个 group 的内部 scope。
- 仓库架构 Scope 声明「无服务、无持久化状态」。
- baseline 文档通过 `Rendered: architecture/rendered/*.html` 引用静态渲染产物。

## Target Architecture

### A. 本地服务模式 —— 多项目架构笔记浏览服务

定位（2026-07-03 用户扩容）：仿笔记软件的浏览体验，不是单图渲染端点。打开一个根目录（推荐 PM 项目记忆根目录，如 `PM/`），根目录下每个项目一个文件夹（含 `architecture/graphs/*.arch.json`、`architecture/modules/*.md`、PM/知识文档）；侧边栏浏览项目树，点击 `.arch.json` 渲染图，点击图中模块节点跳转到对应模块文档。

- 实现形态：新文件 `modular-programming/_shared/scripts/serve_modular_graph.py`，`import render_modular_graph` 复用解析/布局/SVG 管线；渲染器本体保持单文件纯 CLI/库，不塞服务逻辑。installer rsync 整目录，分发不变。
- 启动：`python3 serve_modular_graph.py [--root <dir>] [--port <n>]`，默认 root 为当前目录；`http.server.ThreadingHTTPServer`，只绑 `127.0.0.1`，按需启动、无持久化状态。
- 页面结构：全部服务端渲染的普通 HTML 页面（无前端框架）；每页含左侧项目树侧边栏 + 右侧内容区，页面间普通链接跳转。
- 项目树发现规则（假设）：root 的一级子目录即项目；树内列出各项目下的 `*.arch.json` 与 `*.md`（含 PM、知识、架构、模块文档），其余文件不显示。
- 路由：
  - `GET /`：项目总览 / 目录树；
  - `GET /graph?path=<rel>`：现场执行 parse → layout → render 返回图页面，warning 显示在页面顶部；SVG 中节点/组合框链接由文件相对路径改写为 `/doc?path=<模块md路径>`；
  - `GET /doc?path=<rel>`：Markdown 渲染为 HTML 阅读页（标准库自实现最小转换：front matter 元信息卡、标题、列表、表格、代码块、链接、粗斜体）；文内相对链接改写——`.md` → `/doc`、`.arch.json` → `/graph`，形成图 ↔ 文档双向导航。
- 每次请求现场读盘重渲染，改文件后刷新即见最新；无缓存、无索引、无写操作（只读服务）。
- 渲染器配合改动：SVG 链接生成（现 `document_href()` 输出文件相对路径）抽出 link-resolver 挂钩，CLI 静态导出走原有相对路径 resolver，serve 传入 URL 改写 resolver。
- 安全约束：所有 path 参数解析后必须落在 `--root` 内（拒绝路径穿越），只服务 `.arch.json` 与 `.md`。
- 原有 CLI `render_modular_graph.py <graph.arch.json> -o <out.html>` 完全不变；静态导出仍是 baseline 产物的权威形态，`Rendered:` 链接语义不变，serve 定位为本地浏览/预览。

### B. 多层嵌套 group（格式 v0.3 + 递归模型/布局）

- 格式升级 `arch-graph/v0.3`（兼容读取 v0.1/v0.2）：`groups[].contains` 允许出现其他 group ID。
- 结构约束（校验为 warning）：containment 必须构成森林——每个 object/group 至多一个父 group、无环；group interface 的 `provided_by` 允许指向子树内任意 object。
- scope 规则从两层推广为树形：child（object 或 group）属于其父 group 的内部 scope；关系仍须同层连接——即两端点的父 scope 相同；跨 scope 关系应提升到最近公共父层级或经由 group interface，违反时 warning（规则本质不变，只是递归化）。
- 布局递归化：后序遍历计算 group 外框——叶子 group 由所含 object 盒并集 + padding 得出，父 group 由子 object 盒与子 group 外框并集 + padding 得出；嵌套外框、标签互为避让障碍，关系路由 obstacles 纳入所有层级外框。
- 内外箭头粗细规则按「端点所在 scope 深度」推广：顶层 scope 关系粗箭头，任何 group 内部关系细箭头。

### C. 仓库级约束更新

- `main-design.md` Scope 由「无服务、无持久化状态」改为「无常驻服务、无持久化状态；提供按需启动的本地架构浏览服务」。
- graph-renderer 模块扩为两个文件：`render_modular_graph.py`（渲染管线，单文件纯 CLI/库）+ `serve_modular_graph.py`（浏览服务，import 前者）；`renderer-docs/` 新增 `notes-server.md`（服务结构：路由、项目树、Markdown 转换、链接改写、安全），并更新 format-spec、graph-model、rules-layer、layout-engine、cli-orchestrator 文档。
- installer 无需改动（rsync 整个 scripts 目录，新文件自动覆盖）。

## Module Impact

| Module | Impact |
| --- | --- |
| graph-renderer | 主模块：新增 `serve_modular_graph.py` 浏览服务（项目树、图页、文档页、Markdown 最小转换）；`render_modular_graph.py` 抽 link-resolver 挂钩 + 模型/校验/布局递归化；公开契约扩展（新增 serve 入口），旧 CLI 契约不变 |
| shared-references | `architecture-graph-json-format.md` 升级 v0.3：嵌套 group、树形 scope 规则 |
| modular-skills | `modular-architecture` SKILL 的 Rendering 节补充 serve 预览方式（静态渲染仍为 baseline 产物默认路径） |
| examples | 新增嵌套 group 示例图作为回归夹具；现有示例保持零 warning |
| shared-assets | 无变化 |
| installer | 无变化 |

## Alternatives

| Option | Tradeoff |
| --- | --- |
| 前端 JS 渲染（服务只发 JSON） | 交互潜力大，但需用 JS 重写整个布局/SVG 引擎，工作量数倍且产生双实现漂移风险；已否决 |
| 完全替换静态导出 | 简化模式数量，但破坏 `Rendered:` 产物可提交、可离线的工作流契约；已否决（用户确认保留） |
| 服务逻辑并入 render_modular_graph.py 单文件 | 保持一个文件，但服务扩容为多项目浏览应用后单文件将超 3000 行、职责混杂；改为双文件（服务 import 渲染库），installer rsync 整目录分发不受影响 |
| Markdown 渲染引入第三方库（markdown/mistune） | 转换质量高，但违反「仅标准库」约束；自实现最小子集 |
| 嵌套仅做视觉扁平化（自动拆图） | 不改布局引擎，但没有解决表达问题；不采用 |

## ADR Need

需要一条 ADR：`ADR-2026-07-03-server-side-rendering.md` —— 本地服务采用服务端 Python 渲染而非前端 JS 引擎，且静态导出保持权威产物地位。该决策约束未来交互类需求的实现路径（增强交互应先考虑 HTML 内嵌 JS 行为层，而不是搬走渲染管线）。

## Implementation Strategy

先落嵌套 group（B：解析 → 校验 → 布局 → 渲染递归化 + 示例回归），再落浏览服务（A：先抽 link-resolver 挂钩，再建 serve_modular_graph.py——项目树 → 图页 → Markdown 文档页 → 链接改写，逐路由验证），最后同步文档与规范（C）。两部分相互独立，可分开验证；全部落地后更新模块 baseline 与图格式 reference，并运行 `./install.sh` 同步安装副本。

## Validation

- 现有回归：`system-overview.arch.json` 与本仓库 `current-project.arch.json` 渲染零 warning、输出不劣化。
- 新增嵌套示例：两层以上嵌套（group 套 group 套 object）渲染零 warning，外框、标签、关系路由无重叠异常。
- 负向用例：containment 成环、多父、跨 scope 关系分别产生预期 warning。
- 浏览服务：以 PM 根目录为 root 启动，`curl` 验证 `/` 项目树包含全部项目、`/graph` 返回渲染页且节点链接指向 `/doc`、`/doc` 的 Markdown 转换正确（front matter 卡、表格、代码块）、文内 `.md`/`.arch.json` 相对链接改写生效；路径穿越请求（`../`）与非白名单后缀被拒绝；改 JSON/MD 后刷新可见变更。
- CLI 向后兼容：旧用法命令原样成功，静态导出的节点链接仍为文件相对路径。

## Risks

- 布局递归化触碰 layout-engine 核心，可能影响现有图观感 —— 以两张既有图零 warning + 人工目检兜底。
- scope 规则递归化可能让既有图出现新 warning —— 规则语义保持不变，仅推广；回归中确认。
- Markdown 自实现转换是范围蔓延点 —— 锁定最小子集（front matter、标题、列表、表格、代码块、链接、粗斜体），不追求完整 CommonMark；渲染不了的按原文行展示。
- 渲染库抽 link-resolver 挂钩触碰静态导出路径 —— 回归确认静态输出字节级不变或仅等价改写。
- http.server 为开发级服务器 —— 仅绑定 127.0.0.1、只读、定位本地浏览，不承诺并发/生产用途。

## Open Questions

- ~~`/doc` 纯文本是否足够~~ → 已由用户扩容决定：需要 Markdown 渲染阅读页（2026-07-03）。
- 项目树发现规则假设：root 一级子目录即项目，树内只列 `*.arch.json` 与 `*.md`——是否符合你的 PM 目录组织？
- 嵌套 group 深度不设硬上限，仅靠森林校验约束——是否需要「深度 > 3 给提示」类软约束？（当前假设不需要）

## Review Notes

- Review status: reviewed（2026-07-03 二次评审：A 部分扩容为多项目浏览服务后，双文件拆分理由、Markdown 最小子集边界、link-resolver 兼容回归、树发现规则假设均已显式；baseline/target 分离与验证覆盖齐备）
- 2026-07-03 用户接受要点摘要（树发现规则按默认假设）；同日实现完成，Validation 全项通过（三张既有图字节级回归、嵌套/三层示例零 warning、负向用例出预期 warning、服务端到端 curl 验证、路径穿越与隐藏文件 404）。baseline 已更新。
