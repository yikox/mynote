---
name: Examples
described: 可渲染的示例架构图和模块文档样例
module_form: atomic
module_kind: resource-file
main_subject: modular-programming/_shared/examples/
code_paths:
  - modular-programming/_shared/examples/**
status: implemented
review_status: reviewed
---

# Examples

## Responsibility

两张示例图（`system-overview.arch.json` 订单系统、`tooling-overview.arch.json` 工具链）和配套模块文档样例（user、api-gateway、order-service、order-database、logger、diagnostics、path-utils、tool-module），演示图格式和模块文档写法，同时充当渲染器的回归夹具。

## Public Contract

- 示例必须始终可被 graph-renderer 无 warning 渲染。
- 示例展示的格式特性应与 `architecture-graph-json-format.md` 同步。

## Internal Design

- 模块文档样例覆盖多种 module_kind，便于对照分类体系。

## Dependencies

| Dependency | Direction | Reason |
| --- | --- | --- |
| graph-renderer | in | 作为其验证输入 |

## Constraints

- 示例保持最小，不引入与格式演示无关的内容。

## Validation

- 渲染两张示例图均无 warning。

## Review Notes

- Review status: reviewed
