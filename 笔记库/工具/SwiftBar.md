# SwiftBar

> SwiftBar 是 macOS 菜单栏脚本工具：它定时执行一个脚本，把脚本的标准输出解析成菜单栏标题、下拉菜单和可点击动作。

SwiftBar 本身不提供业务功能。它解决的是“把已有 CLI、API 或本地状态变成常驻可见入口”：

```text
脚本 / CLI / API
       │ stdout
       ▼
SwiftBar 输出协议
       │
       ├─ 菜单栏标题
       ├─ 下拉菜单
       └─ 点击动作
```

适合：系统状态、Git/CI、网络服务、定时器、播放器、开发环境和个人自动化。复杂表单、多步骤界面或完整应用逻辑仍应交给独立程序，SwiftBar 只作为入口。

## 1. 简介与安装

### 1.1 Homebrew 安装

```bash
brew install --cask swiftbar
open -a SwiftBar
```

第一次启动时，SwiftBar 会要求选择 **Plugin Folder**。推荐使用默认目录：

```bash
mkdir -p "$HOME/Library/Application Support/SwiftBar/Plugins"
```

如果已经启动，可以在 SwiftBar 的设置中重新选择插件目录。插件放入该目录、具有可执行权限后，SwiftBar 会自动发现；修改脚本后可在菜单中刷新。

### 1.2 手动安装

从 [SwiftBar Releases](https://github.com/swiftbar/SwiftBar/releases) 或 [swiftbar.app](https://swiftbar.app/) 下载应用，拖入 `/Applications` 后打开。若 macOS 第一次阻止运行，在 Finder 中右键应用并选择“打开”。

### 1.3 安装社区插件

SwiftBar 自带插件浏览入口，也可以从 [swiftbar-plugins](https://github.com/swiftbar/swiftbar-plugins) 下载脚本，放入 Plugin Folder：

```bash
cp example.5m.sh "$HOME/Library/Application Support/SwiftBar/Plugins/"
chmod +x "$HOME/Library/Application Support/SwiftBar/Plugins/example.5m.sh"
```

社区插件本质上是本机脚本，安装前应阅读源码，尤其检查网络请求、文件写入、密钥读取和 `sudo` 操作。

## 2. 简单使用

### 2.1 插件文件名

插件文件名通常是：

```text
{name}.{refresh-interval}.{extension}
```

例如：

```text
cpu.5s.sh       每 5 秒刷新
weather.10m.py  每 10 分钟刷新
git.1h.swift    每小时刷新
```

支持的时间单位包括 `ms`、`s`、`m`、`h`、`d`。扩展名只要能通过 shebang 执行即可，常见语言有 Bash、Python、Ruby、Swift、JavaScript 和编译后的二进制程序。

### 2.2 输出协议：如何展示

SwiftBar 按行解析标准输出：

```text
第一行                         菜单栏标题
---                            下拉菜单分隔线
菜单项                         下拉菜单内容
子菜单项                       更深一级菜单
菜单项 | 参数=值               菜单项属性
```

最小示例：

```bash
#!/bin/bash

echo "🟢 SwiftBar"
echo "---"
echo "当前时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo "SwiftBar GitHub | href=https://github.com/swiftbar/SwiftBar"
echo "刷新 | refresh=true"
```

输出中的 `|` 是参数分隔符；如果要显示包含 `|` 的普通文本，需要注意转义或改写内容。以 `--` 开头的菜单项可以创建子菜单：

```bash
echo "项目"
echo "--构建项目"
echo "--运行测试"
```

### 2.3 第一个脚本

创建一个每 10 秒刷新的插件：

```bash
PLUGIN_DIR="$HOME/Library/Application Support/SwiftBar/Plugins"
mkdir -p "$PLUGIN_DIR"

cat > "$PLUGIN_DIR/hello.10s.sh" <<'EOF'
#!/bin/bash

echo "🟢 SwiftBar"
echo "---"
echo "当前时间：$(date '+%H:%M:%S')"
echo "当前用户：$USER"
echo "刷新 | refresh=true"
echo "打开终端 | bash=/usr/bin/open param1=-a param2=Terminal terminal=false"
EOF

chmod +x "$PLUGIN_DIR/hello.10s.sh"
open -a SwiftBar
```

脚本的第一行会显示在菜单栏；点击图标后，其余输出会显示为下拉菜单。

### 2.4 菜单项如何调用动作

常用动作有三类：

```text
打开网页 | href=https://example.com
执行脚本 | bash=/绝对路径/action.sh param1=start terminal=false
刷新插件 | refresh=true
```

常用参数：

| 参数 | 作用 |
| --- | --- |
| `href=` | 点击后打开 URL |
| `bash=` | 点击后执行绝对路径脚本 |
| `param1=`、`param2=` | 传给脚本的参数 |
| `terminal=false` | 后台执行，不打开终端窗口 |
| `terminal=true` | 在终端中执行 |
| `refresh=true` | 点击该菜单项时重新执行/刷新插件 |
| `color=` | 设置文字颜色 |
| `font=`、`size=` | 设置字体和大小 |
| `tooltip=` | 鼠标悬停提示 |
| `sfimage=` | 使用 SF Symbols 图标 |

动作最好回调插件自身，由插件统一分派参数，而不是把复杂 shell 命令直接拼在菜单项里：

```bash
#!/bin/bash

SELF="$(cd -- "$(dirname -- "$0")" && pwd)/$(basename -- "$0")"

case "${1:-show}" in
  refresh)
    # 在这里执行刷新、同步或其他动作
    ;;
  clear)
    rm -f "$HOME/Library/Caches/my-status.cache"
    ;;
  show)
    ;;
esac

echo "状态正常"
echo "---"
echo "刷新 | bash=\"$SELF\" param1=refresh terminal=false refresh=true"
echo "清理缓存 | bash=\"$SELF\" param1=clear terminal=false refresh=true"
```

`bash=` 应使用绝对路径并正确处理空格。SwiftBar 的插件目录通常位于 `Application Support` 下，直接写 `bash=$0` 可能因为路径中的空格被截断，表现为点击没有反应。

## 3. 进阶使用

### 3.1 选择合适的插件类型

#### Standard：定时执行

默认插件每次运行后退出，适合状态查询：

```text
battery.10s.sh
weather.10m.py
ci-status.5m.sh
```

不要让高频插件每次都访问慢速网络服务；网络数据应设置较长刷新周期、缓存和超时。

#### Streamable：持续输出

Streamable 插件适合 WebSocket、日志流、远程事件或实时行情，不适合用来替代普通轮询。可以通过 `streamable` 元数据声明，并持续向 stdout 输出；特殊分隔符 `~~~` 会通知 SwiftBar 更新当前显示。

```bash
#!/bin/bash
# streamable

while read -r event; do
  echo "事件：$event"
  echo "~~~"
done < <(tail -f "$HOME/events.log")
```

长驻进程必须处理退出、断线和异常，否则会成为后台泄漏进程。

#### Shortcuts：调用 macOS 快捷指令

SwiftBar 可以把 Shortcuts 的输出作为菜单栏插件，适合：

- 调用系统自动化；
- 操作 HomeKit、提醒事项和日历；
- 把非程序用户也能维护的流程放进菜单栏。

#### Ephemeral：临时菜单项

Ephemeral 插件通过 URL Scheme 或 Shortcut 临时创建菜单项，适合：

- 某个任务完成后的短暂提示；
- 外部程序发送的一次性状态；
- 不希望常驻的通知入口。

#### Packaged Plugin：可分发插件包

新版 SwiftBar 支持 `.swiftbar` 插件包，可以把脚本、库文件、二进制程序、图片和配置放在同一个目录中。包内可使用 `PACKAGE_DIR`、`PACKAGE_LIB_DIR`、`PACKAGE_BIN_DIR`、`PACKAGE_ASSETS_DIR` 等环境变量，避免写死安装路径。适合开发可分享的完整插件。

### 3.2 复杂刷新策略

简单刷新直接写在文件名中。更复杂的时间表可以使用 `schedule` 元数据和 Cron 风格表达式；官方 README 的示例是 `# 01,16,31,46`，表示每小时的第 1、16、31、46 分钟执行，多个时间表可以用 `|` 分隔。具体语法以当前版本 [README](https://github.com/swiftbar/SwiftBar) 为准。

外部程序也可以通过 URL Scheme 控制 SwiftBar：

```bash
# 刷新所有插件
open 'swiftbar://refreshallplugins'

# 按名称刷新一个插件
open 'swiftbar://refreshplugin?name=myplugin'
```

插件可以读取 `SWIFTBAR_PLUGIN_REFRESH_REASON`，区分是定时器、菜单打开、点击动作还是外部 URL 触发的刷新，从而避免不必要的工作。

### 3.3 做成一个真正有用的状态面板

可以把菜单栏做成不同类型的小型控制台：

- **系统**：CPU、内存压力、磁盘、网络吞吐、电池、温度；
- **开发**：Git 分支、未提交文件、CI 状态、Docker 容器、端口占用、tmux 会话；
- **服务**：VPN、Tailscale、远程主机、HTTP 健康检查、云服务状态；
- **效率**：番茄钟、会议倒计时、剪贴板片段、今日任务；
- **AI 工具**：本地 vLLM/SGLang 服务、GPU 显存、请求队列、当前模型和 token 速度。

典型结构是：

```text
菜单栏：🟢 API 12ms
       │
       ├─ 最近一次检查：...
       ├─ GPU：67% / 14.2 GB
       ├─ 打开监控面板
       ├─ 重启服务
       └─ 查看日志
```

### 3.4 视觉和交互增强

除了 emoji，还可以使用 SF Symbols、颜色、字体、tooltip 和图片；较新的 SwiftBar 版本还支持：

- `fold=true`：折叠/手风琴式菜单区段；
- menu item badge：在菜单项旁显示徽标；
- `alwaysVisible`：避免重要项目被自动隐藏；
- 持久 WebView：在菜单栏弹出一个不随每次打开而重新加载的网页界面；
- 变量配置：让用户在 SwiftBar 设置中配置 API 地址、项目名等环境变量。

如果交互已经发展成复杂表单，应考虑使用 WebView、Shortcuts 或独立 SwiftUI 应用，而不是继续堆叠菜单项。

### 3.5 稳定性、性能和安全

1. **根据数据源设置刷新频率**：本地文件或 socket 可以几秒刷新；网络 API 应使用分钟级刷新或点击触发。
2. **所有外部请求都要有超时**：例如 `curl --max-time 3`，失败时显示灰色或警告状态，不要沿用上一次的“正常”结果。
3. **缓存慢数据**：把 API 结果放入 `~/Library/Caches/`，菜单栏只读取缓存；点击菜单项时再主动更新。
4. **避免重复执行**：慢任务需要锁文件，防止上一次执行尚未结束时又启动一份。
5. **解析 JSON 优先使用 `jq`**：比每几秒启动完整 Python 解释器更轻量。
6. **密钥不要写进脚本**：使用 macOS Keychain、环境变量或独立权限文件，并限制文件权限。
7. **标准输出只输出菜单协议**：诊断信息写到 stderr；脚本失败时 SwiftBar 会显示错误标记，可结合 Console.app 查看日志。
8. **先直接运行再放入 SwiftBar**：

   ```bash
   "$HOME/Library/Application Support/SwiftBar/Plugins/hello.10s.sh"
   ```

9. **注意菜单栏空间**：刘海屏或插件过多时，macOS 可能把右侧图标藏起来而不提示；可以退出 SwiftBar 验证，并用 Ice 或 Bartender 管理折叠。

## 相关资料

- [SwiftBar 官方 GitHub](https://github.com/swiftbar/SwiftBar) — 插件协议、参数、插件类型和 URL Scheme。
- [SwiftBar Releases](https://github.com/swiftbar/SwiftBar/releases) — 新版本功能和兼容性变化。
- [SwiftBar Plugins](https://github.com/swiftbar/swiftbar-plugins) — 社区插件仓库。
- [Packaged Plugins 文档](https://github.com/swiftbar/SwiftBar/blob/main/README-PACKAGED-PLUGINS.md) — `.swiftbar` 插件包及资源目录。
