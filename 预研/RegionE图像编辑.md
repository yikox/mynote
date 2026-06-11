# RegionE: Adaptive Region-Aware Generation for Efficient Image Editing

> 📌 **TL;DR** — 一个**训练免费**的图像编辑加速框架。**三阶段推理 + 区域感知生成**，将 IIE（Instruction-based Image Editing）速度提升 **2.06-2.57×**，PSNR 仅降 0.2-0.3 dB，**几乎无损**。
>
> **核心思想**：编辑任务中大部分像素其实没变 → 空间上把图分成"编辑区/非编辑区"分开算，用 KV Cache 注入被丢弃的全局信息 → 时间上用速度衰减跳步。

| 属性     | 信息                                                |
| ------ | ------------------------------------------------- |
| **会议** | ICLR 2026                                         |
| **作者** | 复旦大学                                              |
| **代码** | [Peyton-Chen/RegionE](https://github.com/Peyton-Chen/RegionE) |
| **论文** | [arXiv:2510.25590](https://arxiv.org/abs/2510.25590)   |

## 1. 问题与动机

**核心痛点**：现有的 Instruction-based Image Editing（IIE）模型存在严重的计算效率问题——即使只修改图像的局部区域，模型也会对**整个图像**进行统一的去噪生成。编辑区域和非编辑区域在**生成难度**和**计算冗余**上差异巨大，但现有方法忽略这种差异，浪费大量算力在"不需要变"的部分。

**三个关键观察**：

1. **非编辑区**（观察 1）：去噪轨迹近似**直线** → 速度方向恒定，可以在单步中推断多步预测
2. **编辑区**（观察 2）：相邻时间步的速度**方向高度一致** → 可以利用缓存跳步
3. **区域差异**（观察 3）：编辑/非编辑难度本质不同 → 应**区分处理**

> 这三个观察是 RegionE 全部设计的出发点。理解它们就理解了为什么需要 ARP（利用观察 1）、RIKVCache（利用观察 3 的空间差异）、AVDCache（利用观察 2）这三个组件。

## 2. 三阶段架构

| 阶段            | 步数范围            | 步数     | 关键操作                                       |
| ------------- | --------------- | ------ | ------------------------------------------ |
| **STS** 稳态化   | $t \in [T, 16]$  | 6      | 标准去噪 + 缓存所有 KV                            |
| **RAGS** 区域感知 | $t \in (16, 2]$  | 14     | ARP + RIKVCache + AVDCache，step 16 强制刷新     |
| **SMS** 平滑    | $t \in [2, 0]$   | 2      | 完整去噪（质量恢复）                                |
| **总计**        | —               | **22** | （原 28 步）                                  |

**模型特定超参**：

| 模型              | $\eta$ (ARP 分割) | $\delta$ (AVDCache 跳步) |
| --------------- | ---------------- | --------------------- |
| Step1X-Edit     | 0.88             | 0.02                  |
| FLUX.1 Kontext  | 0.93             | 0.04                  |
| Qwen-Image-Edit | 0.80             | 0.03                  |

三阶段的设计逻辑：

- **STS** 阶段不做任何加速，纯粹跑标准去噪——目的是让模型进入"稳态"、建立可信的中间状态。这一阶段也承担**为 RAGS 阶段建立 KV Cache** 的责任（$t=16$ 强制刷新步会一次性建好 cache）。
- **RAGS** 阶段是 RegionE 的主战场，三大组件全部上场：ARP 把图分成两区、RIKVCache 让编辑区在算 attention 时能"看到"被丢弃的非编辑区和指令图、AVDCache 在速度变化小时跳过一些步。
- **SMS** 阶段是"清理"——抛弃 cache、全量 forward，修复分块生成可能留下的痕迹，保证最终输出质量。

## 3. 三大核心组件

### 3.1 Adaptive Region Partition（ARP）— 区域划分

**核心思想**：在 STS 阶段末（step 16），对最终图像做单步估计，比较其与原始图像的相似度，把图像分成"编辑区"和"非编辑区"两个 mask。

**做法（伪代码）**：

```python
# 在 t=16 步执行一次
X̂_0 = X_t16 + v_t16 · (0 - 16)    # 一步欧拉外推到 t=0
mask[i] = 1 if |X̂_0[i] - X_ref[i]| > η else 0
#         ↑ 编辑区 (mask=1)   ↑ 非编辑区 (mask=0)
```

**渲染版公式**：

$$\hat{X}_0 = X_{t_{16}} + v_{t_{16}} \cdot (0 - 16)$$

$$\text{mask}[i] = \mathbb{1}\left(|\hat{X}_0[i] - X_{\text{ref}}[i]| > \eta\right)$$

分割只发生一次（step 16），后续 RAGS 阶段复用。

#### 原理深挖：为什么 $\hat{X}_0$ 的预测误差能定位编辑区？

这要从**去噪轨迹的几何形态**说起。在 DDPM/flow matching 这类迭代去噪模型里，每个像素 $X_t$ 在时间维度上画出一条从 $X_T$（纯噪声）到 $X_0$（清晰图）的轨迹：

- **未编辑区**的轨迹是**近似直线**：这类像素在编辑任务里基本没被改过，模型的"想法"也很明确——保持原样，所以速度 $v_t$ 的方向和大小在整条轨迹上变化很小。
- **编辑区**的轨迹是**曲线**：模型要把原像素"改"成新内容，速度方向在轨迹中段往往会发生旋转、幅度也有起伏。

这一几何差异带来了一个非常实用的推论：**用 $t=16$ 处的速度 $v_{t_{16}}$ 做一步欧拉外推，得到的 $\hat{X}_0$ 在两类像素上表现截然不同**。

| 区域   | $v_t$ 的方向         | $v_t$ 的大小（步幅）     | $\hat{X}_0$ 与 $X_{\text{ref}}$ 的距离 | mask |
| ---- | ----------------- | ----------------- | ------------------------------ | ---- |
| 未编辑区 | 几乎恒定（轨迹是直线）       | 很小（"没什么要降噪的"）     | 极小（落在 $X_{\text{ref}}$ 附近）          | 0    |
| 编辑区  | 持续旋转（轨迹是曲线）       | 较大（"要动很多"）        | 大（飞离 $X_{\text{ref}}$）              | 1    |

> 「差异小」= **方向对 + 步幅小**，两个因素**叠加**的结果，不是单一原因。

#### 自监督特性

这种「误差即定位」是**自监督**的——论文没有用任何 ground truth mask，**预测误差本身**就把 mask 标出来了。所以论文 Figure 5 说 ARP 划出来的区域 "closely match human perception"——**编辑区 = 模型预测不准的区域**，两者是同一回事。这一性质让 RegionE 整个流程无需任何额外标注。

---

### 3.2 Region-Instruction KV Cache（RIKVCache）— 空间冗余优化

**问题背景**：编辑任务中，DiT 正常输入是 $[X_P, X_t, X_I]$（prompt token + 噪声图 token + 指令图 token）。RegionE 在 RAGS 阶段改成 $[X_P, X_{E_t}]$，**完全丢弃**了非编辑区 $X_U$ 和指令图 $X_I$——目的是只算编辑区 token 以加速。但 DiT 的 attention 是**全局 token 交互**的，丢弃会导致编辑区缺乏上下文、偏差累积。

**RIKVCache 的解法**：在 STS 阶段末（$t=16$ 强制刷新步）做一次全量 forward，把 $X_U$ 和 $X_I$ 对应的 K, V 缓存下来；后续 RAGS 步跑编辑区时，attention 时把 cache 拼回去——编辑区"看不到"的全局信息就被接回来了。

#### 三件套设计（RIKVCache 算法的核心）

RIKVCache 的精髓**不是单纯的"用 cache"**，而是把整个 RAGS 步的 DiT 前向**重新设计**成了三件套，缺一不可：

**设计一：只跑 $x_e$**（决定 cache 必要性的前提）

```
正常 DiT:   x_full → DiT(x_full)    # 跑全部 N 个 token
RegionE:    x_e    → DiT(x_e)       # 只跑 rN 个 token（r = 编辑区占比）
```

只跑 $x_e$ 之后，**编辑区自然就"看不到"非编辑区了**——这是 cache 存在的前提。如果还跑全量，cache 也就没必要了。

**设计二：一次性建 cache**（节省"重算"成本）

```
t=16 强制刷新步（必须全量 forward 一次）:
    K_C^U, V_C^U, K_C^I, V_C^I = KV_noedit(x_full)[noedit_mask]
                                       # 截取非编辑区+指令图对应的 K, V 存下来
                                       # 后续 RAGS 步不再算
```

这一步是不可省略的"建索引"成本，但**只发生一次**。

**设计三：attention 时拼接注入**（让 $x_e$ "看得到"非编辑区）

```text
A = softmax([Q_P, Q_E] · [K_P, K_E, K_C^U, K_C^I]ᵀ / √d) · [V_P, V_E, V_C^U, V_C^I]
```

**渲染版公式（RIKVCache 算法的灵魂）**：

$$A = \text{softmax}\left(\frac{[Q_P, Q_E] \cdot [K_P, K_E, K_C^U, K_C^I]^\top}{\sqrt{d}}\right) \cdot [V_P, V_E, V_C^U, V_C^I]$$

这一行就是**整个 RIKVCache 算法的灵魂**：Q 来自 prompt + 编辑区当前状态，K/V 来自四类 token 拼接（prompt + 编辑区 + cache 里的非编辑区 + cache 里的指令图）。

**三件套的逻辑闭环**：

```
设计一（只跑 x_e）
    │  问题：编辑区看不到非编辑区 → 生成不连贯
    ↓
设计二（建 cache 存 K_C, V_C）
    │  问题：怎么让 x_e 看到非编辑区？
    ↓
设计三（attn 拼接）→ 形成闭环
```

#### Cache 里的四类 token 视角

DiT 在编辑任务中涉及**四类 token**，cache 的内容是**精确选择**的结果：

| Token | 含义             | 在 cache 吗         | 为什么                                                |
| ----- | -------------- | ---------------- | -------------------------------------------------- |
| **P** | Prompt（文字指令）  | ❌                | 文字 prompt 参与 Q 计算但不存——它本身就是编辑任务的输入，不存在"上下文丢失"问题       |
| **E** | Edited region | ❌                | **每步都在变化**（去噪过程），缓存没意义                              |
| **U** | Unedited region | ✅ $K_C^U, V_C^U$ | 空间邻接上下文（边缘延伸、纹理连续、阴影一致）                              |
| **I** | Instruction image | ✅ $K_C^I, V_C^I$ | **全局风格锚点**（整体色彩、构图、风格保持）                              |

**为什么 I 也要存**（一个常被忽略的关键设计）：编辑区只跑 $x_e$ 后，会丢失"原图整体长啥样"的参考。比如把一只猫改成狗，只看 U（猫周围的草地）可能生成一只写实狗，但原图是卡通风格——应该生成卡通狗。I 提供了这个"全局风格锚点"。论文公式 6 明示了 I 的存在，是 RegionE 设计中容易被忽略但关键的一环。

#### 位置编码适配性——"训练免费"能 work 的隐藏前提

DiT 用 RoPE（旋转位置编码），K 矩阵里**嵌入了相对位置**。$K_C^U$、$V_C^U$、$K_C^I$、$V_C^I$ 都保留原图 token 的**原始位置信息**。

当拼接做 attention 时：

- $Q_E$（编辑区当前位置）· $K_C^U$（非编辑区原位置）→ 相对距离**自动算出**
- **不需要任何位置对齐处理**

| 位置编码方式                       | 在 K_V 里的体现            | 拼接时是否需要处理     |
| ---------------------------- | --------------------- | ------------ |
| **RoPE**（现代 DiT 主流）          | K 矩阵里嵌入了相对位置          | ❌ 不需要        |
| 2D 正弦 / Learned PE          | 加在 token embedding 上 | ❌ 不需要        |
| **ALiBi**（线性偏置）              | attention score 后加偏置 | ⚠️ 需要扩展 bias 表 |

> 现代 DiT（FLUX、Qwen、Step1X）几乎都用 RoPE，所以 RegionE 不用特殊处理位置编码——**这是它能"训练免费"的隐藏前提**。

#### Cache 刷新机制

cache **不是永久有效**——编辑区在去噪过程中 K_V 会缓慢变化，cache 用久了会"漂移"（编辑区看到的非编辑区"印象"还是几帧前的，实际当前可能略有不同，累积起来就失真了）。

RAGS 阶段需要**周期性强制刷新**：

| 时机              | 缓存操作       | 说明                            |
| --------------- | ---------- | ----------------------------- |
| **STS 末（t=16）** | 建 cache    | 首次强制刷新步，全量 forward，截取 U/I 的 KV |
| **RAGS 加速步**    | 用 cache    | 只跑 $x_e$，拼接 $K_C^U$、$K_C^I$   |
| **RAGS 强制刷新点**  | 刷新 cache  | "重置" cache 到当前真实状态（防漂移）      |
| **SMS（t=1, 0）** | 抛弃 cache  | 全量 forward，消除分块痕迹              |

刷新频率论文没明说，但根据"高质量"目标，密度不会太低（推测每 2-3 步一次）。**刷新太频繁 → AVDCache 跳不了几步（加速比下降）；刷新太少 → cache 漂移（质量下降）**——这是 RegionE 唯一需要调的"联合超参"。

#### 显存开销估算

cache 显存占用（理论值，未压缩）：

$$\text{per\_layer} = 2 \times (N_U + N_I) \times d_{kv} \times \text{dtype\_bytes}$$

$$\text{total} = \text{per\_layer} \times \text{num\_layers}$$

其中 $2$ 是 K 和 V 两份，$d_{kv} = \text{num\_heads} \times \text{head\_dim}$。

以 FLUX-Kontext 为例（粗估）：

| 参数                          | 值                          |
| --------------------------- | -------------------------- |
| num_layers                  | ~60（双 block + 单 block）     |
| $N_U + N_I$                 | 1024 token（=32×32 latent）  |
| $d_{kv}$                    | $\approx 4096$（FLUX）      |
| dtype                       | bf16 = 2 bytes            |

**代入数值**：

$$\text{per\_layer} = 2 \times 1024 \times 4096 \times 2 \approx 16 \text{ MB}$$

$$\text{total} = 16 \text{ MB} \times 60 \approx 1 \text{ GB}$$

Qwen-Image-Edit / Step1X 类似量级，~0.5-1 GB。这是 RegionE 唯一的"额外显存开销"，相比 FLUX 模型本身的 24 GB 权重可以接受（实际可能有量化到 fp8/int8 减半，看代码实现）。

---

### 3.3 Adaptive Velocity Decay Cache（AVDCache）— 时间冗余优化

**问题**：编辑区虽然轨迹是曲线（需要迭代），但**相邻时间步的速度方向几乎一致**（余弦相似度 $\to 1$），只有大小在衰减。能不能直接跳几步？

**核心公式（论文公式 7）**——速度衰减关系：

$$\frac{\|v_{t_{i+1}}\|}{\|v_{t_i}\|} = (1 - \Delta t_{t_{i+1}, t_i}) \cdot \gamma_{t_i}$$

这条公式说的是：从 $t_i$ 到 $t_{i+1}$，速度的**大小**按 $(1 - \Delta t) \cdot \gamma$ 衰减。其中：

- $(1 - \Delta t)$ 是一阶欧拉的天然衰减项（步长越大衰减越多）
- $\gamma_{t_i}$ 是一个标量修正因子，捕捉实际轨迹偏离一阶欧拉的程度

由此推出**跳步预测（论文公式 5）**：

$$v_{t_j} = v_{t_i} \cdot (1 - \Delta t_{t_j, t_i}) \cdot \gamma_{t_i} \quad \text{其中} \quad \Delta t_{t_j, t_i} = t_j - t_i$$

只要速度**方向不变**（这是 RegionE 依赖的关键假设），用上一步的速度按衰减率乘一下就能"预测"未来任意步的速度，而不需要真跑 DiT。

**决策机制（伪代码）**：

```python
if |v_ti - v_ti+1| / |v_ti| < δ:
    skip_step()              # 速度变化小 → 跳步（用预测）
else:
    compute_step()           # 速度变化大 → 正常算（让 DiT 算真实 v）
```

**渲染版决策条件**：

$$\frac{|v_{t_i} - v_{t_{i+1}}|}{|v_{t_i}|} < \delta \;\Longrightarrow\; \text{skip step}$$

阈值 $\delta$ 控制"激进程度"：$\delta$ 小 → 宁可多算不跳（保守，质量高）；$\delta$ 大 → 敢跳得多（激进，加速比大但有质量风险）。三个模型用不同 $\delta$（见 §2 表格）。

**跳步示意**：

```
t = T → t = 0.9 → 跳 → t = 0.8 → 跳 → t = 0.6 → 算 → ...
            ↑ 黄：被跳过、速度由前一步推算
```

注意一个细节：AVDCache 跳过的步**不更新 cache**——因为 DiT 完全没跑，cache 也没机会重新生成。这一点和 RIKVCache 的强制刷新机制是耦合的（见 §3.4）。

---

### 3.4 AVDCache + RIKVCache 联合工作机制

**为什么需要单独一节**：两个 cache 改的**不是同一类对象**——RIKVCache 改 `DiT.forward()` 内部的 attention 计算；AVDCache 改整个 step 是否要 `DiT.forward()`（scheduler 层）。理解它们的耦合是理解 RegionE 完整工作流的关键。

#### 加速比相乘原理

两件事**不冲突**：

- RIKVCache 让**每步变快**（算的 token 少）
- AVDCache 让**总步数变少**（跳步）
- 同时启用 = **每步快 × 步数少 = 加速比相乘**

理论上：$2.5\times$（空间）$\times 1.5\times$（时间）$\approx 3.75\times$  
实测：Step1X-Edit $2.54\times$ → 时间维度贡献 $1.27\times$（比纯 AVDCache 的 $1.5\times$ 略低）  
**差异原因**：联合时 cache 刷新点增多 + 强制算步占用时间。

#### 完整 RAGS 步的状态机

进入 RAGS 阶段后，每一步都按以下逻辑推进：

```text
t_i 的状态：
  - x_ti（当前位置）
  - v_{i-1}（上一步速度）
  - γ_{i-1}（上一步算的衰减因子）
  - K_C^U, V_C^U, K_C^I, V_C^I（RIKVCache 内容）

        ↓
   1. AVDCache 决策：跳 or 算？
        ↓ 算                ↓ 跳
   真跑 DiT          预测 v_ti
   （用 RIKVCache）   = (1-Δt)·γ_{i-1}·v_{i-1}
        ↓                ↓
   反算 γ_new      进入下一步
   检查 cache
   是否需要刷新
        ↓
   进入下一步
```

**跳步时的预测公式**（对应状态机右支）：

$$v_{\text{pred}} = v_{t_{i-1}} \cdot (1 - \Delta t) \cdot \gamma_{t_{i-1}}$$

#### 两个关键耦合点

**耦合点 1：cache 刷新点 = 强制算步**

联合版 AVDCache 决策逻辑（伪代码）：

```python
if 是刷新点 OR |v_{i-1} - v_pred| / |v_{i-1}| > δ:
    v_real = DiT_with_RIKVCache(x_ti, t_i)   # ← 走 RIKVCache 路径
    γ_new = recompute_gamma(v_{i-1}, v_real)
    use(v_real)
else:
    v_pred = v_{i-1} · (1 - Δt) · γ_{i-1}    # ← 完全跳过 DiT
    use(v_pred)
```

**渲染版决策条件**：

$$\text{刷新点} \;\lor\; \frac{|v_{i-1} - v_{\text{pred}}|}{|v_{i-1}|} > \delta \;\Longrightarrow\; \text{compute}$$

**跳步时的预测**：

$$v_{\text{pred}} = v_{i-1} \cdot (1 - \Delta t) \cdot \gamma_{i-1}$$

含义：
- AVDCache 跳步时：**DiT 完全不跑**，RIKVCache 闲置
- AVDCache 算步时：**DiT 必须跑**，RIKVCache 派上用场
- **强制刷新点 = AVDCache 不能跳**（必须真跑 DiT）→ 步数减少变慢

**耦合点 2：cache 有效性随 step 推进衰减**

- step 0（STS 末）：$K_C$ = 真实值 → 100% 有效
- step 1（RAGS）：$K_C$ 略陈旧（编辑区已走一步）
- step 2（RAGS）：$K_C$ 更陈旧
- ...
- step k：$K_C$ 可能已经漂移 → 需要刷新

**为什么 cache 会"漂移"**：编辑区 $X_E$ 在每步去噪后**位置变化**，但 cache 里**非编辑区的 K_V 是 step 0 时算的**——编辑区看到非编辑区的"印象"还是 step 0 时的样子，实际当前非编辑区**可能已经有点不同**（虽然小，但有）。累积起来，cache 就"失真"了。

#### 为什么 AVDCache 只能在 RAGS 跑？

| 阶段              | 跑 AVDCache 吗 | 为什么                                                  |
| --------------- | ---------- | ---------------------------------------------------- |
| **STS** ($t \in [T, 16]$) | ❌         | 刚启动，**没有 $v_{i-1}$** 没法判跳步；需要建 cache（必须全量 forward，跳步会破坏 cache 完整性） |
| **RAGS** ($t \in (16, 2]$) | ✅         | 有 $v_{i-1}$ 可比、有 cache 可用、有跳步价值                     |
| **SMS** ($t \in [2, 0]$) | ❌         | 接近收敛，速度衰减极快，**跳过风险大**；且要消除分块痕迹，全量 forward 才有保障            |

> **STS 不跑 AVDCache 的深层原因**：STS 要"建 cache"，**必须全量 forward**，跳步会破坏 cache 的完整性。这也解释了为什么 STS 阶段是 6 步固定开销——它是 RAGS 阶段能 work 的前提。

#### 联合加速比分解

| 组件              | 单独加速比   | 联合贡献  | 备注                       |
| --------------- | ------- | ----- | ------------------------ |
| **仅 ARP**       | $2.79\times$ | —     | 质量 $-3.82$ dB（不可用）         |
| **+ RIKVCache** | $2.73\times$ | 空间维度  | 质量回到可用                   |
| **+ AVDCache**  | **$2.54\times$** | 时间维度  | 质量不变                     |

**注意反直觉点**："仅 ARP"加速比 $2.79\times$ **比"完整" $2.54\times$ 还高**！

- ARP 把 token 数减到最少，**每步都跑也快**（FLOPs 少）
- 加 AVDCache 后，**单步 FLOPs 没变**，只是**步数变少** → 加速比应该**更高**
- **但实际更低** → AVDCache 引入的"强制算步"和"γ 反算开销"**抵消了部分收益**

> 这是 RegionE 设计中**唯一"做得不够极致"的地方**——时间维度的加速比被联合开销侵蚀了。

---

## 4. 实验效果

### 4.1 整体性能

| 模型              | 延迟 (s)         | 加速比           | PSNR↑  | LPIPS↓ |
| --------------- | -------------- | ------------- | ------ | ------ |
| Step1X-Edit     | 18.93 → 7.45   | **$2.54\times$** | 29.43  | 0.053  |
| FLUX.1 Kontext  | 20.50 → 7.99   | **$2.57\times$** | 28.21  | 0.057  |
| Qwen-Image-Edit | 15.60 → 7.57   | **$2.06\times$** | 31.66  | 0.043  |

加速 $2-2.5\times$，PSNR 损失 $0.2-0.3$ dB，**几乎无损**。LPIPS 也几乎不变（感知质量保持）。

### 4.2 消融实验（Step1X-Edit）

| 变体              | PSNR            | LPIPS↓    | 加速比        | 分析              |
| --------------- | --------------- | --------- | ---------- | --------------- |
| **完整**          | 29.43           | 0.053     | $2.54\times$ | 基线              |
| w/o ARP         | 25.61           | 0.087     | $2.79\times$ | ❌ PSNR $-3.82$，质量明显下降 |
| w/o RIKVCache   | 22.87           | 0.207     | $2.73\times$ | ❌ PSNR $-7.65$，LPIPS 暴涨 $4\times$ |
| w/o AVDCache    | 29.41           | 0.053     | $1.65\times$ | ⚠️ PSNR 不变但加速比腰斩   |

**关键发现**：

1. **RIKVCache 至关重要** — 去掉 PSNR 直接掉 7.65 dB（说明局部生成需要全局 KV 注入）
2. **ARP 是质量保证** — 去掉 PSNR 掉 3.82 dB（区域划分不准会导致编辑区错乱）
3. **AVDCache 是加速器** — 去掉质量不变但速度退回 $1.65\times$（贡献了一半的加速）
4. **三者缺一不可** — 各自负责"质、质、速"三个维度

---

## 5. 与现有工作的区别

| 方法         | 缓存粒度     | 空间优化 | 时间优化 | 训练成本  |
| ---------- | -------- | ---- | ---- | ----- |
| Δ-DiT      | 时间步      | ❌    | ✅    | 需要训练  |
| FORA       | 时间步      | ❌    | ✅    | 训练免费  |
| **RegionE** | **patch 级** | **✅** | **✅** | **训练免费** |

**核心差异**：

- **不训练**：RegionE 完全不修改模型权重，是纯推理加速
- **区域感知**：把"算力按区域分配"做到极致，编辑区 1 步 = 原模型 1 步，非编辑区 0 步
- **KV 注入**：通过 RIKVCache 把被丢弃的全局信息接回来，保证局部生成不偏

---

## 6. 总结

**RegionE = ARP + RIKVCache + AVDCache** 的三件套组合拳：

| 组件            | 解决什么        | 怎么解决                  |
| ------------- | ----------- | --------------------- |
| **ARP**       | 编辑/非编辑混合计算  | 区域划分，分开算              |
| **RIKVCache** | 局部生成缺全局上下文  | 缓存 U/I 的 KV，注入到 attention |
| **AVDCache**  | 速度慢，每步都跑    | 速度方向一致时跳步             |

**效果**：$2-2.5\times$ 加速，PSNR 损失 $< 0.3$ dB。**训练免费**，落地成本极低。

### 关键术语表

| 术语                | 含义                   |
| ----------------- | -------------------- |
| **STS**          | Stabilization，稳态化阶段  |
| **RAGS**         | Region-Aware Generation |
| **SMS**          | Smooth，平滑阶段          |
| **ARP**          | Adaptive Region Partition |
| **RIKVCache**    | Region-Instruction KV Cache |
| **AVDCache**     | Adaptive Velocity Decay Cache |
| **IIE**          | Instruction-based Image Editing |
| **$\eta$**       | ARP 分割阈值             |
| **$\delta$**     | AVDCache 跳步决策阈值       |
| **$X_t$**        | 时刻 $t$ 的中间图像          |
| **$v_t$**        | 速度（DiT 输出，预测的 $dx/dt$） |
| **$\hat{X}_0$**  | 单步欧拉估计的最终图            |
| **$X_{\text{ref}}$** | 原始参考图（用于 mask 计算）     |
| **$X_U$**        | 非编辑区 token            |
| **$X_E$**        | 编辑区 token             |
| **$X_I$**        | 指令图 token             |
| **$X_P$**        | Prompt token          |
| **$K_C^U, V_C^U$** | 非编辑区的 cache KV        |
| **$K_C^I, V_C^I$** | 指令图的 cache KV         |
| **$\gamma_{t_i}$** | $t_i$ 处的速度衰减修正因子     |

### 思考与疑问

> ❓ **关于 $\eta$**：三个模型用不同 $\eta$（$0.88 / 0.93 / 0.80$），论文没明确说怎么定的，猜测是 grid search 选 PSNR 最佳。
>
> ❓ **关于强制刷新频率**：RAGS 阶段多久刷新一次 cache 论文没明说。
>
> ❓ **关于位置编码**：RegionE 依赖 RoPE 兼容性，对于用 ALiBi 的老 DiT 不知是否 work。
>
> ❓ **关于 Qwen-Image-Edit 加速比偏低**：只有 $2.06\times$ 而其他两个 $2.5\times$，可能和它本身架构或推理时合并 KV 策略有关。
>
> ❓ **关于 mask 区域比 $r$**：不同图的 $r$ 不同（猫 5% vs 风景 30%），RegionE 加速比和 $r$ 直接相关。
>
> ❓ **关于联合开销**：为什么完整版 $2.54\times$ 比仅 ARP $2.79\times$ 还低？强制刷新点和 $\gamma$ 反算的开销占比需要量化。

**延伸阅读**：

- [FLUX.1 Kontext 论文](https://arxiv.org/abs/2506.15742)（attention 实现细节）
- [DiT 原文](https://arxiv.org/abs/2212.09748)（RoPE 怎么嵌进 K）
- [Δ-DiT / FORA / Learning-to-Cache](https://github.com/ali-vilab/learning-to-cache)（同类工作对比）
