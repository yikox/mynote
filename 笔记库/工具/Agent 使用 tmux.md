# Agent 使用 tmux

> Agent 使用 tmux，本质上是把 tmux 当成“持久化的交互式执行环境 + Agent 与人之间的交接面”。

## 1. 核心定位

```text
Agent
  ├─ 创建和管理 tmux session
  ├─ 向 pane 发送命令或按键
  ├─ 读取 pane、日志和状态
  └─ 根据结果继续、重试、停止或交给人处理
       │
       ▼
tmux server
  ├─ 保持 Shell / 程序继续运行
  ├─ 保存窗口和分屏状态
  └─ 允许人类重新 attach 接管
```

tmux 负责的是**运行环境和交互通道**，Agent 负责的是**决策循环**，真正执行工作的仍然是 Shell、编译器、测试程序或服务进程。

```text
Agent = 决策者
 tmux = 持久化终端工作区
Shell / 程序 = 执行者
日志 / 退出码 / health check = 状态来源
```

## 2. Agent 可以做什么

### 2.1 启动长期任务

Agent 可以在后台 session 中启动：

- 编译、测试和代码扫描；
- 开发服务器和模型服务；
- 下载、训练、数据处理等长任务；
- 远程机器上的部署命令。

即使 Agent 当前连接断开，tmux server 和 pane 中的程序仍可以继续运行。

### 2.2 发送命令和按键

Agent 不需要模拟人类的 `Ctrl-b` 前缀键，可以直接使用 tmux CLI：

```bash
tmux send-keys -t agent:main.0 'pytest -q' Enter
```

也可以向交互式程序发送输入：

```bash
tmux send-keys -t agent:main.0 'yes' Enter
tmux send-keys -t agent:main.0 C-c
```

这对需要 PTY 的程序有用，例如交互式 CLI、REPL、安装器和终端 UI。

### 2.3 读取运行状态

```bash
tmux capture-pane -t agent:main.0 -p -S -100
```

Agent 可以观察最近的输出，判断：

- 编译或测试是否结束；
- 服务是否启动成功；
- 是否出现交互式确认；
- 是否发生错误；
- 是否需要人类介入。

### 2.4 让人类随时接管

```bash
tmux attach -t agent-work
```

人类可以直接看到 Agent 的工作环境，继续输入命令、修复问题或中止任务。这使 tmux 很适合“Agent 自动执行，人类必要时接管”的工作流。

## 3. 常见的 session 结构

```text
agent-work session
├── window 0: main
│   └── pane 0: Agent / Shell
├── window 1: server
│   └── pane 0: 开发服务器或模型服务
└── window 2: logs
    └── pane 0: 日志观察
```

小任务可以只使用一个 session 和一个 pane；多服务项目则可以按职责拆分 window 或 pane。

## 4. 标准工作流程

### 4.1 创建或复用 session

```bash
SESSION=agent-work

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux new-session -d \
    -s "$SESSION" \
    -n main \
    -c "$PWD"
fi
```

也可以使用简单形式：

```bash
tmux new -As agent-work
```

### 4.2 启动任务

```bash
TARGET="agent-work:main.0"
tmux send-keys -t "$TARGET" 'pytest -q' Enter
```

长任务最好通过脚本启动，而不是把复杂命令直接拼进 `send-keys`：

```bash
tmux send-keys -t "$TARGET" \
  './run-task.sh > task.log 2>&1; printf "%s\n" "$?" > task.exit' Enter
```

### 4.3 轮询和判断

```bash
tail -n 80 task.log
cat task.exit 2>/dev/null || true
tmux capture-pane -t "$TARGET" -p -S -80
```

推荐的判断优先级：

```text
退出码 / status 文件
    ↓
日志文件
    ↓
HTTP health check 或其他业务检查
    ↓
capture-pane 的屏幕文本
```

`capture-pane` 适合观察人类可见状态，但屏幕内容可能包含 ANSI 控制码、截断文本、交互提示或旧输出，不应作为复杂服务唯一的成功判断依据。

### 4.4 成功、失败和人工接管

Agent 通常根据状态进入以下分支：

```text
任务完成
  └─ 读取结果，结束或进入下一步

任务失败
  ├─ 读取日志和退出码
  ├─ 修复命令或代码
  └─ 在同一 session 中重试

出现交互提示 / 不确定操作
  └─ 暂停并请求人类 attach 接管
```

### 4.5 清理

任务完成后可以关闭临时资源：

```bash
tmux kill-session -t agent-work
```

如果 session 需要保留供人类检查，则不要自动清理，只记录 session 名称和日志位置。

## 5. 典型使用场景

### 5.1 Coding Agent

```text
main pane：Agent 或 Shell
server pane：npm run dev / python server.py
logs pane：tail -f server.log
```

Agent 可以修改代码、运行测试、观察服务器日志，并让人类随时接管。

### 5.2 本地模型服务

```bash
tmux new-session -d -s qwen 'vllm serve model-path'
tmux capture-pane -t qwen -p -S -100
```

Agent 可以检查服务启动日志，再通过 HTTP health check 验证服务是否真正可用。

### 5.3 远程部署

长任务应在远程机器内部启动 tmux：

```bash
ssh server
tmux new -As deploy
```

不要只在本机 tmux 中运行 SSH，再把远程任务当作已经持久化；本机 tmux 保护的是本机 SSH 客户端，不一定能保护远程进程。

### 5.4 交互式 CLI

对于需要输入确认的工具，Agent 可以发送按键并观察输出：

```bash
tmux send-keys -t agent:main.0 'command-that-prompts' Enter
tmux capture-pane -t agent:main.0 -p -S -30
```

但如果命令提供非交互参数，应优先使用 `--yes`、`--non-interactive` 等选项，让任务变得可预测。

## 6. tmux 与其他执行方式的区别

| 方式 | 适合场景 | 特点 |
| --- | --- | --- |
| 直接执行 Shell 命令 | 短任务 | 简单、结果容易读取 |
| tmux | 长任务、交互式程序、人机交接 | 保留 PTY，可 attach |
| `nohup` / 后台进程 | 简单长任务 | 没有完整交互界面 |
| `launchd` / systemd | 服务托管 | 自动启动、重启和监控 |
| Docker / supervisor | 可复现服务 | 隔离、部署和生命周期管理 |

tmux 不是任务队列、进程监控器或自动重启系统。生产服务仍应使用 `launchd`、systemd、Docker 或专门的 supervisor。

## 7. 稳定性与安全注意事项

1. **每个任务使用独立 session 名称**，避免 Agent 误操作其他工作区。
2. **命令尽量写入脚本**，再由 tmux 启动，减少 `send-keys` 的引号和转义问题。
3. **不要用 `tmux kill-server` 做普通清理**，它会关闭当前用户的所有 session。
4. **不要只依赖屏幕文本**，使用退出码、日志文件和 health check。
5. **限制交互式确认**，危险命令应保留人工确认流程。
6. **注意输出中的秘密**，`capture-pane` 和日志可能包含 token、密码或私有数据。
7. **Agent 使用远程 tmux 时确认机器、用户和 session 名称**，避免在错误环境中执行命令。
8. **任务结束后决定是否保留 session**：保留方便复盘，清理避免后台进程泄漏。

## 相关资料

- [tmux 使用与逻辑](./tmux.md)
- [tmux 官方 GitHub](https://github.com/tmux/tmux)
- `man tmux` — 本机完整命令和配置手册
