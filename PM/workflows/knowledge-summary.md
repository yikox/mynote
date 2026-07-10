# workflows 知识总结

Last updated: 2026-07-01

本仓库：`/Users/chenzeyang/MTGIT/workflows` —— aimaster 与 jira 的 Playwright 自动化工作流，含 `workflows/optkit/` 下的 optkit 自动测试编排。

## 验证过的命令

- 运行测试：`python3 -m pytest tests/ -q`（2026-07-09 验证，32 passed；旧 test_optkit_auto_test.py 已随重构删除）。
- 构建 wheel：`python3 -m build --wheel`（产物在 `dist/`，2026-07-01 验证）。
- 部署到 optkit-test 机（2026-07-01 验证）：`scp dist/workflows-<ver>-py3-none-any.whl lyw@172.21.25.184:/Users/lyw/Documents/repository/optkit-test/` → 远程 `/Users/lyw/miniforge3/envs/optkit-test/bin/pip install --force-reinstall --no-deps <whl>`。
- **注意**：pip 以版本号判断是否覆盖，改代码不 bump 版本则 `install` 不会更新已装包；每次发布务必 bump `pyproject.toml` 的 `version`。

## 架构与结构

- `workflows/optkit/`（0.4.0 起三模块，旧 optkit_auto_test.py 已删）：
  - `machine.py`——AIMaster 机器对象（apply/start/restart/status/run/stop），SSH 惰性建链走 `am_tools.proxy`（ensure_pubkey + register_pubkey + 系统 ssh；旧 `am_tools.ssh_session` 已被 am_tools 移除）；
  - `config.py`——机器规格与各阶段预算常量（setup 单命令 20min、总预算 30min、生命周期 release 11h / pre 4h）；
  - `auto_test.py`——契约函数 + 每机独立生命周期线程（STARTING→SETUP→TESTING→终态，互不阻塞，终态必关机）+ restart 重试一轮 + 监督者。冒烟（pre）1 台 5090，release 3 机型。
- 退出码语义：0 ⟺ 全部机器 DONE；test rc!=0 只警告（测试内容对错归结果网站，CI 只对流程负责）。
- AIMaster 凭证从环境变量 `AM_MASTER_AUTHORIZATION`（格式 `账号@meitu.com:token`）读取，不再硬编码；缺失即报错。

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

- **ssh 后台启动命令挂死（2026-07-09 实机定位，教训级）**：`ssh host "cd X && setsid cmd > log 2>&1 < /dev/null &"` 中 `&` 绑定**整个 && 列表**——bash 把列表后台化成子 shell 后退出，但子 shell**前台等待 cmd 整棵树**且握着 sshd 会话的 stdout/stderr 管道 → sshd 不关 channel → OpenSSH 客户端挂到树跑完（曾令 launch 挂满 20min 超时；paramiko 旧实现读到 exit-status 即返回，掩盖了此 bug 多年）。修复：`cd X && { setsid cmd > log 2>&1 < /dev/null & }`，让 `&` 只绑定 setsid。验证判据：launch 后远端不应有 `bash -c cd ...` 包装进程驻留。
- dm-proxy 机器的 ssh config（am_tools 写入）含 `ControlMaster auto + ControlPersist 10m`：连接复用自动生效；调试时用独立 `-o ControlPath=` 可精确控制 master 生命周期，`ssh -O check/exit` 查看/关闭。

## Investigation Results

- 

## Decisions

- 

## Lessons Learned

- 硬编码明文凭证曾进过 git 历史；凭证一律走环境变量，泄露过的 token 需在源侧吊销/轮换（历史无法靠删代码抹除）。
