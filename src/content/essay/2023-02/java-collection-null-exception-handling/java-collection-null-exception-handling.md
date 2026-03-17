---
title: "Java集合处理,空值处理,异常处理"
description: ""
badge: "开发随笔"
date: 2023-02-03
tags: ["Java"]
archive: true
draft: false
slug: java-collection-null-exception-handling
---
# 1. Arrays.asList

业务开发当中，我们常常会将原始的数组转换为List类数据结构，来继续展开各种Stream操作

- Arrays.asList无法转换基本类型的数组，可以使用Arrays.stream来进行转换
- Arrays.asList返回的list是不支持增删操作的，其返回的List是Arrays的内部类ArrayList。内部继承自AbstractList，没有覆写父类的add方法
- 对原始数组的修改会影响到我们获得的那个ListArrayList实际上是使用了原始的数组，因此在使用的时候，最好再使用New ArrayList来实现解耦

# 2. 空值处理

## 2.1 NullPointerException

- 可能出现的场景
    - 参数值是Integer等包装类型，使用时因为自动拆箱出现了空指针异常
    - 字符串比较
    - ConcurrentHashMap这种容器不支持Key和Value为null，强行put null的key或Value会出现空指针异常
    - 方法或远程服务返回的list是null，没做判空就直接调用，出现空指针异常
    - 联级调用的null check
- best practice
    - `string.equalsTo(variableName)`
    - `Optional.ofNullable()`
    - `orElse()`

# 3. 异常处理

## 3.1 在业务代码层面考虑异常处理

- 大多数业务应用都采用三层架构
    - Controller层
        - 负责信息收集，参数校验，转换服务层处理的数据适配前端，轻业务逻辑
        - Controller 捕获异常，然后需要给用户友好用户的提示
    - Service层
        - 负责核心业务逻辑，包括外部服务调用，访问数据库，缓存处理，消息处理等
        - 一般会涉及到数据库事务，出现异常不适合捕获，否则事务无法自动回滚
    - Repository层
        - 负责数据访问实现，一般没有业务逻辑
        - 根据情况来做忽略，降级，或者转化为一个友好的异常
- 框架层面的异常处理尽量不要在框架层面做异常的自动，统一的处理
    - 框架应当来做兜底工作，如果异常上升到最上层逻辑还是无法处理的话，可以用统一的方式进行异常转换 `@RestControllerAdvice`
        - `@ExceptionHandler`

## 3.2 不要直接生吞异常

捕获了异常以后不应该生吞，因为吞掉的异常如果没有正常处理的话，出现Bug会很难发现。

需要有合适的转化成用户友好的异常，或者至少在warn， error级别来做log

## 3.3 保留原始的信息

在捕捉了异常之后，一定要记得在log 或者在向外扔出的异常之中记录原始异常信息

```java
catch (IOException e) {
    //只保留了异常消息，栈没有记录
    log.error("文件读取错误, {}", e.getMessage());
    throw new RuntimeException("系统忙请稍后再试");
}

catch (IOException e) {
    throw new RuntimeException("系统忙请稍后再试", e);
}

```

## 3.4 小心finally中的异常 + try with resources

注意在资源释放处理等收尾操作的时候也可能会出现异常，这种时候，如果try block逻辑和finnally逻辑都有异常抛出的话，try当中的异常会被finnally中的异常覆盖掉，这会让问题变得非常不明显。

```java
@GetMapping("wrong")
public void wrong() {
    try {
        log.info("try");
        //异常丢失
        throw new RuntimeException("try");
    } finally {
        log.info("finally");
        throw new RuntimeException("finally");
    }
}

```

对于实现了AutoCloseable接口的资源，可以使用try-with-resources来释放资源，就是在try中带资源的声明

try catch finally vs try with resources

```java
Scanner scanner = null;
try {
    scanner = new Scanner(new File("test.txt"));
    while (scanner.hasNext()) {
        System.out.println(scanner.nextLine());
    }
} catch (FileNotFoundException e) {
    e.printStackTrace();
} finally {
    if (scanner != null) {
        scanner.close();
    }
}

try (Scanner scanner = new Scanner(new File("test.txt"))) {
    while (scanner.hasNext()) {
        System.out.println(scanner.nextLine());
    }
} catch (FileNotFoundException fnfe) {
    fnfe.printStackTrace();
}

```

## 3.5 线程池任务的异常处理

设置自定义的异常处理程序作为保底，比如在声明线程池时自定义线程池的未捕获异常处理程序：

```java
new ThreadFactoryBuilder()
  .setNameFormat(prefix+"%d")
  .setUncaughtExceptionHandler((thread, throwable)-> log.error("ThreadPool {} got exception", thread, throwable))
  .get()
```
