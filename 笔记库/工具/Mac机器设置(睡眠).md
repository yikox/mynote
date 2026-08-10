# Mac 睡眠设置：锁屏/熄屏但保持运行

**目标**：Mac 可以锁屏、熄屏，但机器本身始终保持运行，适合把 MacBook 当远程终端/服务器使用。

macOS 中需要区分以下概念：

- **Display Sleep**：显示器熄灭 → 允许
- **System Sleep**：整机睡眠 → 禁止
- **Hibernate / Standby**：深度休眠 → 尽量禁止
- **Lock Screen**：锁屏 → 允许

## 推荐设置（接通电源时）

先查看当前配置：

```bash
pmset -g custom
```

在接通电源时进行设置（`-c` 表示只修改充电器供电状态）：

```bash
sudo pmset -c sleep 0
sudo pmset -c displaysleep 10
sudo pmset -c disksleep 0
sudo pmset -c standby 0
sudo pmset -c hibernatemode 0
sudo pmset -c autopoweroff 0
```

也可一次执行：

```bash
sudo pmset -c sleep 0 displaysleep 10 disksleep 0 standby 0 hibernatemode 0 autopoweroff 0
```

### 效果对照

| 行为 | 设置 | 结果 |
|---|---:|---|
| 锁屏 | 不受影响 | 允许 |
| 10 分钟后熄屏 | `displaysleep 10` | 允许 |
| 系统自动睡眠 | `sleep 0` | 禁止 |
| Standby 深度睡眠 | `standby 0` | 禁止 |
| Hibernate | `hibernatemode 0` | 禁止 |
| 自动关机式深度休眠 | `autopoweroff 0` | 禁止 |

说明：`-c` 参数只修改充电器供电状态，拔掉电源后仍可使用正常的省电策略。

## 合盖问题

`sleep 0` 并不等于禁止合盖睡眠。MacBook 的合盖睡眠（lid-close sleep）有单独的系统行为。

推荐日常状态：**接电源 + 屏幕打开但熄屏 + 锁屏**。这种方式最稳定，无需折腾 macOS 的合盖机制。若目标是「接电源 → 锁屏 → 屏幕关闭 → Tailscale/远程终端始终能连接」，上述配置即可满足。
