# 股票智能分析项目管理

最后更新：2026-06-28

## 项目概览

这是一个个人使用的股票智能分析与投研工作台项目。当前代码来自 `ZhuLinsen/daily_stock_analysis` demo（演示版本），已具备 FastAPI（Python Web 接口框架）服务、Web 前端、桌面端、数据源适配、AI 分析、投资组合、告警、决策信号等基础能力。v1 目标是把 demo 收敛为个人桌面端优先的 AI 投研工作台：AI Agent（人工智能代理）负责研究、推理、综合和交互，确定性程序模块负责数据获取、计算、核算、校验、调度和通知。

## 当前状态

| 项目 | 内容 |
| --- | --- |
| 当前版本 | v1 核心闭环实现阶段 |
| 状态 | v1 核心模型、旧分析桥接、报告准出、投资假设复核和任务生命周期已落地；架构文档集为 accepted（已接受） |
| 当前重点 | 建立 `Instrument`（标的）中心、任务编排、证据层、报告准出、信号和投资假设沉淀 |
| 主要仓库 | `/Users/zyc/work/2026/stock-analysis` |
| 外部项目记忆 | `/Users/zyc/notes/PM/stock-analysis/` |
| 主入口 | `main.py`、`server.py`、`api/app.py`、`api/v1/router.py` |
| 桌面方向 | Tauri（桌面应用封装框架）作为主线，Electron（旧桌面封装）后续退场 |

## 进行中的任务

| 日期 | 任务 | 状态 | 下一步 / 备注 |
| --- | --- | --- | --- |
| 2026-06-28 | 初始化当前仓库 Project Memory（项目记忆）并生成 v1 架构设计文档 | done | 已创建主设计和模块设计文档，用户已确认，架构基线已标记为 accepted（已接受） |
| 2026-06-28 | 实现 v1 核心模型基座：Instrument、ResearchTask、Report、InvestmentThesis 最小闭环 | done | 已新增兼容式数据模型、服务层、API、旧 analysis_history 桥接、Watchlist 到 Instrument 同步、Report Audit、ThesisReview 和任务生命周期接口 |
| 2026-06-28 | v1 核心闭环视觉验收：本地 Web/Tauri 页面检查、响应式布局和关键入口可视状态 | done | 已完成隔离 FastAPI + Vite dev + 生产静态页验收；桌面首页/设置、移动首页/设置/AI 建议/持仓无控制台错误、无水平溢出；Tauri 原生窗口未单独启动 |

## 需求待办

| ID | 日期 | 需求 | 主模块 | 修改摘要 | 范围 / 影响 | 状态 | 优先级 | 下一步 / 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-20260628-v1-architecture | 2026-06-28 | 将当前 demo 收敛为个人桌面端优先的 AI 投研工作台，v1 覆盖全部讨论模块 | architecture | 建立全局架构、核心数据模型、模块边界和运行链路 | 桌面端、本地 API、任务、数据、证据、Agent、报告、信号、投资假设、组合、监控、插件、旧模块边界 | implementing | P0 | Design: architecture/main-design.md；用户已确认架构基线；首个实现切片进行中 |

## 设计文档

| 类型 | 路径 | 状态 | 备注 |
| --- | --- | --- | --- |
| 主设计文档 | architecture/main-design.md | accepted | v1 全模块目标架构，待人工确认 |
| 模块: Desktop Workbench | architecture/modules/desktop-workbench.md | accepted | Tauri（桌面应用封装框架）优先的个人工作台 |
| 模块: Command API | architecture/modules/command-api.md | accepted | Local API（本地接口）与命令入口 |
| 模块: Instrument | architecture/modules/instrument.md | accepted | 全局标的中心 |
| 模块: Watchlist | architecture/modules/watchlist.md | accepted | 自选与观察入口 |
| 模块: Data Hub | architecture/modules/data-hub.md | accepted | 行情、财务、市场数据入口 |
| 模块: Evidence Hub | architecture/modules/evidence-hub.md | accepted | 新闻、公告、财报、事件证据层 |
| 模块: Research Task Engine | architecture/modules/research-task-engine.md | accepted | 研究任务编排层 |
| 模块: Agent Layer | architecture/modules/agent-layer.md | accepted | AI Agent（人工智能代理）研究推理层 |
| 模块: Deterministic Tools | architecture/modules/deterministic-tools.md | accepted | 确定性计算和校验工具 |
| 模块: Report Audit | architecture/modules/report-audit.md | accepted | 报告产物和质量准出 |
| 模块: Decision Signal | architecture/modules/decision-signal.md | accepted | 可跟踪决策信号 |
| 模块: Investment Thesis | architecture/modules/investment-thesis.md | accepted | 中长期投资假设记忆 |
| 模块: Portfolio | architecture/modules/portfolio.md | accepted | 投资组合、持仓、风险 |
| 模块: Monitor | architecture/modules/monitor.md | accepted | 调度、告警、通知 |
| 模块: Evaluation | architecture/modules/evaluation.md | accepted | 回测和信号复盘 |
| 模块: Plugins | architecture/modules/plugins.md | accepted | AlphaSift、图片识别和扩展通知 |
| 模块: Legacy Boundaries | architecture/modules/legacy-boundaries.md | accepted | Electron、SaaS Auth、复杂 Web 后台的弱化边界 |

## 里程碑

| 里程碑 | 状态 | 备注 |
| --- | --- | --- |
| 本地服务和桌面封装验证 | done | 已完成本地部署和 Tauri 打包探索；具体代码产物在仓库工作区 |
| v1 架构讨论 | done | 已确认个人使用、桌面端优先、v1 全模块覆盖、兼容式演进 |
| v1 架构设计文档 | accepted | 当前文档集已生成，等待人工确认 |
| v1 实现拆分 | in-progress | 核心模型和兼容桥接已完成首批落地，后续继续推进桌面 UI、Agent 编排和数据/证据层细化 |

## 测试与验证

- 本轮主要是架构文档写作，未执行代码构建或单元测试。
- 写作前已核对当前仓库的关键入口、API 路由、存储模型、任务队列、Agent 编排、投资组合、告警、情报和决策信号结构。
- 已运行 `python scripts/check_ai_assets.py`，AI 协作资产检查通过。
- 2026-06-28 已验证 v1 核心闭环：`python -m unittest tests.test_research_workspace_api tests.test_storage -v` 通过 29 个用例；Watchlist 直接回归、`./scripts/ci_gate.sh syntax`、`python scripts/check_ai_assets.py` 和 `git diff --check` 均通过。
- 2026-06-28 已完成视觉验收：隔离后端 `127.0.0.1:18000`、Vite dev `127.0.0.1:5173` 和 FastAPI 生产静态页均可渲染；桌面首页/设置、移动首页/设置/AI 建议/持仓检查无控制台错误和水平溢出；`npm run build` 通过。

## 部署

- 当前目标是个人本地部署和桌面端使用。
- 服务侧以 FastAPI（Python Web 接口框架）本地进程为核心。
- 桌面端以 Tauri（桌面应用封装框架）承载 Web Renderer（Web 渲染层）并管理本地服务生命周期。
- 云端 SaaS（软件即服务）部署和多用户后台不作为 v1 主线。

## 风险与注意事项

| 风险 / 阻塞 | 影响 | 缓解 / 状态 |
| --- | --- | --- |
| 当前 demo 表结构以 `stock_code` 为主，没有一等 `Instrument`（标的） | 多市场、多资产和跨模块关联会继续分散 | v1 采用兼容式演进，新增 `Instrument`，旧字段保留过渡 |
| AI Agent（人工智能代理）结论存在不确定性 | 数据计算、估值和风险判断可能不稳定 | 强化 Deterministic Tools（确定性工具）和 Report Audit（报告审查） |
| 任务队列当前偏单股票分析 | 难以承载组合复盘、定时监控、插件任务 | 新增 `ResearchTask`（研究任务）作为一等对象 |
| 报告、信号、长期假设未完全分层 | 研究结论难以沉淀和复盘 | v1 明确 `Report`（报告）、`DecisionSignal`（决策信号）、`InvestmentThesis`（投资假设）的关系 |
| v1 全模块覆盖范围较大 | 容易一次性过度实现 | 文档中区分 Core（核心）、Built-in（内置）、Plugin（插件）、Legacy/Exit（旧模块退场）成熟度 |

## ADR 摘要

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-06-28 | 采用 A 方案：兼容式演进，而不是干净重写 | 当前 demo 已有较多有价值能力，直接重写成本高且风险大 |
| 2026-06-28 | `Instrument`（标的）作为全局中心实体 | 股票、ETF（交易型开放式指数基金）、指数、期货等都可统一挂接任务、报告、信号和组合 |
| 2026-06-28 | v1 覆盖全部讨论模块，但按成熟度分层 | 满足完整闭环，同时避免每个模块一开始都做成同等复杂度 |
| 2026-06-28 | Tauri（桌面应用封装框架）作为主桌面方向 | 个人桌面端优先，弱化复杂 Web 后台和 Electron 旧主线 |
| 2026-06-28 | Agent 和确定性计算分层 | AI 适合综合研究，公式、核算、质量校验必须由程序承担 |

## 最近更新

- 2026-06-28 - 创建当前仓库独立 Project Memory（项目记忆）目录 `/Users/zyc/notes/PM/stock-analysis/`。
- 2026-06-28 - 写入 v1 主设计文档和模块设计文档，覆盖桌面端、标的、数据、证据、任务、Agent、确定性工具、报告、信号、投资假设、组合、监控、评估、插件和旧模块边界。
- 2026-06-28 - 完成图表基础校验、PM 设计索引路径校验和 AI 协作资产检查。
- 2026-06-28 - 用户确认 v1 架构设计文档，主设计和模块设计状态更新为 accepted（已接受）。

- 2026-06-28 - 完成 v1 核心闭环实现：新增核心模型 API、旧分析历史到 v1 工作区桥接、Watchlist 到 Instrument 同步、ResearchTask 生命周期、Report Audit 和 ThesisReview 复核事件。

- 2026-06-28 - 完成 v1 核心闭环视觉验收：Web dev 与生产静态服务均正常，桌面/移动关键页面无明显布局阻断问题；记录移动首页双菜单图标为后续体验优化点。
