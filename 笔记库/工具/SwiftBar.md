# SwiftBar

> 把任意脚本的标准输出显示到 macOS 菜单栏的开源壳子。用来给已有的 CLI 补上"常驻可见"。

## 是什么

SwiftBar 自己不含任何业务逻辑。你写一个脚本，它 `print` 什么就在菜单栏显示什么；多 print 几行
就变成点击后的下拉菜单，每一项可以绑定一条命令。

所以它解决的**不是功能问题，而是常驻可见性问题**。适用判断很简单：

- 已经有能用的 CLI，只是不主动敲就不知道状态 → 适合
- 功能本身还不存在 → 先写好 CLI，SwiftBar 不负责这个
- 需要复杂交互（表单、多步流程）→ 不适合，它只有菜单

| | |
| --- | --- |
| 安装 | `brew install --cask swiftbar` |
| 版本 | 2.1.1（2026-08） |
| 协议 | MIT |
| 要求 | macOS ≥ 12 |
| 同类 | 前身 BitBar 已停更；xbar 仍挂 beta。SwiftBar 是 Swift 原生，更省电 |

## 插件模型

**文件名即配置**，格式 `{名字}.{刷新间隔}.{扩展名}`：

```text
tailscale.3s.sh     每 3 秒重跑一次
weather.10m.py      每 10 分钟
disk.1h.py          每小时
```

间隔单位 `s` / `m` / `h` / `d`。脚本放进插件目录、加可执行权限即可，语言不限。

```bash
brew install --cask swiftbar

DIR="$HOME/Library/Application Support/SwiftBar/Plugins"
mkdir -p "$DIR"
defaults write com.ameba.SwiftBar PluginDirectory -string "$DIR"   # 跳过首次启动的目录选择引导

ln -sf ~/path/to/myplugin.3s.sh "$DIR/"    # 软链而非复制：改脚本即时生效，本体归工作目录管理
open -a SwiftBar
```

## 输出协议

```text
🟢 vps-exit              ← 第一段：菜单栏上显示的内容
---                      ← 分隔线
已连接 · hs.yiko.site    ← 第二段：下拉菜单项
出口节点
--vps-exit | bash=… terminal=false refresh=true
                         ← 两个减号前缀 = 二级菜单
```

常用参数写在 `|` 之后：

| 参数 | 作用 |
| --- | --- |
| `bash=` / `param1=` … | 点击时执行的命令与参数 |
| `terminal=false` | 后台执行，不弹终端窗口 |
| `refresh=true` | 执行完立刻重跑插件刷新显示 |
| `font=` / `size=` / `color=` | 排版；等宽对齐用 `font=Menlo` |
| `sfimage=` | 用 SF Symbols 图标代替 emoji |

插件类型除常规的"跑完即退"外，还支持 Streamable（长驻进程持续输出）、Shortcuts（调用系统
快捷指令）、Ephemeral（通过 URL scheme 临时插入菜单项）。日常够用的是常规型。

## 编写要点

**菜单项文本里的 `|` 会被当作参数分隔符**，正文中必须避开，否则后半截会被当成参数解析。

**动作用 `bash=<脚本自身> param1=<动作>` 回调**，不要在菜单项里直接拼命令。带 `=` 和空格的参数
在 SwiftBar 的引号规则下极易出错；让脚本开头用 `case "$1"` 分派，一次性绕开，也把逻辑收在一处。

**但不能直接写 `bash=$0`。** 插件目录路径是
`~/Library/Application Support/SwiftBar/Plugins`，`Application Support` 中间那个空格会把
`bash=` 的值截断，**表现为点击完全没反应、也没有任何报错**。若插件是软链，解析回本体路径即可
避开；无论如何都要绝对化并加引号：

```bash
SELF=$(readlink "$0" 2>/dev/null); [ -n "$SELF" ] || SELF="$0"
SELF="$(cd "$(dirname "$SELF")" && pwd)/$(basename "$SELF")"

echo "断开 | bash=\"$SELF\" param1=down terminal=false refresh=true"
```

调试办法：直接从软链路径运行插件（`"$DIR/x.3s.sh"`），肉眼检查输出里的 `bash=` 是不是完整
路径——SwiftBar 静默失败，不看输出查不出来。

**刷新间隔按数据来源定，不按"想多快看到"定。** 读本地状态（文件、socket、本机命令）可以 3 秒；
凡是发网络请求的，一律别放进轮询——做成菜单项点击触发，结果走系统通知：

```bash
osascript -e "display notification \"内容\" with title \"标题\""
```

**取数失败时必须显式降级，不能沿用旧显示。** 状态盘最严重的失败模式是让人误以为一切正常。命令
失败就画一个灰点，别装作没事。

**当前生效项渲染成不可点。** 点自己没有意义，还容易误触。

**解析 JSON 优先 `jq`。** macOS 自带 `/usr/bin/jq`，比每几秒起一次 Python 解释器轻一个数量级。

## 已知问题：菜单栏空间会静默挤爆

刘海屏上图标数量超限时，macOS 会把靠右的图标藏到刘海后面，**且不作任何提示**。新增插件后某个
原有图标突然消失，多半是这个原因，不是配置被改。验证方法：退出 SwiftBar，看消失的图标是否回来。

要精确控制留哪些图标，可用 Ice（开源）或 Bartender 折叠管理。
