# optkit 知识总结

Last updated: 2026-06-30

## 验证过的命令

- 安装：`pip install -e .`（仓库根目录）。
- 单卡运行（并行自动关闭）：`python examples/v2/qwenimage_edit_full_opt.py`。
- 多卡运行（Ulysses degree = N）：`torchrun --nproc-per-node=N examples/v2/qwenimage_edit_full_opt.py`。
- 批量测试：`bash examples/v2/run_tests.sh {qwen|flux|flux2|wan|all}`（改 `NPROC` 切单/多卡，注释不跑的 `run` 行）。
- 新 pipeline 测试驱动：`examples/v2/run_new_tests.sh`（幂等可断点续跑，需 `PYTHONPATH=/app/optkit`）。
- v1 测试（从 `test/` 目录跑，用相对导入）：`cd test && python test_runner.py`；单模型 `python fluxkontext_test.py`。
- 质量度量：`cd test && python quality_metric.py && python generate_reports.py`。
- 开关方式（环境变量覆盖代码默认）：`OPTKIT_SAGE / OPTKIT_FP8 / OPTKIT_COMPILE / OPTKIT_DICACHE / OPTKIT_REGIONE / OPTKIT_PARALLEL`（1/0）；参数 `OPTKIT_MODEL / OPTKIT_INPUT / OPTKIT_STEPS / OPTKIT_SEED / OPTKIT_THRESHOLD`。
- 性能测试：`OPTKIT_RUNS=2`，**compile 计时取第二遍**（第一遍含编译开销）。

## 架构与结构

### v2 框架（三层 + 一契约）

```
用户 → OptKitConfig(specs)         # 描述意图，无逻辑 (config/specs.py)
        │ apply.py: spec→component
        ▼
     OptComponent（能力插件）        # sage/quant/compile/parallel/cache/regione
        │   ↕ register/trigger hooks
     OptKitContext（冻结契约）        # 分发原语 + 命名生命周期 + 跨组件引用 (core/context.py)
        │   ↕ warp 经 trigger 发出 hook
     warp（模型侧）                   # 替换 transformer.forward + attn processor (warps/*.py)
```

- `config/specs.py`：各能力 Spec dataclass（纯意图 + 参数校验）。
- `config/__init__.py`：`OptKitConfig` 顶层容器，`__post_init__` 做跨能力约束校验，`specs()` 收集启用项。
- `core/context.py`：`OptKitContext` —— **冻结契约**：分发原语 `register/trigger` + 命名生命周期糖 + `regione/parallel` 跨组件引用槽。
- `core/order.py`：`HOOK_ORDER` —— **顺序唯一事实源**：每个注册点显式列出参与 component 的 fold 顺序。
- `core/component.py`：`OptComponent` 基类 + `attach` 生命周期。
- `apply.py`：spec→component 派发 + 单趟 attach + warp + `on_pipe_ready` 触发。
- `warps/transformers/`：transformer 级 warp（forward + attn processor，按 diffusers transformer 模型一文件）。
- `warps/pipelines/`：pipeline 级 warp（`__call__` 镜像 + 注册，按 pipeline 类名注册到 `_registry`，import 即注册）。
- `components/`：sage / quant / compile / parallel / cache（含 regione）各能力实现。
- `runtime/lora.py`：`replace_lora` 量化/编译后热切换 LoRA。

### v1 结构（并行保留）

- `optkit/optimizers/`：每模型一个 `opt_xxx.py`，固定应用顺序 **sage → fp8 量化 → torch.compile → dicache/magcache**。
- `optkit/components/`：sageattention / dicache / magcache / quantization / lora_replace。
- 入口 `apply_opt_to_xxx_pipe(pipe, opt_config)`，`@optimize_once_only` 装饰；`XxxOptConfig(OptConfig)` 配置。

## 约定

- **思考用英语，回应/文档一律中文**（用户全局要求）。
- 代码简洁实用、模块化、合理用设计模式、注重解耦；第一性原理：目标/动机不清就停下讨论。
- **优化应用顺序敏感**：v1 硬编码 sage→fp8→compile→cache；v2 把顺序事实源放在 `core/order.py` 的 `HOOK_ORDER`，按「注册点」排序而非全局优先级（同两 component 在不同 hook 可能需相反顺序），未登记的 (注册点, component) 直接报错。
- **延迟 pipe 变换到 `on_pipe_ready`**：quant 改权重 → compile 编 graph → regione 换 scheduler，统一在 warp 替换完 forward 后按序执行，故 attach 顺序无所谓。
- **transformer 不做 offload**：torchao 量化张量与 accelerate 跨设备不兼容，且反复 CPU↔GPU 搬运严重拖慢；显存不足靠 FP8 量化缩到常驻。text_encoder 可 `apply_group_offloading(..., offload_type="leaf_level")`，vae 留 GPU。
- **compile 测试必须跑两遍**：第一遍含编译开销，计时/对比结论取第二遍稳态。
- compile 产物缓存默认 `/app/cache/torch_inductor`；生产部署测好后打包 `cache.tar` 随镜像下发。

### 跨能力约束（`OptKitConfig.__post_init__` 强校验）

- RegionE **不支持** Ring attention（ring 的 seq-partition K/V 与 RegionE 全局 cache 不兼容）；只能 `ulysses_degree>1, ring_degree=1`。
- RegionE + Ulysses 必须 `ulysses_anything=True`（Qwen txt/img 序列不保证整除 cp_size）。
- RegionE + compile 强制 `dynamic=True`（partial step 变长序列，否则 dynamo 反复重编译）。
- `cp_degree (= ulysses×ring) <= world_size`。

## 排查

| 问题 | 现象 | 原因 | 解决 |
| --- | --- | --- | --- |
| RegionE 底部花屏 | 图像底部噪声块 | `n_noise > n_cond` 时尾部 token 孤儿化 | 已修（commit 2706b34） |
| Wan A14B OOM | 显存爆 | 双 14B 专家未量化 | 必须 `OPTKIT_FP8=1` + `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` |
| flux-kontext RegionE 无 partial 区间 | RegionE 不加速 | `warmup_step+post_step >= STEPS` | `OPTKIT_STEPS=28`（>10 才有 partial 区间） |
| Wan TI2V-5B i2v 花屏 | i2v 输出花屏 | diffusers 0.38 原生缺陷（非 optkit） | 等 diffusers main；默认不跑 |
| 重复 apply_warp | RuntimeError | 同一 transformer 已 warp | 复用 `pipe._optkit_ctx`，勿二次调用 |
| CP + true CFG latent NaN | 全黑图 | CFG 两分支 txt 长度不一致（CP all_to_all split sizes 变化） | 负 prompt pad 同长 / `true_cfg_scale=1.0` |
| 机器重启后失联 | pod 清盘只留 /app/czy5 | — | `am key-register` 重注公钥 + `restore_env.sh` + 重传 /app/optkit |

## 调查结论

- **CP 数值已验证**：重构后 ulysses/ring 真机忠实；v1/v2 量化产物不可混用。
- **ring 关 sage 缺口已修**：加 `native_attention_kernel`，ring 关 sage 也能跑（SSIM 0.99）。
- **DiCache/MagCacheContext 已迁入 v2 正本**：切断最后 v1 依赖；magcache cfg+校准接线完成；v1↔v2 逐位一致。
- **稳态零重编有效**：开 compile 项 warmup 内有重编（fp8 权重类型 guard + cfg cond/uncond 两种序列长），run2~4 稳态零重编；4 跑丢首跑取后 3 均值方案有效。
- **t2i 类任务 SSIM 对基线仅弱参考**：无参考图锚定，fp8/sage 数值微差经多步纯生成放大为构图漂移（qwen t2i sfc 0.51 但出图干净）；质量结论必须看图 + 对 sfc 算 SSIM。
- **跨次跑基线自漂移 ~0.97**：SSIM 对比须同次跑内看。
- **dicache 不标定、magcache 才标定**：magcache 的 `mag_ratios` 是离线逐步幅值表，表长须 == `num_steps`，故其 cell 步数钉到标定步数（改不得）；dicache 是 `rel_l1_thresh` 阈值自适应，任意步数可跑，应跟随 group 步数。已修正（commit 50c84ae，v1+v2 对称）：dicache 不再钉步数、配置不写 `num_steps`（回落 28 默认 + 运行时注入），magcache/regione 仍钉。踩坑点：旧 `flux2_klein/dicache` 曾写死 50，被当校准钉到 50 步。
- **auto_test 配置归一**：v1/v2 各持一份同构单文件 —— `auto_test/config/optcfgs_v1.yaml`（v1 扁平 flag）/ `optcfgs_v2.yaml`（v2 spec 片段），结构均为 `atoms:` 共享 + `models:` 每模型片段，按 `models.<model>.<atom>` 覆盖 `atoms.<atom>` 合并（commit 56bce5c，废弃旧散落 JSON 目录）。magcache 标定数据由 `calibrate` 产到 `config/calibration/` 暂存后人工并入两份 yaml。
- **v1 测试真机验证通过（4 模型 @5090 32G）**：归一 `optcfgs_v1.yaml` 加载、dicache 步数跟随、**noopt 退 fp8wo 兜底**（纯 bf16 在 32G 会 OOM，故 v1 noopt 也镜像 v2 退 fp8-weight-only，commit af3eaf4）均生效；noopt 峰值 flux_kontext 22.7 / flux2_klein 26.3 / qwen 21.2 / step1x 22.9 G，dicache 加速 qwen 2.48× / flux2_klein 1.60×。调度器默认用满全部卡 + 每 job 独立 log（`_logs_<run_id>/`，commit 6788e3c）。**v1-on-32G 限制**：v1 引擎无 Option B（v2 step1x 在「降噪+vae decode」期临时 offload te 的机制），故 v1 step1x **dicache** 在 decode 峰值点叠 cache 大概率 OOM —— v1 step1x 在 32G 仅 noopt/headline 稳妥，cache 项需更大显存或等 v1 引入等效 offload。

## 决策（ADR 摘要）

- ADR-001：v1 优化顺序硬编码/能力耦合 → 改为 component + context hook 框架（能力解耦、任意组合、模型只写 warp）。
- ADR-002：同两 component 在不同 hook 需相反顺序 → 按「注册点」排序（`HOOK_ORDER` 唯一事实源），废弃全局 Phase。
- ADR-003：顺序敏感的 pipe 变换 → 延迟到 `on_pipe_ready` 统一按序 fold（quant→compile→regione 固定）。
- ADR-004：RegionE 与 Ring attention 禁止共存，config 层报错（算法不兼容）。
- ADR-005：CP 切分单位=自注意力序列，下沉到 transformer 级，self/cross 两模式，支持不均匀切分。

## 环境与运行约束

- 测试环境：远程 4×RTX5090（sm_120，SageAttention 2.2，32G/卡），模型权重在 `/app/model/...`。
- 依赖：`diffusers >= 0.35.0`（强校验）、torch、torchao、`sageattention`（可选）；测试机 transformers 须 pin 4.57.1。
- 双 14B FP8（Wan A14B）需 `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` 防碎片 OOM；A14B 双专家必须 `OPTKIT_FP8=1`。
- 验收标准：v1↔v2 等价回归 **PSNR>50dB**（sage+quant+compile）；多卡 CP 加速正确；各模型实跑产图无明显质量退化。

> 仓库内权威开发文档：`docs/v2-pm.md`、`docs/dev-new-optimizer.md`、`docs/v2-regione-design.md`、`docs/v2-regione-cp-design.md`、`docs/dynamic-num-steps-and-pipeline-hooks.md`、`docs/v2-lora-swap-testing.md`。
