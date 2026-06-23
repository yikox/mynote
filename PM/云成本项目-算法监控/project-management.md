# 云成本项目-算法监控 项目管理

Last updated: 2026-06-23

## 项目概览

- 目标：围绕新算法监测与 PS 云成本项目，沉淀算法服务 GPU 利用率、Pod 初始化耗时、资源使用卡量、成本优化空间等查询与分析能力。
- 当前工作区：/Users/chenzeyang/work/2026/11.新算法监测（ps-云成本项目）
- 外部记忆目录：~/zycode/zynode/PM/云成本项目-算法监控/

## 当前状态

| 字段 | 值 |
| --- | --- |
| 版本 | 未设置 |
| 状态 | 日报生成流程、本地 Streamlit 看板与日报自动化已验证可用 |
| 当前重点 | 基于 20260617-20260622 日报数据做算法级聚合、优化排序、跨日期算法趋势查询和自动更新 |

## 版本与发布记录

| 日期 | 版本/引用 | 摘要 |
| --- | --- | --- |
| 2026-06-23 | 日报自动化 | 看板新增“自动化”页面与后台调度器，默认每天 09:00 生成前天日报。 |
| 2026-06-23 | 看板能力更新 | 生成 20260617-20260622 日报数据；本地 Streamlit 看板支持日报分析、日期日历选择、算法级跨日期查询。 |
| 2026-06-22 | 初始化 | 建立项目记忆；创建算法 GPU 指标导出脚本，但源表 SELECT 权限仍阻塞真实导出。 |

## 活跃任务

- 维护 20260617-20260622 已生成日报与看板数据质量；后续按需继续拉取新日期并运行固定日报流程。
- 使用看板“算法查询”页面按算法名称和日期范围临时聚合趋势数据，不落地额外文档。
- 使用看板“自动化”页面维护日报定时任务配置；当前默认每天 09:00 获取前天日报。
- 若只需要初始化耗时维度，可继续使用 `stat_aigc.cost_odz_pod_init_detail_info` 做按天/按算法服务聚合。

## 里程碑

| 里程碑 | 状态 | 备注 |
| --- | --- | --- |
| 项目记忆初始化 | 完成 | 2026-06-22 初始化 PM 文档与 AGENTS.md 规则。 |
| 算法 GPU 指标脚本 | 完成 | 2026-06-22 workflowId `46230449` 成功导出 `algo_gpu_metrics_20260617.csv`。 |
| 算法监控日报固定流程 | 完成 | 2026-06-23 已生成 20260617-20260622 报告、筛选 CSV 与 Excel 聚合产物。 |
| 本地算法监控 Web 看板 | 完成 | 2026-06-23 Streamlit 看板已支持日报分析、跨日期算法查询与日报自动化，入口 `http://localhost:8501`。 |

## 测试与验证

- 已验证 `stat_aigc.cost_odz_pod_init_detail_info` 可在 `AIGC监控` 项目下查询。
- 已验证 `stat_meitu.mpub_mdz_deployment_metric` 数据地图元数据可查，字段齐全，分区键为 `date_p`。
- 已验证当前用户 `czy5` 在 `AIGC监控` 项目下可查询 `stat_meitu.mpub_mdz_deployment_metric`；2026-06-22 workflowId `46230449` 成功导出 20260617 CSV。
- 2026-06-23 已验证 20260622 导出与日报生成：workflowId `46263889`，源数据 2282 条，初始化 49 条/35 个算法，低利用率 289 条/185 个算法。
- 2026-06-23 已验证看板测试：`/Users/chenzeyang/miniforge3/bin/python3 -m pytest tests/test_daily_report_automation.py tests/test_streamlit_layout.py tests/test_dashboard_data.py -q` 通过 11 个测试；`py_compile dashboard_data.py daily_report_automation.py streamlit_app.py` 通过；`curl http://localhost:8501` 可访问页面。

## 部署

- 当前为本地脚本、神舟临时查询工作流与本地 Streamlit 看板。
- 看板启动命令：`/Users/chenzeyang/miniforge3/bin/python3 -m streamlit run streamlit_app.py --server.port 8501 --server.headless true`。
- 日报自动化配置：`config/daily_report_automation.json`；状态文件：`outputs/daily-report-automation-state.json`；日志目录：`outputs/automation-logs/`。

## 风险与阻塞

| 风险/阻塞 | 影响 | 缓解/状态 |
| --- | --- | --- |
| `stat_meitu.mpub_mdz_deployment_metric` SELECT 权限曾缺失 | 曾无法生成完整 GPU 指标 CSV | 2026-06-22 已验证权限生效，workflowId `46230449` 成功导出。 |
| 只用 `cost_odz_pod_init_detail_info` | 缺少 GPU 型号、GPU 利用率、使用卡量 | 只能作为初始化耗时监控的短期替代。 |

## ADR 摘要

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-06-22 | 完整 GPU 指标优先使用 `stat_meitu.mpub_mdz_deployment_metric` | 该表包含项目、deployment、GPU 型号、算法 GPU 利用率、平均耗时、初始化耗时和平均卡量。 |
| 2026-06-22 | 脚本输出 CSV 而非 XLSX | 用户明确要求输出 CSV。 |
| 2026-06-23 | 看板“算法查询”作为页面级入口 | 算法查询是跨日期趋势分析，不属于单日日报日期下的 Tab；侧边栏先选择“日报分析 / 算法查询”。 |
| 2026-06-23 | 日报自动化放在看板服务内 | 用户需要在看板中配置自动运行代码；采用 Streamlit 启动的后台线程和本地 JSON 配置，避免额外调度服务。 |

## 最近更新

- 2026-06-23 - 新增看板日报自动化：默认每天 09:00 生成前天日报，可在“自动化”页面保存配置或手动触发指定日期。
- 2026-06-23 - 完成本地 Streamlit 看板层级调整：日报分析保留单日日期与三个日报 Tab；算法查询独立为跨日期页面，默认最新数据往前 7 天并夹紧到本地可用日期范围。
- 2026-06-23 - 补齐 20260617-20260622 日报数据与报告产物，固定 `export_algo_gpu_metrics.py` + `spreadsheet_build/build_daily_algo_monitor.mjs` 的日报流程。
- 2026-06-22 - workflowId `46230449` 成功导出 `algo_gpu_metrics_20260617.csv`，共 2486 行，约 639 KB。
- 2026-06-22 - 初始化项目记忆与协作规则。
