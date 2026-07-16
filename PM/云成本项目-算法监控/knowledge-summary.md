# 云成本项目-算法监控 知识摘要

Last updated: 2026-07-16

## 已验证命令

- 安装神舟临时查询 skill：`npx -y meitu-skills add https://skills.meitu-int.com/support/bigdata-skills --skill shenzhou-temp-query --yes`。
- 查询神舟项目列表：`python3 .agents/skills/shenzhou-temp-query/scripts/temp_query.py projects --env default`。
- 查询单表元数据：`python3 .agents/skills/workflow-lineage-query/scripts/data_meta.py -q <db.table> --json`。
- 运行算法 GPU 指标导出脚本 dry-run：`python3 export_algo_gpu_metrics.py --dry-run`。
- 成功导出 20260617 算法 GPU 指标：`python3 export_algo_gpu_metrics.py --date 20260617 --project AIGC监控 -o algo_gpu_metrics_20260617.csv`；workflowId `46230449`，输出 2486 行，文件约 639 KB。
- 2026-06-23 成功导出并生成 20260622 算法监控日报：`/Users/chenzeyang/miniforge3/bin/python3 export_algo_gpu_metrics.py --date 20260622 -o algo_gpu_metrics_20260622.csv`，workflowId `46263889`，下载 587.5 KB；随后运行 `node spreadsheet_build/build_daily_algo_monitor.mjs --date 20260622`，输出源数据 2282 条、初始化明细 49 条/35 个算法、低利用率明细 289 条/185 个算法。
- 2026-06-23 验证 Streamlit 看板、自动化与数据层：`/Users/chenzeyang/miniforge3/bin/python3 -m pytest tests/test_daily_report_automation.py tests/test_streamlit_layout.py tests/test_dashboard_data.py -q` 通过 11 个测试；`/Users/chenzeyang/miniforge3/bin/python3 -m py_compile dashboard_data.py daily_report_automation.py streamlit_app.py` 通过；`curl http://localhost:8501` 可访问看板页面。
- 2026-07-16 验证 GitLab `master` 为 `be37db9`；主链路测试 `38 passed`（11 条 pandas FutureWarning），主模块 `py_compile` 通过。
- 2026-07-16 只读登录 `ssh lyw@172.21.25.184`，确认 Streamlit PID `13094` 监听 `*:8501`，`curl http://127.0.0.1:8501/_stcore/health` 返回 `ok`。
- 2026-07-16 远端部署目录为 `/Users/lyw/Documents/repository/monitor-algo`，进程 Python 为 `/Users/lyw/miniforge3/envs/monitor-algo/bin/python3.12`（Python 3.12.13）；核心代码文件哈希与 `master@be37db9` 一致。
- 2026-07-16 远端自动化状态显示 20260715 日报生成成功，飞书推送成功，最近调度时间为 2026-07-16 09:07。

## 架构与结构

- 当前工作区是 Git 仓库；远端为 `git@git.mtlab.meitu.com:IPD/OPTG/SDLA/algo-monitor.git`，默认分支 `master`。
- 外部项目记忆位于 `~/zycode/zynode/PM/云成本项目-算法监控/`。
- 项目内已安装 `.agents/skills/shenzhou-temp-query` 与 `.agents/skills/workflow-lineage-query`，但主链路导出不依赖这些 Skills。
- 本地脚本 `export_algo_gpu_metrics.py` 已内置神舟临时查询 API、轮询和 CSV 下载逻辑。
- Web 看板入口为 `streamlit_app.py`，数据加载与汇总逻辑在 `dashboard_data.py`，读取 `outputs/algo-monitor-<YYYYMMDD>/csv/` 下的日报 CSV。
- 看板内置日报自动化逻辑在 `daily_report_automation.py`，配置文件为 `config/daily_report_automation.json`，运行状态写入 `outputs/daily-report-automation-state.json`，日志写入 `outputs/automation-logs/`。
- 生产部署位于 `lyw@172.21.25.184:/Users/lyw/Documents/repository/monitor-algo`，内网入口为 `http://172.21.25.184:8501`。
- Prometheus/Mimir 补充数据源尚未实现；计划补充 Pod 启动期显存峰值与 GPU 利用率，并与神舟统计结果交叉校验。

## 约定

- 回复与文档条目使用中文。
- 神舟临时查询必须显式指定 `--project`，当前默认项目为 `AIGC监控`。
- 远端正式运行环境使用 `/Users/lyw/miniforge3/envs/monitor-algo/bin/python3.12`。
- 分区表查询必须带完整分区条件；相关表当前已知分区键多为 `date_p`。
- 不记录 token、凭证、私钥或临时敏感信息。

## 工作流

- 完整算法 GPU 指标导出：使用 `stat_meitu.mpub_mdz_deployment_metric`，按 `date_p` 过滤并导出 CSV。
- 算法监控日报固定流程：先运行 `/Users/lyw/miniforge3/envs/monitor-algo/bin/python3.12 export_algo_gpu_metrics.py --date <YYYYMMDD> -o algo_gpu_metrics_<YYYYMMDD>.csv` 导出源数据，再运行 `/Users/lyw/miniforge3/envs/monitor-algo/bin/python3.12 daily_report_builder.py --date <YYYYMMDD>` 生成筛选 CSV、算法聚合 CSV 与 Markdown 报告，输出目录为 `outputs/algo-monitor-<YYYYMMDD>/`。
- 远端看板启动：`/Users/lyw/miniforge3/envs/monitor-algo/bin/python3.12 -m streamlit run streamlit_app.py --server.port 8501 --server.address 0.0.0.0 --server.headless true`，内网访问 `http://172.21.25.184:8501`。
- 看板页面层级：侧边栏先用“页面”在“日报分析 / 算法查询”间切换；“数据日期”和 Top N 只属于日报分析，“算法查询”是跨日期页面级入口，不应放在单日日报 Tab 内。
- 当前实际配置以 `config/daily_report_automation.json` 为准：每天 `09:07`、目标 `T-1`、飞书通知启用；后台调度器随 Streamlit 服务启动，页面可保存配置或手动触发指定日期日报。
- 看板“算法查询”日期范围默认按最新数据往前 7 天，但默认值必须通过 `clamp_date_range` 夹紧到本地已生成日报数据的最小/最大日期，否则 Streamlit `date_input` 会因默认值越界报错。
- 初始化耗时分析：使用 `stat_aigc.cost_odz_pod_init_detail_info`，按 `date_p` 过滤，可按 `service_name` 聚合。
- 表结构/分区键确认：优先使用 `workflow-lineage-query/scripts/data_meta.py`。

## 故障排查

- `SHOW TABLES` / `SHOW SCHEMAS` 不适合神舟临时查询下载链路；平台会包装成 `insert overwrite directory ... SHOW ...` 导致语法失败。
- 数据地图 `table/info` 是精确单表查询，不支持空表名或通配符列全库表。
- `stat_meitu.mpub_mdz_deployment_metric` 曾在 `AIGC监控` 项目下报 SELECT 权限错误；2026-06-22 多次补权后，workflowId `46230449` 已成功导出 `algo_gpu_metrics_20260617.csv`。
- 2026-07-16 数据地图重新查询 `stat_meitu.mpub_mdz_deployment_metric` 返回“表不存在”，但远端自动化仍成功生成 20260715 日报；更可能是元数据接口与实际查询链路不一致，排查时不能仅凭数据地图结论判断源表不可用。
- 2026-06-29 09:07 同日期出现两份相隔 7 秒的成功自动化日志，说明多 Streamlit 进程可能重复调度；当前状态文件不提供跨进程原子锁。
- 远端部署目录不含 `.git`；排查版本问题时先对照 GitLab 提交号和核心文件哈希，不能直接在部署目录执行 `git status`。

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
- 部署目录不含 `.git` 时，交付必须同时记录 Git 提交号、文件哈希、同步方式和重启步骤，才能保证版本可追溯与可回滚。
- 日报调度寄生在看板进程时，进程存活和单实例本身就是业务可用性条件，不能只检查 JSON 中的 `enabled`。
