---
name: Graph Renderer
described: 把 .arch.json 架构图渲染为交互式 HTML/SVG 的 Python 脚本
module_form: atomic
module_kind: function-flow
main_subject: modular-programming/_shared/scripts/render_modular_graph.py
code_paths:
  - modular-programming/_shared/scripts/**
status: implemented
review_status: reviewed
---

# Graph Renderer

## Responsibility

单文件 Python 渲染器 `render_modular_graph.py`：读取 `*.arch.json` 图结构和模块 Markdown front matter，输出交互式 HTML（可选 SVG）。校验 ref 存在性、关系端点、group 包含关系、跨 scope 关系等并给出 warning。

## Public Contract

- CLI：`python3 render_modular_graph.py <graph.arch.json> -o <out.html> [--svg-output <out.svg>]`。
- 输入契约：`arch-graph/v0.2`（兼容 v0.1），见 `shared-references` 的 `architecture-graph-json-format.md`。
- module_kind → 图形/颜色映射遵循 `module-kind-classification.md`。

## Internal Design

内部模块文档在仓库 `modular-programming/_shared/scripts/renderer-docs/`（format-spec、parser-loader、graph-model、rules-layer、module-kind-taxonomy、layout-engine、svg-renderer、html-output、render-runtime、cli-orchestrator、diagnostics），修改脚本前先读对应文档。

## Dependencies

| Dependency | Direction | Reason |
| --- | --- | --- |
| modular-skills | in | modular-architecture 调用渲染 |
| examples | out | 以示例图作为回归验证夹具 |
| shared-references | out | 实现须符合图格式规范与分类体系 |

## Constraints

- 无第三方依赖，仅 Python 3 标准库。
- warning 视为问题，除非用户明确接受草稿。

## Validation

- `python3 modular-programming/_shared/scripts/render_modular_graph.py modular-programming/_shared/examples/system-overview.arch.json -o /tmp/graph.html` 成功且无 warning。

## Review Notes

- Review status: reviewed
