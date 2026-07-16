# optkit 项目管理

Last updated: 2026-07-16

## 概述

- **optkit**：面向生产部署的 diffusion 推理优化工具包，把 SageAttention / FP8 量化 / torch.compile / 步级缓存（MagCache/DiCache）/ 并行（Ulysses+Ring CP）/ RegionE 等手段封装为可调用的优化能力。
- **v1**：按「每模型一个 opt 文件」组织（`optkit/optimizers/`），优化顺序硬编码、跨能力耦合，新增模型/能力成本高。仍并行保留，不被替换。
- **v2（当前主线）**：把优化能力重构为**可组合 component 框架**——优化手段解耦为独立插件，模型侧只写 warp（替换 transformer.forward + attn processor），二者通过 `OptKitContext` 的 hook 契约交互。统一入口 `apply_warp(pipe, config)`（warp 按 pipe 类名自动解析）。
- 工作目录 `/Users/chenzeyang/MTGIT/optkit`，git 主分支 `master`，开发分支 `v2`。

## 当前状态

- **版本**：v2 开发分支（`v2`），未发版。
- **阶段**：核心框架契约已冻结；6 类 component + 多模型 warp 已接通；处于「权重/性能收口 + 缺陷修复」阶段。
- **当前焦点**：v2 使用文档已补齐（`docs/v2/` README + 5 模型系）并推送；Wan 全路径权重验证收口；v1→v2 迁移说明待补。
- **LTX2 进展**：基础 warp（sage/fp8/compile）、只切 video 的 Ulysses CP、双流 DiCache 已在 `v2` 分支落地并推送；Stage2 Ring + Ulysses 组合设计已确认，待实现与远端真实权重验证。
- **当前能力**：
  - 模型 warp：Qwen-Image-Edit、Qwen-Image-Edit-2509（Plus 多图编辑）、Qwen-Image（t2i）、FLUX.1（t2i / Fill / Inpaint / Kontext）、FLUX.2-Klein、Wan（i2v / t2v / ti2v / VACE）、LTX2（video+audio，sage/fp8/compile/Ulysses/DiCache 已接通）。
  - 优化 component：SageAttention、FP8/INT8 量化、torch.compile（区域编译）、并行（Ulysses + Ring CP，支持不均匀序列切分）、步级缓存（DiCache / MagCache）、RegionE（编辑区域感知加速 + AVDCache）。
  - 运行时 `replace_lora` 在 sage/fp8/compile 之后热切换 LoRA，不触发重编译。
  - RegionE 仅适用序列级参考拼接的编辑 pipeline（Qwen-Edit / Kontext / FLUX2-Klein / edit_plus）；t2i / Fill / Inpaint 在 apply 时报错拦截。

## 进行中 / 活跃任务

- LTX2 Stage2 Ring + Ulysses：L2 设计已确认；现有 V2 并行算法与公共契约不变，下一步改 Stage2 demo、清理旧术语并验证 `u2/r1`、`u1/r2`、`u2/r2`。
- 2026-06-30 - 已完成：review `origin/master...v2` 分支差异；复核后 auto_test 单 cell OOM/RuntimeError 作为 error cell 继续执行是既有策略，CLI/调度器退出码属于策略确认/可改进点；v1 noopt 基线配置语义为待确认真问题。
- M4 收口：Wan t2v/ti2v/VACE「盲写」warp 的真实权重验证；性能基线报告归档。
- 跟进遗留缺陷：qwen t2i + ulysses4 + true CFG 的 latent NaN（见下）。

## 需求待办

| ID | 日期 | 需求 | 状态 | 优先级 | 模块/范围 | 下一步 / 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-20260716-ltx2-ring-stage2 | 2026-07-16 | LTX2 Stage2 支持纯 Ring 及 Ring + Ulysses 组合 | designed | 高 | LTX2 warp + parallel + `TDD/LTX` Stage2 demo | Design: `architecture/modules/warps/changes/2026-07-16-ltx2-ring-stage2.md`（accepted）；Plan: `architecture/modules/warps/changes/2026-07-16-ltx2-ring-stage2-implementation-plan.md`；公共契约不变，下一步按 TDD 实施并远端验证三种拓扑 |
| REQ-20260624-autotest-v1v2-modular | 2026-06-24 | autotest 改造为模块化测试引擎，支持分别测 v1 / v2，各有 full 与 smoke | implementing | 中 | `auto_test/`（不动 optkit/optkit_v2 本体） | Design: architecture/modules/auto-test/changes/2026-06-24-v1v2-modular-engine.md（accepted）；TDD 实施中；矩阵清单与判断器逻辑见设计「开放问题」，本轮收口 v2 full |
| REQ-20260702-autotest-workflow-align | 2026-07-02 | auto_test 与 optkit-auto-test workflow 契约对齐：workflow 收敛为「4 卡机 + test.sh + done.flag」单一路径、删 impact 死代码；auto_test.tar 按 workflow-id 版本化解 OBS 覆盖竞态 | implementing | 高 | auto-test + workflows 仓库（外部）+ optkit CI | Design: architecture/modules/auto-test/changes/2026-07-02-workflow-autotest-align.md（accepted，超时 11h/固定名留 1 月/机型不变）；P0 已完成并合 master；P2 观测性 2026-07-07 完成并合入 master（5dbf9a6，merge 6c24d1b 已推送，CI 将端到端实测）；余 P1 release 验证 |

**REQ-20260624-autotest-v1v2-modular 详述**

- **背景**：上一轮已把 autotest 原地 retarget 到纯 v2（`adapters/base.py` 仅调 `optkit_v2.apply_warp`，v1 `apply_opt_to_xxx_pipe` 路径已移除）。现需让 autotest 能分别测 v1 与 v2，每引擎各有 full / smoke。本需求逆转了上一轮「非双引擎、原地 retarget」的决策。
- **目标架构（模块化三层）**：
  1. **判断器**：入口，生成「要测什么」的 yaml；`--engine v1|v2` 作为参数写进生成的 yaml。（判断器内部逻辑本轮**不实现**，留到最后讨论。）
  2. **适配器**：解析 yaml 内容（含 engine 字段），按引擎走 v1 / v2 的 apply 路径。
  3. **执行本体**：按解析结果跑测试矩阵、出报告。
- **范围**：仅改 `auto_test/`，不动 optkit / optkit_v2 优化本体。
- **非目标**：判断器自动决策逻辑本轮不做；v1 的 full/smoke 矩阵清单本轮不细化。
- **验收信号**：单一入口可分别跑出 v1 / v2 的 full 与 smoke 报告；v2 full 报告内容经用户确认满足需求。
- **本次重构的一次性工作流（验证用，非常驻代码）**：① 改造代码 → ② autotest 打 tar + optkit 打 whl 上传机器模拟正式流程 → ③ 聚焦 v2 full 迭代补充/删减测试项至报告满足需求 → ④ 讨论敲定正式环境 v2 full 测试清单（预估耗时、注意事项）→ ⑤ 讨论 smoke 测试规则。
- **开放问题（设计/讨论阶段解决）**：(a) 判断器内部决策逻辑（留到最后讨论）；(b) v1 与 v2 的 full/smoke 矩阵关系与具体清单（在工作流第④点讨论）；(c) v1 apply 路径在 autotest 内如何恢复（适配器按 engine 分派 `optkit.apply_opt_to_xxx_pipe`）。
- 关联现有 Todo「接入 autotest 做出版本的测试」。

## 里程碑

- M1 框架（component/context/order 契约冻结）— **已完成**
- M2 模型（多类模型 warp 接通）— **已完成**
- M3 组合（RegionE×Ulysses、DiCache×CP、不均匀 CP 切分正确性）— **已完成（修复中）**
- M4 收口（Wan 全路径权重确认、性能基线报告）— **进行中**
- M5 发版（v2 README + 各模型 doc + 迁移说明）— **进行中**（v2 使用文档已交付 `docs/v2/`；剩 v1→v2 迁移说明 + 发版）

## 设计文档

| 类型 | 路径 | 状态 | 备注 |
| --- | --- | --- | --- |
| 主设计文档 | `architecture/main-design.md` | accepted | 三层+一契约、apply 编排、模块地图、HOOK_ORDER、共享约束 |
| 模块: 核心框架 | `architecture/modules/core-framework.md` | accepted | config/specs、OptKitContext 冻结契约、order.py、apply |
| 模块: 优化组件 | `architecture/modules/optimization-components.md` | accepted | sage/quant/compile/dicache/magcache + runtime lora |
| 模块: 序列并行 | `architecture/modules/parallel.md` | accepted | Ulysses/Ring/USP、统一切分契约、不均匀切分 |
| 模块: RegionE | `architecture/modules/regione.md` | accepted | 区域感知编辑加速、三处协作 |
| 模块: 模型 warp | `architecture/modules/warps.md` | accepted | transformer/pipeline 两层、13 个已注册 pipeline |
| 变更设计: auto-test 双引擎模块化 | `architecture/modules/auto-test/changes/2026-06-24-v1v2-modular-engine.md` | accepted | autotest 三层(判断器/适配器/执行本体)+engine⟂profile；REQ-20260624-autotest-v1v2-modular。auto-test 为候选模块，未入基线 |
| 变更设计: workflow 契约对齐 | `architecture/modules/auto-test/changes/2026-07-02-workflow-autotest-align.md` | accepted | workflow 收敛单一路径 + tar 版本化 + done.flag 权威完成判定；REQ-20260702-autotest-workflow-align；P0/P2 已落地合 master，余 P1 release 验证 |
| 变更设计: LTX2 Stage2 Ring + Ulysses | `architecture/modules/warps/changes/2026-07-16-ltx2-ring-stage2.md` | accepted | 复用 V2 正交组合；`v2a` 保持完整 CP group LSE merge；公共契约不变；REQ-20260716-ltx2-ring-stage2 |

> 原导读 `v2-architecture.md` 保留为面向新同学的代码导读；上表为模块化基线设计文档（由 pm-document-architecture 维护）。

## Todo

- [ ] LTX2 Stage2 Ring + Ulysses：实现 demo degree/rotation 配置，远端验证 `u2/r1`、`u1/r2`、`u2/r2`
- [ ] Wan t2v/ti2v/VACE 真实权重验证收口
- [ ] qwen t2i u4+CFG NaN 缺陷定位（怀疑 all_to_all split sizes 变化的通信层行为）做 bug 定位，需要确定错误原因，修改的方案，输出一个bug 修复报告到 PM/optkit/bugs/下面
- [ ] 接入 autotest 做出版本的测试
- [ ] 性能基线报告归档（M4 交付物）
- [x] 补齐 v2 用户文档：`docs/v2/` README + 各模型 doc（2026-07-01 交付并推送）
- [ ] v1→v2 迁移说明（M5 剩余项）

## 阻塞与风险

- **Wan t2v/ti2v/VACE「盲写」路径**：真实权重下可能产图错误，需补权重验证（M4）。
- **依赖 diffusers 内部私有 API**（`_modeling_parallel` / `_cp_plan` / `dispatch_attention_fn`）：上游升级可能 break；已强校验 `diffusers >= 0.35`，需关注上游。测试机 transformers 须 pin 4.57.1。
- **`OptKitContext` 契约被随意改**：跨组件交互失稳；已约束「修改=契约变更需评审」。
- **v2 用户文档**：使用文档已补（`docs/v2/`，2026-07-01），外部接入成本已降；仅剩 v1→v2 迁移说明待补（M5）。
- **已知缺陷（待跟进）**：
  - **qwen t2i + ulysses4 + true CFG → latent NaN 全黑图**：触发=CFG 两分支 txt 长度不一致（ws=2 / nocfg / samelen 不触发；已排除 sage/compile/镜像层）。NaN 首现负分支中部 block（blk9/10）。规避：负 prompt embeds pad 到与正分支同长，或 `true_cfg_scale=1.0`。qwen edit 系不受影响。复现资产 `reports/qwen_t2i/probe/`。
  - **DiCache 阈值须逐任务标定**：qwen-edit 0.08 / qwen t2i 0.04 / flux2 0.04 / flux 0.08。t2i 类任务对基线 SSIM 仅弱参考（无锚定，漂移地板 ~0.5），质量结论须看图 + 对 sfc 算 SSIM。
  - **A14B（wan-t2v/i2v）四卡 OOM**：双 14B 专家 fp8 常驻 ~26G，CP 切序列不切权重，每卡 >32G。需 ≥48G 卡或对双专家做权重切分；单卡可用。
  - **qwen 单卡 regione OOM**：20B+regione 的 KV 在 1024 分辨率单卡 32G 放不下；四卡（序列切分）OK。
  - **qwen ring/混合并行 SSIM 偏低**：ring4=0.70、u2r2=0.58，而 ulysses4=0.88（flux-kontext ring4=0.97≈ulysses4）→ qwen 专属 ring attention 数值漂移，非系统性。排查方向：qwen ring 路径 RoPE / attention。
  - **Wan TI2V-5B i2v 花屏**：diffusers 0.38 原生缺陷（非 optkit），需 diffusers main；默认不跑。
  - **wan-i2v 未跑通**：测试机离线缺 `ftfy`（diffusers WanI2V prompt_clean 需要）。

## Recent Updates

- 2026-07-16 - LTX2 Stage2 Ring + Ulysses 设计确认：审计现有 V2 parallel 后确认无需新增并行路径或修改公共契约；attention 级 Gloo 验证 `u2/r1`、`u1/r2`、`u2/r2` 均与全量参考对齐（最大误差 `2.38e-7`）。设计要求 video self 走 Ulysses 外层 + Ring 内层，`v2a` 继续在完整 CP group 合并 partial out/LSE；Stage2 demo 使用全部 rank，degree 乘积必须等于 world size。Design: `architecture/modules/warps/changes/2026-07-16-ltx2-ring-stage2.md`。
- 2026-07-07 - P2 观测性完成（TDD，已提交 5dbf9a6 并经 merge 6c24d1b 合入 master 推送，v2 同步）：REQ-20260702-autotest-workflow-align 剩余 P2 两项落地——①触发信息：judge 把裁剪决策落 plan.meta（matched_rules/components/release_tag/profile 等，字段对齐 web 面板消费键），load_plan 解析，scheduler/run 传 `finalize_report(impact_plan=)` 恢复 test_manager.json `info.impact`；②全局进度：调度器 job 粒度独占写 `$TEST_RESULT_DIR_ROOT/progress.json`，worker `--no-aggregate` 改 NullProgress 不再并发覆盖，test.sh 软链 `auto_test/progress.json` 供 workflow 读取。新增 8 单测（套件 176 passed），端到端实证 web「源码变更」面板与 workflow 进度条渲染；workflows/web 两侧零改动（29/101 passed 回归）。背景：这两个消费端为同事 zyh 5-6 月所建（web 3a7804a 触发面板、workflows f596124 进度条），在 6 月底 auto_test 重构中断供。余 P1 release 验证。
- 2026-07-02 - P0 代码完成（待部署）：REQ-20260702-autotest-workflow-align 设计经用户确认 accepted（超时 11h、固定名双写留 1 月、机型不变）并完成 P0-1/P0-2 编码——optkit 侧 tar 版本化上传 + whl 打进 tar + env.sh 版本锁定（168 passed）；workflows 侧契约重写 0.3.0（版本化 URL、gpu:4、done.flag 权威三态、11h 硬超时、删 impact 死代码，29 passed，wheel 已构建）。实施中修复探活自匹配 bug（`[-]m auto_test`）。P0-3 部署顺序关键：先装 workflows 0.3.0 再 push optkit（见设计「实施计划」）。
- 2026-07-02 - pm-design-requirement：REQ-20260702-autotest-workflow-align 转设计，产出 `architecture/modules/auto-test/changes/2026-07-02-workflow-autotest-align.md`（proposed）。核对出 7 项断裂点（gpu:1 vs 4 卡 plan、pgrep 'auto_test run' 空窗误判提前关机、impact 整条死代码、auto_test.tar 固定路径覆盖竞态且 release 错拿 master smoke tar、progress.json 路径失配、info.impact 断供、轮询无硬超时）。方案：workflow 收敛「4 卡机 + test.sh + done.flag」单一路径；tar 按 workflow-id 版本化且 whl 打进 tar 成自洽产物；观测性（全局 progress、judge reason 落 plan.meta）列 P2。需求 → designed。
- 2026-06-24 - 设计 accepted + 开工：REQ-20260624-autotest-v1v2-modular 设计经用户认可标 accepted，入口定 `run <plan>.yaml`、v1 置卡 CPU 量化→搬卡（后端自带策略）；进入 TDD 实施（TestPlan→V2Backend 等价回归→V1Backend→执行本体贯穿）。需求 → implementing。
- 2026-06-24 - pm-design-requirement：REQ-20260624-autotest-v1v2-modular 转设计，归入候选模块 auto-test，产出变更设计 `architecture/modules/auto-test/changes/2026-06-24-v1v2-modular-engine.md`（proposed）；核心：engine 设为 per-run 单一（v1/v2 量化不可混用）、可序列化 TestPlan 作三层契约、模型适配器⟂引擎后端策略、full/smoke=profile 与 engine 正交。需求状态 → designed。
- 2026-06-24 - pm-record-requirement：记录 REQ-20260624-autotest-v1v2-modular（autotest 模块化为判断器/适配器/执行本体三层，`--engine v1|v2` 写进生成 yaml，分别测 v1/v2 各自 full/smoke），状态 ready-for-design；详见「需求待办」。
- 2026-06-24 - pm-document-architecture：把 `v2-architecture.md` 导读重组为标准模块化设计文档（`architecture/main-design.md` + 5 个 modules/），按仓库实际目录与注册表核对、补入 Step1X-Edit（已 13 个注册 pipeline）；原导读保留。设计文档索引见上「设计文档」节。
- 2026-07-01 - 文档整理（已推送 master `d2ca2e7`、`617c952`）：① 清理 20 个开发过程文档（superpowers plans/specs、v2-pm、各 test-plan/refactor/feasibility 等）；② v1 使用文档归集 `docs/v1/`；③ 新增 v2 按模型使用指南 `docs/v2/`（README 公共入门 + qwenimage/flux/flux2/wan/step1x 5 篇，含"仅供参考"加速区间）。**注意**：v2-regione 两份深度设计移入本地 `design/`（已 gitignore）→ **已从仓库删除、仅本机保留**，v2 代码注释中 `design/components/cache/v2-regione-*.md` 路径对 clone 者为断链（用户知情接受）。原仓库内 `docs/v2-pm.md` 已删，本外部 PM 为唯一权威主文档。
- 2026-06-15 - 创建本项目记忆笔记；归档 v2 当前状态。
- 2026-06-12 - 4×RTX5090（机器 4860）实测 5 个新 pipeline（qwen t2i/edit_plus、flux t2i/fill/inpaint）× (baseline/sfc/+dicache/u4) 全矩阵：flux 三 pipeline SSIM 0.88~0.99 全过；qwen edit_plus **regione 首次实测通过**（u4+regione 8.36×，SSIM 0.90）；稳态零重编。遗留 qwen t2i u4+CFG NaN。报告 `reports/{qwen_t2i,qwen_edit_plus,flux_t2i,flux_fill,flux_inpaint}/`。
- 2026-06-09 - 4×RTX5090 全模型×8项矩阵实测（qwen-edit/flux-kontext/flux2-klein/wan）：稳态零重编；加速比 flux-kontext+dicache 4.92×、flux2+dicache 3.43×、qwen u4+regione 4.14×、wan-ti2v(5B) u4 1.74×。
- 2026-06-03 - run_tests.sh flux-kontext 固定 STEPS=28；修 RegionE 尾部 token 孤儿化花屏（commit 2706b34）。
- 2026-05 - 统一 CP 不均匀序列切分；Wan 多模式 warp；FLUX.2-Klein warp；RegionE+Ulysses 完整加速；按注册点排序取代全局 Phase；LoRA 热切换。

> 权威主文档为本外部 PM 文件（仓库内 `docs/v2-pm.md` 已于 2026-07-01 删除）。v2 架构设计见仓库根 `design/`（本地，gitignore）与本笔记 `architecture/`。
