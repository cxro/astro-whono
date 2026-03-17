---
title: 代码高亮测试
description: 测试不同编程语言的语法高亮效果
date: 2026-01-05
tags: ["代码", "测试"]
draft: true
---

本文测试主题对各种编程语言的代码高亮支持。

## TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }
  return response.json();
}
```

## Rust

```rust
fn main() {
    let numbers: Vec<i32> = (1..=10).collect();
    let sum: i32 = numbers.iter().sum();
    println!("Sum of 1 to 10: {}", sum);
}
```

## Go

```go
package main

import "fmt"

func main() {
    messages := make(chan string)
    
    go func() {
        messages <- "Hello, Goroutine!"
    }()
    
    msg := <-messages
    fmt.Println(msg)
}
```

## SQL

```sql
SELECT 
    u.name,
    COUNT(p.id) as post_count,
    MAX(p.created_at) as last_post
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.active = true
GROUP BY u.id
HAVING post_count > 5
ORDER BY post_count DESC;
```

## JSON

```json
{
  "name": "astro-whono",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build"
  }
}
```

## YAML

```yaml
site:
  title: My Blog
  description: A personal blog built with Astro
  author:
    name: John Doe
    email: john@example.com
  social:
    - platform: twitter
      url: https://twitter.com/johndoe
    - platform: github
      url: https://github.com/johndoe
```

代码高亮使用 Shiki，支持 100+ 种编程语言。
