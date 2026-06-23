# Bug 修复报告：qwen t2i + ulysses4 + true CFG → latent NaN 全黑图

- **报告日期**：2026-06-22
- **定位人**：Claude（czy 协助，4×RTX5090 测试机 czy5-machine-20260622154105）
- **状态**：✅ 根因已确认（真机复现 + 隔离验证）；✅ 修复 A 已落地（`examples/v2/qwenimage_t2i_full_opt.py` 改 weight-only）+ 已记录现象（`docs/qwenimage.md`）
- **严重度**：中（仅触发于 t2i + CP + true-CFG 组合；有临时规避；不影响 qwen-edit 系）
- **关联**：`reports/qwen_t2i/optkit-v2-qwen-t2i-test.md`（原异常分析）、`reports/qwen_t2i/probe/`（原隔离矩阵）

---

## 1. 现象

`QwenImagePipeline`（文生图）在 **ulysses_degree=4 + true CFG（true_cfg_scale>1）** 下，
降噪 latent 在第 0 步负分支中部 block 出现 NaN，污染全部后续步，VAE 解码
`image_processor.py: invalid value encountered in cast`，输出全黑图。

触发条件（原隔离矩阵已锁定）：
- ws=4 触发，**ws=2 不触发**
- CFG 两分支 txt 序列长度**不一致**时触发（负 prompt `" "` ≈ 5 token vs 正 prompt ≈ 77 token）
- `samelen`（负=正同长）不触发；`nocfg`（true_cfg=1.0 单 pass）不触发
- `nosage` / `nocompile` 仍触发 → 与 sage / compile 无关
- `longneg`（负 prompt 换 ~12 token）仍触发 → 与"空分片"无关

---

## 2. 根因（已确认）

**`OptKitConfig.quant` 的 `dtype="float8"` 映射到 torchao 的
`Float8DynamicActivationFloat8WeightConfig()`，即「动态激活 fp8 量化」（不是 weight-only）。
其默认 granularity = `[PerTensor(), PerTensor()]`：每次 Linear 前对激活按
`scale = amax(activation) / 448` 现算 per-tensor 缩放。**

**在 Ulysses CP 下，txt（encoder_hidden_states）在进入这些 fp8 Linear 投影之前，
就已被 SequenceDispatcher 按序列维切到 1/cp_size。** 负分支短 prompt 时，每 rank 只分到
**1~2 个 txt token**，于是 per-tensor 激活 amax 是在「极小、被离群值主导」的切片上计算的，
得到的 scale 退化（趋零 / 被单一极端离群值主导），在 Qwen 著名的"激活离群值"
（残差流量级可达 1e6~1e7）上跨 60 层复合放大，最终溢出为 NaN。

NaN 始终**首现于 `enc`（txt 残差流）**，再经 joint-attention 扩散到 img——与"txt 投影的
激活量化是触发源"完全吻合。

### 控制变量 = 量化 scope 的 token 数（真机决定性证据）

| 配置 | 激活量化 scope | 结果 |
|---|---|---|
| ws=1, per-tensor | 全 txt 序列（≈5 token） | ✅ 干净（即使 enc 幅值同样达 2.4e7） |
| **ws=4, per-tensor** | **1~2 token / rank** | ❌ **NaN**（blk09 enc 首现，rank3 单 token） |
| ws=1, **per-row** | 每 token 各 1 scope | ❌ NaN（blk05 enc 首现）——证明与 CP 无关，是 scope 太小 |
| ws=4, **per-row** | 每 token 各 1 scope | ❌ NaN（更早，blk08，全 4 rank） |
| **ws=4, weight-only（无激活量化）** | —— | ✅ **干净，全 4 rank 零 NaN** |

- **scope 越小越易失败**：全序列 ✅ → 1-token 分片 ❌ → per-token ❌（连单卡都 ❌）。
- **幅值不是主因**：ws=1 干净时 enc 也达 2.4e7，与 ws=4 同量级。
- **weight-only 彻底消除**：去掉激活量化即根除（见 §4 验证）。

### 为什么各触发条件都对得上

- **ws=2 不触发**：txt 切到 2~3 token/rank，scope 仍够大，amax 不退化。
- **samelen / nocfg 不触发**：负分支也是 77 token（或只跑正分支），分片后每 rank 仍有
  ~19 token，scope 健康。
- **nosage / nocompile 仍触发**：根因是 fp8 激活量化，与二者正交。
- **qwen-edit / edit_plus 不受影响**：负分支含 vision token，txt+vision 序列长，
  4 路分片后每 rank 仍有足够 token，scope 不退化。
- **此前从未被发现的原因**：Qwen-Image ≈20B，bf16 ≈40GB，32GB 卡上**不开 fp8 必 OOM**，
  所以"关掉 fp8"这条隔离在全模型上根本走不通，fp8 始终是所有 NaN 探针里的隐藏公共变量。

### 不是什么（已排除）

- **不是通信层**：独立单元探针（`probe_ulysses_comm.py`，纯 torch，无模型/fp8）在
  同进程内交替跑 branch0(长 txt)/branch1(短 txt) 共 6 轮，`ulysses_scatter→gather`
  往返**逐位可逆（err=0.0000）**，完整 ulysses joint-attention 数值与单卡 SDPA 参考一致，
  零 NaN。即用户最初怀疑的"all_to_all split sizes 变化的通信层行为"**已证伪**。
- **不是 txt 切分策略错误**：核实 diffusers 源码 `transformer_qwenimage.py` 的 `_cp_plan`，
  它同样把 `encoder_hidden_states`（txt）按 `split_dim=1` 切分（`hidden_states` 也是），
  并支持 "Ulysses Anything" 非整除变长——**与 optkit 完全一致**。切 txt 是标准 Ulysses 做法，
  非 optkit 偏差。
- **不是镜像层 / rotary / mask**：weight-only 同走这些路径却干净。
- **不是 head padding**：Qwen num_heads=24，÷4=6 整除，无 head pad。

### 等价性边界（关键认识）

Ulysses **理论等价，但等价性只覆盖模型本身、不覆盖 per-tensor 动态激活量化**：

- 投影 / norm / MLP 逐 token 独立 ✅；注意力经 all-to-all 看全序列 ✅ → **模型 partition-invariant**。
  （独立探针 err=0、weight-only 同样切 txt 却干净，双重佐证。）
- 但 per-tensor 动态激活 fp8 的 `scale = amax(本 rank 局部切片)/448` **依赖切片里的 token 集合**，
  是数学上 **partition-variant** 的操作。ws=1 在全 txt 上算 amax（健康）、ws=4 在 1-token 切片上
  算 amax（退化）→ 二者不再等价 → NaN。
- diffusers 不暴露此问题，是因为其 CP 路径未叠加 torchao 动态激活 fp8。
- 所以"关掉激活量化（weight-only）"能让 Ulysses 重新等价——这正是修复 A 的依据。

---

## 3. 修复方案

### ✅ 方案 A（已采用 + 已落地）：Qwen-Image t2i 改用 weight-only fp8

把 Qwen-Image t2i 的量化从动态激活 fp8 改为 weight-only：

```python
# 之前
quant=QuantSpec(enabled=True, dtype="float8")          # = Float8DynamicActivationFloat8Weight
# 改为 (examples/v2/qwenimage_t2i_full_opt.py, 默认即 weight-only, 可经 OPTKIT_QUANT 覆盖对照)
quant=QuantSpec(enabled=True, dtype="float8_weight_only")  # = Float8WeightOnlyConfig
```

- **优点**：真机验证 ws=1/2/4 + difflen 全干净；对 Qwen 的极端激活离群值天然鲁棒
  （per-row 连单卡都 NaN，说明动态激活 fp8 对 Qwen txt 本就脆弱）。权重仍是 fp8，
  显存收益不变（仍能上 32GB 卡）。weight-only 不量化激活 → 与序列划分无关 → 恢复 Ulysses 等价。
- **代价**：激活走 bf16，fp8 matmul 的激活路径加速损失（显存不变，仅 matmul 略慢）。
  对 20B 模型显存是硬约束、激活量化加速增益有限，正确性优先，权衡合理。
- **已落地**：`examples/v2/qwenimage_t2i_full_opt.py`（默认 `float8_weight_only`，
  保留 `OPTKIT_QUANT` env 覆盖以便对照测试）；现象记录于 `docs/qwenimage.md`「已知限制」。
- **范围**：仅 Qwen-Image t2i（`QwenImagePipeline`）。Qwen-Image-Edit / Edit-Plus 不改
  （负分支含 vision token，序列长，分片后 amax scope 仍健康，动态激活 fp8 实测正常）。

### 方案 B（保速度，建议后续验证）：仅对 txt 投影层跳过激活量化

NaN 始终源自 txt 残差流，且 txt token 数极少（激活量化对其几乎无加速收益）。
可把 Qwen 的 txt 相关 Linear（`add_q_proj/add_k_proj/add_v_proj/to_add_out` 及 txt MLP）
加入 `module_skip_keys_dict["QwenImageTransformer2DModel"]` 的 skip 列表（保持 weight-only/bf16），
大序列的 img 路径仍走动态激活 fp8 保留加速。需真机验证后采用。

### 方案 C（理论最干净，重，未采用）：激活 scale 用全局 amax

让动态激活量化的 amax 跨 CP rank **all-reduce 成全局**（等价于 ws=1 的 per-tensor scope），
即可恢复"Ulysses + 动态激活量化"的**严格等价**并保留激活量化加速。代价：每个 fp8 Linear
多一次 all-reduce 通信，且需改 torchao 量化张量的 scale 计算路径，工程量大、风险高。
另可叠加 min-scale 保护 / `activation_value_lb`（amax≈0 时防 scale 趋零）。作为后续研究项。

### 临时规避（原报告已记录，仍有效）

- CP + t2i 下把负 prompt embeds **pad 到与正分支同长**，或
- CP 下用单 pass（`true_cfg_scale=1.0`）。

---

## 4. 修复验证

真机 4×RTX5090，ws=4 + true_cfg=4.0 + 负 prompt `" "`（difflen），`float8_weight_only`：

- 细粒度埋点（逐 block attn/out 的 max|.| 与 NaN 计数）：**全 4 rank 零 NaN**，
  txt 残差流保持有界（rank3 blk09 enc 8.8e6，不再溢出）。
- 全 20 步出图：mean=38.85 / std=47.29（非黑图），内容正确——"Qwen Coffee" 咖啡店招牌、
  暖光，与 prompt 一致。见 `fix_ws4_weight_only.png`。

---

## 5. 复现与取证资产（测试机 `/tmp/`，机器重启即失）

- `probe_ulysses_comm.py` —— 通信层独立单元探针（证伪通信假设）
- `repro_qwen_nan.py` —— 全模型复现 + 逐 block 埋点（支持 `OPTKIT_QUANT` =
  `float8` / `float8_weight_only` / `float8_perrow`；`OPTKIT_STEPS`）
- 部署：`/app/czy_optkit/`（optkit_v2 + examples，scp tar 部署，机器无 git）
- 环境：python3.10 + torch 2.10.0+cu128 + diffusers 0.38.0 + transformers 4.57.1 +
  torchao 0.17.0；模型 `/app/model/Qwen-Image`

> 注：torchao 0.17 在 torch 2.10 下报 "Skipping cpp extensions（需 torch≥2.11）"，
> 但 fp8 量化（torch 原生 fp8 dtype）正常工作，不影响本次结论。
