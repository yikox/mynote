# Plugins（插件）设计

最后更新：2026-06-28

状态：accepted（已接受，用户已确认）

## 目的

Plugins（插件）承载非核心但 v1 要纳入边界的扩展能力，例如 AlphaSift、图片识别、额外通知渠道和额外数据源。插件要有清晰边界，不能把核心模块变成隐式依赖。

## 当前 demo 事实

- 当前已有 `alphasift` API 分组和 `src/services/alphasift_service.py`。
- 当前已有 `src/services/image_stock_extractor.py` 和图片识别相关接口。
- 当前已有多种 Bot 和通知平台代码。

## 职责

- 定义插件注册、能力声明、配置、启用状态和失败隔离。
- 让 AlphaSift 作为筛选/研究插件接入 Research Task Engine。
- 让图片识别作为输入插件，把图片转换为候选 Instrument。
- 让额外通知渠道通过插件接入 Monitor。

## 边界

范围内：插件注册、插件配置、能力调用、失败隔离、可观测状态。

范围外：插件不能直接绕过核心数据模型写入关键表；不能成为启动必需依赖。

## 接口与契约

建议插件能力类型：

| 类型 | 说明 |
| --- | --- |
| `data_source` | 数据源插件 |
| `evidence_source` | 证据源插件 |
| `task_provider` | 研究任务插件 |
| `input_extractor` | 输入提取插件，例如图片识别 |
| `notifier` | 通知插件 |

## 数据与状态

- 插件配置要进入系统配置，但不能存储密钥到 PM 文档。
- 插件运行结果必须带来源和错误诊断。

## 运行流程

```mermaid
flowchart TB
    registry["插件注册表"] --> enabled["启用插件"]
    enabled --> call["通过核心接口调用"]
    call --> success["返回标准结果"]
    call --> failure["记录失败并隔离"]
```

## 依赖

- Command API。
- Data Hub、Evidence Hub、Research Task Engine、Monitor。

## 风险与未决问题

- 插件是否允许写核心表需要后续确认；建议 v1 必须通过 Command API 写入。
- 插件配置和密钥要避免进入项目记忆和仓库。
