# 云成本项目-算法监控 项目管理

Last updated: 2026-06-22

## 项目概览

- 目标：围绕新算法监测与 PS 云成本项目，沉淀算法服务 GPU 利用率、Pod 初始化耗时、资源使用卡量、成本优化空间等查询与分析能力。
- 当前工作区：/Users/chenzeyang/work/2026/11.新算法监测（ps-云成本项目）
- 外部记忆目录：~/zycode/zynode/PM/云成本项目-算法监控/

## 当前状态

| 字段 | 值 |
| --- | --- |
| 版本 | 未设置 |
| 状态 | 脚本已验证可用 |
| 当前重点 | 基于导出的算法 GPU 指标 CSV 做监控分析与优化筛选 |

## 版本与发布记录

| 日期 | 版本/引用 | 摘要 |
| --- | --- | --- |
| 2026-06-22 | 初始化 | 建立项目记忆；创建算法 GPU 指标导出脚本，但源表 SELECT 权限仍阻塞真实导出。 |

## 活跃任务

- 基于 `algo_gpu_metrics_20260617.csv` 做算法 GPU 利用率、平均耗时、初始化耗时和使用卡量分析。
- 若只需要初始化耗时维度，可继续使用 `stat_aigc.cost_odz_pod_init_detail_info` 做按天/按算法服务聚合。

## 里程碑

| 里程碑 | 状态 | 备注 |
| --- | --- | --- |
| 项目记忆初始化 | 完成 | 2026-06-22 初始化 PM 文档与 AGENTS.md 规则。 |
| 算法 GPU 指标脚本 | 完成 | 2026-06-22 workflowId `46230449` 成功导出 `algo_gpu_metrics_20260617.csv`。 |

## 测试与验证

- 已验证 `stat_aigc.cost_odz_pod_init_detail_info` 可在 `AIGC监控` 项目下查询。
- 已验证 `stat_meitu.mpub_mdz_deployment_metric` 数据地图元数据可查，字段齐全，分区键为 `date_p`。
- 已验证当前用户 `czy5` 在 `AIGC监控` 项目下可查询 `stat_meitu.mpub_mdz_deployment_metric`；2026-06-22 workflowId `46230449` 成功导出 20260617 CSV。

## 部署

- 暂无部署；当前为本地脚本与神舟临时查询工作流。

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

## 最近更新

- 2026-06-22 - workflowId `46230449` 成功导出 `algo_gpu_metrics_20260617.csv`，共 2486 行，约 639 KB。
- 2026-06-22 - 初始化项目记忆与协作规则。
