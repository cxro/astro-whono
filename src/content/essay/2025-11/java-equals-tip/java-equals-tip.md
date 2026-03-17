---
title: "Java的Equals比较小Tip"
description: ""
badge: "开发随笔"
date: 2025-11-17
tags: ["Java"]
archive: true
draft: false
slug: java-equals-tip
---
> 进行内置角色初始化操作的时候,角色是否相同判断,只需要比较内置角色的信息,和权限的标识即可,不进行比较id等字段,在比较List<PermissionVo>的时候,会存在顺序和数值的问题.

# 一、问题原因

java在比较对象的时候,默认比较内存地址,如果需要比较List的话,会进行列表长度和顺序的校验.只重写对象的equals和hash方法是不够的

# 二、解决思路

## 在equals比较中,单独抽取方法校验equals,先进行排序,再进行比较

```java
    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        if (!super.equals(o)) return false;
        RoleAgg roleAgg = (RoleAgg) o;
        return Objects.equals(mark, roleAgg.mark) && Objects.equals(name, roleAgg.name) && Objects.equals(description, roleAgg.description) && Objects.equals(type, roleAgg.type) &&
                permissionListsEqualIgnoreOrder(this.permissionVoList, roleAgg.permissionVoList);
    }

    /**
     * 自定义的比较权限的方法
     */
    private static boolean permissionListsEqualIgnoreOrder(List<PermissionVo> list1, List<PermissionVo> list2) {
        if (list1 == list2) return true;
        if (list1 == null || list2 == null) return false;
        if (list1.size() != list2.size()) return false;

        List<PermissionVo> sorted1 = list1.stream().sorted(Comparator.comparing(PermissionVo::getMark)).toList();
        List<PermissionVo> sorted2 = list2.stream().sorted(Comparator.comparing(PermissionVo::getMark)).toList();

        return sorted1.equals(sorted2);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), mark, name, description, type, permissionVoList);
    }
```
