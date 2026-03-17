---
title: "配置Https请求"
description: "nginx / springboot 配置 https，使用场景某些视频或摄像头等web页面必须"
badge: "技术分享"
date: 2022-09-14
tags: ["开发"]
archive: true
draft: false
slug: configure-https-requests
---
# 一、Nginx配置https请求

## 之前是这个配置

```shell
http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;

    server {
        listen       8981;
        server_name  localhost;

        client_max_body_size 2048M;

        index  index.html index.htm index.jsp;

				location / {
             try_files $uri $uri/ @router;
             index index.html;
        }
    }
}
```

## 在服务器上用openssl生成密钥文件，在原来nginx配置上面套一层ssl配置代理一下

```shell
server {
        listen       8982 ssl;
        server_name  localhost;

        client_max_body_size 2048M;

        index  index.html index.htm index.jsp;

				ssl_certificate      /root/card/domain.crt;
        ssl_certificate_key  /root/card/domain_nopass.key;

        ssl_session_cache    shared:SSL:1m;
        ssl_session_timeout  5m;

         location / {
            index  index.html index.htm;
            proxy_pass http://localhost:8981/;
        }
}
```

### 示例：

```shell
server {
        listen       9000 ssl;
        server_name  localhost;

        ssl_certificate      ssl/server.crt;#配置证书位置
        ssl_certificate_key  ssl/server.key;#配置秘钥位置

        ssl_session_cache    shared:SSL:1m;
        ssl_session_timeout  5m;

        ssl_ciphers  HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers  on;

        location / {
            root   html;
            index  index1.html index.htm;
        }
}
```

# 二、SpringBoot配置https

## 配置yml

```yaml
# 开发环境配置
server:
  # 服务器的端口，默认为8080
  port: 8000
  ssl:
    key-store: classpath:cc.p12
    key-store-password: yangtian
    key-store-type: PKCS12
```

## 配置http请求重定向

```java
import org.apache.catalina.Context;
import org.apache.catalina.connector.Connector;
import org.apache.tomcat.util.descriptor.web.SecurityCollection;
import org.apache.tomcat.util.descriptor.web.SecurityConstraint;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class HttpForwardConfig {

    @Bean
    TomcatServletWebServerFactory tomcatServletWebServerFactory() {
        TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory() {
            @Override
            protected void postProcessContext(Context context) {
                SecurityConstraint constraint = new SecurityConstraint();
                constraint.setUserConstraint("CONFIDENTIAL");
                SecurityCollection collection = new SecurityCollection();
                collection.addPattern("/*");
                constraint.addCollection(collection);
                context.addConstraint(constraint);
            }
        };
        factory.addAdditionalTomcatConnectors(createTomcatConnector());
        return factory;
    }

    private Connector createTomcatConnector() {
        Connector connector = new Connector("org.apache.coyote.http11.Http11NioProtocol");
        connector.setScheme("http");
        connector.setPort(8080);
        connector.setSecure(false);
        connector.setRedirectPort(8000);
        return connector;
    }
}

```

---
