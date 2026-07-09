---
format: arch-module/v0.1
name: 自动化测试引擎 auto-test
described: 判断器→TestPlan→调度执行的回归测试引擎，把 optkit v1/v2 作为被测对象
module_form: atomic
module_kind: function-flow
main_subject: TestPlan(yaml) + Selector/Executor
status: accepted
review_status: not-reviewed
code_paths:
  - auto_test/**
---
# 模块：自动化测试引擎（auto-test）

- 状态：accepted（三层结构已落地基线；判断器决策逻辑与 v1/v2 full/smoke 具体清单仍为 open，见 §7）
- 代码：`optkit/auto_test/`（独立于 `optkit_v2/` 本体，仅把 optkit v1 / optkit_v2 作为**被测对象**）
- 上游：[main-design](../main-design.md)（被测对象 optkit_v2 核心框架）
- 变更设计：[2026-06-24 双引擎模块化](auto-test/changes/2026-06-24-v1v2-modular-engine.md)、[2026-07-02 workflow 契约对齐](auto-test/changes/2026-07-02-workflow-autotest-align.md)
- 关联需求：REQ-20260624-autotest-v1v2-modular、REQ-20260702-autotest-workflow-align（均 implementing）

## 1. 职责与边界

optkit 的回归测试引擎。把「要测什么」统一为可序列化的 **TestPlan（yaml）**，由调度器按 GPU 资源并发跑测试矩阵，产出统一 markdown 报告。**不改 optkit / optkit_v2 优化本体**——只装载、置卡、apply、跑指标、出报告。

非目标：不实现优化能力；不定义 optkit_v2 模块边界；LoRA 轴不在本模块矩阵内。

## 2. 模块化三层 + 一份计划契约

```text
判断器 Selector  ──产出──▶  TestPlan(yaml)  ──消费──▶  执行器 Executor
 (决定测什么)              (engine + 矩阵的         (展开 Cell → 装/置/apply/跑/报告)
 engine 写进计划)          序列化契约)                    │ 每 (model, opt)
                                                 适配器 Adapter = 模型侧 ⟂ 引擎后端
                                                 (engine 决定 v1/v2 apply 路径)
```

- **judge → plan → execute 之间以 yaml 契约解耦**，三层各自可独测。
- **engine 是计划级（per-run，每进程）单一属性**，非 per-cell：因 v1/v2 量化产物不可同进程混用（见 §6），一次 run 只能单一引擎。

## 3. 三层职责与代码

| 层 | 代码 | 职责 |
| --- | --- | --- |
| 判断器 Selector | `judge.py`、`impact.py`、`config/impact.yaml` | `git diff` / `git tag` 感知变更 → 由 `impact.yaml`（warp 规则 / 组件规则 / defaults 兜底）映射出模型 M 与能力 → 从 `v2_full` 裁剪 smoke；打 tag 则全量。裁剪谓词 `COMPONENT_KEEP` 在 `judge.py` |
| 计划契约 TestPlan | `plan.py`、`matrix.py`、`config/plans/*.yaml`、`config/env_groups.yaml` | plan 三层结构 `envs → groups → items`；`engine`/`profile`/矩阵轴（models×opt×res×steps×parallel×tests）。唯一事实源 = `config/plans/v2_full.yaml`。`matrix.expand_matrix` 把 plan 笛卡尔展开为 `list[Cell]` |
| 适配器 Adapter | `adapters/{base,flux_kontext,flux2,flux2_klein,qwen_image_edit,step1x}.py` | 模型侧：`load_pipe / default_speed_params / supports_parallel / env_group`；`base.apply_optcfg` 委托给注入的引擎后端，不再硬编码 v2 |
| 引擎后端 EngineBackend | `engines/{base,v1,v2}.py` | 与模型正交的引擎维度：`V2Backend`（`optcfgs_v2.yaml` → `build_optkit_config` → `apply_warp`）/ `V1Backend`（`optcfgs/*.json` → `<Model>OptConfig` → `apply_opt_to_<model>_pipe`）。置卡策略由后端自带：v2=卡上 fp8，v1=CPU 量化→搬卡 |
| 执行器 Executor | `run.py`、`scheduler.py`、`runners/{base,speed,memory,result}.py`、`progress.py`、`storage.py`、`report.py`、`optcfg.py`、`calibrate.py` | `run` 跑单 plan；`scheduler` 按显卡需求（degree）并发派发 + env 段屏障（`torchrun --nproc_per_node=N`）；runners 出 speed/memory/result 指标；report 出统一 markdown；storage 记录含 engine 字段 |

## 4. 公开契约

- **CLI**（`python -m auto_test <sub>`）：
  - `judge --out <plan>.yaml [--files ...]` — 裁剪出 smoke plan（默认 `HEAD~1..HEAD`，`--files` 不依赖 git 供调试）
  - `schedule <plan>.yaml --gpus 0,1,2,3 [--dry-run]` — 调度器并发跑一份 plan（含 env 段屏障）
  - `run <plan>.yaml` — 直跑单 plan（调度器派发的单 job 子 plan 也走此路，不处理 env 屏障）
- **TestPlan yaml 契约**：`engine`（v1|v2）、`envs → groups → items`、矩阵轴、`test_set`。字段权威在 `plan.py`。
- **parallel token**：`none` / `ring<N>` / `ulysses<N>` / `ring<N>_ulysses<M>`（合法 cell：`ring*ulysses == 1` 或 `== WORLD_SIZE`）。
- **CI 集成契约**（对 workflows 仓）：`test.sh`（入口）、`env.sh`（版本锁定）、`done.flag`（权威完成判定三态）、`is_runing.sh`（探活）；详见 `docs/judge-ci.md` 与 2026-07-02 workflow 对齐设计。

## 5. 依赖

| 依赖 | 方向 | 原因 |
| --- | --- | --- |
| optkit_v2 核心框架（`apply_warp`） | auto-test → optkit_v2 | v2 引擎后端装配优化，作为被测对象；契约保持不改本体 |
| optkit v1 optimizers（`apply_opt_to_<model>_pipe`） | auto-test → optkit v1 | v1 引擎后端恢复旧 apply 路径，复用 `optcfgs/*.json` 资产 |
| workflows 仓（aimaster/jira 自动化） | workflows → auto-test | 外部工作流经 `test.sh`/`done.flag` 契约驱动本引擎跑 CI（见 2026-07-02 对齐设计） |

## 6. 约束

- **引擎单一性强校验**：`run` 启动即固定 `plan.engine`，禁止一次 run 跨引擎——v1/v2 量化产物不可同进程混用。
- **配置源隔离**：`engine=v2 → optcfgs_v2.yaml`；`engine=v1 → optcfgs/atoms + optcfgs/<model>`。v1 不支持的 atom（如 regione）在 `V1Backend.supported_opts` 排除：profile 来源静默跳过，`--opts` 显式传则 hard error。
- **等价回归**：重构后 v2 在同 plan 下的 Cell 集合与 apply 结果须与改造前逐项一致（dry-run Cell diff 为空 + 真机 SSIM 兜底）。
- **远程旧 optkit_v2 树遮蔽**：须从不含本地 `optkit_v2` 树的目录跑，避免被本地包遮蔽（记忆坑 `v2-autotest-retarget`）。
- **启用 compile 的用例计时取第二遍**（首遍含编译开销）。

## 7. Open（未收口）

- 判断器**内部自动决策逻辑**（impact 驱动 / 版本驱动 / 引擎裁剪的完整策略）本轮仅有薄壳，留最后讨论。
- v1 与 v2 的 **full/smoke 具体矩阵清单**（各跑哪些 model×opt×res×steps×tests、是否共用 profile）留到验证工作流第④点讨论。
- 两关联需求（REQ-20260624 / REQ-20260702）在 PM 中仍 `implementing`。

## 8. 验证

- 纯逻辑单测（不依赖 GPU）：`tests/` 下 `test_plan / test_matrix / test_judge / test_engine_v1 / test_engine_v2 / test_v2_build_config / test_optcfg / test_scheduler / test_report / test_storage / test_progress` 等，覆盖 TestPlan 序列化、`EngineBackend.compose`、engine 感知 `supported_opts`、`expand_matrix` 等价性。
- 真机：4×5090 上跑 v2 full（本轮收口目标），核对矩阵、加速比、稳态零重编，报告经用户确认；再扩 v1。

## Review Notes

- Review status: not-reviewed
