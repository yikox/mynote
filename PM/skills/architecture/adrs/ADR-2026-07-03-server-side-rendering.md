---
title: ADR-2026-07-03-server-side-rendering
status: accepted
review_status: reviewed
---

# ADR-2026-07-03-服务端渲染的本地预览服务

## Context

图渲染需要「打开 `.arch.json` 即看图」的动态预览体验。渲染管线（解析、布局、SVG）目前完全在 Python 端、仅依赖标准库、单文件分发。引入本地服务时，渲染逻辑放在哪一端是一个约束未来演进的持久决策。

## Decision

本地预览服务采用**服务端 Python 渲染**：`http.server` 按请求现场调用既有 parse → layout → render 管线返回 HTML。渲染管线保持单一 Python 实现、单文件、仅标准库；静态 CLI 导出保持权威产物地位（baseline `Rendered:` 链接指向静态文件），serve 模式定位为开发期预览。

## Alternatives Considered

| Alternative | Reason Not Chosen |
| --- | --- |
| 前端 JS 渲染引擎（服务只发 JSON） | 需要用 JS 重写全部布局/SVG 逻辑，形成双实现漂移；工作量数倍 |
| 用第三方框架（Flask 等）建服务 | 违反「仅 Python 3 标准库」约束，破坏复制即用的分发方式 |
| 静态导出完全替换为服务 | 破坏产物可提交、可离线打开的工作流契约 |

## Consequences

- 未来交互增强（折叠、过滤、高亮）应优先做进输出 HTML 的内嵌 JS 行为层，消费 Python 端产出的结构，而不是把布局/渲染搬到浏览器。
- 服务是按需启动、绑定 127.0.0.1 的本地预览工具，不承诺并发与生产用途。
- 仓库约束由「无服务」调整为「无常驻服务」。

## Follow-Up

- 2026-07-03 变更已落地（serve_modular_graph.py），本 ADR 转 accepted，PM ADR Summary 已同步。
