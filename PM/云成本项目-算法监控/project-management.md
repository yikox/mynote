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
| 状态 | 探索与脚本化阶段 |
| 当前重点 | 基于神舟临时查询与数据地图，导出算法 GPU/初始化耗时监控 CSV |

## 版本与发布记录

| 日期 | 版本/引用 | 摘要 |
| --- | --- | --- |
| 2026-06-22 | 初始化 | 建立项目记忆；创建算法 GPU 指标导出脚本，但源表 SELECT 权限仍阻塞真实导出。 |

## 活跃任务

- 获取 `stat_meitu.mpub_mdz_deployment_metric` 的 SELECT 权限，或找到有权限的项目/token，以便导出完整算法 GPU 指标。
- 在权限可用后运行 `export_algo_gpu_metrics.py --date 20260617 --project AIGC监控 -o algo_gpu_metrics_20260617.csv` 验证完整链路。
- 若只需要初始化耗时维度，可继续使用 `stat_aigc.cost_odz_pod_init_detail_info` 做按天/按算法服务聚合。

## 里程碑

| 里程碑 | 状态 | 备注 |
| --- | --- | --- |
| 项目记忆初始化 | 完成 | 2026-06-22 初始化 PM 文档与 AGENTS.md 规则。 |
| 算法 GPU 指标脚本 | 部分完成 | 脚本已创建并通过 dry-run/语法检查；真实导出受 SELECT 权限阻塞。 |

## 测试与验证

- 已验证 `stat_aigc.cost_odz_pod_init_detail_info` 可在 `AIGC监控` 项目下查询。
- 已验证 `stat_meitu.mpub_mdz_deployment_metric` 数据地图元数据可查，字段齐全，分区键为 `date_p`。
- 已验证当前用户 `czy5` 在 `AIGC监控` 项目下没有 `stat_meitu.mpub_mdz_deployment_metric` 的 SELECT 权限；2026-06-22 用户反馈补权后重试 workflowId `46229958`，后台再次调整后重试 workflowId `46230116`，仍为同一 SELECT 权限错误。

## 部署

- 暂无部署；当前为本地脚本与神舟临时查询工作流。

## 风险与阻塞

| 风险/阻塞 | 影响 | 缓解/状态 |
| --- | --- | --- |
| `stat_meitu.mpub_mdz_deployment_metric` SELECT 权限缺失 | 无法生成完整 GPU 指标 CSV | 需要给用户 `czy5` 开通权限，或改用有权限的项目/token。 |
| 只用 `cost_odz_pod_init_detail_info` | 缺少 GPU 型号、GPU 利用率、使用卡量 | 只能作为初始化耗时监控的短期替代。 |

## ADR 摘要

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-06-22 | 完整 GPU 指标优先使用 `stat_meitu.mpub_mdz_deployment_metric` | 该表包含项目、deployment、GPU 型号、算法 GPU 利用率、平均耗时、初始化耗时和平均卡量。 |
| 2026-06-22 | 脚本输出 CSV 而非 XLSX | 用户明确要求输出 CSV。 |

## 最近更新

- 2026-06-22 - 初始化项目记忆与协作规则。
