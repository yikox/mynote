# tmux

> tmux（terminal multiplexer）把终端显示与 Shell/程序进程分离，让程序在终端窗口关闭、SSH 连接断开后仍能继续运行，并可以重新连接恢复现场。

## 1. 核心逻辑

tmux 自己不执行命令，真正执行命令的仍然是 zsh、bash 或其他 Shell。tmux 负责管理伪终端、窗口布局、输入输出和会话生命周期。

```text
Terminal.app / iTerm2 / SSH
          │
          ▼
      tmux client
          │ Unix socket
          ▼
      tmux server
          │
          └─ session
               └─ window
                    └─ pane
                         └─ PTY
                              └─ zsh / 程序
```

### 1.1 各层对象

| 对象        | 含义                                                  |
| ----------- | ----------------------------------------------------- |
| **client**  | 当前 Terminal/iTerm2 中连接 tmux 的客户端             |
| **server**  | 后台 tmux 服务，保存 session、window、pane 和终端状态 |
| **session** | 一个持久化工作区，例如一个项目或一台远程机器          |
| **window**  | session 中的虚拟标签页                                |
| **pane**    | window 中的分屏终端，每个 pane 都有独立 PTY 和 Shell  |
| **PTY**     | tmux 与 Shell/程序之间的伪终端                        |

### 1.2 输入输出路径

```text
键盘
  ↓
Terminal/iTerm2
  ↓
tmux client
  ↓ Unix socket
tmux server
  ↓
当前 pane 的 PTY
  ↓
zsh / 程序
```

程序输出沿相反方向回到屏幕。关闭 Terminal 通常只会关闭 client，tmux server 和 pane 中的程序仍然存在。

### 1.3 为什么断开后还能恢复

```bash
tmux new -s work
```

创建的结构大致是：

```text
work session
└── window 0
    └── pane 0
        └── zsh / 当前程序
```

按下分离快捷键后：

```text
tmux client      退出
 tmux server     继续运行
 Shell / 程序   继续运行
```

重新连接：

```bash
tmux attach -t work
```

新的 client 会接管原来的 session，并恢复窗口、pane 和滚动内容。

## 2. 简单使用（macOS）

### 2.1 安装

macOS 上推荐使用 Homebrew：

```bash
brew install tmux
tmux -V
```

然后创建第一个 session：

```bash
tmux new -s work
```

Terminal.app 和 iTerm2 都只是 tmux 的显示前端，Apple Silicon 与 Intel Mac 在 tmux 的逻辑上没有区别。

### 2.2 tmux 操控的维度

tmux 不是只有一个“窗口”概念，而是一个层级结构：

```text
server
└── session          生命周期和工作区
    ├── window 0     标签页
    │   ├── pane 0   实际运行 Shell/程序的终端
    │   └── pane 1
    └── window 1
```

| 你要做的事情 | 主要操作对象 |
| --- | --- |
| 创建、分离、重新接入、整体关闭 | **session** |
| 新建标签、切换标签、重命名标签 | **window** |
| 分屏、切换分屏、关闭分屏 | **pane** |
| 当前终端连接 | **client**，它只是显示连接，不是工作区 |

因此，日常可以这样理解：

```text
session = 项目工作区
window  = 标签页
pane    = 真正执行命令的终端
```

命令也可以用目标地址定位对象：

```text
session:window.pane
例如：work:1.0
```

### 2.3 创建、关闭、分离与重新接入

#### 创建并进入

```bash
tmux new -s work
```

这条命令会启动 tmux server，并创建：

```text
work session
└── window 0
    └── pane 0
        └── zsh
```

随后在这个 pane 中运行命令即可：

```bash
python server.py
```

#### 分离但不关闭

当程序正在运行时，执行：

```text
1. 按住 Control，按 b
2. 松开 Control 和 b
3. 再单独按 d
```

也就是：

```text
Ctrl-b，然后松开，再按 d
```

**不能一直按住 Ctrl 再按 d**；那会变成 `Ctrl-d`，不会执行 tmux 的 detach 操作。分离后，client 退出，但 session、pane 和程序继续运行。

也可以使用命令：

```bash
tmux detach-client
```

#### 查看并重新接入

```bash
tmux ls
tmux attach -t work
```

更方便的“有则接入、无则创建”：

```bash
tmux new -As work
```

#### 关闭

关闭有不同范围：

```bash
exit                         # 退出当前 pane 的 Shell
tmux kill-window -t work:0   # 关闭一个 window
tmux kill-session -t work    # 关闭整个 session 及其中的 pane
tmux kill-server             # 关闭当前用户的所有 tmux session
```

也可以使用快捷键：

```text
Prefix x    关闭当前 pane
Prefix &    关闭当前 window
```

`exit`、关闭 pane、关闭 window 和关闭 session 都会终止其中仍在运行的前台程序；**分离（detach）则不会**。

### 2.4 Window 和 Pane 的基本操作

```text
Prefix c    新建 window
Prefix n/p  切换下一个/上一个 window
Prefix %    左右分屏
Prefix "    上下分屏
Prefix o    切换 pane
Prefix z    放大或恢复当前 pane
Prefix x    关闭当前 pane
```

一个常见的开发工作区可能是：

```text
work session
├── window 0: editor
│   ├── pane 0: vim
│   └── pane 1: shell
└── window 1: server
    ├── pane 0: API server
    └── pane 1: logs
```

### 2.5 前缀键：必须先松开 Ctrl

tmux 默认前缀键是 `Ctrl-b`，它不是一个完整命令，而是告诉 tmux：

> 接下来按的键是 tmux 操作，而不是发送给 Shell。

正确操作顺序：

```text
1. 按住 Control，按 b
2. 松开 Control 和 b
3. 再单独按 d
```

也就是：

```text
Ctrl-b，然后松开，再按 d
```

**不要把 `Ctrl-b-d` 三个键同时按住。** 特别是按 `d` 时必须已经松开 `Ctrl`，否则 tmux 收到的是 `Ctrl-d`，不是分离命令。

如果当前不在 tmux 中，`Ctrl-b` 只是普通 Shell 的按键输入，不会产生 tmux 行为。可以检查：

```bash
echo "$TMUX"
```

有输出通常表示当前在 tmux 内；没有输出则需要先运行 `tmux new -s work`。

### 2.4 常用前缀操作

下表中的 `Prefix` 默认就是 `Ctrl-b`，每个操作都要先按并**松开** `Ctrl-b`，再按第二个键：

| 按键             | 作用                          |
| ---------------- | ----------------------------- |
| `Prefix d`       | 分离当前 client，程序继续运行 |
| `Prefix c`       | 新建 window                   |
| `Prefix n` / `p` | 下一个 / 上一个 window        |
| `Prefix 0`–`9`   | 切换到对应编号的 window       |
| `Prefix %`       | 左右分屏                      |
| `Prefix "`       | 上下分屏                      |
| `Prefix o`       | 切换 pane                     |
| `Prefix z`       | 放大或恢复当前 pane           |
| `Prefix x`       | 关闭当前 pane                 |
| `Prefix [`       | 进入滚动/复制模式             |
| `Prefix ]`       | 粘贴                          |
| `Prefix s`       | 选择 session                  |
| `Prefix w`       | 选择 window                   |
| `Prefix ,`       | 重命名 window                 |
| `Prefix :`       | 打开 tmux 命令行              |

关闭 pane 中的 Shell：

```bash
exit
```

如果这是 window 的最后一个 pane，window 会关闭；如果这是 session 的最后一个 window，session 也会关闭，最后一个 session 退出后 tmux server 通常也会结束。

## 3. macOS 特有的理解

### 3.1 Terminal 标签页和 tmux window 不是一回事

```text
⌘T              Terminal/iTerm2 的标签页
Prefix c        tmux 的 window
⌘W              关闭 macOS 终端窗口
Prefix d        只断开 tmux client
```

macOS 的 `Command` 快捷键默认由 Terminal/iTerm2 处理；tmux 的快捷键通常使用 `Control-b`。

### 3.2 SSH 场景

如果 tmux 在本机、SSH 在 pane 内：

```text
本机 tmux
└── SSH 连接
    └── 远程程序
```

本机或 SSH 连接断开时，远程程序仍可能收到断开信号。远程长任务应在远程机器上启动 tmux：

```bash
ssh server
tmux new -As work
```

这样结构是：

```text
远程服务器
└── tmux server
    └── 远程程序
```

### 3.3 macOS 剪贴板

可以在 `~/.tmux.conf` 中加入：

```tmux
set -g mouse on
set -g default-terminal "screen-256color"
set -as terminal-features ",*:RGB"

bind-key -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "pbcopy"
```

进入复制模式后按 `y`，选中的内容会写入 macOS 剪贴板。`pbcopy` 和 `pbpaste` 是 macOS 自带的剪贴板命令。

### 3.4 tmux 不是 macOS 服务管理器

tmux 适合开发、实验和需要人工接管的长期任务：

```bash
tmux new -s api
python server.py
```

如果要求开机启动、崩溃重启和系统级托管，应使用 macOS 的 `launchd`。tmux 只负责保持交互式终端工作区，不负责可靠地监控服务。

## 4. 配置文件

配置文件通常是：

```text
~/.tmux.conf
```

修改后重新加载：

```bash
tmux source-file ~/.tmux.conf
```

常见配置：

```tmux
# 鼠标支持：滚动、选择 pane、拖动边界
set -g mouse on

# 使用 vi 风格复制模式
setw -g mode-keys vi

# 更换前缀键为 Ctrl-a
unbind C-b
set -g prefix C-a
bind C-a send-prefix
```

如果使用 `Ctrl-a`，之后的操作就变为：

```text
Ctrl-a，然后松开，再按 d
```

## 5. 自动化与脚本控制

tmux 的命令行接口可以让脚本或 Agent 创建工作区、启动程序、发送输入和读取输出：

```bash
# 后台创建 session 并启动服务
tmux new-session -d -s api 'python server.py'

# 向指定 session 发送按键
tmux send-keys -t api 'echo ready' Enter

# 读取当前 pane 的屏幕内容
tmux capture-pane -t api -p

# 查看所有 pane
tmux list-panes -a
```

常见自动化结构：

```text
脚本 / Agent
   ├─ 创建 session
   ├─ 启动服务
   ├─ 发送命令
   ├─ capture-pane 读取状态
   └─ 保持后台运行
```

如果程序本身有日志文件、HTTP 健康检查或 API，优先使用这些稳定接口；`capture-pane` 适合人工可见状态和简单实验，不适合作为复杂服务的唯一监控接口。

## 6. 排错清单

### 按快捷键没有反应

1. 确认当前在 tmux 内：

   ```bash
   echo "$TMUX"
   ```

2. 确认操作顺序：`Ctrl-b` 后必须松开，再按 `d`。
3. 确认没有改过前缀键：

   ```bash
   tmux show-options -g prefix
   ```

4. 直接使用命令验证：

   ```bash
   tmux detach-client
   ```

### Session 找不到

```bash
tmux ls
```

如果没有目标 session，可能是 Shell 已退出、session 被删除，或 session 在另一台机器上。tmux session 默认只存在于创建它的那台机器和用户账户中。

### SSH 断开后任务消失

检查 tmux 是运行在本机还是远程主机。长任务应在远程主机内部运行 tmux，而不是在本机 tmux 中嵌套 SSH。

## 相关资料

- [tmux 官方 GitHub](https://github.com/tmux/tmux)
- `man tmux` — 本机完整命令和配置手册
- [tmux Wiki](https://github.com/tmux/tmux/wiki)
