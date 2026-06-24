# optkit 项目管理

Last updated: 2026-06-15

## 概述

- **optkit**：面向生产部署的 diffusion 推理优化工具包，把 SageAttention / FP8 量化 / torch.compile / 步级缓存（MagCache/DiCache）/ 并行（Ulysses+Ring CP）/ RegionE 等手段封装为可调用的优化能力。
- **v1**：按「每模型一个 opt 文件」组织（`optkit/optimizers/`），优化顺序硬编码、跨能力耦合，新增模型/能力成本高。仍并行保留，不被替换。
- **v2（当前主线）**：把优化能力重构为**可组合 component 框架**——优化手段解耦为独立插件，模型侧只写 warp（替换 transformer.forward + attn processor），二者通过 `OptKitContext` 的 hook 契约交互。统一入口 `apply_warp(pipe, config)`（warp 按 pipe 类名自动解析）。
- 工作目录 `/Users/chenzeyang/MTGIT/optkit`，git 主分支 `master`，开发分支 `v2`。

## 当前状态

- **版本**：v2 开发分支（`v2`），未发版。
- **阶段**：核心框架契约已冻结；6 类 component + 多模型 warp 已接通；处于「权重/性能收口 + 缺陷修复」阶段。
- **当前焦点**：5 个新 pipeline 已 GPU 实测通过；Wan 全路径权重验证收口；补 v2 用户文档。
- **当前能力**：
  - 模型 warp：Qwen-Image-Edit、Qwen-Image-Edit-2509（Plus 多图编辑）、Qwen-Image（t2i）、FLUX.1（t2i / Fill / Inpaint / Kontext）、FLUX.2-Klein、Wan（i2v / t2v / ti2v / VACE）。
  - 优化 component：SageAttention、FP8/INT8 量化、torch.compile（区域编译）、并行（Ulysses + Ring CP，支持不均匀序列切分）、步级缓存（DiCache / MagCache）、RegionE（编辑区域感知加速 + AVDCache）。
  - 运行时 `replace_lora` 在 sage/fp8/compile 之后热切换 LoRA，不触发重编译。
  - RegionE 仅适用序列级参考拼接的编辑 pipeline（Qwen-Edit / Kontext / FLUX2-Klein / edit_plus）；t2i / Fill / Inpaint 在 apply 时报错拦截。

## 进行中 / 活跃任务

- M4 收口：Wan t2v/ti2v/VACE「盲写」warp 的真实权重验证；性能基线报告归档。
- 跟进遗留缺陷：qwen t2i + ulysses4 + true CFG 的 latent NaN（见下）。

## 需求待办

| ID | 日期 | 需求 | 状态 | 优先级 | 模块/范围 | 下一步 / 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-20260624-autotest-v1v2-modular | 2026-06-24 | autotest 改造为模块化测试引擎，支持分别测 v1 / v2，各有 full 与 smoke | implementing | 中 | `auto_test/`（不动 optkit/optkit_v2 本体） | Design: architecture/modules/auto-test/changes/2026-06-24-v1v2-modular-engine.md（accepted）；TDD 实施中；矩阵清单与判断器逻辑见设计「开放问题」，本轮收口 v2 full |

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
- M5 发版（v2 README + 各模型 doc + 迁移说明）— **待开始**

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

> 原导读 `v2-architecture.md` 保留为面向新同学的代码导读；上表为模块化基线设计文档（由 pm-document-architecture 维护）。

## Todo

- [ ] Wan t2v/ti2v/VACE 真实权重验证收口
- [ ] qwen t2i u4+CFG NaN 缺陷定位（怀疑 all_to_all split sizes 变化的通信层行为）做 bug 定位，需要确定错误原因，修改的方案，输出一个bug 修复报告到 PM/optkit/bugs/下面
- [ ] 接入 autotest 做出版本的测试
- [ ] 性能基线报告归档（M4 交付物）
- [ ] 补齐 v2 用户文档：README + 各模型 doc + v1→v2 迁移说明（M5）

## 阻塞与风险

- **Wan t2v/ti2v/VACE「盲写」路径**：真实权重下可能产图错误，需补权重验证（M4）。
- **依赖 diffusers 内部私有 API**（`_modeling_parallel` / `_cp_plan` / `dispatch_attention_fn`）：上游升级可能 break；已强校验 `diffusers >= 0.35`，需关注上游。测试机 transformers 须 pin 4.57.1。
- **`OptKitContext` 契约被随意改**：跨组件交互失稳；已约束「修改=契约变更需评审」。
- **缺 v2 用户文档**：外部接入成本高，M5 补齐。
- **已知缺陷（待跟进）**：
  - **qwen t2i + ulysses4 + true CFG → latent NaN 全黑图**：触发=CFG 两分支 txt 长度不一致（ws=2 / nocfg / samelen 不触发；已排除 sage/compile/镜像层）。NaN 首现负分支中部 block（blk9/10）。规避：负 prompt embeds pad 到与正分支同长，或 `true_cfg_scale=1.0`。qwen edit 系不受影响。复现资产 `reports/qwen_t2i/probe/`。
  - **DiCache 阈值须逐任务标定**：qwen-edit 0.08 / qwen t2i 0.04 / flux2 0.04 / flux 0.08。t2i 类任务对基线 SSIM 仅弱参考（无锚定，漂移地板 ~0.5），质量结论须看图 + 对 sfc 算 SSIM。
  - **A14B（wan-t2v/i2v）四卡 OOM**：双 14B 专家 fp8 常驻 ~26G，CP 切序列不切权重，每卡 >32G。需 ≥48G 卡或对双专家做权重切分；单卡可用。
  - **qwen 单卡 regione OOM**：20B+regione 的 KV 在 1024 分辨率单卡 32G 放不下；四卡（序列切分）OK。
  - **qwen ring/混合并行 SSIM 偏低**：ring4=0.70、u2r2=0.58，而 ulysses4=0.88（flux-kontext ring4=0.97≈ulysses4）→ qwen 专属 ring attention 数值漂移，非系统性。排查方向：qwen ring 路径 RoPE / attention。
  - **Wan TI2V-5B i2v 花屏**：diffusers 0.38 原生缺陷（非 optkit），需 diffusers main；默认不跑。
  - **wan-i2v 未跑通**：测试机离线缺 `ftfy`（diffusers WanI2V prompt_clean 需要）。

## Recent Updates

- 2026-06-24 - 设计 accepted + 开工：REQ-20260624-autotest-v1v2-modular 设计经用户认可标 accepted，入口定 `run <plan>.yaml`、v1 置卡 CPU 量化→搬卡（后端自带策略）；进入 TDD 实施（TestPlan→V2Backend 等价回归→V1Backend→执行本体贯穿）。需求 → implementing。
- 2026-06-24 - pm-design-requirement：REQ-20260624-autotest-v1v2-modular 转设计，归入候选模块 auto-test，产出变更设计 `architecture/modules/auto-test/changes/2026-06-24-v1v2-modular-engine.md`（proposed）；核心：engine 设为 per-run 单一（v1/v2 量化不可混用）、可序列化 TestPlan 作三层契约、模型适配器⟂引擎后端策略、full/smoke=profile 与 engine 正交。需求状态 → designed。
- 2026-06-24 - pm-record-requirement：记录 REQ-20260624-autotest-v1v2-modular（autotest 模块化为判断器/适配器/执行本体三层，`--engine v1|v2` 写进生成 yaml，分别测 v1/v2 各自 full/smoke），状态 ready-for-design；详见「需求待办」。
- 2026-06-24 - pm-document-architecture：把 `v2-architecture.md` 导读重组为标准模块化设计文档（`architecture/main-design.md` + 5 个 modules/），按仓库实际目录与注册表核对、补入 Step1X-Edit（已 13 个注册 pipeline）；原导读保留。设计文档索引见上「设计文档」节。
- 2026-06-15 - 创建本项目记忆笔记；归档 v2 当前状态。
- 2026-06-12 - 4×RTX5090（机器 4860）实测 5 个新 pipeline（qwen t2i/edit_plus、flux t2i/fill/inpaint）× (baseline/sfc/+dicache/u4) 全矩阵：flux 三 pipeline SSIM 0.88~0.99 全过；qwen edit_plus **regione 首次实测通过**（u4+regione 8.36×，SSIM 0.90）；稳态零重编。遗留 qwen t2i u4+CFG NaN。报告 `reports/{qwen_t2i,qwen_edit_plus,flux_t2i,flux_fill,flux_inpaint}/`。
- 2026-06-09 - 4×RTX5090 全模型×8项矩阵实测（qwen-edit/flux-kontext/flux2-klein/wan）：稳态零重编；加速比 flux-kontext+dicache 4.92×、flux2+dicache 3.43×、qwen u4+regione 4.14×、wan-ti2v(5B) u4 1.74×。
- 2026-06-03 - run_tests.sh flux-kontext 固定 STEPS=28；修 RegionE 尾部 token 孤儿化花屏（commit 2706b34）。
- 2026-05 - 统一 CP 不均匀序列切分；Wan 多模式 warp；FLUX.2-Klein warp；RegionE+Ulysses 完整加速；按注册点排序取代全局 Phase；LoRA 热切换。

> 详细主文档（仓库内权威源）：`docs/v2-pm.md`。
