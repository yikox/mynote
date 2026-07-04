---
title: 模块-代码映射与关系语义
level: L3
status: implemented
review_status: reviewed
primary_module: shared-references
impacted_modules: [modular-skills, shared-assets, graph-renderer]
---

# 模块-代码映射与关系语义

## Request

完善模块化约束规则中最薄弱的两处：①模块与代码没有可检查的对应关系；②模块间关系箭头语义未定义、模块文档 Dependencies 表与图存在双源漂移风险。（方向一书写规范、方向四嵌套规则在 backlog，另行处理。）

## Current Baseline

- 模块锚定代码仅靠 frontmatter 自由文本 `main_subject`，无法机械校验；modular-change 定位主模块靠 agent 理解。
- storage-schema 未定义模块文档 frontmatter schema（只有模板示例）。
- 图 relation 只有必填 `described` 自由文本 + `style: solid|dashed`（无语义约定）；箭头有时表示调用、有时表示数据流。
- 模块文档另有 Dependencies 表（in/out + reason），与图 relations 无权威归属和一致性约束。

## Target Architecture

### A. 模块-代码映射（code ownership）

1. **frontmatter 新增 `code_paths`**：仓库相对路径 glob 列表，声明模块拥有的代码。storage-schema 补一节完整的模块 frontmatter schema（name、described、module_form、module_kind、main_subject、code_paths、status、review_status）。
2. **单一所有权分割**：每个承载行为的代码路径必须属于且只属于一个模块；重叠 = 边界坏味道（拆文件或修映射）。测试默认随被测模块；生成物随生产它的模块。
3. **有意无主路径**（README、LICENSE、CI 配置等仓库元文件）默认不要求认领；其他例外在 `main-design.md` 的 Shared Constraints 中显式列出。
4. **定位规则**：modular-change 通过"变更路径 ∩ code_paths"确定性定位主模块；无匹配或多模块歧义 → 走既有的架构缺口流程。
5. **审计抓手**：modular-audit 新增孤儿检查（代码路径无模块认领）和幽灵检查（code_paths glob 匹配不到任何文件）；迁移时（migration-rules）必须填 code_paths。

### B. 关系语义

1. **箭头 = 依赖方向**：`A -> B` 读作"A 使用/依赖 B"。数据流向与依赖方向不一致时写进 `described`，不改箭头。
2. **relation 可选 `kind` 字段**，封闭词表五个：`uses`（默认，泛化使用）、`reads`（读数据/配置）、`writes`(写数据/产物)、`triggers`（事件/调度触发）、`distributes`（打包/分发/同步）。`described` 仍必填。
3. **style 语义**：`solid` = 运行时依赖；`dashed` = 非运行时依赖（构建、验证夹具、同步约定）。
4. **图是模块间关系的权威来源**：模块文档 Dependencies 表必须是图中该模块关系的子集（加原因），review/audit 检查一致性。
5. 渲染器已宽容未知字段，`kind` 作为纯语义元数据落地，**不改渲染器**（hover 展示 kind 为未来增强，非本次目标）。

### 假设

- glob 语义按 Python `pathlib.Path.glob`/`fnmatch` 常规约定，实现 audit 脚本（backlog REQ-20260702-audit-script）时再精确化——本次只定文档契约。（assumption）

## Module Impact

| Module | Impact |
| --- | --- |
| shared-references | storage-schema、workflow-rules、graph-json-format、migration-rules、review-rules 五份文档扩展（主变更） |
| shared-assets | module-design-template 加 code_paths 与 Dependencies 子集注释 |
| modular-skills | architecture/change/audit 三个 SKILL 的定位与检查步骤更新 |
| graph-renderer | 无代码改动；格式文档语义扩展与其实现兼容 |

## Alternatives

| Option | Tradeoff |
| --- | --- |
| 独立映射清单文件（modules.json） | 映射与文档分离成第二真相源，易漂移；拒绝 |
| 关系类型用完整 UML 词表 | 表达力过剩、学习成本高、agent 难一致使用；拒绝，收敛到 5 词 |
| 箭头 = 数据流向 | 修改路由需要的是依赖方向；数据流写 described 即可；拒绝 |

## ADR Need

需要。三个决定都是"多个合理选项中的持久方向"：单一所有权 code_paths 内嵌 frontmatter、箭头=依赖方向+五词 kind、图为关系权威。合并写一份 ADR-2026-07-03-code-ownership-and-relation-semantics。

## Implementation Strategy

先改 shared-references 五份规则文档 → 模板 → 三个 SKILL → README → 本项目自身 baseline 吃狗粮（6 个模块文档补 code_paths、图 relations 补 kind、重渲染）→ install 同步。向后兼容：无 code_paths / kind 的存量文档合法（audit 提示补齐），默认语义与现状一致。

## Validation

- grep 验证五份规则文档、模板、三个 SKILL 的接线齐全。
- 本项目图补 kind 后渲染零 warning；两张示例图回归通过。
- 本项目 6 个模块 code_paths 覆盖仓库全部非元文件路径（人工核对一次作为孤儿检查演练）。

## Risks

- 规则变多导致 agent 负担：code_paths/kind 均为"新建和迁移时必填、存量提示补齐"，不追溯强制。
- glob 语义未精确化：文档契约先行，脚本落地时再收紧（已标 assumption）。
- Dependencies 表降级为子集视图后，旧文档表里可能有图中没有的关系：audit 按"补图或删表行"处理。

## Review Notes

- Review status: reviewed（2026-07-03 modular-review：L3 检查项齐全，假设显式，无阻塞项；待人工接受）
