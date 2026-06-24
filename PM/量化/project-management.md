# 量化项目管理

最后更新：2026-06-24

## 项目概览

这是一个个人量化项目，当前目标是先跑通最小闭环：数据获取 -> 策略信号 -> 回测 -> 绩效分析 -> 可视化报告。项目先保持轻量、可解释、可本地运行，再逐步接入真实数据源、更高效的本地存储和更完整的 A 股交易规则。

## 当前状态

| 项目 | 内容 |
| --- | --- |
| 当前版本 | 最小闭环版本 + AkShare 数据源 + DuckDB/Parquet 存储 |
| 状态 | 已完成本地可运行原型，已接入真实 A 股日线数据源，并完成存储层升级 |
| 当前重点 | 完善 AkShare 数据校验、优化/暴露批量查询能力，并推进 A 股交易规则设计落地 |
| 主要入口 | `.venv/bin/python -m quant_mini.run` |
| CSV 回退入口 | `python3 -m quant_mini.run --storage csv` |
| 最近代码提交 | `d5434f0 Update project memory task rule` |
| 项目记忆规则 | 已在 `/Users/zyc/Documents/量化/AGENTS.md` 初始化，2026-06-24 已补充需求待办、设计文档和架构文档规则 |

## 进行中的任务

| 日期 | 任务 | 状态 | 下一步 / 备注 |
| --- | --- | --- | --- |
| 2026-06-24 | PM skills 端到端试跑：记录 A 股交易规则需求并生成设计文档 | done | 已创建架构文档和 Backtest 模块变更设计 |

## 需求待办

| ID | 日期 | 需求 | 状态 | 优先级 | 模块/范围 | 下一步 / 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-20260624-a-share-trading-rules | 2026-06-24 | 为回测模块增加可配置 A 股交易规则层，覆盖 T+1、涨跌停、停牌和 100 股整数倍等约束，并保持现有 sample 闭环可运行 | designed | P2 | backtest | Design: architecture/modules/backtest/changes/2026-06-24-a-share-trading-rules.md |

## 设计文档

| 类型 | 路径 | 状态 | 备注 |
| --- | --- | --- | --- |
| 主设计文档 | architecture/main-design.md | draft | 从当前代码和 PM 笔记生成，待人工复核 |
| 模块: Data | architecture/modules/data.md | draft | 数据源、CSV 缓存、DuckDB/Parquet 存储 |
| 模块: Strategy | architecture/modules/strategy.md | draft | 双均线交叉信号 |
| 模块: Backtest | architecture/modules/backtest.md | draft | 长仓撮合和权益曲线 |
| 模块: Reporting | architecture/modules/reporting.md | draft | 绩效指标和 HTML/SVG 报告 |
| 模块: CLI Runner | architecture/modules/cli-runner.md | draft | 命令行参数和闭环编排 |
| 变更设计 | architecture/modules/backtest/changes/2026-06-24-a-share-trading-rules.md | proposed | REQ-20260624-a-share-trading-rules；尚未实现 |

## 已完成能力

| 能力 | 说明 | 状态 |
| --- | --- | --- |
| 示例数据闭环 | 使用 `SampleDataProvider` 生成可复现 OHLCV 数据，完成策略、回测、绩效、报告流程 | 已完成 |
| AkShare 数据源 | 新增 `AkShareProvider`，通过 AkShare 获取 A 股日线 OHLCV 数据 | 已完成 |
| DuckDB/Parquet 存储 | 新增 `DuckDbParquetBarStore`，按标的写入 Parquet，并用 DuckDB 做日期区间查询 | 已完成 |
| CSV 回退存储 | 保留 `CsvBarStore`，可通过 `--storage csv` 在无 DuckDB 环境下运行 | 已完成 |
| 本地缓存保护 | `--refresh` 在新数据获取成功后才覆盖缓存，避免失败时丢失旧数据 | 已完成 |
| 报告输出 | 生成静态 HTML/SVG 回测报告 | 已完成 |
| 错误处理 | AkShare 和 DuckDB 依赖缺失时输出友好错误，避免整段 traceback | 已完成 |
| Git 版本管理 | 已创建初始提交，并提交 DuckDB/Parquet 存储升级 | 已完成 |
| Project Memory 初始化 | 已创建 `AGENTS.md`，连接外部项目记忆目录并说明何时更新笔记 | 已完成 |

## 里程碑

| 日期 | 里程碑 | 结果 |
| --- | --- | --- |
| 2026-06-19 | 完成无第三方依赖的最小闭环原型 | sample 数据流程可运行 |
| 2026-06-19 | 完成第一个真实数据源 `AkShareProvider` | `000001` 2024 年前复权日线回测验证通过 |
| 2026-06-19 | 改进 AkShare 稳定性处理 | 加入请求重试、友好错误、刷新缓存保护、日期区间缓存名 |
| 2026-06-19 | 升级为 DuckDB + Parquet 存储 | 默认走 `--storage parquet`，CSV 作为回退 |
| 2026-06-19 | 使用 Git 管理项目版本 | 已提交 `9fe4d14` 和 `9b4c129` |
| 2026-06-20 | 初始化 Project Memory 规则 | 已提交 `b5a76b0`，未来 agent 可通过 `AGENTS.md` 找到外部项目记忆 |
| 2026-06-20 | 更新 Project Memory 任务记录规则 | 已提交 `d5434f0`，开始非平凡任务时需记录/更新进行中的任务 |

## 下一步计划

| 优先级 | 任务 | 说明 |
| --- | --- | --- |
| P1 | 完善 AkShare 数据字段校验 | 检查返回列、空数据、日期范围、成交量单位等 |
| P1 | 优化 AkShare 失败处理 | 区分网络失败、上游限流、无数据、代码错误 |
| P2 | 优化并暴露 DuckDB/Parquet 批量查询能力 | 代码已有 `DuckDbParquetBarStore.load_many`；后续重点是更高效批量查询、研究入口暴露和组合回测接入 |
| P2 | 增加 A 股回测规则 | 已记录为 REQ-20260624-a-share-trading-rules，并生成 Backtest 变更设计；尚未实现 |
| P3 | 增加参数实验 | 支持不同均线窗口批量回测 |
| P3 | 增加模拟交易账户 | 为后续交易执行模块做准备 |

## 风险与注意事项

| 风险 | 影响 | 当前处理 |
| --- | --- | --- |
| AkShare 上游接口断连 | 真实数据获取可能失败 | 已加入重试和友好错误；可去掉 `--refresh` 使用本地缓存 |
| 公开数据源稳定性有限 | 数据可能延迟、缺失或接口变更 | 后续需要数据质量校验和失败重试策略 |
| DuckDB 依赖缺失 | 默认 Parquet 存储无法运行 | 使用 `.venv/bin/pip install -r requirements-storage.txt` 安装，或临时 `--storage csv` |
| macOS LibreSSL warning | 运行 AkShare 时出现 urllib3 警告 | 当前不影响已验证流程；若后续 HTTPS 失败需关注 |
| 真实数据源 key/token 管理 | 误提交密钥会带来安全风险 | `.env` 已忽略；项目记忆不记录任何密钥 |

## 最近更新

| 日期 | 更新 |
| --- | --- |
| 2026-06-19 | 创建个人量化项目最小闭环，运行 `python3 -m quant_mini.run` 成功生成 260 根 K 线、4 个信号、3 笔成交，最终权益 125,653.53。 |
| 2026-06-19 | 新增 `AkShareProvider` 和 `requirements-akshare.txt`，入口支持 `--provider akshare`、`--symbol`、`--start`、`--end`、`--adjust`、`--refresh`。 |
| 2026-06-19 | 用 `.venv/bin/python -m quant_mini.run --provider akshare --symbol 000001 --start 2024-01-01 --end 2024-12-31 --refresh` 验证真实 A 股数据：242 根日线、12 个信号、11 笔成交，最终权益 95,820.72。 |
| 2026-06-19 | 针对 AkShare `RemoteDisconnected` 问题加入请求重试、友好错误提示；`--refresh` 改为获取成功后再覆盖缓存；缓存文件名加入日期区间。 |
| 2026-06-19 | 新增 DuckDB + Parquet 存储层，默认 `--storage parquet`，保留 `--storage csv` 回退；验证 sample Parquet、CSV 回退、DuckDB 区间查询均通过。 |
| 2026-06-19 | 提交存储升级：`9b4c129 Add DuckDB parquet bar storage`。 |
| 2026-06-20 | 创建 `/Users/zyc/Documents/量化/AGENTS.md`，连接外部项目记忆 `/Users/zyc/notes/PM/量化/`，并提交 `b5a76b0 Initialize project memory instructions`。 |
| 2026-06-20 | 更新 `AGENTS.md` 的 Project Memory 规则：开始非平凡项目工作时，应在项目管理笔记中记录当前任务，并随进展关闭或更新；提交 `d5434f0 Update project memory task rule`。 |
| 2026-06-24 | 使用 PM skills 端到端试跑：补充架构设计文档、记录 A 股交易规则需求、生成 Backtest 变更设计，并更新 `AGENTS.md` 项目记忆规则。 |
| 2026-06-24 | 通过 PM 审计发现“批量查询 API”计划表述已落后于代码事实：`DuckDbParquetBarStore.load_many` 已存在，已将下一步调整为优化和暴露批量查询能力。 |
