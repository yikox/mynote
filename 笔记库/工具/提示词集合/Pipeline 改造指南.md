## 用途

用于把已有算法项目改造成 Pipeline 多节点项目，生成一份面向研发的改造指南。重点覆盖项目配置、节点编写、节点串联、子流水线调用和节点拆分原则。

不包含部署、测试、性能分析、发布和验收内容。

## 提示词

```text
请阅读当前项目中与 Pipeline、mtpipe、Init、Process、节点拓扑和运行时机制相关的文档，为当前项目生成一份《Pipeline 改造指南》。

目标：
把已有的单体算法项目改造成 Pipeline 多节点项目，帮助研发明确项目配置、节点写法、节点连接方式，以及如何从原有 api.py 拆分出合理的节点。

文档必须包含以下内容：

1. 项目配置
   - 说明 Pipeline 项目的推荐目录结构；
   - 说明 CONTAINER_TYPE、PIPE_CONFIG_PATH、PYTHON_NODE_TIMEOUT、worker.default.worker_num 等相关配置；
   - 给出完整的 Pipeline 配置文件示例；
   - 解释 entry、nodes、name、file、in_list_name、out_list_name、node_count、timeout、envs、torchrun 等参数；
   - 说明 input/output、节点 List 连接、末端节点和拓扑约束；
   - 区分默认单节点 Pipeline 和自定义多节点 Pipeline。

2. 节点编写
   - 说明 Init 和 Process 的职责与生命周期；
   - 说明 body、extra 的输入含义和类型声明；
   - 说明节点返回三元组 [result, error_code, error_message]；
   - 约定业务数据和中间状态直接放入返回三元组中的 result 字典，由 mtpipe 内置处理节点间数据传递；
   - 不要介绍 msg_tmp_dir、临时文件、文件路径传递、大型数组落盘或 Base64 编码；
   - 说明成功、业务失败、异常、超时和取消的处理边界；
   - 说明节点不能依赖模块级可变状态保存任务中间结果。

3. 节点内调用子流水线
   - 明确常规线性流程优先使用 in_list_name 和 out_list_name；
   - 说明只有在前置节点需要改写参数、选择分支或汇总子流水线结果时才使用 call_pipeline；
   - 给出 async Process、await call_pipeline、list_name、outtime 和错误码透传示例；
   - 说明 call_pipeline 的入口节点使用边界。

4. 节点拆分原则
   - 从原始 Process 的真实调用链开始建立阶段映射；
   - 按职责边界、输入输出边界、资源边界、生命周期和并发需求判断是否拆分；
   - 给出前处理、核心处理、后处理的典型拆分示例；
   - 说明哪些阶段应该合并，避免为了拆分而拆分；
   - 说明分支、汇合、结果顺序和任务关联信息的处理；
   - 说明不要使用跨节点锁或全局变量维持节点顺序。

5. 静态检查清单
   - 配置字段、节点连接、入口和 output 检查；
   - 节点函数、返回值、错误传播和状态隔离检查；
   - 节点边界、数据字段和拓扑设计检查。

写作要求：

- 使用中文，结构清晰，优先使用表格、代码块和检查清单；
- 以当前项目文档和运行时行为为准，不凭空补充未确认的参数；
- 将 mtpipe 内置能力与节点业务代码职责明确分开；
- 不包含部署、测试、性能分析、发布和验收章节；
- 如果某项能力依赖 mtopen_plugin_pykit 版本，明确标注版本依赖；
- 最后列出本指南引用的项目文档和仍需确认的运行时前提。
```

## 使用说明

使用此提示词时，最好同时提供：

- 原始项目的 `api.py` 和主要调用链；
- 当前 Pipeline 配置或节点示例；
- 目标 `mtopen_plugin_pykit` 版本；
- 需要拆分的处理阶段说明。
