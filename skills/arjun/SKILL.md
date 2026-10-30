---
name: arjun
description: >
  此技能适用于用户询问关于 "arjun"、"执行 API 侦察"、"模糊测试查询/请求体/请求头参数"、"在 REST/GraphQL 端点中发现未文档化的输入参数" 等内容。在 Web 端点中发现隐藏的 HTTP 参数。
---

# Arjun

HTTP 参数发现工具 — 在 Web 端点中找到隐藏的 GET/POST/JSON/XML 参数。

## 快速开始

```bash
pip install arjun

# 单个 URL — GET 参数
arjun -u https://target.com/api/endpoint

# POST 请求体参数
arjun -u https://target.com/api/endpoint -m POST

# JSON 请求体
arjun -u https://target.com/api/endpoint -m JSON

# 从文件批量处理多个 URL
arjun -i urls.txt -o results.json
```

## 核心参数

| 参数 | 用途 |
|------|---------|
| `-u URL` | 目标 URL |
| `-m GET/POST/JSON/XML` | 请求方法（默认：GET） |
| `-i FILE` | 包含 URL 的输入文件 |
| `-o FILE` | 将结果输出为 JSON |
| `-t N` | 线程数（默认：5） |
| `-d N` | 请求延迟（毫秒） |
| `--headers "K:V"` | 自定义请求头 |
| `--stable` | 避免不稳定端点（出错时重试） |
| `-q` | 静默模式 |
| `--include` | 在每个请求中始终包含指定参数 |

## 常见工作流程

**对需认证的端点进行 API 侦察：**
```bash
arjun -u https://api.target.com/v1/user -m GET --headers "Authorization: Bearer TOKEN"
```

**模糊测试 POST 表单：**
```bash
arjun -u https://target.com/login -m POST
```

**从 Burp 导出的 URL 批量扫描：**
```bash
cat burp_urls.txt | arjun -i /dev/stdin -o found_params.json
```

## 资源

| 文件 | 加载时机 |
|------|--------------|
| `references/` | 扩展字典与参数篡改技巧 |
