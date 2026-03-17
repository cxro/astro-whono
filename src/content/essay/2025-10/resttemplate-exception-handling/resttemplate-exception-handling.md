---
title: "RestTemplate异常处理"
description: "RestTemplate异常处理,除了200响应的状态码外,别的状态码RestTemplate都默认为 RestClientException 异常.但有些系统实现401,400等状态码,响应是正常的,只是做了状态码的不同,系统处理需要在catch中"
badge: "开发随笔"
date: 2025-10-27
tags: ["Java"]
archive: true
draft: false
slug: resttemplate-exception-handling
---
> RestTemplate异常状态码正常响应处理

# 一、问题描述

:::warning
RestTemplate异常处理,除了200响应的状态码外,别的状态码RestTemplate都默认为 RestClientException 异常.但有些系统实现401,400等状态码,响应是正常的,只是做了状态码的不同,系统处理需要在catch中
:::

# 二、解决思路

`RestTemplate` 实现了 `DefaultResponseErrorHandler` ,此错误处理程序检查 `ClientHttpResponse` 上的状态代码。`4xx` 或 `5xx` 系列中的任何代码都被视为错误。可以通过重写 `hasError(HttpStatusCode)`来更改此行为。未知状态代码将被 `hasError(ClientHttpResponse)`忽略

> 代码实现

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.RestTemplate;
import reactor.util.annotation.NonNull;

import java.io.IOException;

/**
 * @author : QingHai
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(5000);
        RestTemplate restTemplate = new RestTemplate(factory);
        restTemplate.getMessageConverters().add(new MappingJackson2HttpMessageConverter());
        restTemplate.setErrorHandler(new DefaultResponseErrorHandler() {
            @Override
            public boolean hasError(@NonNull ClientHttpResponse response) throws IOException {
                // 如果是400的话也是正常的，需要正常响应
                HttpStatusCode statusCode = response.getStatusCode();
                return !statusCode.is4xxClientError() && !statusCode.is2xxSuccessful();
            }

            @Override
            public void handleError(@NonNull ClientHttpResponse response) throws IOException {
                super.handleError(response);
            }
        });
        return restTemplate;
    }

}

```

> 异常状态码处理

```java
    public static void main(String[] args) {
        RestTemplate restTemplate = new RestTemplate();
        HttpEntity<?> requestEntity = new HttpEntity<>(new HttpHeaders());
        try {
            ResponseEntity<String> responseEntity = restTemplate.exchange("https://xxx.com/geturl?id=", HttpMethod.POST, requestEntity, new ParameterizedTypeReference<>() {
            });
            if (responseEntity.getStatusCode().is4xxClientError()) {
                // todo 400错误,异常处理逻辑
                log.warn("请求响应400.");
            }
            if (responseEntity.getStatusCode().is2xxSuccessful()) {
                log.info("请求响应成功.");
                System.out.println(responseEntity.getBody());
            }
        } catch (RestClientException restClientException) {
            throw new RuntimeException(restClientException);
        }
    }
```
