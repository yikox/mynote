---
title: vscode-sftp 使用指南
date: 2023-09-14T16:10:44+08:00
tags: [sftp] 
categories: 工具
mathjax: true
---
> vscode-sftp 插件是一个在远程开发中非常好用的工具
<!--more-->

# 简介
vscode-sftp 插件是一个在远程开发中非常好用的工具，和 vscode-remote 类似，但是适用范围不同；vscode-remote适合代码仓库在远程，本地只是做修改；而 vscode-sftp 适合代码仓库在本地，远程只是做测试；

# 安装
> vscode 扩展商店 搜索 sftp 选最新的安装即可

# 使用
快捷键 `cmd+shift+p` 输入 `sftp` 会出现很多 `sftp` 的命令，选择 `SFTP:Config` 就会在工作目录下生成 `.vscode/sftp.json` 文件。

根据具体服务器修改配置文件
```json
{
    //起个名字吧
    "name": "xxx",
    //服务器的路径
    "remotePath": "/root/xxx",

    //IP和端口
    "host": "your server ip",
    "protocol": "sftp",
    "port": 22,
    "username": "root",
    //输入密码或者秘钥
    "password":"abc",
    "privateKeyPath": "~/.ssh/id_rsa",
    
    //打开uploadOnSave，当你修改文件保存是会自动同步
    "uploadOnSave": true,
    "useTempFile": false,
    "openSsh": false,

    //忽略的文件
    "ignore": [            
        "**/.vscode/**",
        "**/.git/**",
        "**/.DS_Store",
    ]
}
```
填写好配置文件就可以开始上传了，还是`cmd+shift+p`选择`SFTP:Upload Project`,等待上传完成即可在远程服务器看到该项目了；这时候你修改本地文件远程会自动同步。
不过远程并不会自动同步到本地，如果你在远程运行代码生成了图片，数据之类的结果，可以使用`SFTP:Sync Remote->Local`同步到本地

# 跳板机
有些公司的服务器比较特殊，需要使用专门的跳板机来登陆，sftp 插件也是支持跳板机的，只要你按下面修改配置文件即可
```json
{
    "name": "xxx",
    "remotePath": "/root/xxx/",
    //跳板机的信息
    "host": "ip",
    "protocol": "sftp",
    "port": 22,
    "username": "root",
    //跳板机的密码或者秘钥
    "password":"abc",
    "privateKeyPath": "~/.ssh/id_rsa",
    
    "uploadOnSave": true,
    "useTempFile": false,
    "openSsh": false,
    "hop": {
        //远程服务器的信息
        "host": "IP",
        "port": 22,
        "username": "root",
        "password": "abc"
    },
    "ignore": [            
        "**/.vscode/**",
        "**/.git/**",
        "**/.DS_Store",
    ],
    "sshConfig": {
        "StrictHostKeyChecking": "no"
    }
}
```