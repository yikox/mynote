
### 挂载
```shell

sudo mount -t cifs //172.16.23.68/data /root/share -o username=root,password=xxxx,nounix,sec=ntlmssp

umount /root/share
```
### 文件传输
```shell
scp -r src/ root@host:dst/

# 端口
scp -r -P port src/ root@host:dst/

# jump
scp -r -P port -o StrictHostKeyChecking=no -J name@ip:port src/ root@host:dst/
```


### 临时添加环境
```shell
#环境
export PATH=./ffmpeg/bin:$PATH
#库环境
export LD_LIBRARY_PATH=./ffmpeg/lib:$LD_LIBRARY_PATH
```
### 挂起和恢复
在终端中可以使用ctrl+z将进程挂起
然后使用fg恢复
如果挂起多个可以使用fg 进程号恢复

### 查看 linux 系统版本
`cat /etc/issue`
