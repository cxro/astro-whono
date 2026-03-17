---
title: "SpringBoot集成Guava限流"
description: ""
badge: "技术分享"
date: 2025-11-01
tags: ["Java","建站"]
archive: true
draft: false
slug: springboot-guava-rate-limiting
---
# 一、介绍

Guava限流是使用令牌桶方式进行限流，可以根据ip进行限流操作，可以进行扩展。

# 二、引入依赖

```xml
<!--AOP相关-->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>

<dependency>
    <groupId>com.google.guava</groupId>
    <artifactId>guava</artifactId>
</dependency>
```

### 三、代码实现

### 枚举定义

```java
import org.springframework.core.annotation.AliasFor;

import java.lang.annotation.*;
import java.util.concurrent.TimeUnit;

/**
 * 限流注解
 *
 * @author : yhb
 * @date : 2022/8/30
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented   // 将注解生成在javadoc中
public @interface Limiter {

    int NOT_LIMIT = 0;

    /**
     * qps：Queries-per-second， 每秒查询率，QPS = req/sec = 请求数/秒
     */
    @AliasFor("qps")
    double value() default NOT_LIMIT;

    @AliasFor("value")
    double qps() default NOT_LIMIT;

    /**
     * 超时时长
     */
    int timeout() default 0;

    /**
     * 超时时间单位
     */
    TimeUnit timeUnit() default TimeUnit.MILLISECONDS;
}
```

### 切面定义

```java
import cn.hutool.extra.servlet.ServletUtil;
import com.google.common.util.concurrent.RateLimiter;
import com.yt.common.annotation.Limiter;
import com.yt.common.enums.ResponseEnum;
import com.yt.common.exception.BusinessException;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 接口限流处理
 *
 * @author : yhb
 * @date : 2022/8/30
 */
@Aspect
@Component
public class RateLimiterAspect {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterAspect.class);

    /**
     * 令牌桶
     */
    private static final ConcurrentHashMap<String, RateLimiter> LIMIT_CACHE = new ConcurrentHashMap<>();

    @Pointcut("@annotation(com.yt.common.annotation.Limiter)")
    public void pointcut() {
    }

    @Around("pointcut()")
    public Object pointcut(ProceedingJoinPoint point) throws Throwable {
        MethodSignature signature = (MethodSignature) point.getSignature();
        Method method = signature.getMethod();
        HttpServletRequest httpServletRequest = ((ServletRequestAttributes) RequestContextHolder.getRequestAttributes()).getRequest();
        Limiter limiter = AnnotationUtils.findAnnotation(method, Limiter.class);
        // 判断是否需要进行限流
        if (limiter != null && limiter.qps() > Limiter.NOT_LIMIT) {
            // 获取key
            String key = ServletUtil.getClientIP(httpServletRequest) + " - " + method.getName();
            double qps = limiter.qps();
            // 是否第一次调用
            if (LIMIT_CACHE.get(key) == null) {
                LIMIT_CACHE.put(key, RateLimiter.create(qps));
            }
            log.debug("[{}]的QPS设置为: {}", key, LIMIT_CACHE.get(key).getRate());

            // 尝试获取令牌
            if (LIMIT_CACHE.get(key) != null && !LIMIT_CACHE.get(key).tryAcquire(limiter.timeout(), limiter.timeUnit())) {
            // TODO 自定义异常
                throw new BusinessException(ResponseEnum.ERROR.getCode(), "系统异常，请稍后再试");
            }
        }
        return point.proceed();
    }
}
```

### 扩展，根据IP进行限流

```java
import cn.hutool.extra.servlet.ServletUtil;
import com.google.common.util.concurrent.RateLimiter;
import com.yt.common.annotation.Limiter;
import com.yt.common.enums.ResponseEnum;
import com.yt.common.exception.BusinessException;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 接口限流处理
 *
 * @author : yhb
 * @date : 2022/8/30
 */
@Aspect
@Component
public class RateLimiterAspect {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterAspect.class);

    /**
     * 令牌桶
     */
    private static final ConcurrentHashMap<String, RateLimiter> LIMIT_CACHE = new ConcurrentHashMap<>();

    /**
     * 禁用时间存储<key, 开始禁用时间>
     */
    private static final ConcurrentHashMap<String, LocalDateTime> WAIT_TIME_CACHE = new ConcurrentHashMap<>();

    @Pointcut("@annotation(com.yt.common.annotation.Limiter)")
    public void pointcut() {
    }

    @Around("pointcut()")
    public Object pointcut(ProceedingJoinPoint point) throws Throwable {
        MethodSignature signature = (MethodSignature) point.getSignature();
        Method method = signature.getMethod();
        HttpServletRequest httpServletRequest = ((ServletRequestAttributes) RequestContextHolder.getRequestAttributes()).getRequest();
        Limiter limiter = AnnotationUtils.findAnnotation(method, Limiter.class);
        // 判断是否需要进行限流
        if (limiter != null && limiter.qps() > Limiter.NOT_LIMIT) {
            // 获取key
            String key = ServletUtil.getClientIP(httpServletRequest) + " - " + method.getName();
            double qps = limiter.qps();
            // 是否第一次调用
            if (LIMIT_CACHE.get(key) == null) {
                LIMIT_CACHE.put(key, RateLimiter.create(qps));
            }
            log.debug("[{}]的QPS设置为: {}", key, LIMIT_CACHE.get(key).getRate());
            // 是否在限制时间中
            if (limiter.disableTime() > 0 && WAIT_TIME_CACHE.get(key) != null && WAIT_TIME_CACHE.get(key).isAfter(LocalDateTime.now())) {
                throw new BusinessException(ResponseEnum.ERROR.getCode(), "系统异常，请稍后再试");
            }
            // 尝试获取令牌
            if (LIMIT_CACHE.get(key) != null && !LIMIT_CACHE.get(key).tryAcquire(limiter.timeout(), limiter.timeUnit())) {
                if (limiter.disableTime() > 0) {
                    WAIT_TIME_CACHE.put(key, LocalDateTime.now().plusSeconds(limiter.disableTime()));
                }
                throw new BusinessException(ResponseEnum.ERROR.getCode(), "系统异常，请稍后再试");
            }
        }
        return point.proceed();
    }
}
```

### 四、使用示例

```java
@Limiter(10.0)
@PostMapping("/findAddress")
public Result<List<AddressVo>> findAddress() {
    return Result.success(addressService.findAddress());
}
```
