# GDB 调试笔记

> 整理自 2020 年实习期间的 GDB 调试常用命令记录

---

## 1. 准备工作

使用 GDB 调试时，**编译必须加 `-g` 参数**，否则只能看到内存地址，看不见函数名和变量名。

```bash
gcc -g -o program program.c
```

---

## 2. 启动与运行

### 启动方式

| 命令 | 说明 |
|------|------|
| `gdb 可执行文件` | 调试指定程序 |
| `gdb 可执行文件 core` | 调试 core dump 文件 |
| `gdb 可执行文件 PID` | 附加到已运行的进程 |

### 调试已运行程序

```bash
# 方法1：ps 查看 PID 后直接附加
gdb 可执行文件 PID

# 方法2：先关联源码，再 attach
gdb 可执行文件
(gdb) source 可执行文件      # 关联符号表
(gdb) attach PID             # 挂接进程
(gdb) detach                 # 取消挂接
```

### 基础命令

| 命令 | 简写 | 功能 |
|------|------|------|
| `list` | `l` | 列出源码 |
| `run` | `r` | 运行程序 |
| `continue` | `c` | 继续执行 |
| `next` | `n` | 单步执行（**不进入**函数） |
| `step` | `s` | 单步执行（**进入**函数） |
| `finish` | - | 运行到当前函数返回 |
| `until` | - | 运行到退出循环体 |
| `stepi` / `nexti` | - | 单步执行一条**机器指令** |
| `quit` | `q` | 退出 GDB |

### 断点

| 命令 | 说明 |
|------|------|
| `break 行号` | 在指定行设置断点 |
| `break 函数名` | 在函数入口设置断点 |
| `break 行号 if 条件` | 条件断点 |
| `break ... thread 线程ID` | 只在指定线程断住 |
| `info break` | 查看断点信息 |
| `condition 断点号 新条件` | 修改断点条件 |
| `clear` | 清除所有断点 |
| `clear 行号/函数名` | 清除指定断点 |
| `delete 断点号` | 删除指定断点 |
| `disable 断点号` | 禁用断点 |
| `enable 断点号` | 启用断点 |
| `ignore 断点号 次数` | 忽略该断点 N 次 |

### 观察点（变量变化时暂停）

| 命令 | 说明 |
|------|------|
| `watch 变量名` | 变量值**变化**时暂停 |
| `rwatch 变量名` | 变量被**读**时暂停 |
| `awatch 变量名` | 变量被**读或写**时暂停 |

### 打印

```gdb
p 变量名              # 打印变量值
p 结构体              # 打印结构体（紧凑格式）
set print pretty on   # 结构体分行显示
display 表达式        # 程序停止时自动显示
display/格式 地址     # 格式化显示
```

---

## 3. 查看信息

### 栈信息

| 命令 | 说明 |
|------|------|
| `backtrace` / `bt` | 查看调用栈 |
| `bt N` | 只显示栈顶 N 层 |
| `frame N` / `f N` | 切换到第 N 帧 |
| `info frame` | 查看当前帧详细信息 |
| `up` / `down` | 上/下切换栈帧 |

### 内存与源码

```gdb
# 查看源码行对应的地址
info line 行号
info line 文件名:行号
info line 函数名

# 查看汇编代码
disassemble 函数名

# 查看内存（x 命令）
# n/f/u = 长度/格式/单位
x/4xb addr    # 16进制，单字节，显示4个
x/8xw addr    # 16进制，4字节，显示8个
x/s addr      # 作为字符串显示
x/i addr      # 作为指令显示
```

### 寄存器

```gdb
info registers      # 查看通用寄存器
info all-registers  # 查看所有寄存器（含浮点）
info registers rax # 查看指定寄存器
```

### 搜索

```gdb
search 正则表达式      # 向后搜索
forward-search 正则    # 向前搜索
reverse-search 正则    # 全局搜索
```

---

## 4. 多线程调试

```gdb
info threads              # 查看所有线程
break 行号 thread 线程ID  # 只在该线程断住

# 控制线程调度
set scheduler-locking on   # 只运行当前线程
set scheduler-locking off  # 所有线程并发运行
```

---

## 5. 信号处理

```gdb
handle 信号 处理方式
```

| 处理方式 | 说明 |
|----------|------|
| `nostop` | 不暂停，但打印信息 |
| `stop` | 暂停 |
| `noprint` | 不打印信息 |
| `print` | 打印信息 |
| `pass` / `nopass` | GDB 是否将信号传递给程序 |
| `ignore` / `noignore` | 是否忽略信号 |

```gdb
info signals    # 查看所有信号
info handle     # 查看信号处理设置
```

---

## 6. 高级操作

### 修改变量

```gdb
print x=4               # 修改变量值
set var width=47        # 推荐写法，避免与 GDB 参数冲突
```

### 跳转执行

```gdb
jump 行号
jump 地址
```
> ⚠️ 警告：跳转不会改变栈内容，最好在函数内部跳转，跨函数跳转可能导致栈错误。

### 强制返回

```gdb
return        # 强制从当前函数返回
return 值     # 返回指定值
```

### 强制调用函数

```gdb
call 函数      # 调用函数，显示返回值（void 不显示）
print 函数     # 调用函数，结果存入历史记录
```

### 断点触发时自动执行命令

```gdb
(gdb) commands 断点号
> printf "hit breakpoint %d\n", $bpnum
> continue
> end
```

---

## 7. 其他命令

| 命令 | 说明 |
|------|------|
| `symbol-file 文件` | 加载符号表 |
| `core 文件` | 加载 core dump 文件 |
| `directory 路径` | 添加源码搜索路径 |

---

## 8. Python 程序 Core Dump 调试

### 加载 core 文件

```bash
gdb /usr/bin/python3 core
# 或虚拟环境
gdb .venv/bin/python core
```

### 启用 Python 感知调试

```bash
# Ubuntu/Debian
sudo apt install python3-dbg

# 验证 GDB 脚本已加载
(gdb) info auto-load python-scripts
```

### 常用 Python 调试命令

| 命令 | 说明 |
|------|------|
| `py-bt` | Python 层调用栈 |
| `py-list` | 当前帧对应的 Python 源码 |
| `py-up` | 向上切换 Python 栈帧 |
| `py-down` | 向下切换 Python 栈帧 |

---

## 参考资料

- [GDB 官方文档](https://sourceware.org/gdb/documentation/)
- Python GDB 扩展：`/usr/share/gdb/auto-load/usr/bin/python*.py`
