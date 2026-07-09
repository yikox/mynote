# 缺陷定位报告：CP(ulysses)×fp8×compile 在 torch 2.9.1 上的 FakeTensor guard 崩溃

- 日期：2026-07-02
- 状态：**已定位，修复已验证**（修复=CI 测试机镜像升级 torch 2.10，已交由其他会话落地）
- 严重性：高（CI smoke 全 runner 失败；compile+sage+quant+ulysses4 是发布主推优化路径）
- 发现渠道：REQ-20260702-autotest-workflow-align 修通 CI 链路后的首轮 smoke（e2e 验证时抓到）
- 定位方法：systematic-debugging；调试机 2 台（4×5090，分别为 torch 2.9.1 / 2.10 镜像），9 组对照实验 + dynamo 源码探针

---

## 1. 现象

CI smoke（judge defaults 兜底 cell：`flux2_klein × compile+sage+quant × ulysses4 × 1024 × 28step`）3/3 runner（result/speed/memory）全部失败：

```
RuntimeError: Cannot access data pointer of Tensor (e.g. FakeTensor, FunctionalTensor).
If you're using torch.compile/export/fx, it is likely that we are erroneously tracing
into a custom kernel. To fix this, please wrap the custom kernel into an opaque custom op.
```

- 失败环境：镜像 `mcr.meitu-int.com/mtlab/py310-cu128-torch291-ubuntu2204:2.4.0`（**torch 2.9.1**）、torchao 0.17.0、diffusers 0.38.0、transformers 5.12.1（env.sh 浮动最新）、sageattention 2.2.0、optkit d7eccf28
- load_pipe / apply_warp 正常，**denoise 第 0 步即挂**；4090 与 5090 均复现（与 GPU 架构无关）
- 复现批次：CI `8a0c304f`、`d7eccf28`；报告与完整日志：`/app/czy5/optkit-test-results/pre/{8a0c304f,d7eccf28}/`

## 2. 关键证据一：完整 traceback（NAS `_logs_*/job_000_*.log`）

错误**不在 sage、不在任何 kernel**，而在 dynamo **创建 guard** 时：

```
torch/_dynamo/guards.py:2096, in TENSOR_SUBCLASS_METADATA_MATCH
    original_metadata = deepcopy(self.get(guard.name).__tensor_flatten__()[1])
  → copy.deepcopy 递归（_reconstruct → state → dict → … → list）
  → torch/_tensor.py:165, in __deepcopy__
    or (type(self) is not Tensor and self.data_ptr() == 0)
RuntimeError: Cannot access data pointer of Tensor (FakeTensor)
```

- 被 guard 对象：`L['___stack0']` / `L['args'][1]`（graph break 后 resume frame 的栈值/入参）
- 出错帧：`[12/1_1]`（frame 12 的第 2 次编译），denoise 第 0 步，4 个 rank 全部命中
- **错误信息里 "wrap into opaque custom op" 的建议是误导**——optkit v2 的 sage 本来就包成了 opaque custom op（`torch.ops.optkit_sage.sage_attention`，带 register_fake）

## 3. 关键证据二：判别实验矩阵

调试机 5161（4×RTX5090，与 CI 同镜像 torch 2.9.1，同 tar `auto_test-d7eccf28.tar`、同 env.sh 流程，完全复刻 CI 环境）：

| # | 配置 | 结果 | 结论 |
| --- | --- | --- | --- |
| A | compile+sage+quant，**单卡** | ✅ 通过（rc=0，稳态 2.47it/s，零错误） | **同环境单卡正常 → 证伪"torch 版本单因子"，锁定 CP 路径** |
| B | compile+sage+quant，**ulysses4** | ❌ 复现（4 rank 全中同款 guard 错误） | 确定性复现基准 |
| C | compile+quant，ulysses4（**摘 sage**） | ❌ 照崩 | **sage 彻底无罪** |
| D | compile+sage，ulysses4（**摘 quant**） | OOM（9B bf16 装不进 32G，quant 本就是前提） | 无信息量 |
| C2 | C + dynamo guards.py 探针 + TORCH_LOGS=graph_breaks | 抓到被 guard 对象与 break 位置 | 见 §4 |
| C4 | C + 逐字段 deepcopy 探针 | 抓到崩溃字段 | 见 §4 |
| C5 | C + `CompileSpec.dynamic=False` | ✅ 通过（avg 11.46s ×3） | 反证 SymInt 是必要条件（该方案因多分辨率重编代价被否决，未采用） |

另：sage 两个 whl（默认 vs torch210）解包 diff——Python 层几乎相同（仅 sm90 fake 注册函数改名），差异仅 .so ABI 重编 → **sage whl 不是变量**。

## 4. 关键证据三：dynamo 源码探针输出（torch 2.9.1，实验 C2/C4）

给 `torch/_dynamo/guards.py` 的 `TENSOR_SUBCLASS_METADATA_MATCH` 打探针，逐字段试 deepcopy：

```
[DBG-GUARD] name=L['args'][1] cls=torchao.quantization.Float8Tensor
            meta={'block_size': list, 'mm_config': Float8MMConfig,
                  'act_quant_kwargs': QuantizeTensorToFloat8Kwargs,
                  'kernel_preference': KernelPreference, 'dtype': torch.dtype}

[DBG-KEY]  field=block_size type=torch.fx.immutable_collections.immutable_list
           repr=[1, s27, 4096]
           err=Cannot access data pointer of Tensor (FakeTensor...)
```

- 被 guard 的是 **动态量化产生的激活 Float8Tensor**（3 维 `[batch=1, seq=s27, hidden=4096]`，注意不是权重——权重是 2 维静态 `[4096,4096]`）
- 五个元数据字段中**唯一崩的是 `block_size`**：一个含 **SymInt（`s27`）** 的 fx immutable_list
- deepcopy(SymInt) → SymNode → ShapeEnv（`tracked_fakes` 列表持有 FakeTensor）→ `Tensor.__deepcopy__` 调 `data_ptr()` → 崩（与 traceback 的 `dict→dict→list→tensor` 递归形态完全吻合）

graph break 位置（TORCH_LOGS=graph_breaks）：

```
Graph break: skip: from user code at:
  File ".../diffusers/models/transformers/transformer_flux2.py", line 916, in forward
    attention_outputs = self.attn(
```

即：ulysses 的 all_to_all（c10d）不可被 dynamo trace → 2.9.1 把**整个 attn 函数跳过（skip）**、在外层调用处断帧。

## 5. 根因链（四个条件缺一不可）

1. **ulysses CP 的 all_to_all 不可被 dynamo trace** → 每个 flux2 block 在 `self.attn(...)` 处 graph break，block 前后被切成两个 frame；
2. **fp8 动态激活量化**（`Float8DynamicActivationFloat8WeightConfig`）：激活在图内被动态量化为 torchao `Float8Tensor` 子类，作为 resume frame 的入参**跨越 break 边界**；
3. **`CompileSpec.dynamic=None`（自动动态形状）**：首次编译后 automatic dynamic 在第二次编译（`[12/1_1]`）把 seq 维符号化 → torchao 把 `block_size=[1, s27, 4096]`（含 SymInt）写进该激活子类的 `__tensor_flatten__()` 元数据；
4. **torch 2.9.1 dynamo 的 `TENSOR_SUBCLASS_METADATA_MATCH` guard** 对 frame 入参子类做 `deepcopy(metadata)`：deepcopy SymInt 经 SymNode→ShapeEnv.tracked_fakes 触到 FakeTensor → `data_ptr()` → RuntimeError。

推论验证：
- 单卡不崩：无 all_to_all → 无 break → 激活不跨帧 → 不装该 guard（实验 A ✓）
- 摘 sage 照崩：sage 不在链条里（实验 C ✓）
- 强制静态形状不崩：SymInt 不出现（实验 C5 ✓）

## 6. 修复验证：torch 2.10 镜像（机器 5165，4×5090）

镜像 `swr.cn-north-4.myhuaweicloud.com/mtlab/py310-cu128-torch2100-ubuntu2204:2.6.0`，同 tar、同 env.sh 流程（install.sh 按 torch≥2.10 自动选 torch210 sage whl），**torchao 0.17.0 / diffusers 0.38.0 / transformers 5.12.1 与失败环境完全一致，唯一变量 torch 2.9.1→2.10.0**：

```
compile+sage+quant + ulysses4 → status=ok
warmup 132.2s（首编无缓存）  avg 8.22s ×3  零 FakeTensor 错误
```

附带观察：2.10 上 sfc+u4 的 avg 8.22s 优于 2.9.1 上 compile+quant（无 sage）的 11.46s。

## 7. 2.9.1 vs 2.10 差异分析（为什么一个崩一个不崩）

**结论：2.10 并没有修 deepcopy 那个坑，而是 dynamo 的 graph break 分帧方式变了（嵌套 graph break 支持），让"符号形状的量化激活"不再落到被 guard 的位置上。**

三项对照证据（同机同环境，仅 torch 版本不同）：

| 判据 | torch 2.9.1（崩） | torch 2.10.0（过） |
| --- | --- | --- |
| guard 源码 | `TENSOR_SUBCLASS_METADATA_MATCH` 含 `deepcopy(metadata)` | **同一行原封未动**（仅 `guard.name`→`guard` 的 API 微调） |
| SymInt deepcopy | 崩 | **依然崩**——独立实验实证：2.10 上构造含 `tracked_fakes` 的 SymInt，`copy.deepcopy` 报 `Cannot call numel() on tensor with symbolic sizes/strides`。坑还在 |
| graph break 形态 | `skip: from user code at transformer_flux2.py:916 self.attn(...)`——整个 attn 函数被跳过，断帧点在外层 | break 点落在 `torch/distributed/distributed_c10d` **内部**（100 处）——dynamo 2.10 支持嵌套函数内断帧续跑，粒度更细 |
| 被 guard 的子类（探针实测） | `L['args'][1]`/`L['___stack0']` = **激活** Float8Tensor，`block_size=[1, s27, 4096]` 含 SymInt | **72 个 guard 全部**在权重参数（`L['attn']._modules[...]._parameters['weight']`，`block_size=[4096,4096]` 全静态）；**0 个**非权重、**0 个**含 SymInt |
| recompile | `[12/1_1]` 二次编译时 automatic dynamic 把 seq 标 `s27` → 崩 | `[10/1..4]`、`[12/1]` 等 recompile 正常发生（触发条件为 `s_local_all is None` 等常规 guard），不涉及符号形状子类 → 不崩 |

机理：2.9.1 遇到 attn 内不可 trace 的 all_to_all 只能**跳过整个 attn**、在外层断帧——动态量化的激活因此作为入参传给续接 frame，dynamo 对"入参子类"装元数据 guard；automatic dynamic 符号化后 guard 的 deepcopy 撞 SymInt。2.10 能在 `distributed_c10d` 内部断帧，帧边界不同，激活不再出现在被 guard 的入参位置——只有静态形状的权重被 guard，同一段 deepcopy 代码永远碰不到 SymInt。

**重要推论：2.10 是"不再踩坑"而非"填坑"。** 若未来某路径再让符号形状的 tensor 子类成为 frame 入参（例如新模型/新组件引入别的不可 trace 调用 + 动态形状 + 子类跨帧），同款崩溃理论上仍会出现。

## 8. 结论与建议

| 项 | 内容 | 状态 |
| --- | --- | --- |
| 当前修复 | CI 测试机镜像升级 `swr.cn-north-4.myhuaweicloud.com/mtlab/py310-cu128-torch2100-ubuntu2204:2.6.0`（workflows `DEFAULT_IMAGE`；optkit 本体零改动；sage whl 由 install.sh torch≥2.10 阈值自动切换） | 已验证，已交由其他会话落地 |
| 已否决方案 | `CompileSpec.dynamic=False`（虽验证有效，但多分辨率生产场景重编代价大） | 否决 |
| 中期建议 | funcol 化 ulysses（`torch.distributed._functional_collectives.all_to_all_single` 可被 dynamo trace）→ 消除 attention 处 graph break，根子上移除"子类跨帧"的触发面；附带收益：CP 下编译图不再按 block 断裂、每 block 少两次断帧开销 | 待排期 |
| 上游可报 | pytorch：guard `TENSOR_SUBCLASS_METADATA_MATCH` 对含 SymInt 的子类元数据 deepcopy 不健壮（2.10 仍存在，只是不再被触发）；torchao：`Float8Tensor` 把含 SymInt 的 `block_size` 放进 flatten 元数据 | 可选 |
| 回归覆盖 | 本 bug 由修通后的 CI smoke 首次抓到（此前 gpu:1 时 4 卡 item 从未真正跑过）——印证 4 卡回归链路的价值 | — |

## 附录：环境与资产

- 失败环境：torch 2.9.1+cu128 / torchao 0.17.0 / diffusers 0.38.0 / transformers 5.12.1 / sageattention 2.2.0（默认 whl）/ optkit d7eccf28 / RTX 5090 & 4090
- 通过环境：torch 2.10.0+cu128（其余同上，sage 为 torch210 whl）
- CI 日志与报告：`/app/czy5/optkit-test-results/pre/{8a0c304f,d7eccf28}/NVIDIA GeForce RTX 5090/`（`_logs_*/job_000_flux2_klein_compile_sage_quant_ulysses4.log` 为完整 traceback 出处）
- 调试机实验数据：机器 5161（torch 2.9.1，已关）`/root/exp{A,B,DC,C2-C5}.log`、`/root/dbg*/runs.jsonl`；机器 5165（torch 2.10，用毕即关）`/root/exp{B,B2}.log`、`/root/dbgB*/runs.jsonl`——机器销毁后以本报告为准
- 复现最小面：4 卡 + `compile+sage+quant`（或 compile+quant）+ `parallel: ulysses4` + flux2_klein/1024/28step + torch 2.9.1
