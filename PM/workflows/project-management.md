# workflows 项目管理

Last updated: 2026-07-01

## Overview

- 仓库：`/Users/chenzeyang/MTGIT/workflows`，git 远程 `git.mtlab.meitu.com:IPD/OPTG/personal/czy5/workflows.git`。
- 用途：aimaster 与 jira 的 Playwright 自动化工作流；核心为 `workflows/optkit/` 下的 optkit 自动测试编排（申请机器 → 触发启动 → 轮询等待 → SSH 下发测试 → 轮询完成 → 关机）。

## Current Status

| Field | Value |
| --- | --- |
| Version | 0.2.11 |
| State | 活跃维护 |
| Current focus | optkit 自动测试健壮性与凭证安全 |

## Version and Release Notes

| Date | Version/Ref | Summary |
| --- | --- | --- |
| 2026-07-01 | d8e1f21 (0.2.11) | bump 版本 0.2.10→0.2.11，使含凭证安全修复的构建可识别并覆盖安装 |
| 2026-07-01 | d604027 | 移除硬编码 AIMaster 凭证，改从环境变量 `AM_MASTER_AUTHORIZATION` 读取 |
| 2026-07-01 | f596124 | 合入 optkit 自动测试健壮性修复（not_started 持续补发、SSH 超时放宽至 4h、启动断连重试、进度条） |

## Active Tasks

| Date | Task | Status | Next Step / Notes |
| --- | --- | --- | --- |
| 2026-07-01 | 轮换/吊销已泄露的旧 AIMaster token（zyh8@meitu.com） | 进行中 | token 仍在 git 历史中，需在 AIMaster 侧吊销并换新值 |
| 2026-07-01 | optkit-test 机配置 `AM_MASTER_AUTHORIZATION` 环境变量 | 进行中 | 0.2.11 已只读环境变量，运行前需 export 新 token，否则报错 |

## Requirements Backlog

| ID | Date | Requirement | Status | Priority | Module/Area | Next Step / Notes |
| --- | --- | --- | --- | --- | --- | --- |

## Design Documents

| Type | Path | Status | Notes |
| --- | --- | --- | --- |

## Milestones

| Milestone | Status | Notes |
| --- | --- | --- |

## Testing and Validation

- 单测：`python3 -m pytest tests/test_optkit_auto_test.py -q`（2026-07-01 验证，30 passed）。

## Deployment

- optkit-test 测试机（手动 SSH）：`ssh lyw@172.21.25.184`，路径 `/Users/lyw/Documents/repository/optkit-test`，环境 `optkit-test`（python 3.10，`/Users/lyw/miniforge3/envs/optkit-test`）。详见 `knowledge-summary.md`。
- 2026-07-01 部署现状：已装 `workflows 0.2.11`（force-reinstall，非 editable）、`am_tools 0.2.3`；代码已确认无硬编码密钥、缺凭证会报错。
- 2026-07-01 目录清理：删除全部旧 wheel（am_tools 0.1.x / workflows 0.1.0–0.2.6）、旧 log、swp、.DS_Store、impact*.json、chrome_data（约 50MB）；保留 capture_multicard*.py、query_machine.py、dm-ssh-proxy 二进制。
- 部署流程：本地 `python3 -m build --wheel` → `scp` wheel 到远程 → `envs/optkit-test/bin/pip install --force-reinstall --no-deps <whl>` → 装完删除远程 wheel。版本号不变时 pip 不会覆盖，改代码务必 bump 版本。

## Blockers and Risks

| Risk/Blocker | Impact | Mitigation/Status |
| --- | --- | --- |
| 旧 AIMaster token 遗留在 git 历史 | 凭证泄露 | 已从代码移除；需源侧吊销/轮换，历史无法靠删代码抹除 |

## ADR Summary

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-07-01 | AIMaster 凭证一律走环境变量，不硬编码 | 避免明文密钥进仓库与 git 历史 |

## Recent Updates

- 2026-07-01 - 初始化项目记忆；记录 optkit-test 部署机、凭证改造、健壮性修复合入。
- 2026-07-01 - 清理 optkit-test 目录（释放约 50MB）；bump 0.2.11 并构建部署到该机，验证凭证走环境变量。
