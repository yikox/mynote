# 股票智能分析知识库

最后更新：2026-07-03

## 已验证命令

| 日期 | 命令 | 结果 |
| --- | --- | --- |
| 2026-07-02 | `pwd` | 确认当前仓库根目录为 `/Users/zyc/work/2026/stock-analysis` |
| 2026-07-02 | `rg --files architecture` | 确认仓库内保留新版架构主文档、模块文档和架构图 JSON |
| 2026-07-11 | `PYTHONPATH=src python3 -m unittest discover -s tests -v` | 优先级执行波次后 46 个单元测试通过 |
| 2026-07-03 | `PYTHONPATH=src python3 -m unittest discover -s tests -v` | 全局首版实现 34 个单元测试通过 |
| 2026-07-11 | `PYTHONPYCACHEPREFIX=/private/tmp/stock-analysis-pycache python3 -m compileall -q src tests` | 优先级执行波次后全量 Python 编译验证通过 |
| 2026-07-03 | `PYTHONPYCACHEPREFIX=/private/tmp/stock-analysis-pycache python3 -m compileall -q src tests` | macOS 受限环境下全量 Python 编译验证通过，避免写入用户 Library cache |
| 2026-07-03 | `python3 -m json.tool architecture/graphs/current-project.arch.json` | 当前架构图 JSON 可解析 |
| 2026-07-03 | `git diff --check` | 当前改动无空白错误 |
| 2026-07-02 | `sed -n` 读取 `modular-init` 及共享规则 | 已读取 modular workflow、storage schema、migration rules |
| 2026-06-28 | `git rev-parse --show-toplevel` | 曾确认当前仓库根目录为 `/Users/zyc/work/2026/stock-analysis` |

## 架构与结构事实

| 路径或模块 | 当前事实 |
| --- | --- |
| `/Users/zyc/work/2026/stock-analysis/architecture/main-design.md` | 当前主架构真源，状态为 accepted |
| `/Users/zyc/work/2026/stock-analysis/architecture/modules/` | 当前模块契约真源 |
| `/Users/zyc/work/2026/stock-analysis/architecture/graphs/current-project.arch.json` | 当前架构图源文件 |
| `/Users/zyc/work/2026/stock-analysis/dist/current-project-architecture.html` | 当前架构图 HTML 渲染产物 |
| `/Users/zyc/work/2026/stock-analysis/dist/current-project-architecture.svg` | 当前架构图 SVG 渲染产物 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/domain/decision_policy.py` | 第一阶段 Decision Policy 核心准出规则实现路径 |
| `/Users/zyc/work/2026/stock-analysis/tests/test_decision_policy.py` | Decision Policy 行为测试路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/research/orchestrator.py` | Research Engine 最小编排实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/research/data_hub.py` | Data Hub provider fallback 实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/runtime/command_api.py` | 本地 Command API 实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/runtime/desktop_shell.py` | Desktop Shell service 管理状态机实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/runtime/workspace_ui.py` | Workspace UI 今日驾驶舱 view model 实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/platform/storage.py` | SQLite migration dry-run/apply/backup 实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/platform/plugins.py` | Plugin Boundary manifest 校验和失败隔离实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/platform/config.py` | 配置脱敏和诊断实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/domain/decision_signal.py` | Decision Signal 冻结 policy metadata 的实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/platform/repositories.py` | SQLite repository 最小持久化切片实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/research/report.py` | Report 正式产物对象实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/research/analytics.py` | Deterministic Analytics 最小可复现计算实现路径 |
| `/Users/zyc/work/2026/stock-analysis/src/stock_analysis_app/runtime/command_json.py` | Command API JSON adapter 实现路径 |
| `/Users/zyc/notes/PM/stock-analysis/project-management.md` | 外部 PM，记录任务、需求、设计索引、风险和更新 |
| `/Users/zyc/notes/PM/stock-analysis/knowledge-summary.md` | 外部知识库，记录可复用事实和经验 |

## 工作流约定

- 本项目使用 modular programming workflow。
- 文档语言和标题使用中文。
- 确认粒度为 `standard`。
- 仓库内 `architecture/` 是模块边界和关系的真源。
- 外部 PM 只记录工作状态、需求、证据和索引，不独立定义模块边界。
- 旧 `pm-*` 和 `architecture-design` 流程只作为历史背景；新任务优先映射到 `modular-init`、`modular-architecture`、`modular-change`、`modular-status`、`modular-review`、`modular-audit`、`modular-knowledge`。
- 非平凡请求需要先识别主模块、影响模块、变更级别和预期产物。

## 当前核心架构原则

- 新版 App 是个人桌面投研工作台，不做多用户 SaaS。
- 证据先行：正式结论必须来自 `EvidencePack`。
- 计算可复现：指标、风险、估值、数据质量由确定性工具生成 `ToolResult`。
- AI 受控推理：Agent 可以生成草稿、候选建议和补证据请求，但不能绕过 Report Audit 发布高风险建议。
- 结论可追踪：`DecisionSignal` 必须追溯到报告、证据、工具结果、审查结论和人工确认状态。
- 持仓和长期观点可复盘：`Portfolio Ledger`、`Decision Signal`、`Investment Thesis` 分层。

## 决策

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-07-02 | 接入 modular programming workflow | 减少旧 PM 流程和架构基线漂移，明确 architecture 为模块真源 |
| 2026-07-02 | 文档语言和标题使用中文，确认粒度为 standard | 符合用户偏好，同时保留高风险确认点 |
| 2026-07-02 | 仓库内 `architecture/` 是当前架构真源 | 仓库已清理为最新设计基线，外部 2026-06 架构文档存在历史漂移 |
| 2026-07-03 | `Decision Policy` 作为轻量建议准出规则纳入架构基线 | 集中定义动作、风险等级、证据门槛、持仓约束、Thesis 红线、AI 权限、风险偏好档位和冲突处理 |
| 2026-07-02 | `Decision Policy` 作为轻量核心模块继续设计 | 需要集中定义建议动作、证据门槛、持仓约束、风险红线和 AI 权限边界 |
| 2026-07-01 | 仓库只保留最新设计基线 | 用户明确要求清理仓库，旧实现不再影响新架构边界 |
| 2026-06-30 | 正式推翻兼容式演进 | 用户确认旧实现退出主线，转向新架构重建 |

## 历史 / 迁移背景

- 2026-06 旧 demo 曾包含 FastAPI、Web、Electron、数据源、Agent、组合、告警、信号等实现事实。
- 这些事实在 2026-06 架构讨论中有参考价值，但当前仓库已经清理，不再代表当前实现。
- 后续如需复用旧逻辑，必须先形成独立迁移设计，不能直接把旧目录或旧模块重新作为主线依赖。

## 经验教训

- 架构文档必须明确区分“当前基线”“目标设计”“历史背景”，否则 agent 容易把旧代码事实当成当前事实。
- AI Agent 适合解释、综合和研究组织；投资相关的价格、指标、估值、仓位和风险核算必须由确定性工具负责。
- `Decision Policy` 不应演化成完整策略引擎；v1 只保留内置规则、三档风险偏好和可冻结的 `policy_version` / `policy_profile`。
- 建议链路需要单独的轻量 `Decision Policy`，避免证据门槛、AI 权限和持仓约束散落在 Prompt、Report Audit 和 DecisionSignal 中。
- `code_paths` 应尽量落到 atomic 模块；composite 模块不要用宽泛 glob 抢占子模块代码路径。
- 大任务派生子 agent 时，应按 disjoint write set 拆分，例如 repository、Report、analytics、runtime adapter 分开，主 agent 负责 P0 文档漂移修正和最终集成验证。

## 排障记录

- macOS Python 3.9 在受限环境下直接运行 `python3 -m py_compile ...` 可能尝试写入 `/Users/zyc/Library/Caches/com.apple.python/...` 并触发 `PermissionError`；设置 `PYTHONPYCACHEPREFIX=/private/tmp/stock-analysis-pycache` 后可完成编译验证。
- 当前未新增运行故障。
