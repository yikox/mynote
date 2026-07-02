# workflows 知识总结

Last updated: 2026-07-01

本仓库：`/Users/chenzeyang/MTGIT/workflows` —— aimaster 与 jira 的 Playwright 自动化工作流，含 `workflows/optkit/` 下的 optkit 自动测试编排。

## 验证过的命令

- 运行测试：`python3 -m pytest tests/test_optkit_auto_test.py -q`（2026-07-01 验证，30 passed）。
- 构建 wheel：`python3 -m build --wheel`（产物在 `dist/`，2026-07-01 验证）。
- 部署到 optkit-test 机（2026-07-01 验证）：`scp dist/workflows-<ver>-py3-none-any.whl lyw@172.21.25.184:/Users/lyw/Documents/repository/optkit-test/` → 远程 `/Users/lyw/miniforge3/envs/optkit-test/bin/pip install --force-reinstall --no-deps <whl>`。
- **注意**：pip 以版本号判断是否覆盖，改代码不 bump 版本则 `install` 不会更新已装包；每次发布务必 bump `pyproject.toml` 的 `version`。

## 架构与结构

- `workflows/optkit/optkit_auto_test.py`：optkit 自动测试主编排（申请机器 → 触发启动 → 轮询等待 → SSH 下发测试 → 轮询完成 → 关机）。
- AIMaster 凭证从环境变量 `AM_MASTER_AUTHORIZATION`（格式 `账号@meitu.com:token`）读取，不再硬编码；`configure_aimaster_authorization()` 只做存在性校验，缺失即报错。

## 部署 / 运行环境

### optkit-test 测试机（手动 SSH，非 AIMaster 申请）

- SSH：`ssh lyw@172.21.25.184`
- 远程仓库路径：`/Users/lyw/Documents/repository/optkit-test`
- 环境：`conda activate optkit-test`（绝对路径 `/Users/lyw/miniforge3/envs/optkit-test`，python 3.10.19）。
- 已装：`workflows 0.2.11`（force-reinstall，非 editable）、`am_tools 0.2.3`（2026-07-01）。
- 运行前必须 `export AM_MASTER_AUTHORIZATION='账号@meitu.com:token'`；0.2.11 起只读环境变量，缺失即 `RuntimeError`。
- 用途：optkit 相关测试的部署 / 运行机器（macOS x86_64 iMac，非 git 仓库，仅存脚本与部署 wheel）。
- 备注：记录时间 2026-07-01；连接凭证（密码 / key）不入库，按本机 SSH 配置处理。

## Workflows

- 

## Troubleshooting

- 

## Investigation Results

- 

## Decisions

- 

## Lessons Learned

- 硬编码明文凭证曾进过 git 历史；凭证一律走环境变量，泄露过的 token 需在源侧吊销/轮换（历史无法靠删代码抹除）。
