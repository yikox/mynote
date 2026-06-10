
# 基础语法
##  类
类名： 约定第一个字母为大写
### self
表示类本身，和 C++中的 this 指针类似
类中每个函数的第一个参数要引入
相当与自己：引用a=Boll(),使用a.kite()时，实际上是a.kite(a)
eg:
```python
class Boll:
   def __init__(self,name):               #__init__相当于Java的初始化
​		self.name =name
​	def kite(self):
​		print("我叫"+self.name+"初次见面，请多关照！")
```
### 魔法方法

魔法方法总是被双下划线包围

1.` __new__(cls[,...])`
- 用于创建对象时调用
- 平时很少写，当继承一个不可变类型，有需要修改才会重写该方法
eg:
```python
>>> class CapStr(str):
​	def __new__(cls,string):
​		string = string.upper()
​		return str.__new__(cls,string)
\>>> a= CapStr('I Love Eat Fish!')
\>>> a
'I LOVE EAT FISH!'
```
2.`__init__(self[,...])`
- 类似与其他语言的构造方法
- 在实例化时调用
- 返回none,不可以自定返回

3.`__del__(self)`
- 垃圾回收机制
- 所有应用对象都被删除才会引用
eg:
```python
>>> class C:
​	def __init__(self):
​		print("我是__init__方法，我被调用了。。")
​	def __del__(self):
​		print("我是__del__方法，我被调用了。。。")		
\>>> a=C()
我是__init__方法，我被调用了。。
\>>> b=a
\>>> c=a
\>>> del b
\>>> del c
\>>> del a
我是__del__方法，我被调用了。。。
```

### 私有变量
在函数名或者属性前加双下划线则为私有的
eg:
```python
class Person:
​	__name = "czy"          #前面加双下划线，为类内私有
​	def getname(self):
​		print("我叫%s,请多多关照！" % self.__name)
```

输出
```python
a = Person()
a.__name
Traceback (most recent call last):
  File "<pyshell#16>", line 1, in <module>
​    a.__name
AttributeError: 'Person' object has no attribute '__name'
```
> 拓：python其实是伪装私有，其实是把加下滑线的属性名改成一个下滑线加类名再加双下划线及属性名
> ```python
> >>> a._Person__name
> 'czy'
> ```

### 继承
eg:
```python
import random as r
class Fish:
    def __init__(self):
       self.x =r.randint(1,10)
       self.y =r.randint(1,10)
    def move(self):
       self.x -= 1
       print("我的位置是："，self.x,self.y)
class Goldfish(Fish):     #继承Fish
       pass
class Shark(Fish):
       def __init__(self):
       Fish.__init__(self)  #或者super().__init__()
       self.hungral = "Ture"
       def eat(self):
               pass
```
> 拓：使用`super().__init__()`，或者在初始化时加入父类的初始化方法，不然会被覆盖
> 

python支持多重继承即：`class Shark(Fish,ascas,asxad...............)`

### 相关函数
- `issubclass(A,B)`该函数用于判断A类是否为B的子类
需要注意的是A类是A类的子类
- `isinstance(object,classinfo)`该函数用于检测对象是否为classinfo是否为其的对象
- `hasattr(object,name)`检测变量名是否为对象的，注意变量名要用字符串形式
eg: 
```python
class A:
​	def __init__(self,x=0):
​		self.x=x		
C1=A()
hasattr(C1,'x')
True
hasattr(C1,x)
Traceback (most recent call last):
  File "<pyshell#7>", line 1, in <module>
​    hasattr(C1,x)
NameError: name 'x' is not defined 
```
- `getattr(object,name,[default])`获得属性值，属性存在返回属性值，属性不存在返回default中的值
eg:
```python
>>> getattr(C1,'x',"不在哦！！")
>>> getattr(C1,'y',"不在哦！！")
'不在哦！！'
```
- `setattr(object,name,value)`
创建一个名为name的变量，其值为value
eg:
```python
>>> setattr(C1,'y',"现在在啦！！")
>>> getattr(C1,'y',"不在哦！！")
'现在在啦！！'
```

- `delattr(object,name)`删除对象中名为name 的属性
- `property(get,set,del)`该函数用于创建一个属性来调用属性，内三个参数为获得属性，改变属性，删除属性的函数
 eg:
```python
>>> class C:
​	def __init__(self,size=10):
​		self.size=size
​	def getSize(self):
​		return self.size
​	def setSize(self,value):
​		self.size=value
​	def delSize(self):
​		del self.size
​	x = property(getSize,setSize,delSize)
>>> c1=C()
>>> c1.getSize()
10
>>> c1.x
10
>>> c1.x =18
>>> c1.x
18
>>> c1.getSize()
18
>>> del c1.x
>>> c1.x
Traceback (most recent call last):
  File "<pyshell#35>", line 1, in <module>
​    c1.x
  File "<pyshell#25>", line 5, in getSize
​    return self.size
AttributeError: 'C' object has no attribute 'size'
```
## 模块
* 容器是数据的集合
* 函数是语句的集合
* 类是方法和属性的集合
* 模块就是程序
* 例如
```graph LR
Hello.py-->是一个模块
```
那么如何导入模块呢？
有三个方法：
1. import 模块名
2. from 模块名 import 函数名
3. import 模块名 as 新名字（简短的代号，以便于引用当模块名特别复杂的时候）

注：
```
if __name__=='__main__'：//判断当前运行的程序是不是主程序
    test()
```
每个模块都可以单独运行，一般在模块后会添加一个测试函数test(),这个函数可以判断是不是在运行模块，如果是导入模块的话，判断就不成立__name__会等于模块名，只有当这个模块当成主程序运行时才会成立。

### 搜索路径
当年import一个模块的时候，程序会在搜索路径中搜索这个文件，如若有这个文件，就会导入这个模块，如若没有则会报错
- 如何知道程序的搜索路径
```
import sys
sys.path //显示所有搜索路径
```
> 最佳的搜索路径为site-packages文件夹，大多的模块都是放在这个位置的

- 添加搜索路径
```
import sys
sys.path.append("c://....")//路径采用双斜杠，转义字符//即为/
```

### 包（package）
> 包是模块的集合

创建一个包：
1. 创建一个文件夹，文件夹名即包名
2. 在文件夹内创建一个名为`__init__.py`的文件，可以是空文件
3. 将相关的模块放入文件夹中
4. 导入包内的模块：import 包名.模块名 as 新名字

## pickle(泡菜)

- 导入
`import pickle`
- 打开文件
`pickle_file = open("my_list.pkl","wb")`
w代表写入，b代表二进制
- 存入文件
`pickle.dump(my_list,pickle_file )`
该函数有两个参数`my_list`我要打包的文件，`pickle_file`打开文件的指针
- 关掉文件
`pickle.close()`
- 读取文件
`pickle_file = open("my_list.pkl","rb")`
`my_list2=pickle.load(pickle_file)`

## 异常处理
```python
try:
	a = 1+'1'
	f = open('我为什么是一个文件.txt')
	print(f.read())
except OSError as reason:       #捕获OSError
​    print('文件出错啦!\n错误的原因是：'+str(reason))
except TypeError as reason:
​    print('文件出错啦!\n错误的原因是：'+str(reason))
```
或者：
```python
except：       #检查全部错误
	print("出错了！")
finally：     #一定会执行
	f.close()
pass
```

- raise  引发异常
eg:
```python
raise OSError("系统的错误")
Traceback (most recent call last):
  File "<pyshell#1>", line 1, in <module>
​    raise OSError("系统的错误")
OSError: 系统的错误
```
## Python装饰器：增强函数功能的利器

在 Python 中，装饰器（Decorator）是一种强大的语法特性，它允许你在不修改原有函数定义的情况下，动态地为函数添加额外的功能。装饰器本质上是一个函数，它接受一个函数作为参数，并返回一个新的函数。通过装饰器，我们可以实现诸如日志记录、性能分析、权限验证等功能的重用，从而提高代码的可维护性和可扩展性。

### 简单装饰器示例

下面是一个简单的装饰器示例，用于在函数执行前后打印一条消息：

```python
def my_decorator(func):
    def wrapper():
        print("Something is happening before the function is called.")
        func()
        print("Something is happening after the function is called.")
    return wrapper
@my_decorator
def say_hello():
    print("Hello!")

# 等价于 say_hello = my_decorator(say_hello)

say_hello()
```
运行结果将会是：
```
Something is happening before the function is called.
Hello!
Something is happening after the function is called.
```
### 带参数的装饰器

有时候我们需要给装饰器传递参数，例如指定函数执行的次数。这时可以通过嵌套函数的方式来实现：
```python
def repeat(num_times):
    def decorator_repeat(func):
        def wrapper(*args, **kwargs):
            for _ in range(num_times):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator_repeat

@repeat(num_times=3)
def greet(name):
    print(f"Hello, {name}!")
#等价于 greet = repeat(num_times=3)(greet)

greet("World")

```
这段代码将会打印三次 "Hello, World!"。

### 超时装饰器
基于装饰的功能，我们可以做一些通用的功能，比如超时函数
eg:
```python
def handler(signum, frame):
    raise TimeoutError("Timeout occurred")
def timeout(seconds):
    def decorator(func):
        def wrapper(*args, **kwargs):
            signal.signal(signal.SIGALRM, handler)
            signal.alarm(seconds)
            try:
                result = func(*args, **kwargs)
            finally:
                signal.alarm(0)
            return result
        return wrapper
    return decorator
```
使用:
```python
@timeout(10) #设置超时函数 10s
def process():
	# 做些计算操作
	pass
```
