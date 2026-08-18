# Headscale 自建网络部署

> 自建 Tailscale 控制面：VPS 部署 Headscale + Embedded DERP + Caddy 反代 + Exit Node，
> 各设备通过自定义 Coordination Server 接入，实现内网穿透与统一出口。
>
> 状态：V1 已部署验证通过（2026-08-18）

## 目标架构

```text
                    Internet
                       │
             ┌─────────┴─────────┐
             │                   │
         TCP 443             UDP 3478
             │                   │
             ▼                   ▼
      ┌──────────────────────────────┐
      │      VPS (首尔, 腾讯云轻量)    │
      │  Caddy → Headscale           │
      │  Embedded DERP               │
      │  tailscaled → Exit Node      │
      └──────────────┬───────────────┘
                     │ Control
         ┌───────────┼───────────┐
         ▼           ▼           ▼
      MacBook     MacBook      GPU-01
        Air         Pro       (待接入)
         ╲           │           ╱
          ╲══════════╪═════════╱
                  P2P Mesh
```

日常：Tailscale 常驻在线，Exit Node 默认关闭；需要公网出口时开启，用完关闭。

## 部署参数

| 项目 | 值 |
| :--- | :--- |
| 控制面域名 | `hs.yiko.site` |
| MagicDNS 后缀 | `ts.yiko.site` |
| VPS 公网 IP | `43.155.173.41` |
| Headscale 版本 | v0.29.3 |
| 用户 | `zy` |
| DNS 托管 | DNSPod（非 Cloudflare，无橙云代理问题） |

节点分配：

| 节点 | Tailnet IP |
| :--- | :--- |
| vps-exit | 100.64.0.1 |
| zymacbook-air | 100.64.0.2 |
| zy-macbook-pro | 100.64.0.3 |

## 部署

VPS 侧全部由脚本完成，幂等，中途失败可直接重跑：

```bash
scp headscale-setup.sh ubuntu@43.155.173.41:/tmp/
ssh ubuntu@43.155.173.41 'sudo bash /tmp/headscale-setup.sh --domain hs.yiko.site --user zy'
```

脚本覆盖：前置检查 → DNS 校验 → 防火墙 → Headscale 安装配置 → Caddy 反代 → 服务启动 → 入网 → Exit Node → 自验收 → 输出客户端接入命令。

迁移域名时改 `--domain` 重跑即可，脚本会检测控制面变更并提示重新注册节点。

脚本全文与逐段解析（含设计原则、部署中修掉的 6 个 bug）见子笔记：

- [部署脚本解析](./Headscale%20自建网络部署/部署脚本解析.md)

工作副本位于 `~/work/2026/vps/headscale-setup.sh`，以子笔记内容为准。

### 脚本管不到的两件事

- **云防火墙**：必须在腾讯云控制台单独开放，见下方踩坑记录
- **客户端接入**：不在 VPS 上，见「客户端接入」章节

## 踩坑记录

### 环境层（云厂商相关）

| 问题 | 现象 | 处理 |
| :--- | :--- | :--- |
| 云防火墙独立于 ufw | 端口 timeout，服务器内部完全无感，tcpdump 抓不到包 | 轻量服务器在控制台「防火墙」开放 80/443 TCP + 3478/41641 UDP。规则改完可能有延迟，删掉重建更可靠 |
| NAT 型 VPS | 网卡是 `10.8.0.8`，非公网 IP | `derp.server.ipv4` 必须填公网 IP，用 `curl ipify` 探测，不能用 `ip addr` |
| 无公网 IPv6 | `tailscale debug derp` 报 IPv6 连接失败 | 无害可忽略；但需删掉 `derp.server.ipv6`（默认值是保留地址 `2001:db8::1`，留着客户端会去连不存在的地址） |

诊断端口是否放行的方法：无服务监听时，**refused = 放行，timeout = 被拦**。

```bash
curl -s -o /dev/null --connect-timeout 6 http://<IP>:<PORT>/; echo $?
# 7 = refused（放行）  28 = timeout（未放行）
```

### 系统层

| 问题 | 现象 | 处理 |
| :--- | :--- | :--- |
| ufw 多端口语法 | `ufw allow 22/tcp 80/tcp 443/tcp` 报 `Wrong number of arguments` | 拆成多条，或 `ufw allow 22,80,443/tcp` |
| 未放行 tailscale0 | `ssh vps-exit` 不通，但公网 SSH 正常 | `ufw allow in on tailscale0`。这是关闭公网 22 的前提 |
| FORWARD 策略 | Exit Node 转发被丢弃 | `/etc/default/ufw` 里 `DEFAULT_FORWARD_POLICY` 从 `DROP` 改 `ACCEPT` |
| DERP 私钥属主 | 服务启动失败：`derp_server_private.key: permission denied` | root 身份跑 `headscale configtest` 会生成 root 属主的密钥，而服务以 headscale 用户运行。修：`chown -R headscale:headscale /var/lib/headscale` |

### Headscale 配置默认值

这几个默认值都会造成实际故障，**必须显式覆盖**：

| 配置项 | 默认值 | 问题 | 应改为 |
| :--- | :--- | :--- | :--- |
| `dns.override_local_dns` | `true` | **强制把客户端 DNS 换成 1.1.1.1，导致内网域名（NAS/路由器/打印机）全部解析失败** | `false` |
| `dns.base_domain` | `example.com` | 与真实域名撞名，MagicDNS 解析混乱 | `ts.yiko.site` |
| `derp.server.ipv6` | `2001:db8::1` | 文档保留地址，无 IPv6 时客户端会尝试连接并超时 | 删除该键 |

`override_local_dns: false` 后，MagicDNS 仍解析 tailnet 域名，其余交回本地 DNS——这才是想要的行为。

### 命令差异（v0.29.3）

- `preauthkeys create -u` 要的是**用户 ID（uint）**，不是用户名。需先 `users list -o json` 取 id
- `auth register --user` 反而接受用户名（string），两者不一致
- 节点名字段有 `name`（原始主机名，可能含中文）和 `given_name`（规范化名）两个，脚本匹配需兼容
- 列表为空时 `users list -o json` 返回 `null` 而非 `[]`，直接迭代会抛 TypeError
- `nodes list-routes` 的 Approved 和 Available 都含 `0.0.0.0/0`，验证是否批准必须查 JSON 的 `approved_routes`，grep 字符串会误判

## macOS GUI 无法管理 Exit Node

macOS 官方 GUI 的 Exit Nodes 页面永远显示 "No available exit nodes"，但 CLI 一切正常。

> 2026-08 复核，推翻了本笔记早先"headscale 下发的 online 状态位是错的"这一判断。
> 当时观测到的 `Online=False, Active=True` 是节点刚启动时的瞬时状态，不是持续性缺陷。

复核时客户端拿到的数据完全正确：

```text
vps-exit | Online True | ExitNodeOption True
         | AllowedIPs ['0.0.0.0/0', '100.64.0.1/32', '::/0', 'fd7a:115c:a1e0::1/128']
```

`ExitNodeOption=True` 就是"可作为出口节点"的标志位，双栈路由也齐全。tailscaled 知道它是
Exit Node，是 GUI 没有显示。真实原因有两个，彼此独立：

**一、新窗口 UI 依赖 admin console API。** 1.88+ 引入的 windowed UI 是围绕 Tailscale 自家
SaaS 后台设计的——它的启用开关在 admin console 的 Feature previews 里，界面正中间放着
"Open in Admin Console" 按钮。设备与出口节点列表走 control server 的 admin web API，而
headscale 只实现了 **control protocol**（让客户端能组网），从不实现 admin API。GUI 要不到
数据，于是列表为空。CLI 走 LocalAPI，只读本地 netmap，因此不受影响。

**二、菜单栏图标没有 Exit Node 状态位。** 从 app 二进制提取出的完整图标状态机：

```text
StatusBarIconDimmed                            未连接
StatusBarIconDot1 … Dot16                      连接中动画
StatusBarIconDefaultRouterOnline / Offline     已连接
StatusBarIconErrorOnline / Offline             出错
```

没有任何一个表示"正在走出口节点"。即便退回旧菜单栏 UI，也无法一眼看出 Exit Node 是否开着。

### 官方修复的可能性：低

| Issue | 开 | 关 | 结局 |
| --- | --- | --- | --- |
| [tailscale#5628][bug1] | 2022-09-13 | 次日 | 转给 headscale，定性为非己方问题 |
| [headscale#804][bug2] | 2022-09-14 | 2023-03-02 | 标记 COMPLETED |

不是"挂了四年没人管"。真实情况是 Tailscale 对 custom control server 没有兼容义务，而 GUI
正在往自家 admin console 深度绑定的方向走。**这个差距会扩大而非缩小**，不是等一个补丁的事。
CLI 依赖的 LocalAPI 只吃 netmap，headscale 把 netmap 喂对就够，这条路才是稳定的。

### 附带发现：Exit Node 必须双栈通告

bradfitz 在 #804 中指出的硬性要求：Tailscale 只有在节点**同时**通告 `0.0.0.0/0` 和 `::/0`
时才认它是 Exit Node，与该机是否真有 IPv6 出网无关。只批准 IPv4 路由会导致 Exit Node 永远
不出现——这才是部署脚本保留 `net.ipv6.conf.all.forwarding = 1` 的真正理由（早先记的理由
"tailscale 会告警"不够硬）。本机核对结果：

```text
vps-exit | approved: ['0.0.0.0/0', '::/0']
```

### 结论

macOS 上一律用 CLI 管理 Exit Node，不要跟 GUI 较劲。需要常驻的状态展示，见
[SwiftBar 菜单栏状态盘](./SwiftBar%20菜单栏状态盘.md)——用 SwiftBar 把 CLI 输出挂到菜单栏，
取代官方 GUI 的展示职能。

另记：`headscale nodes list` 的在线状态在节点刚启动时会短暂不准，判断设备是否真在线以客户端
的 `tailscale status` 为准。

## 客户端接入

### 通用流程

GUI 客户端填入控制面地址 `https://hs.yiko.site` 后，会得到一个注册请求 ID，需在 VPS 上批准：

```bash
sudo headscale auth register --auth-id hskey-authreq-xxxxx --user zy
```

### macOS

- 首次：App 里 `Add Account...` 旁的下拉箭头 → **Add Account Using Alternate Server** → 填控制面地址
- 或菜单栏按住 `Option` 点图标 → Debug → Custom Login Server

配置便捷别名（`~/.zshrc`）：

```bash
alias ts='/Applications/Tailscale.app/Contents/MacOS/Tailscale'
alias vpn-on='ts set --exit-node=100.64.0.1 --exit-node-allow-lan-access=true && sleep 2 && echo "出口 IP: $(curl -s --max-time 10 ifconfig.me)"'
alias vpn-off='ts set --exit-node= && sleep 2 && echo "出口 IP: $(curl -s --max-time 10 ifconfig.me)"'
```

想要菜单栏常驻显示当前是否走出口节点，见 [SwiftBar 菜单栏状态盘](./SwiftBar%20菜单栏状态盘.md)。

### iOS / iPadOS

需 Tailscale ≥ 1.38.1，两种入口：

- App 内：账户图标 → Log in → 右上角选项 → **Use custom coordination server**
- 系统设置 → Tailscale → **ALTERNATE COORDINATION SERVER URL**

注意：iPadOS 无 CLI，Exit Node 只能从 GUI 选择，同样受上述 admin API 缺失的影响，很可能列不出可用出口节点，且没有 CLI 兜底（未实测）。

### Linux

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --login-server=https://hs.yiko.site --authkey=<preauthkey>
```

preauthkey 由脚本在部署结束时输出，也可手动生成：

```bash
sudo headscale preauthkeys create -u <用户ID> --reusable --expiration 24h
```

## 日常使用

查看接入设备（客户端上，状态比服务端可信）：

```bash
ts status
```

查看全部注册节点（VPS 上）：

```bash
sudo headscale nodes list
```

判断 P2P 还是中继：

- `direct 1.2.3.4:41641` → P2P 直连
- `relay xxx` → 走 DERP 中继
- 新建连接通常先走 DERP，几秒后升级为 direct

### Allow Local Network Access

开启 Exit Node 时，是否让内网流量（`192.168.x.x` 等）绕过 VPS 直连本地。

- **用途是换出口 IP** → 建议开启，否则一开 Exit Node 就断掉 NAS 和内网服务
- **用途是在不可信网络上保护流量**（公共 WiFi）→ 不要开启，此时本地网络本身就是威胁源

这是客户端本地偏好，headscale 无法统一下发，每台设备需各自设置。

## 实测数据（2026-08-18）

| 指标 | 值 |
| :--- | :--- |
| Mac ↔ VPS 直连延迟 | 303ms |
| Mac ↔ VPS 单流吞吐 | 6~11 Mbps |
| VPS 出网带宽 | 60~69 Mbps |
| DERP 中继延迟（西雅图） | 567ms |

瓶颈在本地到首尔的链路，非 VPS 带宽。Exit Node 可用但速度受限，属已知取舍——按需开关即可。

中继比直连多 264ms，所以 P2P 是否打通对体验影响很大。

以上数据由 [网络链路测速](./网络链路测速.md) 中的 `nettest.py` 测得。跨境链路单次波动大，重测时至少跑 2~3 次看区间。

## 验收清单

- [x] `https://hs.yiko.site/health` 返回 `{"status":"pass"}`
- [x] Let's Encrypt 证书签发正常
- [x] 自建 DERP 可达（`tailscale debug derp headscale`）
- [x] UDP 3478 / 41641 入站可达
- [x] 节点出现在 `headscale nodes list`
- [x] `tailscale status` 显示 `direct`（P2P 直连成功）
- [x] Exit Node 开启后公网 IP 变为 VPS IP，关闭后恢复
- [ ] Mac 可 `ssh gpu-01`（GPU-01 待接入）
- [ ] tailnet SSH 可用（`ssh ubuntu@100.64.0.1`）
- [ ] VPS 公网 SSH 关闭

## 待办

**关闭公网 SSH**（服务稳定后再做）：

```bash
ufw delete allow 22/tcp
```

前提：先确认 `ssh ubuntu@100.64.0.1` 走 tailnet 可靠。

救援路径（务必先确认可用）：腾讯云控制台 VNC 登录，或云助手 `tat_agent` 远程执行命令。

## V1.1 计划

只做三件事：ACL/Grants、MagicDNS 域名体验、Subnet Router。

**不再增加** Dashboard、独立数据库、独立 DERP 等组件——复杂度高，收益小。

V1 阶段不配 ACL，默认全互通，便于排障：网络、ACL、DERP、路由、防火墙问题混在一起会极难定位。

## 参考

- [Headscale 官方安装][1]
- [Headscale 反向代理配置][2]
- [Headscale DERP 配置][3]
- [Tailscale 防火墙端口说明][4]
- [Headscale Apple 客户端接入][5]
- [Tailscale 自定义控制服务器][6]
- [Headscale 路由与 Exit Node][7]

[1]: https://headscale.net/stable/setup/install/official/ "Official releases - Headscale"
[2]: https://headscale.net/stable/ref/integration/reverse-proxy/ "Reverse proxy - Headscale"
[3]: https://headscale.net/stable/ref/derp/ "DERP - Headscale"
[4]: https://tailscale.com/docs/reference/faq/firewall-ports "Tailscale firewall ports FAQ"
[5]: https://headscale.net/stable/usage/connect/apple/ "Apple - Headscale"
[6]: https://tailscale.com/docs/how-to/set-up-custom-control-server "Custom control server - Tailscale"
[7]: https://headscale.net/stable/ref/routes/ "Routes - Headscale"
[bug1]: https://github.com/tailscale/tailscale/issues/5628 "No exit nodes available in macOS GUI with custom control server"
[bug2]: https://github.com/juanfont/headscale/issues/804 "macOS GUI doesn't display exit nodes from headscale"
