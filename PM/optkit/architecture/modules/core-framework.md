# 模块：核心框架（core-framework）

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/config/`、`optkit_v2/core/`、`optkit_v2/apply.py`
- 上游：[main-design](../main-design.md)

## 1. 职责与边界

框架脊柱：把「用户意图（Spec）」装配成「能力插件（component）」并经稳定契约（Context）发到模型侧（warp）。本模块**不含任何优化能力逻辑**——能力逻辑全在 optimization-components / parallel / regione。

四件事：
1. **意图描述**：`config/specs.py` 的各 Spec dataclass + `OptKitConfig` 顶层容器。
2. **冻结契约**：`core/context.py` 的 `OptKitContext`。
3. **顺序事实源**：`core/order.py` 的 `HOOK_ORDER`。
4. **编排**：`apply.py` 的 spec→component 派发 + 单趟 attach + warp + `on_pipe_ready` 触发。

## 2. 配置层（config/specs.py）

- 各能力 Spec：`SageSpec / QuantSpec / CompileSpec / ParallelSpec / DiCacheSpec / MagCacheSpec / RegionESpec`（纯意图 + 参数校验）。
- `OptKitConfig`：字段 `sage / quant / compile / parallel / cache`，其中 **`cache` 三选一互斥**（单字段联合 DiCache/MagCache/RegionE）。`__post_init__` 做跨能力约束强校验（见主设计 §6），`specs()` 收集启用项。
- 能力身份枚举 `Comp`（`core/order.py`）：`sage / quant / compile / parallel / cache / regione`。

## 3. OptKitContext —— 冻结契约（core/context.py）

显式声明为「冻结契约」：修改本类 = 契约变更，需评审。三部分组成。

### (a) 分发原语 —— 永久冻结，只有两个

```python
register(name, fn, *, by)            # by = 注册 component 身份，优先级查 HOOK_ORDER
trigger(name, value=None, /, **kw) -> value
```

`trigger` 是**统一 fold**：按 priority 升序遍历 handler，`new = fn(value, **kw)`，`new is not None` 即替换 value。**约定 `None` = 不接管 / 透传**。一条原语覆盖五种归约语义：

| 语义 | 用法 |
| --- | --- |
| 通知 | handler 做副作用、返回 None（value 透传） |
| 链式 | handler 返回新 value |
| 布尔 | 种子 False，handler 返回 True/None（如 `should_skip_block`） |
| 短路 | 种子 None，首个返回非 None 的 handler 接管（如 `on_denoise_forward_pre`） |
| compose | value 是函数，后注册 handler replace/decorate 前一个（如 `replace_dispatch_attention_fn`） |

### (b) 命名生命周期糖 —— 冻结目录，每个都是一行 trigger 包装

严禁在方法体内写能力逻辑。两级：
- **transformer 级**：`on_transformer_enter` / `cache_before_blocks` / `cache_after_blocks` / `on_transformer_exit` / `cp_split_blocks` / `cp_gather_blocks` / `on_attn_processor_enter` / `on_backend_enter` / `on_backend_exit` / `on_attn_processor_exit`。
- **pipeline 级**：`on_pipeline_enter` / `on_denoise_loop_enter` / `on_denoise_step_pre` / `on_denoise_step_post` / `on_denoise_loop_exit` / `on_pipeline_exit`。

### (c) 跨 component 共享事实 —— 只用「活跃 component 引用」

Context 只持两个跨组件引用槽（未启用 = None），**新增引用槽 = 契约变更**：

```python
ctx.regione    # RegionEComponent | None —— manager / attn cache / region_mode
ctx.parallel   # ParallelComponent | None —— cp_group / dispatcher / mesh
```

事实就是各 component 的成员变量，owning component 写、任意 component 读（如 dicache 读 `ctx.parallel.cp_group` 做 CP-aware reduce）。其余允许状态：`rank / world_size / device`（构造时定）+ `_current_block_idx`（forward↔attn processor 迭代游标，选 per-block KV cache 槽）。**任何模型特定知识严禁进入 Context**。

## 4. 顺序事实源（core/order.py）

`HOOK_ORDER[hook] = (Comp.X, Comp.Y, ...)` 显式列出参与者顺序，component 注册时只报自己名字（`by=self.name`），优先级 = 名字在元组里的下标。未登记的 `(注册点, component)` 直接报错。改顺序只动这一个文件。详见主设计 §5。

## 5. 编排（apply.py）+ component 基类（core/component.py）

- `core/component.py`：`OptComponent` 基类 + `attach` 生命周期。
- `apply.py`：spec→component 派发 + 单趟 attach + warp + `on_pipe_ready` 触发（流程见主设计 §3）。
- **延迟 pipe 变换到 `on_pipe_ready`**：顺序敏感的活儿（quant 改权重→compile 编 graph→regione 换 scheduler）延迟到 warp 替换完 forward 之后统一执行，故 attach 顺序无所谓。

## 6. 依赖与约束

- 依赖 diffusers 内部私有 API（`_modeling_parallel` / `_cp_plan` / `dispatch_attention_fn`），强校验 `diffusers >= 0.35`；测试机 transformers 须 pin 4.57.1。
- 纪律：**改 Context / order.py 即契约变更，需评审。**
