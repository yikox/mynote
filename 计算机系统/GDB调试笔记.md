---
title: GDB调试笔记
date: 2022-01-06 23:42:24
tags: GDB
categories: 工具

---

> 2020年实习时，由于需要频繁用到GDB调试，特此记录GDB调试使用的一些常用命令记录
<!-- more -->

#### 启动

使用GDB在编译时需要加上-g，没有-g将看不见函数名，变量名，取代的是内存地址

##### 运行程序

* `gdb+执行文件/路径`

* `gdb+执行文件+core文件`

* `gdb+执行文件+PID（进程ID`



##### 调试已经运行的程序：
  * ps查看程序运行的PID，然后用上面的命令`gdb+执行文件+PID`（进程ID）
  * 先用`pdb+执行文件` 关联上源代码，再用`attach`挂接进程的PID，用`detach`取消挂接的进程。


#### 基础命令

| 命令       | 功能                 |
| ---------- | -------------------- |
| l(list)    | 从第一行列出代码     |
| break+行号 | 从16行设置断点       |
| break func | 设置断点在func入口处 |
| info break | 查看断点信息         |
|r (run) |运行程序  |
| n(next) | 执行下一句，不会进入函数 |
| s(step) | 执行下一句，会进入函数 |
| c(continue) | 继续运行程序 |
| p 变量名(print 变量名) | 打印变量i的值 |
| bt | 查看函数堆栈 |
| finish | 退出函数 |
| q | 退出GDB |
| s(symbols)+file | 从指定文件中读取符号表 |
| c/core file | 调试时core dump的core文件 |
| d/directory file | 加入一个源文件的搜索路径 |

`until`运行命令到退出循环体

`stepi`和`nexti`单步执行一条机器指令

* 打印结构体分行显示

  ```
  set print pretty on 
  ```


#### 暂停程序

##### 停止点

  * 断点`break+行号/函数`

  **可以通过条件设置（break if 条件）**

  **修改条件可以通过 condition+断点号+新条件**

  * 观察点`watch+变量名`（值发生变化会暂停）
    * `rwatch +变量名`（变量被读时暂停）
    * `awatch+变量名`（读和写）
  * 捕捉点`catch`

##### 停止点维护
  `clear`清除所有停止点，可以加行号，函数指定清除的点
  `delete +断点号+范围`
  <u>**clear和delete有啥区别**</u>
  `disable和enable` 关掉和启动停止点

##### 特殊命令：

  * `ignore+断点号+次数`程序运行时忽略该断点次数
  
  * `commands+断点号 +命令列表+end`当断点触发时运行的命令列表中的命令，有利于自动测试

  ```shell
commands 断点号
  command-list
end
  ```


##### 信号

信号是一种软中断，是一种处理异步事件的方法。一般来说，操作系统都支持许多信号。尤其是UNIX，比较重要应用程序一般都会处理信号。UNIX 定义了许多信号，比如SIGINT表示中断字符信号，也就是Ctrl+C的信号，SIGBUS表示硬件故障的信号；SIGCHLD表示子进程状态改变信号；SIGKILL表示终止程序运行的信号，等等。信号量编程是UNIX 下非常重要的一种技术。

定义GDB在调试过程中，当收到某种信号时的动作/停下/打印信息等等

```shell
handle+信号+处理方式
```

处理方式：

`Nostop`-不停下，但打印信息

`stop`-停下

   `noprint`-不打印信息

   `pass`

`noignore`-GDB不处理该信号，交给被测程序处理

`nopass`

`ignore`-不让被测程序处理

`info signals`

`info handle`

查看哪些信号被GDB检测中


##### 多线程

GDB可以指定断点在某一线程上**`break+行号+thread+线程ID`**

线程ID需要通过GDB查看，命令**`info threads`**

多线程调试时，可以取消线程轮转来进行单步调试（断到具体的函数，取消轮转，单步调试）

```
(gdb) set scheduler-locking on
(gdb) set scheduler-locking off
```

#### 检查信息

##### 栈信息

查看栈信息`backtrace/bt`可以加一个数n,表示只打印栈顶n行

查看当前栈详细信息`info frame/f`

切换当前栈`frame/f`,同理加n，也可以用**`up和down`**上下移动

##### 搜索

`forward-search 条件` 向前搜索

`search 条件` 向后搜索

`reverse-search 条件` 全局搜索

条件为正则表达式形式

##### 查看内存

  * 查看源代码在运行时的地址
    ```
    info line 行号/文件名：行号/文件名：函数名
    ```

  * 查看源程序的当前执行时的机器码
     ```shell
      disassemble func
      # 会打印出函数func的汇编代码
     ```

* 查看内存地址中的值
   ```shell
    #examine命令，简写x
    x n/f/u addr
    #n 是一个正整数，表示显示内存的长度，也就是说从当前地址向后显示几个地址的内容。
    #f 表示显示的格式，参见上面。如果地址所指的是字符串，那么格式可以是s，如果地十是指令地址，那么格式可以是i。
    #u 表示从当前地址往后请求的字节数，如果不指定的话，GDB默认是4个bytes。u 参数可以用下面的字符来代替，b 表示单字节，h 表示双字节，w 表示四字节，g 表示八字节。当我们指定了字节长度后，GDB 会从指内存定的内存地址开始，读写指定字节，并把其当作一个值取出来。
    #n/f/u可以一起使用
   ```

##### 自动显示

你可以设置一些自动显示的变量，当程序停住时，或是在你单步跟踪时，这些变量会自动显示。

```shell
display 表达式
display 地址
display/格式 地址或表达式
```

##### 查看寄存器

```shell
info registers
#查看寄存器的情况。（除了浮点寄存器）
info all-registers
#查看所有寄存器的情况。（包括浮点寄存器）
info registers <regname ...>
#查看所指定的寄存器的情况。
```
#### 改变程序的运行

##### 修改变量值

修改程序运行时的变量值

```gbd
print x=4
```

如果变量名和gdb参数冲突，可以使用`set var` 告诉GDB这个是程序的变量名。

```shell
set var width=47
```

**在有些时候GDB并不会报告这类错误，因此都推荐使用`set var`的格式修改变量值**

##### 跳转执行

GDB提供了修改程序的执行顺序的功能，跳转功能，直接跳转到某个语句继续执行

```
jump 行号
jump 代码行的内存地址
```

**注：跳转并不会改变当前程序栈的内容，所以最好在一个函数内跳转，当你从一个函数跳到另一个函数，函数执行完进行弹栈操作时必然发生错误**

##### 产生信号量

GDB可以使用`singal`命令，在断点处由GDB产生一个信号量给被调试程序

```
singal <singal>
```

##### 强制函数返回

如果你的调试断点在某个函数中，并还有语句没有执行完，你可以使用return命令强制函数忽略后面未执行的语句并返回

```
return
return 返回值
```

##### 强制调用函数
* call命令 
  ```shell
  call 函数
  #强制调用函数，并显示返回值，如果返回值时void就不显示
  ```

* print 命令
  ```shell
  print 函数
  #如果函数返回void依旧会显示，并把该值存入历史数据
  ```

#### python 程序出现 core dump 调试

##### 使用 gdb 打开 core 文件

```shell
gdb /usr/bin/python3 core
```

如果你用的是虚拟环境，可以是：

```shell
gdb .venv/bin/python core
```

##### 启用 Python-aware 调试（推荐）

Python 官方提供了一个 GDB 扩展脚本 libpython.py，可以让 GDB 理解 Python 层的栈帧！

- 安装带符号的 Python（或使用系统带符号的版本）
```shell
# Ubuntu/Debian:
sudo apt install python3-dbg
# RedHat/CentOS:
sudo dnf install python3-debuginfo
```

- 确保 gdb 自动加载 python 扩展脚本
```shell
# Python 安装时会带一个 GDB 脚本，路径类似于：
/usr/lib/debug/.build-id/.../python3.X-gdb.py
# 或者
/usr/share/gdb/auto-load/usr/bin/python3.X-gdb.py
# gdb 启动时会自动加载它。可以在 gdb 中运行：
info auto-load python-scripts
```

- 使用 py-bt 或 py-list 查看 Python 层调用栈和代码
```shell
gdb /usr/bin/python3 core
(gdb) py-bt        # Python 层的 backtrace
(gdb) py-list      # 当前帧对应的 Python 源码
(gdb) py-up        # 向上切换 Python 栈
(gdb) py-down      # 向下切换 Python 栈
```
