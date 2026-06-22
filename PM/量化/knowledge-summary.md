# 量化项目知识库

最后更新：2026-06-19

## 已验证命令

| 日期 | 命令 | 结果 |
| --- | --- | --- |
| 2026-06-19 | `python3 -m quant_mini.run` | 初版 sample 数据完整闭环通过，生成 `data/sample_ohlcv.csv` 和 `reports/sample_SAMPLE.A_backtest_report.html` |
| 2026-06-19 | `PYTHONPYCACHEPREFIX=/private/tmp/quant_mini_pycache python3 -m compileall quant_mini` | 语法编译检查通过 |
| 2026-06-19 | `python3 -m venv .venv` | 成功创建项目本地虚拟环境 |
| 2026-06-19 | `.venv/bin/pip install -r requirements-akshare.txt` | 成功安装 AkShare 1.18.64 及其依赖 |
| 2026-06-19 | `.venv/bin/python -m quant_mini.run --provider akshare --symbol 000001 --start 2024-01-01 --end 2024-12-31 --refresh` | 成功通过 AkShare 拉取真实 A 股日线并完成回测 |
| 2026-06-19 | `.venv/bin/python -m quant_mini.run --provider akshare --symbol 000001 --start 2024-01-01 --end 2024-01-31 --refresh --retries 2 --retry-delay 1` | 当前 AkShare 上游连接断开；程序已输出友好错误，无 traceback |
| 2026-06-19 | `.venv/bin/pip install -r requirements-storage.txt` | 成功安装 DuckDB 1.4.5 |
| 2026-06-19 | `.venv/bin/python -m quant_mini.run` | 默认 Parquet 存储路径通过，生成 `data/bars/SAMPLE.A.parquet` |
| 2026-06-19 | `python3 -m quant_mini.run --storage csv` | CSV 回退路径通过 |
| 2026-06-19 | `.venv/bin/python -c "from datetime import date; from pathlib import Path; from quant_mini.data import DuckDbParquetBarStore; store=DuckDbParquetBarStore(Path('data/bars')); print(len(store.load('SAMPLE.A', date(2024,1,1), date(2024,3,31))))"` | DuckDB 区间查询返回 65 根 K 线 |
| 2026-06-19 | `git commit -m "Add DuckDB parquet bar storage"` | 成功提交 `9b4c129` |
| 2026-06-20 | `git commit -m "Initialize project memory instructions"` | 成功提交 `b5a76b0`，新增 `AGENTS.md` |
| 2026-06-20 | `git commit -m "Update project memory task rule"` | 成功提交 `d5434f0`，更新 `AGENTS.md` 的任务记录规则 |

## 架构与结构

项目根目录：`/Users/zyc/Documents/量化`

| 文件或模块 | 职责 |
| --- | --- |
| `quant_mini/data.py` | 数据 provider、CSV 缓存、DuckDB/Parquet 存储；包含 `SampleDataProvider`、`AkShareProvider`、`CsvBarStore`、`DuckDbParquetBarStore` |
| `quant_mini/strategy.py` | 双均线交叉策略，生成 `buy` / `sell` 信号 |
| `quant_mini/backtest.py` | 简单多头回测撮合，包含手续费、滑点和 100 股手数 |
| `quant_mini/performance.py` | 计算总收益、年化收益、最大回撤、夏普比率和交易次数 |
| `quant_mini/report.py` | 生成包含指标、资金曲线、信号和成交记录的 HTML/SVG 报告 |
| `quant_mini/run.py` | 命令行入口，支持 `sample` / `akshare` provider 和 `parquet` / `csv` storage |
| `requirements-akshare.txt` | AkShare 可选依赖文件 |
| `requirements-storage.txt` | DuckDB/Parquet 存储依赖文件 |
| `AGENTS.md` | Agent 协作说明；记录外部项目记忆位置和更新规则 |

## 数据源与存储设计

| 类型 | 名称 | 用途 | 依赖 | 缓存或输出 |
| --- | --- | --- | --- | --- |
| 数据源 | `SampleDataProvider` | 无 key、无网络的示例 OHLCV 数据 | Python 标准库 | 由存储层决定 |
| 数据源 | `AkShareProvider` | A 股真实日线 OHLCV 数据 | `akshare` | 由存储层决定 |
| 存储 | `DuckDbParquetBarStore` | 按标的保存 Parquet，用 DuckDB 做日期区间查询 | `duckdb` | `data/bars/<symbol>.parquet` |
| 存储 | `CsvBarStore` | 简单 CSV 缓存，作为无 DuckDB 环境的回退 | Python 标准库 | `data/*.csv` |

AkShare 当前通过 `ak.stock_zh_a_hist` 获取 A 股日线数据，股票代码使用不带交易所后缀的格式，例如 `000001`。默认复权方式为 `qfq` 前复权。

## 命令参数约定

| 参数 | 说明 |
| --- | --- |
| `--provider sample|akshare` | 选择数据源，默认 `sample` |
| `--storage parquet|csv` | 选择存储方式，默认 `parquet` |
| `--symbol 000001` | AkShare A 股代码，不带交易所后缀 |
| `--start YYYY-MM-DD` | 数据开始日期 |
| `--end YYYY-MM-DD` | 数据结束日期；AkShare 使用 |
| `--adjust qfq|hfq|""` | AkShare 复权方式，默认 `qfq` |
| `--refresh` | 重新获取数据；成功获取后才覆盖缓存 |
| `--retries 3` | AkShare 请求失败时的重试次数 |
| `--retry-delay 2` | AkShare 每次重试之间等待的秒数 |

## 工程约定

| 约定 | 内容 |
| --- | --- |
| 默认运行 | 默认走 DuckDB + Parquet；需先安装 `requirements-storage.txt` |
| 回退运行 | 无 DuckDB 时可使用 `python3 -m quant_mini.run --storage csv` |
| 真实数据依赖 | AkShare 作为可选依赖，推荐安装到项目本地 `.venv` |
| 密钥管理 | `.env`、`.env.*` 和 `.venv/` 已加入 `.gitignore`；项目记忆不记录任何 token/key |
| 运行产物 | CSV、Parquet、DuckDB db 和 HTML 报告均已忽略，不进入 Git |
| 数据模型 | 策略和回测通过 `Bar`、`Signal`、`Trade`、`EquityPoint` 交互 |
| 缓存策略 | `load_or_create` 支持 callable 延迟获取数据；Parquet 缓存覆盖请求区间时才直接命中 |

## 排障记录

| 问题 | 表现 | 处理 |
| --- | --- | --- |
| Python 编译缓存权限 | `python3 -m compileall quant_mini` 尝试写入 `/Users/zyc/Library/Caches/com.apple.python/...` 并报 `PermissionError` | 使用 `PYTHONPYCACHEPREFIX=/private/tmp/quant_mini_pycache` |
| 未安装 AkShare | 运行 `--provider akshare` 时无法导入 `akshare` | 安装 `.venv/bin/pip install -r requirements-akshare.txt`，或切回 `--provider sample` |
| 未安装 DuckDB | 默认 `--storage parquet` 无法运行 | 安装 `.venv/bin/pip install -r requirements-storage.txt`，或使用 `--storage csv` |
| AkShare 上游断连 | `RemoteDisconnected('Remote end closed connection without response')` | 已加入重试和友好错误；稍后重试，或去掉 `--refresh` 使用本地缓存 |
| urllib3 LibreSSL 警告 | `urllib3 v2 only supports OpenSSL 1.1.1+` | 本次验证不影响数据获取；若后续 HTTPS 失败再处理 Python/OpenSSL 环境 |

## 调查结果

| 日期 | 发现 |
| --- | --- |
| 2026-06-19 | 系统 Python 版本为 3.9.6。 |
| 2026-06-19 | 系统 Python 未安装 pandas/matplotlib；项目 `.venv` 因安装 AkShare 已包含 pandas 2.3.3，仍未为可视化引入 matplotlib。 |
| 2026-06-19 | AkShare 真实数据验证：`000001` 在 2024-01-01 至 2024-12-31 区间返回 242 根前复权日线；回测产生 12 个信号、11 笔成交，最终权益 95,820.72。 |
| 2026-06-19 | AkShare 短区间刷新请求当前会被上游断开；修复后程序输出一行友好错误，并保护旧缓存不被提前删除。 |
| 2026-06-19 | DuckDB/Parquet 存储验证：`SAMPLE.A` 默认运行写入 `data/bars/SAMPLE.A.parquet`；2024-01-01 到 2024-03-31 区间查询返回 65 根 K 线。 |

## 技术决策

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-06-19 | 先做无 key、无第三方依赖的本地闭环 | 用示例数据验证架构，再逐步接入真实数据源 |
| 2026-06-19 | 报告先输出静态 HTML/SVG | 避免引入前端构建或图表依赖 |
| 2026-06-19 | 将 AkShare 设计为可选 provider | 默认 sample 流程保持无外部依赖，真实数据通过 `--provider akshare` 显式启用 |
| 2026-06-19 | `CsvBarStore.load_or_create` 支持 callable 延迟获取数据 | 本地缓存存在时避免触发网络请求或 AkShare 导入 |
| 2026-06-19 | `--refresh` 成功获取后再覆盖缓存 | 防止网络失败时丢失已有 CSV 数据 |
| 2026-06-19 | AkShare CSV 缓存文件名加入日期区间 | 避免不同 `--start/--end` 误用同一个缓存文件 |
| 2026-06-19 | 默认存储升级为 DuckDB + Parquet | 提升多标的、多区间查询体验，同时为后续组合研究铺路 |
| 2026-06-19 | 保留 CSV 存储作为回退 | 让无 DuckDB 环境仍可运行最小闭环 |
| 2026-06-20 | 在 `AGENTS.md` 中初始化 Project Memory 规则 | 让未来 agent 在提交、调试、架构变化和验证工作流后知道何时更新外部项目记忆 |
| 2026-06-20 | Project Memory 规则增加“开始非平凡任务时记录 Active Task” | 让未来 agent 在长任务开始、推进和完成时维护项目管理笔记，而不是只在提交后回填 |
