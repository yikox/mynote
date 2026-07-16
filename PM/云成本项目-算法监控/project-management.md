# 云成本项目-算法监控 项目管理

Last updated: 2026-07-16

## 项目概览

- 目标：围绕新算法监测与 PS 云成本项目，沉淀算法服务 GPU 利用率、Pod 初始化耗时、资源使用卡量、成本优化空间等查询与分析能力。
- 当前工作区：/Users/chenzeyang/work/2026/11.新算法监测（ps-云成本项目）
- 外部记忆目录：~/zycode/zynode/PM/云成本项目-算法监控/

## 当前状态

| 字段 | 值 |
| --- | --- |
| 版本 | 未设置 |
| 状态 | `master@be37db9` 主链路已部署；`lyw@172.21.25.184` 上的 Streamlit 服务常驻运行，最新日报为 20260715 |
| 当前重点 | 完成交接、规范远端发布与回滚流程、明确 `algo_gpu_util` 口径；Prometheus/Mimir 补充数据源尚未实现 |

## 版本与发布记录

| 日期 | 版本/引用 | 摘要 |
| --- | --- | --- |
| 2026-07-16 | 项目交接审计 | 创建并精简飞书交接文档；核对 Git 基线、远端部署、运行状态、数据口径与环境搭建方式。 |
| 2026-06-23 | 日报自动化 | 看板新增“自动化”页面与后台调度器；当前远端配置为每天 09:07 生成前一日日报。 |
| 2026-06-23 | 看板能力更新 | 生成 20260617-20260622 日报数据；Streamlit 看板支持日报分析、日期日历选择、算法级跨日期查询。 |
| 2026-06-22 | 初始化 | 建立项目记忆；创建算法 GPU 指标导出脚本，但源表 SELECT 权限仍阻塞真实导出。 |

## 活跃任务

- 补齐远端发布与回滚规范；当前部署目录不含 `.git`，需明确代码同步、版本标识和服务重启流程。
- 闭环 `algo_gpu_util` 大于 1 的口径，确认源数据是比例、百分比还是聚合值。
- 设计并实现 Prometheus/Mimir 补充数据源；当前尚未接入正式代码、日报或看板。
- 完成交接文档后续“待开发需求”章节补充与负责人确认。

## 里程碑

| 里程碑 | 状态 | 备注 |
| --- | --- | --- |
| 项目记忆初始化 | 完成 | 2026-06-22 初始化 PM 文档与 AGENTS.md 规则。 |
| 算法 GPU 指标脚本 | 完成 | 2026-06-22 workflowId `46230449` 成功导出 `algo_gpu_metrics_20260617.csv`。 |
| 算法监控日报固定流程 | 完成 | 2026-06-23 已生成 20260617-20260622 报告、筛选 CSV 与 Excel 聚合产物。 |
| 远程算法监控 Web 看板 | 完成 | 部署于 `lyw@172.21.25.184:/Users/lyw/Documents/repository/monitor-algo`，入口 `http://172.21.25.184:8501`。 |
| Prometheus/Mimir 补充数据源 | 未开始 | 计划用于补充显存峰值和 GPU 利用率并与神舟数据交叉校验，尚未接入正式代码、日报或看板。 |

## 测试与验证

- 已验证 `stat_aigc.cost_odz_pod_init_detail_info` 可在 `AIGC监控` 项目下查询。
- 已验证 `stat_meitu.mpub_mdz_deployment_metric` 数据地图元数据可查，字段齐全，分区键为 `date_p`。
- 已验证当前用户 `czy5` 在 `AIGC监控` 项目下可查询 `stat_meitu.mpub_mdz_deployment_metric`；2026-06-22 workflowId `46230449` 成功导出 20260617 CSV。
- 2026-06-23 已验证 20260622 导出与日报生成：workflowId `46263889`，源数据 2282 条，初始化 49 条/35 个算法，低利用率 289 条/185 个算法。
- 2026-06-23 已验证看板测试：`/Users/chenzeyang/miniforge3/bin/python3 -m pytest tests/test_daily_report_automation.py tests/test_streamlit_layout.py tests/test_dashboard_data.py -q` 通过 11 个测试；`py_compile dashboard_data.py daily_report_automation.py streamlit_app.py` 通过。
- 2026-07-16 已验证 GitLab `master` 为 `be37db9`，主链路测试 `38 passed`，Python 编译检查通过。
- 2026-07-16 已只读核对远端部署：Streamlit PID `13094` 监听 `*:8501`，`/_stcore/health` 返回 `ok`；远端核心代码文件哈希与 `master@be37db9` 一致。
- 2026-07-16 已核对远端自动化最近一次成功生成 20260715 日报，并成功推送飞书通知。

## 部署

- 部署机器：`ssh lyw@172.21.25.184`；主机名 `lywdeiMac.local`，macOS x86_64。
- 部署目录：`/Users/lyw/Documents/repository/monitor-algo`；该目录不含 `.git`，但核心代码文件哈希与 `master@be37db9` 一致。
- Python：`/Users/lyw/miniforge3/envs/monitor-algo/bin/python3.12`，版本 3.12.13。
- 看板命令：`/Users/lyw/miniforge3/envs/monitor-algo/bin/python3.12 -m streamlit run streamlit_app.py --server.port 8501 --server.address 0.0.0.0 --server.headless true`。
- 内网入口：`http://172.21.25.184:8501`；健康检查：`http://172.21.25.184:8501/_stcore/health`。
- 日报自动化配置：`config/daily_report_automation.json`；当前启用，每天 09:07 生成 T-1 日报并发送飞书通知。状态文件：`outputs/daily-report-automation-state.json`；日志目录：`outputs/automation-logs/`。

## 风险与阻塞

| 风险/阻塞 | 影响 | 缓解/状态 |
| --- | --- | --- |
| `stat_meitu.mpub_mdz_deployment_metric` SELECT 权限曾缺失 | 曾无法生成完整 GPU 指标 CSV | 2026-06-22 已验证权限生效，workflowId `46230449` 成功导出。 |
| 只用 `cost_odz_pod_init_detail_info` | 缺少 GPU 型号、GPU 利用率、使用卡量 | 只能作为初始化耗时监控的短期替代。 |
| `algo_gpu_util` 源值可能大于 1 | 直接按比例展示可能产生误读 | 确认源字段单位和聚合语义，必要时归一化并补充异常提示。 |
| 远端部署目录不含 `.git` | 版本追踪、更新和回滚依赖人工同步 | 建立发布清单，记录提交号、校验文件哈希，并提供标准重启与回滚步骤。 |
| Streamlit 服务无应用层鉴权 | 非内网访问可能暴露监控数据 | 仅限内网访问；如需扩大范围，应增加网关鉴权或访问控制。 |
| 自动化随 Streamlit 进程运行 | 服务停止后日报不会按时生成 | 保持单实例常驻，监控健康状态；后续可拆分为独立调度任务。 |

## ADR 摘要

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-06-22 | 完整 GPU 指标优先使用 `stat_meitu.mpub_mdz_deployment_metric` | 该表包含项目、deployment、GPU 型号、算法 GPU 利用率、平均耗时、初始化耗时和平均卡量。 |
| 2026-06-22 | 脚本输出 CSV 而非 XLSX | 用户明确要求输出 CSV。 |
| 2026-06-23 | 看板“算法查询”作为页面级入口 | 算法查询是跨日期趋势分析，不属于单日日报日期下的 Tab；侧边栏先选择“日报分析 / 算法查询”。 |
| 2026-06-23 | 日报自动化放在看板服务内 | 用户需要在看板中配置自动运行代码；采用 Streamlit 启动的后台线程和本地 JSON 配置，避免额外调度服务。 |

## 最近更新

- 2026-07-16 - 精简飞书交接文档为五章：https://meitu.feishu.cn/docx/PNBSd4dU6oJwfhxERa7c6XimnDg ，并将 Prometheus/Mimir 明确标记为未实现。
- 2026-07-16 - 只读确认部署机器为 `lyw@172.21.25.184`，路径为 `/Users/lyw/Documents/repository/monitor-algo`；Streamlit 8501 健康，自动化最近一次成功生成 20260715 日报。
- 2026-06-23 - 新增看板日报自动化；当前远端配置为每天 09:07 生成前一日日报，可在“自动化”页面保存配置或手动触发指定日期。
- 2026-06-23 - 完成 Streamlit 看板层级调整：日报分析保留单日日期与三个日报 Tab；算法查询独立为跨日期页面，默认最新数据往前 7 天并夹紧到可用日期范围。
- 2026-06-23 - 补齐 20260617-20260622 日报数据与报告产物，固定 `export_algo_gpu_metrics.py` + `spreadsheet_build/build_daily_algo_monitor.mjs` 的日报流程。
- 2026-06-22 - workflowId `46230449` 成功导出 `algo_gpu_metrics_20260617.csv`，共 2486 行，约 639 KB。
- 2026-06-22 - 初始化项目记忆与协作规则。
