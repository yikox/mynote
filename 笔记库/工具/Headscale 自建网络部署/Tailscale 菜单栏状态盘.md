# Tailscale 菜单栏状态盘

> macOS 官方 GUI 在 headscale 下无法管理 Exit Node，用 [SwiftBar](../SwiftBar.md) 把 CLI 输出
> 挂到菜单栏，接管状态展示与切换。

## 为什么需要

官方 GUI 的 Exit Nodes 页面永远显示 "No available exit nodes"，且菜单栏图标只有"连 / 未连"
两种状态，无法表达是否正走出口节点。原因与查证过程见
[Headscale 自建网络部署](../Headscale%20自建网络部署.md)。

结论是操作全部回到 CLI。但 CLI 解决不了"抬头一眼就知道现在有没有走代理"——这正是这个插件的
职责。

## 设计

### 需求边界：只解决展示

日常真实需求只有三件事：

| 需求 | CLI 够不够 |
| --- | --- |
| 开 / 关 Exit Node | 够，一个词，**比 GUI 快** |
| 确认当前是否走代理 | 够，但要主动敲命令 |
| 看有几台设备在线 | 够，`tailscale status` 信息比 GUI 全 |

三件事 CLI 全都不比 GUI 差，**唯一短板是"不主动查就不知道"**。所以插件职责被限定在展示，操作
只是顺带——这决定了后面所有取舍都优先保证刷新轻、状态准。

### 分层：一个 daemon + 一个 UI

```text
Tailscale.app  →  纯后台 daemon（不使用其界面）
      ↓ CLI
SwiftBar       →  唯一控制台
```

**Tailscale.app 不可卸载**，两个硬事实：

- macOS 上的开源 `tailscaled`（`brew install tailscale`）官方标注为
  *"exit nodes: partial; can advertise as exit node but **cannot use them**"*，正好卡死核心需求
- 真正的 daemon 是 System Extension，由 app 安装并托管，CLI 本身也是 app 包内的一个 binary：

```text
root  /Library/SystemExtensions/…/io.tailscale.ipn.macsys.network-extension.systemextension
zyc   /Applications/Tailscale.app/Contents/MacOS/Tailscale
```

所以 Tailscale.app 不是"GUI"，是 daemon 的宿主，GUI 只是它顺带的前端。**因此这不构成"两套 UI
并存"**：官方图标能表达的信息是 SwiftBar 的真子集，且不从它操作，等价于一盏指示灯。

### 状态设计

菜单栏只用三个符号，追求零阅读成本：

```text
⚪️              未连接
🟢              已连接，直连出网
🌐 vps-exit     已连接，走出口节点
```

只有第三种状态附带文字，因为这时才需要知道走的是哪台。MacBook Air 有刘海，菜单栏寸土寸金。

### 取舍

**出口 IP 查询不进轮询。** 3 秒一次的外部 HTTP 请求既慢又浪费，做成点击触发、结果走系统通知。
Exit Node 状态本身从本地 `status --json` 就能确定，不需要外部验证。

**在线判断只用客户端数据，不查服务端。** `headscale nodes list` 的在线状态在节点刚启动时会
短暂不准，`tailscale status` 才是准的。

**动作全部回调脚本自身、用 `jq` 不用 `python3`** 等通用写法的理由，见
[SwiftBar](../SwiftBar.md) 的「编写要点」。

## 脚本解析

工作副本 `~/work/2026/vps/tailscale.3s.sh`，以下逐段说明。

### 头部与动作分派

```bash
#!/bin/bash

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

脚本有两种运行身份：SwiftBar 定时调用（无参数，输出菜单）和菜单项点击回调（带动作参数，执行后
立刻 `exit`）。`case` 放最前面，让回调路径不必解析任何状态。

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

命令失败时**必须显示灰点而不是沿用旧状态**——状态盘最严重的失败是让人误以为在保护中。

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

`$STATE` 直接显示出来，因为 `Stopped` 和 `NeedsLogin` 的处理方式完全不同。

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

当前生效项渲染成不可点的 `✓`。用 `\t` 分隔而非空格，因为主机名可能含空格（如
`zy MacBook Pro`）。

### 设备列表与底部

```bash
echo "设备"
jq -r '.Peer[]? | "\(if .Online then "🟢" else "⚪️" end) \(.HostName)  \(.TailscaleIPs[0])"' <<<"$J" |
while read -r line; do echo "--$line | font=Menlo"; done

echo "---"
echo "显示出口 IP | bash=$0 param1=showip terminal=false"
echo "断开 | bash=$0 param1=down terminal=false refresh=true"
```

"显示出口 IP" 不带 `refresh=true`：它不改变任何状态，刷新纯属浪费。

## 挂载

```bash
DIR="$HOME/Library/Application Support/SwiftBar/Plugins"
ln -sf ~/work/2026/vps/tailscale.3s.sh "$DIR/tailscale.3s.sh"
```

用软链，脚本本体留在工作目录，改完 3 秒生效。SwiftBar 本身的安装见 [SwiftBar](../SwiftBar.md)。

## 已知问题

**官方菜单栏图标无法隐藏。** [tailscale#9238][fr] 从 2023-09 提出至今 OPEN。app 二进制里只有
`menuBarOnly` 和 `appPlusMenuBar` 两种模式，菜单栏是必选项；Dock 图标可以关（设置里的
Hide Dock icon）。

**实测现象**：装上本插件后官方 Tailscale 图标消失了。原因是菜单栏空间被挤爆（刘海屏的静默行为，
见 [SwiftBar](../SwiftBar.md) 的已知问题），不是配置被改。由于本插件的信息是官方图标的超集，
被挤掉没有信息损失，可以接受。

[fr]: https://github.com/tailscale/tailscale/issues/9238 "FR: Hide macOS menubar icon"
