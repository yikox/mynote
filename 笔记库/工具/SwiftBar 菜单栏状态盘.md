# SwiftBar 菜单栏状态盘

> 用 SwiftBar 把 CLI 输出挂到 macOS 菜单栏，替代官方 Tailscale GUI 的状态展示职能。
> 本篇先讲 SwiftBar 本身，再讲这次基于它的设计与取舍。

## SwiftBar 是什么

**把任意脚本的标准输出显示到 macOS 菜单栏的开源壳子。**

它自己不含任何业务逻辑。你写一个脚本，它 `print` 什么就在菜单栏显示什么；多 print 几行就变成
点击后的下拉菜单，每一项可以绑定一条命令。所以它解决的不是"功能"问题，而是**常驻可见性**问题
——已经有能用的 CLI，缺的只是一个把状态挂在屏幕上的壳。

| | |
| --- | --- |
| 安装 | `brew install --cask swiftbar` |
| 版本 | 2.1.1（2026-08） |
| 协议 | MIT |
| 要求 | macOS ≥ 12 |
| 同类 | 前身 BitBar 已停更；xbar 仍挂 beta。SwiftBar 是 Swift 原生，更省电 |

### 插件模型

**文件名即配置**，格式 `{名字}.{刷新间隔}.{扩展名}`：

```text
tailscale.3s.sh     每 3 秒重跑一次
weather.10m.py      每 10 分钟
```

间隔单位 `s` / `m` / `h` / `d`。脚本放进插件目录（默认
`~/Library/Application Support/SwiftBar/Plugins`），加可执行权限即可。

### 输出协议

```text
🟢 vps-exit              ← 第一段：菜单栏上显示的内容
---                      ← 分隔线
已连接 · hs.yiko.site    ← 第二段：下拉菜单项
出口节点
--vps-exit | bash=... terminal=false refresh=true
                         ← 两个减号前缀 = 二级菜单
```

常用参数（写在 `|` 之后）：

| 参数 | 作用 |
| --- | --- |
| `bash=` / `param1=` … | 点击时执行的命令与参数 |
| `terminal=false` | 后台执行，不弹终端窗口 |
| `refresh=true` | 执行完立刻重跑插件刷新显示 |
| `font=` / `size=` / `color=` | 排版；等宽对齐用 `font=Menlo` |
| `sfimage=` | 用 SF Symbols 图标代替 emoji |

注意菜单项文本里的 `|` 会被当作参数分隔符，正文中要避开。

## 为什么这次需要它

macOS 官方 Tailscale GUI 在 headscale 下**无法**列出 Exit Node，且菜单栏图标只有"连/未连"
两种状态，无法表达是否正走出口节点。原因与查证过程见
[Headscale 自建网络部署](./Headscale%20自建网络部署.md)。

结论是操作全部回到 CLI，但 CLI 无法解决"抬头一眼就知道现在有没有走代理"。这正是 SwiftBar
的定位。

## 设计

### 需求边界：只解决展示

先拆清楚到底缺什么。日常真实需求只有三件事：

| 需求 | CLI 够不够 |
| --- | --- |
| 开 / 关 Exit Node | 够，一个词，**比 GUI 快** |
| 确认当前是否走代理 | 够，但要主动敲命令 |
| 看有几台设备在线 | 够，`tailscale status` 信息比 GUI 全 |

三件事 CLI 全都不比 GUI 差。**唯一的短板是"不主动查就不知道"**。所以 SwiftBar 的职责被限定
在展示，操作只是顺带——这决定了后面所有取舍都优先保证"刷新轻、状态准"。

### 分层：一个 daemon + 一个 UI

```text
Tailscale.app  →  纯后台 daemon（不使用其界面）
      ↓ CLI
SwiftBar       →  唯一控制台
```

**Tailscale.app 不可卸载**，两个硬事实：

- macOS 上开源 `tailscaled`（`brew install tailscale`）官方标注为
  *"exit nodes: partial; can advertise as exit node but **cannot use them**"*，
  正好卡死核心需求
- 真正的 daemon 是 System Extension，由 app 安装并托管，CLI 本身也是 app 包内的一个 binary：

```text
root  /Library/SystemExtensions/…/io.tailscale.ipn.macsys.network-extension.systemextension
zyc   /Applications/Tailscale.app/Contents/MacOS/Tailscale
```

所以 Tailscale.app 不是"GUI"，是 daemon 的宿主，GUI 只是它顺带的前端。这不构成"两套 UI 并存"
——官方图标能表达的信息是 SwiftBar 的真子集，且不从它操作，等价于一盏指示灯。

### 状态设计

菜单栏只用三个符号，追求零阅读成本：

```text
⚪️              未连接
🟢              已连接，直连出网
🌐 vps-exit     已连接，走出口节点
```

只有第三种状态附带文字，因为这时才需要知道"走的是哪台"。MacBook Air 有刘海，菜单栏寸土寸金。

### 三个取舍

**动作全部回调脚本自身**，而不是让 SwiftBar 直接拼 `tailscale set --exit-node=…`。菜单项里带
`=` 和空格的参数在 SwiftBar 的引号规则下极易出错，集中分派一次性绕开。

**出口 IP 查询不进轮询。** 3 秒一次的外部 HTTP 请求既慢又浪费，做成点击触发、结果走系统通知。
Exit Node 状态本身从本地 `status --json` 就能确定，不需要外部验证。

**用 `jq` 不用 `python3`。** 系统自带 `/usr/bin/jq`，每 3 秒起一次解释器的开销差一个数量级。

## 脚本解析

完整脚本见本笔记，以下逐段说明。工作副本位于 `~/work/2026/vps/tailscale.3s.sh`。

### 头部与动作分派

```bash
#!/bin/bash
#
# SwiftBar 插件：Tailscale 状态展示与出口节点控制

TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale

case "$1" in
  exit-on)  "$TS" set --exit-node="$2"; exit ;;
  exit-off) "$TS" set --exit-node=;     exit ;;
  up)       "$TS" up;                   exit ;;
  down)     "$TS" down;                 exit ;;
  showip)
    ip=$(curl -s --max-time 10 ifconfig.me)
    osascript -e "display notification \"${ip:-查询失败}\" with title \"当前出口 IP\""
    exit ;;
esac
```

脚本有两种运行身份：SwiftBar 定时调用（无参数，输出菜单）和菜单项点击回调（带动作参数，执行
后立刻 `exit`）。`case` 放在最前面，让回调路径不必解析任何状态。

`${ip:-查询失败}` 保证 curl 超时时通知里不是空白。

### 取状态与防误报

```bash
J=$("$TS" status --json 2>/dev/null)

if [ -z "$J" ]; then
  echo "⚪️"
  echo "---"
  echo "Tailscale 未运行"
  exit
fi

STATE=$(jq -r '.BackendState // "Unknown"' <<<"$J")
TAILNET=$(jq -r '.CurrentTailnet.Name // "-"' <<<"$J")
EXITNAME=$(jq -r '[.Peer[]? | select(.ExitNode == true) | .HostName] | first // empty' <<<"$J")
```

命令失败时**必须显示灰点而不是沿用旧状态**——展示类工具最严重的失败是让人误以为在保护中。

`EXITNAME` 是整个插件的核心：当前出口节点就是 `Peer` 里 `ExitNode == true` 的那一个，没有则为
空。`.Peer[]?` 的问号容忍 `Peer` 字段缺失，`// empty` 让"没有出口节点"落到空串而非字符串
`null`。

### 菜单栏三态

```bash
if [ "$STATE" != "Running" ]; then
  echo "⚪️"
elif [ -n "$EXITNAME" ]; then
  echo "🌐 $EXITNAME"
else
  echo "🟢"
fi

echo "---"

if [ "$STATE" != "Running" ]; then
  echo "未连接（$STATE）"
  echo "连接 | bash=$0 param1=up terminal=false refresh=true"
  exit
fi

echo "已连接 · $TAILNET | font=Menlo"
echo "---"
```

未连接时下拉菜单只留"连接"一项就结束。**这一项不能省**：没有它，断开后就只能回去点官方图标，
"唯一控制台"随即破功。

`$STATE` 直接显示出来，`Stopped` 和 `NeedsLogin` 的处理方式完全不同。

### 出口节点

```bash
echo "出口节点"
if [ -n "$EXITNAME" ]; then
  echo "--关闭（直连） | bash=$0 param1=exit-off terminal=false refresh=true"
else
  echo "--✓ 关闭（直连） | font=Menlo"
fi
jq -r '.Peer[]? | select(.ExitNodeOption == true)
       | "\(.ExitNode)\t\(.HostName)\t\(.TailscaleIPs[0])"' <<<"$J" |
while IFS=$'\t' read -r active name ip; do
  if [ "$active" = "true" ]; then
    echo "--✓ $name | font=Menlo"
  else
    echo "--$name | bash=$0 param1=exit-on param2=$ip terminal=false refresh=true"
  fi
done
```

候选列表**动态生成**，筛选条件是 `ExitNodeOption == true`。以后加第二台出口节点会自动出现，
不硬编码 IP。

当前生效项渲染成不可点的 `✓`，不可点是刻意的——点自己没有意义，还容易误触。

用 `\t` 分隔而非空格，因为主机名可能含空格（如 `zy MacBook Pro`）。

### 设备列表与底部

```bash
echo "设备"
jq -r '.Peer[]? | "\(if .Online then "🟢" else "⚪️" end) \(.HostName)  \(.TailscaleIPs[0])"' <<<"$J" |
while read -r line; do echo "--$line | font=Menlo"; done

echo "---"
echo "显示出口 IP | bash=$0 param1=showip terminal=false"
echo "断开 | bash=$0 param1=down terminal=false refresh=true"
```

在线判断用客户端的 `.Online`，不查服务端——`headscale nodes list` 的在线状态在节点刚启动时会
短暂不准。

"显示出口 IP" 不带 `refresh=true`：它不改变任何状态，刷新纯属浪费。

## 安装

```bash
brew install --cask swiftbar

DIR="$HOME/Library/Application Support/SwiftBar/Plugins"
mkdir -p "$DIR"
defaults write com.ameba.SwiftBar PluginDirectory -string "$DIR"

# 用软链而非复制：改脚本即时生效，本体仍归工作目录管理
ln -sf ~/work/2026/vps/tailscale.3s.sh "$DIR/tailscale.3s.sh"

open -a SwiftBar
```

预写 `PluginDirectory` 可以跳过首次启动的目录选择引导。

## 已知问题

**官方菜单栏图标无法隐藏。** [tailscale#9238][fr] 从 2023-09 提出至今 OPEN。app 二进制里只有
`menuBarOnly` 和 `appPlusMenuBar` 两种模式，菜单栏是必选项。Dock 图标可以关（设置里的
Hide Dock icon）。

**菜单栏空间会挤爆。** 刘海屏上图标数量超限时，macOS 会把靠右的图标藏到刘海后面，且不作任何
提示（参见 [tailscale#18866][crowd]）。新增 SwiftBar 后官方 Tailscale 图标消失就是这个原因，
不是配置被改。要精确控制取舍可用 Ice（开源）折叠图标。

[fr]: https://github.com/tailscale/tailscale/issues/9238 "FR: Hide macOS menubar icon"
[crowd]: https://github.com/tailscale/tailscale/issues/18866 "Tailscale not shown in menu bar when too many apps are open"
