可以。你要的本质是：

**Mac 可以锁屏、熄屏，但机器本身始终保持运行。**

这很适合把 MacBook 当远程终端/服务器使用。

在 macOS 上，最关键的是区分：

- **Display Sleep**：显示器熄灭 → ✓ 允许
- **System Sleep**：整机睡眠 → ✗ 禁止
- **Hibernate / Standby**：深度休眠 → ✗ 尽量禁止
- **Lock Screen**：锁屏 → ✓ 允许

### 推荐设置

先查看当前配置：

```bash
pmset -g custom
```

然后建议在**接通电源时**这样设置：

```bash
sudo pmset -c sleep 0
sudo pmset -c displaysleep 10
sudo pmset -c disksleep 0
sudo pmset -c standby 0
sudo pmset -c hibernatemode 0
sudo pmset -c autopoweroff 0
```

效果就是：

| 行为 | 设置 | 结果 |
|---|---:|---|
| 锁屏 | 不受影响 | ✓ |
| 10 分钟后熄屏 | `displaysleep 10` | ✓ |
| 系统自动睡眠 | `sleep 0` | ✗ 禁止 |
| Standby 深度睡眠 | `standby 0` | ✗ 禁止 |
| Hibernate | `hibernatemode 0` | ✗ 禁止 |
| 自动关机式深度休眠 | `autopoweroff 0` | ✗ 禁止 |

这里的 `-c` 非常重要，表示**只修改充电器供电状态**。这样拔掉电源后仍然可以使用正常的省电策略。

你也可以一次执行：

```bash
sudo pmset -c sleep 0 displaysleep 10 disksleep 0 standby 0 hibernatemode 0 autopoweroff 0
```

### 还有一个很重要的问题：合盖

如果你的目标是：

> MacBook 接电源 → 锁屏 → 屏幕关闭 → Tailscale/远程终端始终能连接

上面的配置基本就是这个方向。

但如果你还希望：

> **MacBook 合上盖子以后也继续运行**

这是另一回事。**`sleep 0` 并不等于禁止合盖睡眠**。MacBook 的 lid-close sleep 有单独的系统行为。

所以推荐你的日常状态是：

**接电源 + 屏幕打开但熄屏 + 锁屏**

这样最稳定，也不需要折腾 macOS 的合盖机制。
