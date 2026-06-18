# 量化 Knowledge Summary

Last updated: 2026-06-19

## Verified Commands
- 2026-06-19 - `python3 -m quant_mini.run`：成功跑通 sample 数据完整闭环，生成 `data/sample_ohlcv.csv` 和 `reports/sample_SAMPLE.A_backtest_report.html`。
- 2026-06-19 - `PYTHONPYCACHEPREFIX=/private/tmp/quant_mini_pycache python3 -m compileall quant_mini`：语法编译检查通过。
- 2026-06-19 - `python3 -m venv .venv`：成功创建项目本地虚拟环境。
- 2026-06-19 - `.venv/bin/pip install -r requirements-akshare.txt`：成功安装 AkShare 1.18.64 及其依赖。
- 2026-06-19 - `.venv/bin/python -m quant_mini.run --provider akshare --symbol 000001 --start 2024-01-01 --end 2024-12-31 --refresh`：成功通过 AkShare 拉取真实 A 股日线并完成回测，生成 `data/akshare_000001_daily_qfq.csv` 和 `reports/akshare_000001_backtest_report.html`。

## Architecture and Structure
- 项目根目录：`/Users/zyc/Documents/量化`。
- 当前最小闭环包：`quant_mini/`。
- `quant_mini/data.py`：`SampleDataProvider` 生成可复现 OHLCV 示例数据；`AkShareProvider` 通过 `ak.stock_zh_a_hist` 获取 A 股日线数据；`CsvBarStore` 负责 CSV 缓存。
- `quant_mini/strategy.py`：`MovingAverageCrossStrategy` 生成双均线交叉买卖信号。
- `quant_mini/backtest.py`：`LongOnlyBacktester` 实现简单多头回测，包含手续费、滑点和 100 股手数。
- `quant_mini/performance.py`：计算总收益、年化收益、最大回撤、夏普比率和交易次数。
- `quant_mini/report.py`：生成包含指标、资金曲线、信号和成交记录的 HTML/SVG 报告。
- `quant_mini/run.py`：最小闭环入口，支持 `sample` 和 `akshare` provider。
- `requirements-akshare.txt`：AkShare 可选依赖文件。

## Conventions
- 默认 sample 流程不依赖第三方 Python 包，便于在干净环境中直接运行。
- AkShare 作为可选真实数据依赖，推荐安装到项目本地 `.venv`。
- `.env`、`.env.*` 和 `.venv/` 已加入 `.gitignore`，后续真实数据源 token/key 不应提交。
- 策略和回测通过统一数据模型交互：`Bar`、`Signal`、`Trade`、`EquityPoint`。
- AkShare A 股代码使用不带交易所后缀的格式，例如 `000001`。
- AkShare 数据默认使用 `qfq` 前复权，并缓存为 `data/akshare_<symbol>_daily_<adjust>.csv`。

## Troubleshooting
- macOS 系统 Python 运行 `python3 -m compileall quant_mini` 时会尝试写入 `/Users/zyc/Library/Caches/com.apple.python/...`，在当前沙箱中会报 `PermissionError`。
- 解决方式：设置 `PYTHONPYCACHEPREFIX=/private/tmp/quant_mini_pycache` 后再运行 compileall。
- 未安装 AkShare 时，运行 `python3 -m quant_mini.run --provider akshare ...` 会输出清楚错误：`AkShare is not installed. Run python3 -m pip install akshare or use --provider sample.`
- 运行 AkShare 时出现 `urllib3 v2 only supports OpenSSL 1.1.1+` / LibreSSL warning；本次验证不影响数据获取和回测。

## Investigation Results
- 2026-06-19 - 系统 Python 版本为 3.9.6。
- 2026-06-19 - 系统 Python 未安装 pandas/matplotlib；项目 `.venv` 因安装 AkShare 已包含 pandas 2.3.3，仍未为可视化引入 matplotlib。
- 2026-06-19 - AkShare 真实数据验证：`000001` 在 2024-01-01 至 2024-12-31 区间返回 242 根前复权日线；回测产生 12 个信号、11 笔成交，最终权益 95,820.72。

## Decisions
- 2026-06-19 - 先做无 key、无第三方依赖的本地闭环，用示例数据验证架构，再逐步接入 AkShare/Tushare 等真实数据源。
- 2026-06-19 - 报告先输出静态 HTML，避免引入前端构建或图表依赖。
- 2026-06-19 - 将 AkShare 设计为可选 provider，默认 sample 流程保持无外部依赖；真实数据通过 `--provider akshare` 显式启用。
- 2026-06-19 - `CsvBarStore.load_or_create` 支持 callable 延迟获取数据，避免本地缓存存在时仍触发网络或 AkShare 导入。

