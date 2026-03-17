---
title: "将list转为树形结构"
description: ""
badge: "开发随笔"
date: 2022-04-19
tags: ["Java"]
archive: true
draft: false
slug: convert-list-to-tree
---
### 原始数据

```json
[
    {
        "name":"甘肃省",
        "pid":0,
        "id":1
    },
    {
        "name":"天水市",
        "pid":1,
        "id":2
    },
    {
        "name":"秦州区",
        "pid":2,
        "id":3
    },
    {
        "name":"北京市",
        "pid":0,
        "id":4
    },
    {
        "name":"昌平区",
        "pid":4,
        "id":5
    }
]
```

### 使用 Java 将以上数据转为树形结构
> 转化后的结构如下
```json
[
    {
        "children":[
            {
                "children":[
                    {
                        "name":"秦州区",
                        "pid":2,
                        "id":3
                    }
                ],
                "name":"天水市",
                "pid":1,
                "id":2
            }
        ],
        "name":"甘肃省",
        "pid":0,
        "id":1
    },
    {
        "children":[
            {
                "name":"昌平区",
                "pid":4,
                "id":5
            }
        ],
        "name":"北京市",
        "pid":0,
        "id":4
    }
]
```

### 代码如下

```java
/**
 * listToTree
 * <p>方法说明<p>
 * 将JSONArray数组转为树状结构
 * @param arr 需要转化的数据
 * @param id 数据唯一的标识键值
 * @param pid 父id唯一标识键值
 * @param child 子节点键值
 * @return JSONArray
 */
public static JSONArray listToTree(JSONArray arr,String id,String pid,String child){
   JSONArray r = new JSONArray();
   JSONObject hash = new JSONObject();
   //将数组转为Object的形式，key为数组中的id
   for(int i=0;i<arr.size();i++){
      JSONObject json = (JSONObject) arr.get(i);
      hash.put(json.getString(id), json);
   }
   //遍历结果集
   for(int j=0;j<arr.size();j++){
      //单条记录
      JSONObject aVal = (JSONObject) arr.get(j);
      //在hash中取出key为单条记录中pid的值
      JSONObject hashVP = (JSONObject) hash.get(aVal.get(pid).toString());
      //如果记录的pid存在，则说明它有父节点，将她添加到孩子节点的集合中
      if(hashVP!=null){
         //检查是否有child属性
         if(hashVP.get(child)!=null){
            JSONArray ch = (JSONArray) hashVP.get(child);
            ch.add(aVal);
            hashVP.put(child, ch);
         }else{
            JSONArray ch = new JSONArray();
            ch.add(aVal);
            hashVP.put(child, ch);
         }
      }else{
         r.add(aVal);
      }
   }
   return r;
}
```

### 测试代码

```java
public static void main(String[] args){
   List<Map<String,Object>> data = new ArrayList<>();
   Map<String,Object> map = new HashMap<>();
   map.put("id",1);
   map.put("pid",0);
   map.put("name","甘肃省");
   data.add(map);
   Map<String,Object> map2 = new HashMap<>();
   map2.put("id",2);
   map2.put("pid",1);
   map2.put("name","天水市");
   data.add(map2);
   Map<String,Object> map3 = new HashMap<>();
   map3.put("id",3);
   map3.put("pid",2);
   map3.put("name","秦州区");
   data.add(map3);
   Map<String,Object> map4 = new HashMap<>();
   map4.put("id",4);
   map4.put("pid",0);
   map4.put("name","北京市");
   data.add(map4);
   Map<String,Object> map5 = new HashMap<>();
   map5.put("id",5);
   map5.put("pid",4);
   map5.put("name","昌平区");
   data.add(map5);
   System.out.println(JSON.toJSONString(data));
   JSONArray result = listToTree(JSONArray.parseArray(JSON.toJSONString(data)),"id","pid","children");
   System.out.println(JSON.toJSONString(result));
}
```
