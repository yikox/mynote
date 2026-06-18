# 量化 Project Management

Last updated: 2026-06-19

## Overview
- 个人量化项目，目标是先完成最小闭环：数据获取 -> 策略信号 -> 回测 -> 绩效分析 -> 可视化报告。

## Current Status
- Version: 初始最小闭环版本 + AkShare 数据源
- State: 已完成本地可运行原型，并接入第一个真实 A 股数据 provider
- Current focus: 完善真实数据获取、缓存、异常处理和后续 A 股交易规则。

## Active Tasks
- 已创建 `quant_mini` Python 包，包含数据、策略、回测、绩效、报告和入口模块。
- 已生成示例行情数据与 HTML 回测报告。
- 已新增 `AkShareProvider`，支持通过 AkShare 获取 A 股日线 OHLCV 数据。
- 已在项目本地 `.venv` 安装 AkShare，并用 `000001` 的 2024 年日线数据完成真实数据回测验证。

## Milestones
- 2026-06-19 - 完成无第三方依赖的最小闭环原型。
- 2026-06-19 - 完成第一个真实数据源 `AkShareProvider`，并验证 `000001` 2024 年前复权日线回测。
- 下一阶段 - 完善 AkShare 数据字段校验、异常处理和缓存策略。
- 后续阶段 - 增加更完整的 A 股交易规则、参数实验和模拟交易账户。

## Todo
- 继续完善 AkShare 数据字段校验和异常处理。
- 将 CSV 存储升级为 Parquet/DuckDB。
- 在回测中加入 T+1、涨跌停、停牌、100 股整数倍等 A 股规则。
- 增加更多策略和参数实验。
- 增加模拟交易账户，为实盘交易执行模块做准备。

## Blockers and Risks
- 当前真实数据源只接入 AkShare 日线数据，尚未覆盖分钟线、指数、财务或多市场数据。
- AkShare 依赖网络和公开数据源稳定性，后续需要更明确的数据质量校验和失败重试。
- 运行 AkShare 时出现 `urllib3` 关于 macOS LibreSSL 的 warning，目前不影响数据获取，但后续如遇 HTTPS 问题需要关注。
- 真实数据源的 key/token 和收费权限暂未配置，后续不得把密钥写入仓库或项目记忆。

## Recent Updates
- 2026-06-19 - 创建个人量化项目最小闭环，运行 `python3 -m quant_mini.run` 成功生成 260 根 K 线、4 个信号、3 笔成交，最终权益 125,653.53。
- 2026-06-19 - 新增 `AkShareProvider`，新增 `requirements-akshare.txt`，入口支持 `--provider akshare`、`--symbol`、`--start`、`--end`、`--adjust` 和 `--refresh`。
- 2026-06-19 - 运行 `.venv/bin/python -m quant_mini.run --provider akshare --symbol 000001 --start 2024-01-01 --end 2024-12-31 --refresh` 成功生成 242 根真实 A 股日线、12 个信号、11 笔成交，最终权益 95,820.72。

