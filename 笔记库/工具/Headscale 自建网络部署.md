# Headscale 自建网络部署（V1 SOP）

> 自建 Tailscale 控制面：VPS 部署 Headscale + Embedded DERP + Caddy 反代 + Exit Node，
> Mac / Linux 通过自定义 Coordination Server 接入，实现内网穿透与统一出口。
>
> 状态：V1 计划 | 参考：Headscale 官方推荐 Ubuntu 22.04+ / Debian 12+ 用 .deb 包 + systemd 部署

## 目标架构

```text
VPS:
  Headscale + Caddy + Embedded DERP + Tailscale Client + Exit Node

客户端:
  macOS / Linux Server

最终效果:
  Mac 直接 ssh 到 Linux Server
  能判断 P2P / DERP
  Mac 一键选择 VPS 作为 Exit Node
```

## 一、前置条件

- VPS：Ubuntu 24.04 LTS / 2 vCPU / 2 GB RAM / 20 GB SSD+ / 公网 IPv4（1 Gbps 与较大流量额度更好）
- 域名：`hs.example.com` → A 记录 → `1.2.3.4`

> ⚠️ Cloudflare 管 DNS 时**只做解析，不开橙云 Proxy**——不支持 Headscale 的特殊 WebSocket POST upgrade。

## 二、VPS 初始化

```bash
ssh root@1.2.3.4
apt update && apt upgrade -y
apt install -y curl wget vim ca-certificates gnupg ufw
hostnamectl set-hostname vps-exit
```

## 三、防火墙

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp 80/tcp 443/tcp
ufw allow 3478/udp    # Embedded DERP STUN
ufw allow 41641/udp   # Tailscale WireGuard direct
ufw enable
```

| 端口 | 用途 |
|---|---|
| TCP 22 | VPS 管理（V1 保留，跑通后关闭） |
| TCP 80 | HTTPS 证书 / redirect |
| TCP 443 | Headscale + DERP |
| UDP 3478 | DERP STUN（官方明确要求公开） |
| UDP 41641 | WireGuard direct（多数网络不开也能工作） |

## 四、安装 Headscale（.deb）

```bash
HEADSCALE_VERSION="<当前 stable，见官方 Releases>"
HEADSCALE_ARCH="amd64"
wget -O headscale.deb "https://github.com/juanfont/headscale/releases/download/v${HEADSCALE_VERSION}/headscale_${HEADSCALE_VERSION}_linux_${HEADSCALE_ARCH}.deb"
apt install ./headscale.deb
```

`.deb` 自动创建：headscale 用户、systemd service、默认配置。配置报错没关系，下一步改。

## 五、配置 Headscale

基于安装包自带 `config.yaml` 修改，**不整篇重写**（example 参考在 `/usr/share/doc/headscale/examples/`）：

```yaml
server_url: https://hs.example.com
listen_addr: 127.0.0.1:8080
metrics_listen_addr: 127.0.0.1:9090
grpc_listen_addr: 127.0.0.1:50443
tls_cert_path: ""
tls_key_path: ""
trusted_proxies:
  - 127.0.0.1/32
  - ::1/128
```

链路：`Internet → Caddy:443 → Headscale 127.0.0.1:8080`，TLS 归 Caddy 管。

## 六、启用 Embedded DERP

```yaml
derp:
  server:
    enabled: true
    ipv4: 1.2.3.4
    verify_clients: true
    # ipv6: "xxxx:xxxx:..."   # VPS 有 IPv6 时
```

V1 **保留 Tailscale 官方 DERP**（不设 `urls: []`），客户端可在自建 + 官方间选择；稳定后再转完全自建，避免单台 DERP 单点故障。

## 七、启动 Headscale

```bash
systemctl restart headscale && systemctl enable headscale
journalctl -u headscale -f
curl http://127.0.0.1:8080/health   # 本机自检
```

## 八、Caddy 反代

`/etc/caddy/Caddyfile`：

```caddyfile
hs.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

```bash
systemctl reload caddy && systemctl enable caddy
curl https://hs.example.com/health   # 公网可达，必须成功
```

`reverse_proxy` 原生支持 WebSocket，Caddy 自动处理 HTTPS。

## 九、创建 Headscale 用户

```bash
sudo headscale users create zy
sudo headscale users list   # ID | Name
```

一个 user 可拥有多台设备（Mac / 服务器 / Windows 等）。

## 十、VPS 自己加入 Tailnet

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --login-server=https://hs.example.com   # 得到 AUTH_ID
sudo headscale auth register --user zy --auth-id <AUTH_ID>
tailscale status && sudo headscale nodes list        # 出现 vps-exit
```

## 十一、开启 VPS Exit Node

```bash
echo 'net.ipv4.ip_forward = 1' | sudo tee /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf
sudo sysctl -p /etc/sysctl.d/99-tailscale.conf
sysctl net.ipv4.ip_forward   # 应 = 1

sudo tailscale set --advertise-exit-node
```

先开 IP forwarding 再 advertise（官方要求）。

## 十二、Headscale 批准 Exit Node 路由

```bash
sudo headscale nodes list-routes   # Available: 0.0.0.0/0 ::/0
sudo headscale nodes approve-routes --identifier 1 --routes 0.0.0.0/0
sudo headscale nodes list-routes   # Approved: 0.0.0.0/0 ::/0
```

IPv4/IPv6 route 联动批准，批一个默认路由即可。

## 十三、Mac 接入

官方 macOS App 已支持自定义 coordination server：

- **GUI**：按住 `Option` 点菜单栏 Tailscale 图标 → Debug → Custom Login Server → Add Account → 输入 `https://hs.example.com`
- **CLI**：`tailscale login --login-server=https://hs.example.com`
- VPS 侧注册：`sudo headscale auth register --user zy --auth-id <MAC_AUTH_ID>`

## 十四、检查 Mac

```bash
tailscale status        # 100.x.x.x vps-exit / macbook
tailscale ping vps-exit
```

## 十五、加入 Linux Server（GPU-01）

同 VPS 流程：`install.sh` → `tailscale up --login-server=...` → `headscale auth register`。
`nodes list` 应出现：vps-exit / macbook / gpu-01。

## 十六、内网穿透测试

```bash
tailscale ping gpu-01
ssh user@100.x.x.x    # 或 ssh gpu-01
```

达成：`Mac ↔ WireGuard ↔ GPU-01`，无需公网 SSH / 端口映射 / DDNS / FRP。

## 十七、判断 P2P / DERP

```bash
tailscale status
```

- `direct 123.123.123.123:41641` → **P2P**（最优）
- `relay ...` → 走 DERP
- `tailscale ping` 常显示 DERP → direct 的升级过程

## 十八、检查自建 DERP

```bash
tailscale debug derp-map
tailscale debug derp headscale
```

## 十九、Mac 使用 Exit Node

GUI：Tailscale → Exit Nodes → vps-exit。
验证：`curl ifconfig.me` 应显示 VPS 公网 IP；Exit Node → None 恢复本地出口。

## 二十、Exit Node 下访问本地 LAN

GUI 开启 **Allow Local Network Access**，保留 `192.168.1.0/24`（NAS / 打印机）访问。

## 二十一、V1 不上复杂 ACL

Headscale 默认无 policy = 节点全互通，便于排障。先把 Mac / VPS / GPU / DERP / Exit Node 全部跑通，再进 V1.1 ACL/Grants——避免网络 / ACL / DERP / route / 防火墙问题混在一起。

## 二十二、跑通后关闭公网 SSH

先确认 Tailnet 路径可靠（`ssh admin@vps-exit`），再：

```bash
ufw delete allow 22/tcp
```

最终公网只留 443 / 3478 / 41641 / 80，SSH 走 Tailnet。

## 二十三、最终状态

```text
                    Internet
                       │
             ┌─────────┴─────────┐
             │                   │
         TCP 443             UDP 3478
             │                   │
             ▼                   ▼
      ┌──────────────────────────────┐
      │           VPS                │
      │  Caddy → Headscale           │
      │  Embedded DERP               │
      │  tailscaled → Exit Node      │
      └──────────────┬───────────────┘
                     │ Control
         ┌───────────┼───────────┐
         ▼           ▼           ▼
      MacBook      GPU-01      Server-02
         ╲           │           ╱
          ╲══════════╪═════════╱
                  P2P Mesh
```

日常：Tailscale 永久在线，Exit Node = None；访问机器 `ssh gpu-01 / server-02 / vps-exit`；需公网出口时 Exit Node → vps-exit，用完 → None。

## V1 验收清单

- [ ] `https://hs.example.com/health` 正常
- [ ] Mac / VPS / Linux Server 出现在 `headscale nodes list`
- [ ] Mac 可 `ssh gpu-01`
- [ ] `tailscale status` 能识别 `direct` / `relay`
- [ ] `tailscale debug derp headscale` 正常
- [ ] Mac 可选择 `vps-exit`
- [ ] 开启 Exit Node 后公网 IP 变为 VPS IP；关闭后恢复本地出口
- [ ] VPS 公网 SSH 最终关闭

## 后续（V1.1 只做三件事）

ACL/Grants、MagicDNS / 域名体验、Subnet Router。**不再塞** Dashboard、数据库、独立 DERP 等组件（复杂度高收益小）。

## 参考

[1]: https://headscale.net/stable/setup/install/official/ "Official releases - Headscale"
[2]: https://headscale.net/stable/ref/integration/reverse-proxy/ "Reverse proxy - Headscale"
[3]: https://headscale.net/stable/ref/derp/ "DERP"
[4]: https://tailscale.com/docs/reference/faq/firewall-ports "Tailscale firewall ports FAQ"
[5]: https://caddyserver.com/docs/quick-starts/reverse-proxy "Caddy reverse proxy quick-start"
[6]: https://headscale.net/stable/usage/getting-started/ "Getting started - Headscale"
[7]: https://tailscale.com/docs/features/exit-nodes/how-to/setup "Use exit nodes · Tailscale Docs"
[8]: https://headscale.net/stable/ref/routes/ "Routes"
[9]: https://headscale.net/stable/usage/connect/apple/ "Apple"
[10]: https://tailscale.com/docs/features/exit-nodes "Exit nodes (route all traffic)"
[11]: https://headscale.net/stable/ref/policy/ "Policy"
