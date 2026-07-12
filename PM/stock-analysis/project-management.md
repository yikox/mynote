# 股票智能分析项目管理

最后更新：2026-07-03

## 项目概览

本项目是一个个人本地优先的股票 / ETF / 指数投研工作台。当前仓库已从旧 demo 进入重建设计基线阶段：旧实现、旧配置、旧文档和历史归档目录均不再作为仓库主线依赖；后续实现以仓库内 `architecture/` 的新版模块架构为准。

项目目标是建立一个证据先行、计算可复现、AI 受控推理、结论可追踪、持仓和长期观点可复盘的个人投研工具。系统主入口是桌面工作台和今日驾驶舱；外部系统仅作为数据源、证据源、LLM 或通知端点。

## 当前状态

| 项目 | 内容 |
| --- | --- |
| 当前阶段 | 新架构全局实现 |
| 当前状态 | 2026-07-02 已确认使用 modular programming workflow；文档语言和标题均使用中文；确认粒度为 standard |
| 当前重点 | 对照仓库内架构设计逐模块实现新版 App；每个阶段先写测试、再实现、再记录验证证据 |
| 仓库根目录 | `/Users/zyc/work/2026/stock-analysis` |
| 架构真源 | `/Users/zyc/work/2026/stock-analysis/architecture/` |
| 外部项目记忆 | `/Users/zyc/notes/PM/stock-analysis/` |
| 当前入口 | `architecture/main-design.md`、`architecture/modules/`、`architecture/graphs/current-project.arch.json`、`dist/current-project-architecture.html` |

## 进行中的任务

| 日期 | 任务 | 主模块 | 影响模块 | 级别 | 状态 | 下一步 / 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-07-02 | 继续设计 `Decision Policy` 轻量核心模块 | Decision Policy | Agent Reasoning, Report Audit, Decision Signal, Portfolio Ledger, Investment Thesis | L3 | accepted | 已完成 L3 架构变更、模块文档、ADR 和架构图更新；后续由全局实现任务承接 |
| 2026-07-03 | 对照架构设计全局实现新版 App | 全局 | Product Runtime, Research Engine, Domain Memory, Platform Boundaries, Monitor Automation | L3 | implementing | 已完成 11 个基础阶段 + 2026-07-11 P0-P4 优先级波次；下一步进入真实 HTTP/桌面壳、repository 集成和端到端 demo |

## 需求 / 变更待办

| ID | 日期 | 需求 | 主模块 | 影响模块 | 级别 | 修改摘要 | 状态 | 优先级 | 设计路径 / 下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-20260702-modular-workflow | 2026-07-02 | 用 modular programming workflow 接替旧 `pm-*` / `architecture-design` 流程 | Platform Boundaries | AGENTS, PM, Knowledge, Architecture | L3 | 统一模块门禁、L0-L3 分级、中文文档偏好、standard 确认粒度；仓库内架构作为真源，外部 PM 只记录状态和索引 | implemented | P0 | 已完成；后续使用 `modular-architecture` 继续 `Decision Policy` |
| REQ-20260702-decision-policy | 2026-07-02 | 新增轻量 `Decision Policy` 核心模块，集中定义建议动作、证据门槛、持仓约束、风险红线和 AI 权限边界 | Decision Policy | Agent Reasoning, Report Audit, Decision Signal, Portfolio Ledger, Investment Thesis | L3 | 不做完整策略引擎、收益预测、组合优化或自动交易；只做准出和解释规则 | accepted | P0 | 已写入 `architecture/changes/2026-07-03-decision-policy.md`、`architecture/modules/decision-policy.md` 和 ADR |

## 模块化设计索引

| 类型 | 路径 | 状态 | 备注 |
| --- | --- | --- | --- |
| 主架构 | `/Users/zyc/work/2026/stock-analysis/architecture/main-design.md` | accepted | 当前模块架构真源；2026-07-01 新版个人桌面投研工作台架构 |
| 模块设计目录 | `/Users/zyc/work/2026/stock-analysis/architecture/modules/` | accepted | 当前模块契约真源 |
| Decision Policy 模块 | `/Users/zyc/work/2026/stock-analysis/architecture/modules/decision-policy.md` | accepted | 轻量建议准出规则模块 |
| Decision Policy 架构变更 | `/Users/zyc/work/2026/stock-analysis/architecture/changes/2026-07-03-decision-policy.md` | accepted | L3 架构变更记录 |
| Decision Policy ADR | `/Users/zyc/work/2026/stock-analysis/architecture/adrs/ADR-2026-07-03-decision-policy.md` | accepted | 轻量建议准出规则决策记录 |
| 架构图 JSON | `/Users/zyc/work/2026/stock-analysis/architecture/graphs/current-project.arch.json` | accepted | 当前架构图源文件 |
| 架构图 HTML | `/Users/zyc/work/2026/stock-analysis/dist/current-project-architecture.html` | accepted | 当前渲染产物 |
| 架构图 SVG | `/Users/zyc/work/2026/stock-analysis/dist/current-project-architecture.svg` | accepted | 当前渲染产物 |

说明：外部 `/Users/zyc/notes/PM/stock-analysis/architecture/` 中 2026-06 旧架构文档仅保留为历史背景；后续模块边界以仓库内 `architecture/` 为准。

## 路线图

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 旧 demo 调研和早期验证 | historical | 只作为历史背景保留，不代表当前仓库仍保留旧代码 |
| 兼容式演进方案 | superseded | 2026-06-30 已被用户明确推翻 |
| 新架构重建设计 | accepted | 仓库内 `architecture/` 和 `dist/` 是当前设计基线 |
| 模块化工作流接替 | done | 2026-07-02 已完成，`AGENTS.md`、PM 和知识库已切换到 modular workflow |
| 全局首版实现 | in-progress | 已完成 11 个基础阶段，并追加 repository、Report、Deterministic Analytics、Command JSON adapter；当前 46 个单元测试通过 |

## 里程碑

| 里程碑 | 状态 | 备注 |
| --- | --- | --- |
| 仓库清理为最新设计基线 | done | 2026-07-01 已完成，根目录仅保留协作规则、架构和渲染产物 |
| modular workflow 接入 | done | 2026-07-02 已完成 |
| 核心建议链路定稿 | accepted | `Decision Policy` 已纳入架构基线；Agent 候选建议、Report Audit、DecisionSignal 准出规则已收敛 |
| 新实现拆分 | in-progress | 已完成 11 个可测试阶段的首版核心实现；后续进入真实运行壳、repository、UI 和端到端集成 |

## 测试与验证

- 2026-07-11：优先级执行波次验证通过：`PYTHONPATH=src python3 -m unittest discover -s tests -v`，46 个测试通过。
- 2026-07-03：全局首版实现验证通过：`PYTHONPATH=src python3 -m unittest discover -s tests -v`，34 个测试通过。
- 2026-07-11：优先级执行波次编译验证通过：`PYTHONPYCACHEPREFIX=/private/tmp/stock-analysis-pycache python3 -m compileall -q src tests`。
- 2026-07-03：全局首版编译验证通过：`PYTHONPYCACHEPREFIX=/private/tmp/stock-analysis-pycache python3 -m compileall -q src tests`。
- 2026-07-03：架构 JSON 与 diff 验证通过：`python3 -m json.tool architecture/graphs/current-project.arch.json`、`git diff --check`。
- 2026-07-02：本轮为文档 / 工作流修复，未执行代码测试。
- 2026-07-02：已读取 `modular-init`、共享 modular workflow 规则、storage schema、migration rules、当前 `AGENTS.md`、仓库内架构文档和外部 PM / knowledge。
- 2026-07-01：已验证仓库清理结果，根目录只保留 `.git`、`.gitignore`、`AGENTS.md`、`CLAUDE.md`、`architecture/`、`dist/`；架构 JSON 可解析，HTML/SVG 已重新渲染。

## 阻塞与风险

| 风险 / 阻塞 | 影响 | 缓解 / 状态 |
| --- | --- | --- |
| 外部 PM 中残留 2026-06 旧 demo 事实 | 后续 agent 可能误以为旧代码仍在仓库主线 | 已在本文件中降级为 historical / superseded，并声明仓库内 `architecture/` 为真源 |
| 首版实现仍不是完整产品壳 | 还没有真实 HTTP 服务、Tauri/Web UI、真实数据源、LLM 调用和端到端 demo；repository 已有最小 SQLite 切片但尚未接入运行主链路 | 当前核心链路、持久化切片、报告对象、确定性计算、JSON adapter 已通过单元测试；后续继续补真实运行壳和端到端集成 |
| 外部通知、数据源、LLM 依赖未来仍会变化 | 可能影响证据质量和运行可靠性 | 通过 EvidencePack、DataQualitySummary、Report Audit 和 Config Observability 控制 |

## ADR 摘要

| 日期 | 决策 | 模块 | 原因 |
| --- | --- | --- | --- |
| 2026-07-02 | 接入 modular programming workflow，替代旧 `pm-*` / `architecture-design` 项目流程 | Platform Boundaries | 让架构成为模块边界真源，PM 只记录状态和索引，减少旧流程漂移 |
| 2026-07-02 | 文档语言和标题统一使用中文，确认粒度为 standard | Platform Boundaries | 符合用户偏好，同时保留 L3 和高风险边界确认 |
| 2026-07-02 | 仓库内 `architecture/` 是当前架构真源，外部 PM 仅索引和记录状态 | Platform Boundaries | 当前仓库已清理为最新设计基线，外部 2026-06 架构文档存在历史漂移 |
| 2026-07-01 | 仓库只保留最新设计基线，不再保留 archive 目录 | 全局 | 用户明确要求清理仓库；旧实现不能继续影响新架构边界 |
| 2026-06-30 | 正式推翻兼容式演进，采用旧代码退出主线 + 新架构重建 | 全局 | 用户明确确认新版定位为个人桌面投研工作台 |

## 归档

### 2026-06 旧 demo 和兼容式演进阶段

- 2026-06-28 曾创建基于旧 demo 的 v1 兼容式演进架构，并实现过部分核心闭环。
- 2026-06-30 用户明确推翻兼容式演进路线，改为旧实现退出仓库主线、新架构重建设计。
- 2026-07-01 仓库已清理，只保留最新设计基线和协作治理文件。
- 该阶段中的旧目录、旧 API、旧表结构、旧命令和旧测试结果只作为历史背景，不作为当前仓库事实。

## 最近更新

- 2026-07-02 - 用户要求使用 `modular-init` 新流程接替；确认文档语言和标题使用中文，确认粒度为 standard。
- 2026-07-02 - 仓库内 `AGENTS.md` 已切换到 modular programming workflow，旧 `pm-*` 流程降级为历史背景。
- 2026-07-03 - `Decision Policy` 轻量核心模块完成 L3 架构设计，新增模块文档、架构变更、ADR，并重新渲染架构图。
- 2026-07-03 - 用户明确要求从头全局实现新版 App，并要求对照设计文件逐阶段实现、每阶段测试；已启动第一阶段实现任务。
- 2026-07-11 - 按优先级派生子 agent 执行 P1 repository、P2 Report、P3 deterministic analytics，本地完成 P0 AGENTS 状态修正和 P4 Command JSON adapter；46 个单元测试、compileall、架构 JSON 校验和 diff 检查通过。
- 2026-07-03 - 已完成 11 个可测试实现阶段，覆盖核心领域、研究引擎、运行边界、平台边界、监控和工作台 view model；34 个单元测试、compileall、架构 JSON 校验和 diff 检查通过。
- 2026-07-02 - 外部 PM 记忆修复为当前状态：仓库内 `architecture/` 为架构真源，2026-06 旧实现事实降级为历史 / 迁移背景；modular workflow 接替完成。
- 2026-07-01 - 按用户要求继续清理仓库：删除仓库内历史归档目录，移除 Archive Reference 模块，更新 `.gitignore`，重新渲染架构图；根目录只保留最新设计基线和协作治理文件。
