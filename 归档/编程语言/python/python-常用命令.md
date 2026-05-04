## **查找** **Python** **的** **import** 路径 
如果您想查找 Python 的 import 路径，您可以使用 Python 的 inspect 模块。inspect 模块是 Python 的内置模块之一，可以用于查看 Python 对象的信息，包括模块、类、函数和方法。您可以使用 inspect 模块来查看模块的路径，如下所示：
```Python
import inspect
import numpy
print(inspect.getfile(numpy))
```
这将输出 numpy 模块的路径。如果您想查找其他模块的路径，只需将 numpy 替换为所需的模块即可。
## pdb
`pdb`是Python的内置调试器。你可以使用它来逐步执行代码、查看变量值、设置断点和更多。要开始使用`pdb`，请在你希望开始调试的代码行前插入以下代码：
```python
import pdb; pdb.set_trace()
```
这将在运行到此位置时暂停代码执行，并进入调试模式。在调试模式下，你可以输入各种命令来检查和控制程序的执行。一些基本命令：
- `n` (next)：执行下一行代码。
- `s` (step)：步入函数，执行更深层的代码。
- `c` (continue)：继续执行代码，直到遇到下一个断点或程序结束。
- `q` (quit)：退出调试器，终止程序执行。
- `p variable_name`：打印指定变量的值。
- `l` (list)：列出当前正在执行的代码周围的几行。
例如：
```python
def add(a, b):
    import pdb; pdb.set_trace()  # 设置断点
    result = a + b
    return result
add(2, 3)
```
## pip 源
* 使用示例 `pip3 install numpy -i https://pypi.tuna.tsinghua.edu.cn/simple`
* 方便复制
    * 清华源 ： `-i https://pypi.tuna.tsinghua.edu.cn/simple`
    * 中国科学技术大学 :  `-i https://pypi.mirrors.ustc.edu.cn/simple`
    * 豆瓣：`-i http://pypi.douban.com/simple/`
    * 阿里云：`-i http://mirrors.aliyun.com/pypi/simple/`

