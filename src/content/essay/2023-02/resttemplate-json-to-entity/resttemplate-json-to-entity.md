---
title: "RestTemplate JSON 转成实体类"
description: ""
badge: "开发随笔"
date: 2023-02-03
tags: ["Java"]
archive: true
draft: false
slug: resttemplate-json-to-entity
---
有时候我们需要使用RestTemplate在java服务器访问其他url的资源，但是因为毕竟是处于两台服务器（jvm）中的类，如何进行实体类的传输呢？

- 约定实体类
- 本例子以 `AgreementApproveForOA` 为结果返回的实体类接受请求的代码

```java
 @ApiOperation(value = "获取框架协议")
 @PostMapping("/getAgreementApprove")
 public ResponseEntity<AgreementApproveDTO> getAgreementApprove(@RequestParam Integer fcompanyId, @RequestParam Integer fcompanyType, @RequestHeader("fuid") Integer faid) {
      return xxx;
 }

```

- 转化实例

```java
  public static AgreementApproveForOA getData() throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.add("fuid", "2");//设置header
        String url = "http://localhost:8481/admin/admin/agreementApprove/getAgreementApprove?fcompanyId=174&fcompanyType=1";
        ResponseEntity<String> data = restTemplate.postForEntity(url, new HttpEntity<String>(headers), String.class);//获取json串
        AgreementResponseEntity agreementResponseEntity;
        //readValue(json字符串，json串对应装配的实体类)
        agreementResponseEntity = mapper.readValue(data.getBody(), AgreementResponseEntity.class);
        return agreementResponseEntity.getRetEntity();
    }

```

- 附上依赖 pom.xml

```xml
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.9.5</version>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-core</artifactId>
            <version>2.10.0</version>
        </dependency>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-web</artifactId>
            <version>5.1.10.RELEASE</version>
        </dependency>

```

- 踩过的坑jackson包不支持 2019-01-05 13:25:10 这种格式，会出现以下错误

```java
 Cannot deserialize value of type `java.util.Date` from String "2019-10-03 00:00:00": not a valid representation (error: Failed to parse Date value '2019-10-03 00:00:00': Cannot parse date "2019-10-03 00:00:00": while it seems to fit format 'yyyy-MM-dd'T'HH:mm:ss.SSSZ', parsing fails (leniency? null))
```

- 解决方法：自定义日期解析器
解决方法引用自：[链接](https://blog.csdn.net/qq906627950/article/details/79503801)

```java
Jackson2ObjectMapperBuilder jackson2ObjectMapperBuilder = new Jackson2ObjectMapperBuilder();
mapper = jackson2ObjectMapperBuilder.build();
DateFormat dateFormat = mapper.getDateFormat();
mapper.setDateFormat(new MyDateFormat(dateFormat));
```

MyDateFormat.java

```java
public class MyDateFormat extends DateFormat {

	private DateFormat dateFormat;

	private SimpleDateFormat format1 = new SimpleDateFormat("yyy-MM-dd HH:mm:ss");

	public MyDateFormat(DateFormat dateFormat) {
		this.dateFormat = dateFormat;
	}

	@Override
	public StringBuffer format(Date date, StringBuffer toAppendTo, FieldPosition fieldPosition) {
		return dateFormat.format(date, toAppendTo, fieldPosition);
	}

	@Override
	public Date parse(String source, ParsePosition pos) {

		Date date = null;

		try {

			date = format1.parse(source, pos);
		} catch (Exception e) {

			date = dateFormat.parse(source, pos);
		}

		return date;
	}

	// 主要还是装饰这个方法
	@Override
	public Date parse(String source) throws ParseException {

		Date date = null;

		try {

			// 先按我的规则来
			date = format1.parse(source);
		} catch (Exception e) {

			// 不行，那就按原先的规则吧
			date = dateFormat.parse(source);
		}

		return date;
	}

	// 这里装饰clone方法的原因是因为clone方法在jackson中也有用到
	@Override
	public Object clone() {
		Object format = dateFormat.clone();
		return new MyDateFormat((DateFormat) format);
	}
}

```

这样就可以把json转成相对应的实体类了。
