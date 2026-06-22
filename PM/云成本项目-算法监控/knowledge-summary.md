# 云成本项目-算法监控 知识摘要

Last updated: 2026-06-22

## 已验证命令

- 安装神舟临时查询 skill：`npx -y meitu-skills add https://skills.meitu-int.com/support/bigdata-skills --skill shenzhou-temp-query --yes`。
- 查询神舟项目列表：`python3 .agents/skills/shenzhou-temp-query/scripts/temp_query.py projects --env default`。
- 查询单表元数据：`python3 .agents/skills/workflow-lineage-query/scripts/data_meta.py -q <db.table> --json`。
- 运行算法 GPU 指标导出脚本 dry-run：`python3 export_algo_gpu_metrics.py --dry-run`。

## 架构与结构

- 当前工作区不是 git 仓库，项目根按当前目录处理。
- 外部项目记忆位于 `~/zycode/zynode/PM/云成本项目-算法监控/`。
- 项目内已安装 `.agents/skills/shenzhou-temp-query` 与 `.agents/skills/workflow-lineage-query`。
- 本地脚本 `export_algo_gpu_metrics.py` 使用项目内神舟临时查询脚本提交 SQL 并下载 CSV。

## 约定

- 回复与文档条目使用中文。
- 神舟临时查询必须显式指定 `--project`，当前默认项目为 `AIGC监控`。
- 分区表查询必须带完整分区条件；相关表当前已知分区键多为 `date_p`。
- 不记录 token、凭证、私钥或临时敏感信息。

## 工作流

- 完整算法 GPU 指标导出：使用 `stat_meitu.mpub_mdz_deployment_metric`，按 `date_p` 过滤并导出 CSV。
- 初始化耗时分析：使用 `stat_aigc.cost_odz_pod_init_detail_info`，按 `date_p` 过滤，可按 `service_name` 聚合。
- 表结构/分区键确认：优先使用 `workflow-lineage-query/scripts/data_meta.py`。

## 故障排查

- `SHOW TABLES` / `SHOW SCHEMAS` 不适合神舟临时查询下载链路；平台会包装成 `insert overwrite directory ... SHOW ...` 导致语法失败。
- 数据地图 `table/info` 是精确单表查询，不支持空表名或通配符列全库表。
- `stat_meitu.mpub_mdz_deployment_metric` 当前真实查询报错：`Permission denied: user [czy5] does not have [SELECT] privilege on [stat_meitu/mpub_mdz_deployment_metric/*]`。2026-06-22 用户反馈已补权后再次执行 `export_algo_gpu_metrics.py --date 20260617 --project AIGC监控 -o algo_gpu_metrics_20260617.csv`，workflowId `46229958`；2026-06-22 后台再次调整后重试 workflowId `46230116`，仍返回同一 SELECT 权限错误。

## 调查结果

- `stat_aigc.cost_odz_pod_init_detail_info` 可查询；表描述为 `pod初始化时间明细数据`，分区键 `date_p`，字段包括 `pod_name`、`service_name`、`docker_init_time`、`algo_init_time`、`total_init_time` 等。
- `stat_meitu.mpub_mdz_deployment_metric` 数据地图元数据可查；表描述为 `服务器deployment资源信息`，分区键 `date_p`，字段包含 `project_name`、`deployment`、`gpu_model_name`、`algo_process_gpu_util`、`algo_process_gpu_avg_time`、`init_avg_time`、`algo_gpu_avg_count` 等。
- `AIGC监控` 神舟项目元信息：`projectId=169`，英文名 `aigc_monitor`。

## 决策

- `algo_process_gpu_util` 作为“算法 GPU 利用率”的默认口径。
- `algo_process_gpu_avg_time` 作为“算法平均耗时”的默认口径。
- `init_avg_time` 作为“算法初始化耗时”的默认口径，并在脚本中用 `OR` 修正空值/负数清洗逻辑。

## 经验教训

- 先用数据地图确认字段和分区键，再提交神舟 SQL，可减少分区条件与字段名错误。
- 权限验证应使用轻量 `count(1)` 查询；即使元数据可查，也不代表数据 SELECT 权限可用。
