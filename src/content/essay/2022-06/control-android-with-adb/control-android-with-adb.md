---
title: "使用adb命令操控Android手机"
description: "adb一些基本指令"
badge: "技术分享"
date: 2022-06-24
tags: ["Android"]
archive: true
draft: false
slug: control-android-with-adb
---
# 1. 手机连接电脑之前

- 首先，查看安卓手机是否已经连接上电脑

```shell
adb devices
```

- 让 adb 一直查找安卓设备，找到后才停止

```shell
adb wait-for-device
```

# 2. 手机连接电脑后的操作

## 2.1 基本命令

- 连接多个安卓设备时，在 adb 命令后紧跟着使用 -s 加序列号 来指定要操作的设备。建议每次只连接一个安卓设备进行操作。

```shell
adb devices
# List of devices    attached
# FA6AX0301341        device
# ce0217122b56b02604  device

adb -s FA6AX0301341 shell
# sailfish:/ $
```

## 2.2 锁定/解锁/重启/关机

- 锁定/解锁手机

```shell
adb shell input keyevent 26   # 锁定手机
adb shell input keyevent 82   # 解锁手机（若设置密码，会提示输入密码）
```

- 输入密码，并回车

```shell
adb shell input text 123456 && adb shell input keyevent 66
```

- 重启/关机

```shell
adb reboot             # 重启
adb shell reboot       # 重启
adb shell reboot -p    # 关机
```

## 2.3 系统设置

- 打开/关闭蓝牙

```shell
adb shell service call bluetooth_manager 6   # 打开蓝牙
adb shell service call bluetooth_manager 9   # 关闭蓝牙
```

- 打开/关闭 Wi‑Fi

```shell
adb shell svc wifi enable    # 打开 Wi‑Fi
adb shell svc wifi disable   # 关闭 Wi‑Fi
```

- 打开 Wi‑Fi 设置界面

```shell
adb shell am start -a android.intent.action.MAIN -n com.android.settings/.wifi.WifiSettings
```

- 连接时保持亮屏设置

```shell
svc power stayon [true|false|usb|ac|wireless]
```

参数说明：

- true：任何情况下均保持亮屏
- false：任何情况下均不保持亮屏（经过设定时间后自动黑屏）
- usb、ac、wireless：仅在对应供电方式下保持亮屏

## 2.4 模拟本机操作

- 模拟按键操作

```shell
adb shell input keyevent 111   # 关闭软键盘（ESC，111=KEYCODE_ESCAPE）
```

更多按键代码请见[官方文档](https://developer.android.com/reference/android/view/KeyEvent.html)

- 模拟滑动触屏操作

```shell
adb shell input touchscreen swipe 930 880 930 380   # 向上滑
adb shell input touchscreen swipe 930 880 330 880   # 向左滑
adb shell input touchscreen swipe 330 880 930 880   # 向右滑
adb shell input touchscreen swipe 930 380 930 880   # 向下滑
```

- 模拟鼠标操作

```shell
adb shell input mouse tap 100 500
```

说明：100 为 x，500 为 y，原点在屏幕左上角。

## 2.5 运行程序

- 拨打电话

```shell
adb shell am start -a android.intent.action.CALL -d tel:10010
```

- 打开网站

```shell
adb shell am start -a android.intent.action.VIEW -d http://google.com
```

- 启动 APP

```shell
adb shell am start -n com.package.name/com.package.name.MainActivity
adb shell am start -n com.package.name/.MainActivity

adb shell monkey -p com.android.contacts -c android.intent.category.LAUNCHER 1
# Events injected: 1
# Network stats: elapsed time=16ms (0ms mobile, 0ms wifi, 16ms not connected)
```

# 3. 硬件高级调节

## 3.0 信息查看

- 查看设备序列号

```shell
adb get-serialno
```

## 3.1 CPU 相关

- 查看 CPU 温度

先查看有哪些温度区域 thermal zone：

```shell
adb shell ls sys/class/thermal/
# cooling_device0
# cooling_device1
# cooling_device2
# cooling_device3
# cooling_device4
# cooling_device5
# thermal_zone0
# thermal_zone1
# thermal_zone2
# thermal_zone3
# thermal_zone4
# thermal_zone5
# thermal_zone6
# thermal_zone7
```

查看某个 CPU 温度：

```shell
adb shell cat /sys/class/thermal/thermal_zone0/temp
# 25800
```

温度单位为 milliCelsius，例如 25800 表示 25.8°C。

- CPU 设置

查看当前手机可用的 governor：

```shell
adb shell cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_available_governors
# userspace interactive performance
```

- 锁定 CPU 为最大频率

参考：[https://forum.xda-developers.com/showthread.php?t=1663809](https://forum.xda-developers.com/showthread.php?t=1663809)

```shell
echo performance > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
```

# 4. 刷机

- 重启手机，进入 recovery 或 bootloader 模式

```shell
adb reboot recovery         # 恢复模式
adb reboot bootloader       # 刷机模式。不同手机命令可能不同，要试一下
adb reboot-bootloader
adb reboot "boot loader"
```

- 进入 fastboot 模式

```shell
adb reboot fastboot
```

或：关机后，同时按住 音量加 + 电源 键开机

# 5. 调试

- 抓取开机日志

```shell
adb wait-for-device && adb shell logcat -v threadtime | tee mybootup.log
```

- 查看日志

```shell
adb logcat
```

- 关闭/重启 adb 服务进程

```shell
adb kill-server
adb start-server
```

- 本地与设备互传文件

```shell
adb push test.zip /sdcard/          # 从本地复制文件到设备
adb pull /sdcard/abc.zip ~/         # 从设备复制文件到本地
```

- 显示已安装 APP 的包名

```shell
adb shell pm list packages
```

- 安装/删除 APP

```shell
adb install abc.apk                 # 首次安装。若已安装会报错
adb install -r abc.apk              # 覆盖安装，保留数据
adb -s 11223344 install abc.apk     # 多设备时安装到指定设备
adb uninstall com.example.appname
```

- 查看 apk 版本（无需解压）

```shell
aapt dump badging abcd.apk | grep version
```

- 捕获键盘操作

```shell
adb shell getevent -ltr
```

- 查看与设置屏幕分辨率与密度

查看：

```shell
wm size
wm density
```

设置：

```shell
wm density 240
```

设置后立刻生效。
