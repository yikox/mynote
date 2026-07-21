# workflows 项目管理

Last updated: 2026-07-21

## Overview

- 仓库：`/Users/chenzeyang/MTGIT/optkit-workspace/workflows`，git 远程 `git.mtlab.meitu.com:IPD/OPTG/personal/czy5/workflows.git`。
- 当前唯一有效用途是 optkit 自动测试的 AIMaster 编排（申请机器 → 启动 → SSH 下发 → 轮询 → 关机）；旧 Playwright/Jira scripts 不再作为目标能力维护。

## Current Status

| Field | Value |
| --- | --- |
| Version | 0.4.0（本地 `ae1df739`，比 origin/master 超前 1 提交） |
| State | 迁移前维护；目标为只读归档 |
| Current focus | 完成 legacy release 基线，并把有效代码迁入 `optkit-autotest` |

## Version and Release Notes

| Date | Version/Ref | Summary |
| --- | --- | --- |
| 2026-07-09 | ae1df73 (0.4.0，本地) | machine/config/auto_test 三模块重构；独立机器状态机、生命周期重试、终态关机；32 单测与真实 e2e 通过 |
| 2026-07-01 | d8e1f21 (0.2.11) | bump 版本 0.2.10→0.2.11，使含凭证安全修复的构建可识别并覆盖安装 |
| 2026-07-01 | d604027 | 移除硬编码 AIMaster 凭证，改从环境变量 `AM_MASTER_AUTHORIZATION` 读取 |
| 2026-07-01 | f596124 | 合入 optkit 自动测试健壮性修复（not_started 持续补发、SSH 超时放宽至 4h、启动断连重试、进度条） |

## Active Tasks

| Date | Task | Status | Next Step / Notes |
| --- | --- | --- | --- |
| 2026-07-21 | workflows 合并到团队级 `optkit-autotest` | designed | L3 设计已确认；以本地 `ae1df739` 迁移 machine/config/auto_test 与测试，旧 scripts 不迁；新链路验收后归档本仓库 |
| 2026-07-01 | 轮换/吊销已泄露的旧 AIMaster token（zyh8@meitu.com） | 进行中 | token 仍在 git 历史中，需在 AIMaster 侧吊销并换新值 |
| 2026-07-01 | optkit-test 机配置 `AM_MASTER_AUTHORIZATION` 环境变量 | 进行中 | 0.2.11 已只读环境变量，运行前需 export 新 token，否则报错 |
| 2026-07-09 | optkit_auto_test.py 重构：machine/config/auto_test 三模块 + 每机独立状态机 + 生命周期重试 | 已部署，待 CI 真实触发 | 32 单测通过；本地 e2e（cf5d2504）exit 0 自动关机；修复 launch shell 优先级 bug。07-09 已部署 lyw 机：workflows 0.3.2→0.4.0、am-tools 0.2.3→0.2.0（本仓编译，含 register_pubkey，远端旧版缺此函数）。下一步：推 commit 触发 CI 验证 |

## Requirements Backlog

| ID | Date | Requirement | Status | Priority | Module/Area | Next Step / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-20260721-autotest-repo-split | 2026-07-21 | 将 workflows 有效编排与 optkit auto_test 合入新仓库 | designed | 高 | workflows/optkit + tests + packaging/deployment | 先完成 legacy release 基线；再按设计导入双历史、shadow、切流和归档 |

## Design Documents

| Type | Path | Status | Notes |
| --- | --- | --- | --- |
| 跨项目 L3 架构变更 | `../optkit/architecture/changes/2026-07-21-optkit-autotest-repository-migration.md` | accepted | 新仓库边界、CI、历史迁移、切流、回滚与验收 |

## Milestones

| Milestone | Status | Notes |
| --- | --- | --- |

## Testing and Validation

- 单测：`python3 -m pytest tests/ -q`（2026-07-09 最新验证，32 passed；覆盖 machine 生命周期/SSH、契约函数、状态机重试）。
- 旧 `tests/test_optkit_auto_test.py` 已随重构删除，用例平移到 `test_machine.py` + `test_auto_test.py`。

## Deployment

- optkit-test 测试机（手动 SSH）：`ssh lyw@172.21.25.184`，路径 `/Users/lyw/Documents/repository/optkit-test`，环境 `optkit-test`（python 3.10，`/Users/lyw/miniforge3/envs/optkit-test`）。详见 `knowledge-summary.md`。
- 2026-07-09 部署现状：optkit-test Runner 已装 `workflows 0.4.0` 与本仓编译的 `am_tools 0.2.0`；迁移设计要求后者先发布为可重复获取的内部 wheel，随后取消 Runner 对手工安装 workflows wheel 的依赖。
- 2026-07-01 目录清理：删除全部旧 wheel（am_tools 0.1.x / workflows 0.1.0–0.2.6）、旧 log、swp、.DS_Store、impact*.json、chrome_data（约 50MB）；保留 capture_multicard*.py、query_machine.py、dm-ssh-proxy 二进制。
- 部署流程：本地 `python3 -m build --wheel` → `scp` wheel 到远程 → `envs/optkit-test/bin/pip install --force-reinstall --no-deps <whl>` → 装完删除远程 wheel。版本号不变时 pip 不会覆盖，改代码务必 bump 版本。

## Blockers and Risks

| Risk/Blocker | Impact | Mitigation/Status |
| --- | --- | --- |
| 旧 AIMaster token 遗留在 git 历史 | 凭证泄露 | 已从代码移除；需源侧吊销/轮换，历史无法靠删代码抹除 |

## ADR Summary

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-07-21 | workflows 不再独立演进，有效代码合入 `optkit-autotest`，验收后只读归档 | 当前没有其他消费者；测试执行与机器编排需要原子变更 |
| 2026-07-01 | AIMaster 凭证一律走环境变量，不硬编码 | 避免明文密钥进仓库与 git 历史 |

## Recent Updates

- 2026-07-21 - accepted 跨仓迁移设计：本仓库不再承担通用 workflows 定位；仅迁 `workflows/optkit/{auto_test,machine,config}.py` 与对应测试到 `optkit-autotest`，旧 Playwright/Jira scripts 不迁。以本地 `ae1df739` 为历史基线，legacy 观察期结束后本仓库只读归档。
- 2026-07-01 - 初始化项目记忆；记录 optkit-test 部署机、凭证改造、健壮性修复合入。
- 2026-07-01 - 清理 optkit-test 目录（释放约 50MB）；bump 0.2.11 并构建部署到该机，验证凭证走环境变量。
- 2026-07-09 - 重构 optkit 自动测试为 machine/config/auto_test 三模块（0.4.0）：SSH 改 am_tools.proxy 公钥注册+系统 ssh（ssh_session 已被 am_tools 移除）；每机独立生命周期线程（STARTING→SETUP→TESTING→终态，互不阻塞，终态必关机）；失败经 restart 重试一轮；冒烟 1 台（5090）/release 3 台；setup SSH 超时 4h→20min 并加 30min 总预算（修 12h CI 超时 SIGKILL 泄漏 3 台机器的事故根因）；退出码只看流程成败，test rc!=0 仅警告。
- 2026-07-09 - 本地真实 e2e 验证通过（cf5d2504，exit 0，机器自动回收无泄漏）；实机定位 launch 挂 20min 根因：`cd X && setsid ... &` 的 & 后台化整个列表、等待子 shell 握着 sshd 管道（paramiko 时代被 exit-status 语义掩盖），修复为 `{ setsid ... & }` 并加回归单测（32 passed）。
