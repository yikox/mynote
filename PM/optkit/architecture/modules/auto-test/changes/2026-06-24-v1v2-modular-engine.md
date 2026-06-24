# autotest 模块化测试引擎（v1/v2 双引擎 + full/smoke）设计

Last updated: 2026-06-24

Status: accepted

Module: auto-test（候选模块，非 optkit_v2 基线模块；未纳入 main-design.md 基线，落地后再决定是否建模块基线文档）

Requirement ID: REQ-20260624-autotest-v1v2-modular

Related requirement/task: `project-management.md` → 需求待办 / REQ-20260624-autotest-v1v2-modular；关联 Todo「接入 autotest 做出版本的测试」

Design status: accepted

Implementation status: in-progress（2026-06-24 起，按 TDD 实施）

Implementation evidence:

-

## 背景

- 上一轮（commit `141833a`）把 `auto_test/` 原地 retarget 到**纯 v2**：`adapters/base.py::apply_optcfg` 只调 `optkit_v2.apply_warp`，`optcfg.py` 只读 `optcfgs_v2.yaml` 生成 `OptKitConfig`，v1 的 `apply_opt_to_<model>_pipe` 路径已从适配器移除。
- 现需让 autotest 能**分别测 v1 与 v2**，每引擎各有 full / smoke，且把框架重构成清晰的模块化三层，便于后续接「判断器」自动决策与多版本回归。
- 本设计**逆转**上一轮「非双引擎、原地 retarget」的决策。
- 约束（来自项目记忆 `v2-cp-numerically-verified`）：**v1/v2 量化产物不可在同进程混用**。故引擎必须是**每次 run（每进程）单一**，不能在一次 run 内逐 cell 混跑 v1/v2。

## 需求

- autotest 支持「引擎」维度：可选择对 v1（`optkit.apply_opt_to_<model>_pipe`）或 v2（`optkit_v2.apply_warp`）跑测试。
- 每引擎各有 full（全量回归）与 smoke（冒烟）两档。
- 重构为模块化三层（用户给定形状）：
  1. **判断器**：入口，生成「要测什么」的测试计划 yaml；`--engine v1|v2` 作为参数写进该 yaml。判断器**内部决策逻辑本轮不实现**，留到最后讨论。
  2. **适配器**：解析测试计划 yaml（含 engine 字段），按引擎分派到 v1 / v2 的 apply 路径。
  3. **执行本体**：按计划跑测试矩阵、出统一报告。
- 仅改 `auto_test/`，不动 optkit / optkit_v2 优化本体。

## 验收标准

- 单一入口可分别跑出 v1 / v2 的 full 与 smoke 报告。
- v2 full 报告内容经用户确认满足需求（本轮收口目标）。
- 现有 v2 路径行为不回退（重构等价：同 plan 下 cell 集合、apply 结果与改造前一致）。
- 引擎在一次 run 内唯一；v1/v2 配置/量化不在同进程混用。

## 现状

三层职责目前是隐式耦合在以下文件，且 v2 硬编码：

| 现有文件 | 现职责 | 与目标层的关系 |
| --- | --- | --- |
| `profiles.yaml` + `matrix.py::load_profile / build_profile_from_cli` | 命名 profile（smoke/full/cache_sweep/parallel）+ CLI 覆盖 → profile dict | 判断器的雏形（手动选 profile） |
| `matrix.py::expand_matrix` → `list[Cell]` | profile → 笛卡尔展开为 Cell（model×opt×res×steps×parallel×tests） | 计划展开（属执行本体前段） |
| `optcfg.py` + `optcfgs_v2.yaml` | opt 名 → v2 dict → `OptKitConfig`（**v2 硬编码**） | 适配器的「配置解析」半边 |
| `adapters/*` + `base.py::apply_optcfg` | 每模型 load_pipe/默认参数/supported_opts；apply 调 `build_optkit_config + apply_warp`（**v2 硬编码**） | 适配器的「apply 分派」半边 |
| `run.py::main` | 装 pipe / 两段式置卡 / apply / 跑 runner / 存储 / 报告 | 执行本体 |

v1 资产仍在仓库，可复用以恢复 v1 路径：

- `auto_test/optcfgs/atoms/*.json`（扁平 v1 flag：`enable_sage/enable_quant/enable_compile`）+ `optcfgs/<model>/*.json`（per-model cache）。
- v1 apply API：`optkit.optimizers.apply_opt_to_<model>_pipe(pipe, <Model>OptConfig(dict))`（8 个模型入口齐全）。
- 旧适配器形态：`apply_opt_module/apply_opt_fn/apply_opt_cfg_cls` + `fn(pipe, cfg_cls(optcfg))`（见 `git show 2817dae:auto_test/adapters/base.py`）。

## 目标设计

### 总体：三层 + 一份计划契约

```
判断器(Selector)  ──产出──▶  TestPlan(yaml)  ──消费──▶  执行本体(Executor)
   (决定测什么)              (引擎+矩阵的         (展开 Cell → 装/置/apply/跑/报告)
   engine 写入计划)          序列化契约)               │
                                                      ▼ 每 (model,opt) 调用
                                              适配器(Adapter) = 模型侧 + 引擎后端
                                              (engine 决定 v1/v2 apply 路径)
```

- **engine 是计划级（per-run）属性**，非 per-cell；一次 run 单一引擎，规避 v1/v2 同进程混用。
- TestPlan 作为**可序列化中间产物**，让判断器与执行本体解耦、各自可独测。

### Layer 1 — 判断器 Selector（本轮不实现，仅约定其产物）

- 职责（最终）：自动决定测什么 → 产出一份 **TestPlan yaml**。
- **本轮不实现判断器本体**：当前讨论的是「判断器之后」的链路。判断器的自动决策逻辑（impact 驱动 / 版本驱动 / 引擎裁剪）留作最后讨论。
- 本轮 plan yaml **先手工编写**（如 `v2_full.yaml` / `v2_smoke.yaml`），直接喂给执行本体；判断器落地后再由它生成同一份 yaml 契约。
- 入口形态（已定，见决策 d）：**`python -m auto_test run <plan>.yaml`** —— 执行本体直接消费一份 plan yaml，不再走 `--engine/--profile` 即时装配。

### TestPlan 契约（选定字段）

```yaml
engine: v2            # v1 | v2  —— 本轮新增，决定 apply 路径
profile: full         # 来源 profile 名（仅记录/溯源）
models: [...]
opts: [...]           # canonical atom 复合名
resolutions: [...]
steps: [...]
tests: [...]          # speed | memory | result
parallels: [...]      # none / ring<N> / ulysses<N> / ring<N>_ulysses<M>
test_set: test_set_10.csv
```

- 该结构是现 profile dict 的超集（加 `engine` + `profile` 溯源）。`expand_matrix` 直接消费，Cell 不必新增 engine 字段（engine 取自 plan，对整个 run 唯一）。

### Layer 2 — 适配器 Adapter（模型侧 ⟂ 引擎后端）

把「模型相关」与「引擎相关」解耦为两个正交维度：

- **模型适配器（保留）**：`adapters/<model>.py` 仍管 `load_pipe / default_speed_params / supports_parallel / env_group`。
- **引擎后端（新增策略）**：`EngineBackend` 接口，两实现：
  - `V2Backend`：读 `optcfgs_v2.yaml` → `build_optkit_config` → `apply_warp`（= 今天的实现搬入）。
  - `V1Backend`：读 `optcfgs/*.json` → `<Model>OptConfig(dict)` → `apply_opt_to_<model>_pipe`（恢复旧路径，复用现存 json 资产）。
- 接口建议：
  - `backend.compose(model, opt) -> cfg_obj_or_dict`
  - `backend.supported_opts(model) -> list[str]`（v1/v2 支持集不同：v2 有 regione，v1 无）
  - `backend.opt_calibrated_steps(model, opt) -> int | None`（cache 钉步数）
  - `backend.apply(pipe, model, cfg, *, parallel_ring, parallel_ulysses, rank, world_size, device, steps)`
  - `backend.placement` —— 置卡策略（见决策 c）：`V2Backend` = 卡上 fp8（transformer 先上卡再 apply 量化）；`V1Backend` = CPU 量化→搬卡（apply 在 CPU 完成量化后再 `to(device)`）。置卡时序由后端拥有，执行本体不按 engine 硬分支。
- `base.py::apply_optcfg` 改为委托给注入的 `EngineBackend`；适配器不再硬编码 v2。
- `supported_opts` 由「类属性」改为「引擎感知」（`backend.supported_opts(model)` 或 `adapter.supported_opts(engine)`），`expand_matrix` 的 `get_supported_opts` 改从当前 engine 后端取。

### Layer 3 — 执行本体 Executor

- 基本沿用 `run.py::main`，改动点：
  1. 入口先得到 TestPlan（来自 `--plan` 文件或 `--engine/--profile` 即时装配）。
  2. 按 `plan.engine` 选定 `EngineBackend` 实例，贯穿 `expand_matrix`（supported_opts/opt_steps 走该后端）与 apply 调用。
  3. apply 调用从 `adapter.apply_optcfg(... apply_warp)` 改为 `backend.apply(...)`。
  4. 置卡由 `backend.placement` 拥有（决策 c）：v2 = 两段式卡上 fp8（`_place_transformer_pre_apply` / `_place_aux_post_apply` 保持）；v1 = CPU 量化→搬卡（apply 后整体 `to(device)`，满足显存、最稳妥）。执行本体只调 `backend.place_*`，不按 engine 硬分支。
  5. 报告/存储记录 `engine` 字段，便于 v1↔v2 对比与多版本归档。

### full/smoke 与引擎的关系（本轮不定）

- full/smoke 是 **profile（矩阵形状）**；engine 是 **apply 路径**。二者正交。
- `v1 full / v2 full / v1 smoke / v2 smoke` = (engine × profile) 组合。
- 具体每档跑哪些 model×opt×res×steps×tests，以及 v1 与 v2 是否共用同一份 profile，**留到后续工作流第④点讨论**（见开放问题 b）。

## 范围

- In scope：`auto_test/` 内三层重构、引擎后端策略、TestPlan 契约、v1 apply 路径恢复、engine 贯穿执行/报告；本轮收口 **v2 full**。
- Out of scope：判断器自动决策逻辑；v1/v2 full/smoke 的具体矩阵清单；optkit / optkit_v2 本体改动；LoRA 轴。

## 详细设计要点

- **引擎单一性强校验**：`run` 启动即固定 plan.engine；禁止一次 run 跨引擎，避免 v1/v2 量化混用。
- **配置源映射**：`engine=v2 → optcfgs_v2.yaml`；`engine=v1 → optcfgs/atoms + optcfgs/<model>`。opt atom 名两引擎尽量对齐（noopt/sage/quant/compile/dicache/magcache/regione），v1 不支持的 atom（如 regione）在 v1 后端的 `supported_opts` 中排除，profile 来源静默跳过、`--opts` 显式传则 hard error（沿用现规则）。
- **等价回归**：重构后 v2 路径在同一 plan 下产出的 Cell 集合与 apply 结果，须与改造前逐项一致（防回退）。
- **单测**：新增 TestPlan 装配/序列化、`EngineBackend` 双实现 compose、engine 感知 supported_opts 的纯逻辑单测；沿用 `test_optcfg.py` / `test_v2_build_config.py` 风格（不依赖 GPU）。

## 受影响模块

| 模块 | 影响 |
| --- | --- |
| auto-test（本模块） | 三层重构主体 |
| 优化组件 / 模型 warp（optkit_v2） | 仅作为被测对象，**不改代码**；v2 apply 契约保持 |
| optkit v1 optimizers | 仅作为被测对象，恢复调用 `apply_opt_to_<model>_pipe`，**不改代码** |

## 实施计划

1. 定义 `TestPlan`（dataclass + yaml 读写）；判断器薄壳：`--engine/--profile/覆盖` → TestPlan；加 `plan` 子命令与 `run --plan`，过渡期 `run --engine` 直跑。
2. 抽 `EngineBackend` 接口；把现 v2 逻辑搬入 `V2Backend`（行为不变，等价回归）。
3. 实现 `V1Backend`：复用 `optcfgs/*.json` + `apply_opt_to_<model>_pipe`；恢复 v1 置卡时序。
4. `base.py::apply_optcfg` 改委托后端；`supported_opts`/`opt_steps` 改引擎感知；`run.py` 贯穿 engine。
5. 报告/存储加 engine 字段。
6. 单测覆盖三层纯逻辑；本地全套 pytest 绿。
7. **一次性验证工作流**（见下）：打包→上机→迭代 v2 full。
8. （后续讨论后）落 v1/v2 full/smoke 具体矩阵；落判断器决策逻辑。

### 一次性验证工作流（本次重构专用，非常驻代码）

① 改造代码 → ② autotest 打 tar + optkit 打 whl，上传机器模拟正式流程 → ③ 聚焦 **v2 full** 迭代补充/删减测试项至报告满足需求 → ④ 讨论敲定正式环境 v2 full 清单（预估耗时、注意事项）→ ⑤ 讨论 smoke 测试规则。

## 生命周期同步

| 项 | 状态 | 证据 / PM 引用 |
| --- | --- | --- |
| 需求 | implementing | `project-management.md` → 需求待办 / REQ-20260624-autotest-v1v2-modular |
| 设计文档 | accepted | 本文件 |
| 实现 | in-progress | 2026-06-24 起，按 TDD（TestPlan→V2Backend 等价回归→V1Backend→执行本体贯穿→单测） |

## 测试与验证

- 纯逻辑单测：TestPlan 序列化、EngineBackend.compose（v1/v2）、engine 感知 supported_opts、expand_matrix 等价性。
- 真机：按一次性工作流，4×5090 上跑 v2 full（聚焦），核对报告矩阵、加速比、稳态零重编；再扩 v1。
- 等价回归：重构前后 v2 同 plan dry-run 的 Cell 列表 diff 为空。

## 风险

- **v1 置卡时序差异**：v1「CPU 量化→搬卡」与 v2「卡上 fp8 量化」相反（已定为各后端自带置卡策略，决策 c）；实现需保证 v1 apply 在 CPU 完成量化后再整体搬卡，否则 OOM 或量化失败。
- **opt atom 名跨引擎不完全对齐**：v1 无 regione、cache 标定值不同；需各自 `supported_opts` 与配置源，避免串味。
- **等价回归遗漏**：v2 行为在重构中漂移而不自知；用 dry-run Cell diff + 真机 SSIM 兜底。
- **远程旧 optkit_v2 树遮蔽**（记忆 `v2-autotest-retarget` 坑）：须从不含本地 optkit_v2 树的目录跑。

## 开放问题

- (a) **判断器内部决策逻辑**：如何自动决定测哪些（impact 驱动 / 版本驱动 / 引擎裁剪）。留到最后讨论。
- (b) **v1 与 v2 的 full/smoke 矩阵**：各跑哪些组合、是否共用同一份 profile 定义。留到工作流第④点讨论。

## 决策记录

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-06-24 | engine 设为 per-run（每进程）单一，非 per-cell | v1/v2 量化产物不可同进程混用（记忆 v2-cp-numerically-verified） |
| 2026-06-24 | 引入可序列化 TestPlan 作为判断器↔执行本体契约 | 解耦三层、各自可独测；承接「入口判断器生成 yaml」的用户形状 |
| 2026-06-24 | 模型适配器 ⟂ 引擎后端（策略）正交拆分 | 模型差异与引擎差异是两个维度，解耦避免 v1/v2 在适配器里硬编码缠绕 |
| 2026-06-24 | full/smoke=profile 与 engine 正交组合 | 把「测什么」与「用哪个引擎 apply」分离，具体矩阵可延后 |
| 2026-06-24 | v1 置卡用「CPU 量化→搬卡」，置卡策略由引擎后端拥有（非执行本体 if-engine 分支） | 满足显存、最稳妥；v2=卡上 fp8、v1=CPU 量化后搬卡，两策略各自封装解耦（决策 c） |
| 2026-06-24 | 入口定为 `run <plan>.yaml`（消费 plan yaml），判断器本轮不实现 | 当前讨论的是判断器之后的链路；本轮 plan yaml 手工编写，判断器落地后生成同一契约（决策 d） |
