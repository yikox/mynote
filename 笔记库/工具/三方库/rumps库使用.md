---
title: python 简单应用
author: yikox
date: 2023-03-24 18:48:27
tags: [python]
categories: [三方库介绍]
mathjax: true
---
> python rumps库的简单使用
<!--more-->

## HEXO管理APP
- 简单的APP后台管理我的hexo博客
- 博客的新增和修改通过hexo-admin进行
- 通过APP一键启动本地的hexo服务
- 启动服务后自动打开浏览器进入admin管理界面

### 技术分析
- 通过rumps库创建一个菜单栏的APP,并添加start和stop两个按钮

```
import rumps
class ExampleApp(rumps.App):
    def __init__(self):
        super(ExampleApp, self).__init__("Hexo")
        self.menu = ["Start", "Stop"]
        self.state = False

    @rumps.clicked("Start")
    def start(self, _):
 		print("start")
    @rumps.clicked("Stop")
    def stop(self, _):
		print("stop")
```
- 通过subprocess库操作终端实现hexo服务启动和浏览器自动打开

```python
#hexo服务启动
self.proc = subprocess.Popen(['hexo', 'server', '-d'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
#浏览器自动打开
url = 'http://localhost:4000/admin'
subprocess.run(['open', url], capture_output=True, text=True)
```