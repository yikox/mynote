# CP 并行度配置与运行时 group 契约不一致

- 日期：2026-07-17
- 状态：已修复
- 提交：`ba9d1b7`（已推送 `origin/v2`）
- 级别：L1
- 主模块：核心框架
- 影响模块：parallel、warps 注释、FLUX.2-Klein 示例

## 现象

`OptKitConfig` 原先只校验 `cp_degree <= world_size`。因此以下无效配置可以构造成功：

```python
OptKitConfig(
    parallel=ParallelSpec(ulysses_degree=2, ring_degree=1),
    world_size=4,
)
```

但 `ParallelComponent` 创建的 CP group 只有 2 个 rank，`SequenceDispatcher` 却使用全局 `world_size=4` 和全局 rank 做切分与 collective 元数据，group 大小与 dispatcher 契约不一致。`ulysses_degree=0`、`ring_degree=0` 或负数也会通过校验并静默退化。

## 根因

配置层为未来可能的数据并行子组预留了 `cp_degree < world_size`，运行时却没有同步实现数据并行维度、局部 CP group 划分以及局部 rank/world size。设计意图与已落地能力不一致，且缺少非法边界值回归测试。

## 修复

1. `ulysses_degree`、`ring_degree` 必须大于等于 1。
2. `cp_degree=1` 保留 identity 路径；启用 CP（`cp_degree>1`）时必须等于 `world_size`。
3. 明确报错当前不支持 partial CP group。未来若支持数据并行子组，须单独设计 mesh、group 和局部 rank/world size 契约。
4. 同步更新主设计、parallel/RegionE 模块文档、知识总结与遗留架构导读。
5. 清理 CP 切分下沉后的偏移注释：pipeline hook 只承载 RegionE 子集裁剪/还原，CP 切分/聚合在 transformer 的 `cp_split_blocks` / `cp_gather_blocks`。

## 验证

- TDD RED：新增 5 个非法配置场景，修复前均因“未抛出 `ValueError`”失败。
- TDD GREEN：5 个回归场景全部通过。
- `python -m pytest -q auto_test/tests`：176 passed，2 skipped。
- 19 个改动 Python 文件逐个 `compile(...)`：全部通过。
- 目标文件 `ruff check`：通过。
- `git diff --check`：通过。
- 注释契约扫描：旧 pipeline-CP、`REGINE+50`、失效 `run_matrix*.sh` 和过程性基线注释均已清理；保留命中均为当前有效描述。

## 未包含

- 未实现数据并行子组；这需要独立的模块设计与多进程测试。
- 未处理原审阅项 2、3，符合用户本次只修复 1、4、5 的范围。
