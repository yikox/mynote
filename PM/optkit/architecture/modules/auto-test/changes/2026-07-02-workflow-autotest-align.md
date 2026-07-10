# auto_test 与 optkit-auto-test workflow 契约对齐（简化方向）设计

Last updated: 2026-07-02

状态：accepted

模块：auto-test（候选模块，未入基线）

需求 ID：REQ-20260702-autotest-workflow-align

关联需求/任务：project-management.md「需求待办」REQ-20260702-autotest-workflow-align

设计状态：accepted（2026-07-02 用户确认：超时 11h、固定名保留一个月、机型策略不变）

实施状态：implementing（P0 完成 2026-07-02；P2 完成 2026-07-07 合 master；余 P1 release 验证）

实施证据：

- 2026-07-02 P0-1 代码完成（未提交/未推送）：optkit `upload_to_obs.py`（`tar_object_names` 版本化+固定名双写、`object_name` 参数、`--tar-version` CLI、obs SDK 惰性导入）、`.gitlab-ci.yml`（whl 打进 `auto_test/dist/`、`--tar-version "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"`）、`env.sh`（优先强装 tar 内 whl）；`auto_test/tests/test_ci_config.py` 新增 3 用例，套件 168 passed。
- 2026-07-02 P0-2 代码完成（未提交/未推送）：workflows `optkit_auto_test.py` 重写——`build_tar_url`、`build_setup_commands(env_type, version, tar_url)` 单一路径、`gpu:4`、三态完成判定（done.flag 权威 + `pgrep -f '[t]est.sh|[-]m auto_test'`）、`poll_until_all_complete` 11h 硬超时、删 impact/AUTO_TEST_COMMAND 全部死代码；README 联动章节重写；版本 0.2.11→0.3.0，wheel 构建通过；`tests/test_optkit_auto_test.py` 重写为新契约，29 passed。
- 实施中发现并修复：探活模式裸 `[a]uto_test` 会自匹配检查 shell 的 cmdline（含 `auto_test/done.flag`）→ 永判"正在运行"；改 `[-]m auto_test`（只匹配真正的 `python -m auto_test` 进程），本机以真实进程实证三态（不自匹配/测到 test.sh/测到 -m auto_test）。
- 2026-07-07 P2 代码完成（TDD；提交 5dbf9a6，经 merge 6c24d1b 合入 master 并推送，v2 已同步）：
  - **C.2 触发信息**：`judge.py` `analyze()` 增返命中规则名、`judge()` 把 meta（profile/base/head/changed_files/matched_rules/components/models/reason，release 路径为 release_tag/profile/reason）随 plan 落盘；`plan.py` `TestPlan.meta` 可选字段 + `load_plan` 宽容解析；`scheduler.py`/`run.py` 两处 `finalize_report(..., impact_plan=plan.meta)`。meta 字段名与 optkit_test_web `_render_impact_panel` 消费键对齐。
  - **C.1 全局进度**：`progress.py` 新增 `NullProgress`/`make_progress`；`run.py` worker `--no-aggregate` 时用 NullProgress（不再并发覆盖全局文件）；`scheduler.py` 以 job 粒度独占维护 `$TEST_RESULT_DIR_ROOT/progress.json`（starting→running(current=job)→env_setup:\<eg\>→aggregating→completed，字段沿用 done_cells/total_cells 兼容 workflow 0.3.x 已部署解析）；`test.sh` 起调度器前 `ln -sfn` 软链到 `auto_test/progress.json`。
  - 验证：新增 8 单测（judge meta ×2、plan meta ×2、progress ×2、run_scheduler 全局进度+meta 透传 ×1、test.sh 软链 ×1），auto_test 套件 176 passed；端到端脚本实证 judge 真实 meta → finalize → test_manager.json `info.impact` → web「源码变更」面板渲染（rules/components 徽章），及 ProgressTracker 输出 → workflow `_extract_progress`/`_format_progress_bar` 进度条渲染；workflows 29 passed、web 101 passed 零改动回归。

## 背景

auto_test 已完成 plan/judge/schedule 改造（REQ-20260624-autotest-v1v2-modular）：判断器在 CI 侧裁 plan、机器侧 `test.sh` 一次 `auto_test schedule` 跑完。但外部编排 workflow（`workflows` 仓库 `workflows/optkit/optkit_auto_test.py`，部署在 172.21.25.184 的 `workflows 0.2.11`）仍停留在旧契约上，两边多处断裂，链路实际不可用。

## 需求

1. 按简化方向修复 workflow 与 auto_test 的配合：workflow 收敛为「申请 4 卡机器 → 跑 test.sh → 认 done.flag 判完成 → 关机」，删除全部死代码路径。
2. 解决 OBS 上 `auto_test.tar` 单文件互相覆盖问题（并发 commit 竞态 + release 错拿 master smoke tar）。

## 验收标准

- 普通 commit：CI 触发后，3 台 4 卡机器各自跑完 judge 裁出的 smoke plan，done.flag rc=0，机器全部自动关机，报告落 `/app/czy5/optkit-test-results/pre/<sha>/<gpu>/`。
- release tag：同上但跑全量 v2_full，结果落 `release/<tag>/<gpu>/`，且 tar 取的是**本次 tag 构建**的产物（不受期间 master commit 影响）。
- 相邻两次 commit 各自触发的测试互不串扰（各拿各的 tar）。
- env 段切换（step1x setup 数分钟）与结尾聚合（SSIM 回填）期间，workflow 不误判「异常退出」提前关机。
- workflow 仓库中 impact/AUTO_TEST_COMMAND 相关死代码全部删除，单测同步更新。

## 现状（断裂点清单，2026-07-02 核对）

| # | 断裂点 | 位置 | 影响 |
| --- | --- | --- | --- |
| 1 | 机器申请 `gpu: 1`，但 plan 一半 item 需 4 卡（judge 兜底 smoke 即 ulysses4），test.sh 默认 `--gpus 0,1,2,3` | `optkit_auto_test.py` BASE_MACHINE_SPECS / legacy configs | 单卡机上并发 job 被 pin 到不存在的卡、4 卡 torchrun 全挂；smoke 基本全军覆没 |
| 2 | 完成检测 `pgrep -f '[a]uto_test run'` 三态判定有空窗：调度器启动、env 段 setup（数分钟）、结尾 finalize_report（SSIM/LPIPS 回填）期间无 `auto_test run` 进程 | `build_machine_configs` 的 completion_check | 3 分钟轮询撞上空窗 → 误判异常退出（rc=137）→ 提前关机杀掉在跑的测试 |
| 3 | impact 路径整条死代码：`auto_test run --profile/--models/--opts/--parallels/--impact-json` 等 flag 已不存在（CLI 只收 plan yaml）；`AUTO_TEST_COMMAND` 环境变量 test.sh 不读；CI 也从不传 `--impact-json` | `build_auto_test_command` / `build_setup_commands` / single·multi_card 编排 | 约 1/3 workflow 代码不可达或无效，维护误导 |
| 4 | `auto_test.tar` 固定路径互相覆盖：build 以 overwrite=True 传 `optkit/`（tag）或 `optkit-master/`（master）下固定名；机器侧永远 wget `optkit-master/auto_test.tar` | `.gitlab-ci.yml` + `upload_to_obs.py` + workflow setup 命令 | ① 相邻 commit 竞态：A 的机器起来时 tar 已被 B 覆盖，跑成 B 的 plan；② release 错拿最近一次 master commit 的 smoke tar（连 v2_smoke.yaml 一起）|
| 5 | progress.json 路径失配：workflow cat `auto_test/progress.json`，实际写在 `$TEST_RESULT_DIR_ROOT/progress.json`；且并发 worker 各自覆盖、只反映自己子 plan | `ProgressTracker` / completion_check 的 progress_prefix | 进度条功能全废 |
| 6 | `finalize_report(impact_plan=...)` 无调用方传参；judge 的裁剪理由（reason）只打印不落盘 | `run.py` / `judge.py` | optkit_test_web「触发信息」面板永远为空 |
| 7 | workflow 步骤 4 轮询 `while True` 无整体超时 | `optkit_auto_test.py` main | 机器 SSH 持续失败时无限等待、不关机（成本泄漏） |

仍有效的契约（保留）：done.flag `rc=N`（test.sh trap ↔ `_extract_test_rc`）；`env.sh {release|pre}`；`OPTKIT_TEST_CATEGORY/VERSION` 结果分桶注入；workflow-id 判 release/pre 规则两侧一致。

## 目标设计

### A. tar 版本化（解覆盖竞态，改 optkit 侧 CI + workflow 侧 URL）

- **上传**（`.gitlab-ci.yml` build / `upload_to_obs.py`）：`auto_test.tar` 改传版本化对象键
  `<folder>/auto_test/auto_test-<workflow-id>.tar`，其中 `<folder>` 沿用现有 UP_FOLDER 规则（tag→`optkit`，master→`optkit-master`），`<workflow-id>` 与 test 阶段一致：`${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}`。
- **自洽产物**：把本次构建的 whl 一并打进 tar（`auto_test/dist/*.whl`）；`env.sh` 优先安装 tar 内 whl，无则回退现有 install.sh 流程。这样测试链路只依赖一个不可变对象，whl/install.sh 的固定路径覆盖竞态一并消除（install.sh 流程保留给人工安装场景）。
- **下载**（workflow）：由 `classify_workflow_id` 得 category → 拼 `https://obs.../obs-open-platform/{optkit|optkit-master}/auto_test/auto_test-<workflow-id>.tar`。
- **兼容与清理**：过渡期继续同时上传一份固定名 `auto_test.tar`（老部署可用）；OBS 桶对 `*/auto_test/` 前缀配置生命周期规则（建议 30 天过期）防堆积。

### B. workflow 收敛为单一路径（workflows 仓库）

1. **删除死代码**：`load_impact_plan`、`build_auto_test_command`、`build_setup_commands` 的 AUTO_TEST_COMMAND/impact.json 注入、`--impact-json` CLI 参数、single/multi_card 双 job 编排、smoke 5090+L20 特例、`_legacy_commands` 与新命令二选一的分叉。保留唯一路径：3 机型（5090/4090/L20）各 1 台。
2. **机器规格**：`gpu: 4`（与 test.sh 默认 `GPUS=0,1,2,3`、plan 的 4 卡 item 对齐）。
3. **setup 命令**（单一版本）：wget 版本化 tar → `tar -x` → `cd auto_test && sh ./env.sh {release|pre}` → `OPTKIT_TEST_CATEGORY=... OPTKIT_TEST_VERSION=... setsid sh ./test.sh > my_output.log 2>&1 &`。不再注入 AUTO_TEST_COMMAND；不设 10s pgrep 启动守卫（改为下面统一的运行中判定）。
4. **完成检测契约（核心修复）**：三态判定改为
   - `auto_test/done.flag` 存在 → **完成**（rc=N 取自 flag，权威信号）；
   - 否则 `pgrep -f '[t]est.sh' || pgrep -f '[a]uto_test'` 命中 → **运行中**（test.sh 由 setsid 启动、从 wget 后一直存活到 trap 写完 flag，无空窗；`[a]uto_test` 同时覆盖 schedule 父进程与 run worker，作双保险）；
   - 否则 → **异常退出**（按 rc=137 处理并关机，语义同现状：覆盖 OOM-killer 整组 SIGKILL）。
5. **整体硬超时**：步骤 4 轮询加墙钟上限（默认 13h，略小于 CI test 阶段 12h？——取 CI timeout 之下的 11.5h，见开放问题），到点强制关机并以失败退出。
6. **部署**：bump 版本 → build wheel → scp → 目标机 force-reinstall（沿用 PM/workflows 记录的流程）。

### C. 观测性补齐（P2，可后置）

1. **全局进度**：`scheduler.run_scheduler` 以 job 粒度维护一份全局 `progress.json`（写 `$TEST_RESULT_DIR_ROOT`）；worker 子进程 `--no-aggregate` 模式不再写同名文件（避免互相覆盖）。test.sh 在起调度器前 `ln -sf "$TEST_RESULT_DIR_ROOT/progress.json" "$SCRIPT_DIR/progress.json"`，workflow 的 `auto_test/progress.json` 读取点不变。
2. **触发信息面板**：judge 把 reason/变更文件/命中规则写进产出 plan 的 `meta:` 字段；`run`/`schedule` 读 plan.meta 传给 `finalize_report(impact_plan=...)`，恢复 test_manager.json 的 `info.impact` → optkit_test_web「触发信息」面板复活。

## 范围

- In scope：workflows 仓库 `workflows/optkit/optkit_auto_test.py` 及其单测；optkit 仓库 `.gitlab-ci.yml`、`upload_to_obs.py`、`auto_test/env.sh`、`auto_test/test.sh`（软链一行）、`auto_test/scheduler.py`+`progress.py`+`judge.py`（P2 项）。
- Out of scope：optkit / optkit_v2 优化本体；plan/judge 裁剪规则本身；optkit_test_web 代码（其读取的数据恢复即可）；机器镜像与模型路径。

## 影响模块

| 模块 | 影响 |
| --- | --- |
| auto-test（主责，候选模块） | test.sh/env.sh/scheduler/progress/judge 小改；CLI 契约不变 |
| workflows 仓库（外部，secondary） | optkit_auto_test.py 大幅删减 + 契约更新 + 重新部署 |
| optkit CI（secondary） | build 阶段 tar 版本化上传 |

## 实施计划（P0 → P2）

1. **P0-1 tar 版本化**：改 `upload_to_obs.py`（tar 对象键带 workflow-id）+ `.gitlab-ci.yml`（whl 打进 tar；传 id）；`env.sh` 优先装 tar 内 whl。验证：手动构建上传，wget 版本化 URL 解包安装成功。—— **代码完成（2026-07-02）**
2. **P0-2 workflow 收敛**：删死代码、`gpu: 4`、版本化 wget URL、新完成检测三态、整体硬超时；更新 `tests/test_optkit_auto_test.py`。—— **代码完成（2026-07-02）**
3. **P0-3 部署**：**顺序关键——先部署再 push**：① workflows 0.3.0 build → scp → force-reinstall 到 172.21.25.184（此刻无 CI 触发，无影响）；② commit+push optkit（build 开始产版本化 tar，test 阶段即用新 workflow 拉版本化 URL，闭环）。若先 push optkit，test 阶段会用老 workflows 0.2.11 白跑一轮（拉固定名 tar，gpu:1 老问题复现）；若只部署不 push，新 workflow 找不到版本化 tar 会失败。push 后普通 commit 即端到端验证（验收标准 1、3）。
4. **P1 release 验证**：打一个测试 tag（或复用下次 release）验证全量路径与结果分桶（验收标准 2）。
5. **P2 观测性**：调度器全局 progress + test.sh 软链；judge reason 落 plan.meta → info.impact。可与 P0 并行或后置。

## 生命周期同步

| 项 | 状态 | 证据 / PM 引用 |
| --- | --- | --- |
| 需求 | implementing | project-management.md 需求待办 REQ-20260702-autotest-workflow-align |
| 设计文档 | accepted | 本文件（2026-07-02 用户确认） |
| 实施 | implementing | P0 完成 2026-07-02；P2 完成 2026-07-07（用户确认后实施）；余 P1 release 验证 |

## 测试与验证

- workflows 单测：新完成检测三态（done.flag / 进程存活 / 异常退出）、版本化 URL 拼接（release/pre 两类 workflow-id）、硬超时触发关机。
- 端到端：普通 commit smoke（3 台 4 卡机、done.flag rc=0、自动关机、结果分桶正确）；相邻双 commit 互不串扰（各自 tar URL 不同即结构性保证，抽查 test_manager.json 的 optkit 版本）。
- P2 项：多 worker 并发下 progress.json 单调推进；test_manager.json 出现 info.impact。

## 风险

- **workflow 部署漂移**：CI 实际执行的是目标机 pip 装的版本，改仓库不生效；实施必须含部署步骤且 bump 版本（版本不变 pip 不覆盖）。
- **test.sh 进程探测历史问题**：早先弃用 pgrep test.sh 的原因（bash 收尾被误判"还在跑"）与本设计不冲突——新判定先看 done.flag（trap 已写完才轮到 bash 退出），bash 短暂存活窗口只会多等一轮 3 分钟；实施时用单测+真机确认。
- **OBS 堆积**：版本化 tar 若不配生命周期规则会持续累积（每 commit 一份，含 fixtures 体积不小）。
- **4 卡机器供给**：4 卡申请比 1 卡更易排队/审核延迟；已有 not_started 持续补发逻辑兜底，必要时可降机型数量（3→2）。

## 开放问题

- 无（2026-07-02 三项均已决策，见决策记录）。

## 决策记录

| 日期 | 决策 | 理由 |
| --- | --- | --- |
| 2026-07-02 | workflow 步骤 4 轮询硬超时取 11h | 留在 CI test 阶段 12h timeout 之下，full 历史 ~7h 有余量 |
| 2026-07-02 | 过渡期固定名 `auto_test.tar` 双写保留一个月（至 2026-08-02），之后停传 | 给老部署升级窗口 |
| 2026-07-02 | 机型策略不变：每次触发 3 机型（5090/4090/L20）各 1 台 | 成本可接受，多卡型覆盖有价值 |
| 2026-07-02 | workflow 收敛为「4 卡机 + test.sh + done.flag」单一路径，删除 impact/AUTO_TEST_COMMAND 全部死代码 | 「测什么」已物化为 tar 内 v2_smoke.yaml 的有无（judge-ci 设计），workflow 不再需要第二条决策通道；死代码误导维护 |
| 2026-07-02 | tar 按 workflow-id 版本化为不可变对象，whl 打进 tar 成自洽产物 | 固定路径 overwrite 无法根治竞态；单一不可变产物同时消除 whl/install.sh 的同类竞态，且 release/pre 各取各的 |
| 2026-07-02 | 完成判定以 done.flag 为权威、进程探测扩为 test.sh∪auto_test 仅作运行中/异常区分 | `auto_test run` 粒度的探测存在结构性空窗（env setup、聚合期），是提前关机误判的根因 |
