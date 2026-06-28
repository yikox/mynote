# 股票智能分析知识库

最后更新：2026-06-28

## 已验证命令

| 日期 | 命令 | 结果 |
| --- | --- | --- |
| 2026-06-28 | `git rev-parse --show-toplevel` | 确认当前仓库根目录为 `/Users/zyc/work/2026/stock-analysis` |
| 2026-06-28 | `find /Users/zyc/notes/PM -maxdepth 2 -type d` | 确认已有 `PM/量化` 属于另一个项目，当前仓库使用新的 `PM/stock-analysis` |
| 2026-06-28 | `python scripts/check_ai_assets.py` | AI 协作资产检查通过，输出 `[ai-assets] OK` |
| 2026-06-28 | `python3` diagram-check 脚本 | `architecture/main-design.md` 的 Mermaid（图表语法）声明和 SVG（可缩放矢量图）引用基础检查通过 |

## 架构与结构

| 路径或模块 | 事实 |
| --- | --- |
| `main.py` | CLI（命令行接口）和主流程入口之一 |
| `server.py`、`api/app.py` | FastAPI（Python Web 接口框架）服务入口 |
| `api/v1/router.py` | 已聚合 `auth`、`agent`、`analysis`、`history`、`stocks`、`backtest`、`system`、`usage`、`portfolio`、`alerts`、`decision-signals`、`alphasift`、`intelligence`、`health` 等 API 分组 |
| `src/storage.py` | 当前 SQLite（轻量本地数据库）ORM（对象关系映射）模型集中定义处 |
| `src/services/task_queue.py` | 当前异步分析任务队列，使用内存任务表、线程池和 SSE（服务器推送事件）广播 |
| `src/agent/orchestrator.py` | 当前多 Agent（人工智能代理）顺序编排器，包含 quick、standard、full、specialist 模式 |
| `data_provider/` | 多数据源适配层，包含 AkShare、Tushare、Yahoo Finance 等 fetcher（抓取器） |
| `apps/dsa-web/` | Web Renderer（Web 渲染层）目录 |
| `apps/dsa-desktop/` | Electron（旧桌面封装）目录 |
| `apps/dsa-tauri/` | Tauri（桌面应用封装框架）探索目录 |
| `bot/` | Bot（机器人）命令和飞书、钉钉等平台入口 |

## 当前数据模型事实

| 数据域 | 当前表或模型 |
| --- | --- |
| 行情 | `stock_daily` |
| 新闻与情报 | `news_intel`、`intelligence_sources`、`intelligence_items`、`fundamental_snapshot` |
| 分析历史 | `analysis_history` |
| 回测 | `backtest_results`、`backtest_summaries` |
| 投资组合 | `portfolio_accounts`、`portfolio_trades`、`portfolio_cash_ledger`、`portfolio_corporate_actions`、`portfolio_positions`、`portfolio_position_lots`、`portfolio_daily_snapshots`、`portfolio_fx_rates` |
| Agent 会话与用量 | `conversation_messages`、`conversation_summaries`、`agent_provider_turns`、`llm_usage` |
| 告警通知 | `alert_rules`、`alert_triggers`、`alert_notifications`、`alert_cooldowns` |
| 决策信号 | `decision_signals`、`decision_signal_outcomes`、`decision_signal_feedback` |

## 约定

- 新架构文档使用中文；必要英文术语首次出现时写成 `Term`（中文解释）。
- v1 架构区分“当前 demo 事实”和“v1 目标设计”，未经实现的内容不得写成已落地。
- 外部项目记忆目录为 `/Users/zyc/notes/PM/stock-analysis/`。
- 主架构文档使用 `architecture/main-design.md`，模块文档放在 `architecture/modules/`。
- 详细需求变更设计不写进主架构文档，应后续通过 `pm-design-requirement` 生成到模块 `changes/` 目录。

## 工作流

- 非平凡架构、实现、部署或调试工作开始时，先查看 `project-management.md` 的进行中任务和设计文档索引。
- 架构文档变化后，同步更新 `project-management.md` 的 `设计文档` 表。
- 重要技术事实、已验证命令、排障结论记录到 `knowledge-summary.md`，不要记录临时草稿或密钥。

## 排障记录

- 本轮未新增运行故障。

## 调查结果

| 日期 | 发现 |
| --- | --- |
| 2026-06-28 | notes 中已有 `/Users/zyc/notes/PM/量化/`，但其项目根目录为 `/Users/zyc/Documents/量化`，不是当前仓库。 |
| 2026-06-28 | 当前 demo 已具备投资组合、决策信号、告警、情报源、Agent 编排等基础能力，适合兼容式演进。 |
| 2026-06-28 | 当前任务队列以 `stock_code` 去重，适合演进为更通用的 `ResearchTask`（研究任务）。 |

## 决策

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-06-28 | 用户确认 v1 架构基线 | 主设计文档和模块设计文档状态从 proposed（建议稿）更新为 accepted（已接受） |
| 2026-06-28 | 为当前仓库新建 `PM/stock-analysis`，不复用 `PM/量化` | 两个项目根目录和目标不同，复用会造成项目记忆混乱 |
| 2026-06-28 | v1 使用兼容式演进 | 保留 demo 已有价值能力，降低迁移风险 |
| 2026-06-28 | `Instrument`（标的）为全局中心 | 统一股票、ETF、指数、期货、基金、加密资产等研究对象 |
| 2026-06-28 | `Report`（报告）、`DecisionSignal`（决策信号）、`InvestmentThesis`（投资假设）分层 | 分别承载一次性研究产物、可跟踪决策和长期观点记忆 |

## 经验教训

- 当前 demo 不是空白项目，架构设计应优先收敛已有模块，而不是重新发明一套平行系统。
- AI Agent（人工智能代理）适合解释、综合和研究组织，但投资相关的价格、指标、估值、仓位和风险核算必须由确定性工具负责。
