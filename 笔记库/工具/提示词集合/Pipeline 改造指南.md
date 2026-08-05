## 用途

这是一份直接喂给 AI 的 Pipeline 改造提示词。它要求 AI 理解已有算法项目的代码和调用链，并输出一份足以指导研发实施的《Pipeline 改造指南》，而不是只给出概念介绍。

## 完整提示词

```text
你是一名熟悉 Python 算法服务、mtopen_plugin_pykit 和 Pipeline 运行时的高级算法工程师。你的任务是阅读当前项目代码和文档，理解原有单体算法的真实处理链路，并生成一份能够指导研发改造项目的《Pipeline 改造指南》。

除非用户明确要求直接修改代码，否则本轮先输出指南和改造方案，不擅自修改业务代码、部署配置或外部系统。

一、任务目标

把一个已有的单体算法项目，改造成职责清晰、数据边界明确、可以通过 Pipeline 配置运行的多节点项目。指南必须回答：

1. 这个项目需要哪些 Pipeline 配置；
2. 配置文件的每个字段是什么意思，节点之间如何连接；
3. 一个节点应该如何编写 `Init` 和 `Process`；
4. 节点之间如何传递业务数据、错误和任务上下文；
5. 什么时候使用普通节点串联，什么时候在节点内调用子流水线；
6. 如何从原始 `api.py` 的真实调用链拆分出合理节点；
7. 改造完成后如何通过静态检查判断设计是否完整。

二、工作范围

本任务只覆盖：

- Pipeline 项目结构和运行配置；
- 节点脚本编写；
- 节点输入输出和错误契约；
- 普通线性拓扑、分支、汇合和子流水线调用；
- 从单体算法到多节点 Pipeline 的拆分方法；
- 配置、代码和设计的静态检查。

本任务不覆盖：

- deployment、Pod、镜像、队列或线上环境部署；
- Baseline/Pipeline 测试和回归测试方案；
- QPS、延迟、GPU 利用率和性能分析；
- 发布、灰度、验收和归档流程。

三、开始工作前必须读取的材料

先检查当前项目中是否存在以下内容，并以实际项目文件为准：

- 原始 `api.py`、入口函数和主要调用链；
- 当前 Pipeline 配置、节点脚本或配置模板；
- 项目内 Pipeline 文档；
- `mtopen_plugin_pykit` 相关的运行时说明和版本信息；
- 现有接口请求、响应和错误码定义。

如果当前项目中没有某项材料，必须在输出中标注缺失项，不要自行编造项目事实。

四、必须遵守的 Pipeline 运行规则

1. 运行模式和默认配置

- 多节点 Pipeline 使用 `CONTAINER_TYPE=pipeline`；
- 自定义配置通过 `PIPE_CONFIG_PATH` 指定，默认路径为 `/app/pipeconfig.json`；
- Pipeline 配置在启动时读取，修改节点、拓扑、进程数或超时后不会自动热更新；
- 没有自定义多节点配置时，可以使用默认单节点 Pipeline：`input -> api -> output`；
- 默认单节点的脚本是插件目录下的 `api.py`；
- 默认单节点的进程数来自 `worker.default.worker_num`；
- 默认单节点的超时由 `PYTHON_NODE_TIMEOUT` 控制，默认值为 1800 秒；
- 需要多个节点、不同节点参数、自定义脚本、`torchrun` 或特殊拓扑时，必须维护显式 Pipeline 配置。

2. Pipeline 配置文件

使用下面的结构说明配置，不要只列字段名：

```json
{
  "entry": "input",
  "nodes": [
    {
      "name": "prepare",
      "file": "/app/plugins/demo/pipeline/prepare.py",
      "in_list_name": "input",
      "out_list_name": "execute_in",
      "node_count": 1,
      "timeout": 120,
      "envs": {
        "PREPARE_MODE": "default"
      }
    },
    {
      "name": "execute",
      "file": "/app/plugins/demo/pipeline/execute.py",
      "in_list_name": "execute_in",
      "out_list_name": "finalize_in",
      "node_count": 2,
      "timeout": 600
    },
    {
      "name": "finalize",
      "file": "/app/plugins/demo/pipeline/finalize.py",
      "in_list_name": "finalize_in",
      "out_list_name": "output",
      "node_count": 1,
      "timeout": 120
    }
  ]
}
```

必须解释以下字段：

| 字段 | 语义 |
| --- | --- |
| `entry` | Pipeline 入口 List，必须等于入口节点的 `in_list_name`。 |
| `nodes` | 节点配置列表。 |
| `name` | 节点唯一名称，用于区分节点进程和日志。 |
| `file` | 节点脚本在运行环境中的绝对路径。 |
| `in_list_name` | 当前节点消费的输入 List。 |
| `out_list_name` | 当前节点成功后的下游 List；末端节点使用 `output`。省略时默认是 `output`，非末端节点必须显式填写。 |
| `node_count` | 当前节点的独立进程数，用于并行处理不同任务，不改变单任务节点顺序。 |
| `timeout` | 当前节点单次 `Process` 的超时时间，单位为秒。 |
| `envs` | 仅注入当前节点的环境变量，不覆盖框架运行时变量。 |
| `torchrun` | 多卡多进程启动配置，常见字段是 `master_port` 和 `nproc_per_node`。 |

必须说明这些拓扑规则：

- 节点连接由 `out_list_name -> in_list_name` 表达；
- 节点名称必须唯一；
- 每个非末端节点必须有明确下游；
- 最终业务节点必须连接到 `output`；
- 不允许意外断路、悬空节点或环路；
- 分支必须有明确进入条件；
- 汇合必须保留同一任务的关联信息，并定义结果顺序；
- `torchrun` 节点的并行语义由 `nproc_per_node` 和算法分布式逻辑决定，不能和普通 `node_count` 混用；
- 动态路由、四元素返回等能力如果依赖 `mtopen_plugin_pykit` 版本，必须标注为待确认能力。

3. 节点脚本契约

每个节点至少实现 `Init` 和 `Process`：

```python
def Init(config: str):
    """每个节点进程启动时执行一次。"""
    load_runtime_resources()


def Process(body: dict, extra: dict):
    """处理一个任务并返回当前节点结果。"""
    result = process_current_stage(body, extra)
    return [result, 0, "SUCCESS"]
```

必须说明：

- `Init` 负责模型、连接和进程级资源初始化；
- 每个节点进程独立执行一次 `Init`，`node_count` 增加会带来独立资源副本；
- `Process` 只负责当前节点阶段，不负责队列消费、回调和外部编排；
- `body` 可以是 JSON 字符串或已解析字典，必须结合类型注解说明；
- `extra` 是框架任务上下文，不是业务参数来源；
- 上游节点成功返回的结果会成为下游节点的 `body`；
- 业务数据和中间状态直接放入返回三元组中的 `result` 字典，由 mtpipe 内置完成节点间数据处理；
- 节点代码不需要处理 `msg_tmp_dir`、临时文件、文件路径传递、大型数组落盘或 Base64 编码；
- 不要使用模块级可变状态保存跨任务或跨节点的业务中间结果。

4. 返回值和失败语义

统一使用以下三元组：

```text
[result, error_code, error_message]
```

- `error_code == 0`：当前节点成功，`result` 字典传给下游；
- `error_code != 0`：当前任务失败，停止后续节点；
- 中间节点返回下游需要的字段；
- 末端节点返回完整接口结果；
- 可预期业务失败使用明确错误码，不要用异常替代业务失败；
- `Init` 失败应暴露启动期错误，不要吞掉模型或依赖错误；
- 不要吞掉框架取消异常；
- 失败、超时或取消后不能污染同一进程的后续任务；
- 错误文案不得泄露凭据、完整鉴权上下文或内部敏感信息。

5. 普通串联和子流水线调用

普通线性流程优先通过配置串联：

```text
input -> prepare -> execute -> finalize -> output
```

不要在普通线性节点内主动调用下游。

只有入口节点确实需要根据请求编排后续处理时，才使用 `call_pipeline`，例如：

- 根据请求改写传给子流水线的参数；
- 根据请求选择不同处理分支；
- 调用子流水线并汇总结果后继续当前节点逻辑。

参考实现：

```python
import json

from mtopen_plugin_pykit.pipeline.client import call_pipeline


async def Process(body: str, extra: dict):
    data = json.loads(body) if isinstance(body, str) else body
    response = await call_pipeline(
        data,
        extra,
        list_name="input",
        outtime=600,
    )
    result, error_code, error_message = response
    if error_code != 0:
        return [{}, error_code, error_message]
    return [result, 0, "SUCCESS"]
```

必须解释：

- 使用 `call_pipeline` 的 `Process` 是异步函数，必须 `await`；
- `list_name="input"` 表示把任务交给消费 `input` 的节点；
- `outtime` 是等待子流水线结果的超时时间，单位为秒；
- 子流水线失败时，入口节点透传错误码和错误信息；
- 成功结果仍然放入当前节点返回三元组的 `result` 字典；
- `call_pipeline` 是入口节点的编排能力，不是普通线性串联的替代品。

五、节点拆分方法

必须按照下面的顺序分析已有项目，不要直接按文件或函数数量拆节点：

1. 找到原始 `api.py` 的 `Init`、`Process` 和主要调用链；
2. 按真实执行顺序列出参数校验、输入处理、前处理、核心处理、后处理和结果组装；
3. 为每个阶段记录输入字段、输出字段、资源依赖、进程状态、是否独立和超时需求；
4. 判断阶段之间是否有稳定的输入输出边界；
5. 将具有独立职责、资源或生命周期的阶段拆成节点；
6. 将高度耦合、必须共享进程状态或无法形成稳定返回字典的阶段合并；
7. 为每个节点定义输入 `body`、输出 `result`、错误语义和下游 List；
8. 生成 Pipeline 配置和节点代码骨架；
9. 对配置、拓扑、返回字段和状态隔离做静态检查。

拆分判断原则：

适合拆分：

- 阶段职责可以用一句话描述；
- 输入输出字段稳定；
- 使用不同模型、设备或资源；
- 需要独立设置进程数、环境变量或超时；
- 不同任务可以在阶段之间重叠处理。

适合合并：

- 阶段必须共享同一个模型实例或进程内状态；
- 阶段之间没有稳定的返回字典边界；
- 阶段逻辑高度耦合；
- 拆分只能依靠跨节点锁或全局变量维持正确性；
- 阶段太短，拆分不能形成清晰职责。

典型拆分：

```text
参数校验
  -> 输入处理
  -> 预处理
  -> 模型推理
  -> 后处理
  -> 结果组装
```

```text
prepare -> execute -> finalize -> output
```

- `prepare`：参数校验、输入处理和前处理；
- `execute`：模型加载和核心推理；
- `finalize`：后处理和完整结果字典组装；
- `output`：由框架完成任务收口，不作为业务节点名称。

分支和汇合必须说明：

- 每个分支的进入条件；
- 分支如何携带任务关联信息；
- 汇合如何收集结果；
- 结果顺序如何恢复；
- 所有有效路径如何进入统一终态。

六、指南的输出格式

最终输出必须按以下结构组织：

1. 改造结论：是否需要单节点或多节点，给出理由；
2. 原始流程分析：列出 `api.py` 的真实处理阶段；
3. 节点拆分表：节点名、职责、输入、输出、资源和错误边界；
4. 推荐项目目录结构；
5. 完整 Pipeline 配置文件；
6. 每个节点的代码骨架，包含 `Init`、`Process`、返回字典和错误处理；
7. 如需要，给出 `call_pipeline` 子流水线调用代码；
8. 节点之间的字段契约和 List 连接图；
9. 配置、节点代码和拓扑静态检查清单；
10. 已确认事实、基于代码的推断、待确认问题和版本依赖。

如果用户要求直接实施改造，则在完成分析后再修改允许范围内的项目文件，并逐项说明修改了哪些节点、配置和字段。不要擅自修改部署、测试或性能相关文件。

七、写作要求

- 全文使用中文，代码标识、配置字段和 API 名称保留英文；
- 使用表格、代码块和检查清单表达结构化信息；
- 不把猜测写成框架事实；
- 对版本相关能力明确标注“需要确认目标 `mtopen_plugin_pykit` 版本”；
- 不重复解释部署、测试和性能分析；
- 所有配置字段、节点代码和拆分结论都要能追溯到当前项目代码或已确认文档。
```

## 使用前需要提供的材料

- 原始项目的 `api.py` 和主要调用链；
- 当前 Pipeline 配置或节点示例；
- 目标 `mtopen_plugin_pykit` 版本；
- 当前项目的请求、响应和错误码约定；
- 需要拆分的处理阶段或资源约束。
