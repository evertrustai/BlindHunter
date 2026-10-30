---
name: amass
description: >
  此技能适用于用户询问关于 "amass"、"需要深度子域名侦察 (subdomain reconnaissance)、攻击面测绘 (attack surface mapping)、DNS 枚举"、"subfinder 单独使用不足时" 等内容。OWASP 攻击面测绘工具，结合被动 OSINT 与主动 DNS 枚举进行子域名发现和资产探测。
---

# Amass

OWASP 攻击面测绘器 — 将被动 OSINT 与主动 DNS 枚举相结合。

## 快速开始

```bash
# 被动枚举
amass enum -passive -d example.com

# 主动枚举（DNS 暴力破解 + 被动）
amass enum -active -d example.com

# 将结果保存到输出目录
amass enum -d example.com -o subs.txt -dir amass_out/
```

## 子命令

| 命令 | 描述 |
|---------|-------------|
| `enum` | 子域名枚举（主要工作流程） |
| `intel` | 收集组织/ASN/CIDR 情报 |
| `viz` | 生成图形可视化 |
| `track` | 跟踪随时间的变化 |
| `db` | 管理 Amass 图数据库 |

## Enum 参数

| 参数 | 描述 |
|------|-------------|
| `-d <domain>` | 目标域名 |
| `-dL <file>` | 域名列表文件 |
| `-passive` | 仅被动模式（不进行 DNS 探测） |
| `-active` | 主动模式（DNS + 证书抓取） |
| `-brute` | 使用字典进行 DNS 暴力破解 |
| `-w <wordlist>` | 暴力破解使用的自定义字典 |
| `-r <resolvers>` | 自定义 DNS 解析器文件 |
| `-o <file>` | 输出文件 |
| `-dir <path>` | 所有文件的输出目录 |
| `-config <file>` | 配置文件（API 密钥、设置） |
| `-timeout <mins>` | 枚举超时时间（分钟） |

## 配置文件（API 密钥）

创建 `~/.config/amass/config.yaml`：

```yaml
scope:
  domains:
    - example.com
data_sources:
  Shodan:
    - apikey: YOUR_KEY
  VirusTotal:
    - apikey: YOUR_KEY
  Censys:
    - apikey: YOUR_ID
      secret: YOUR_SECRET
```

## 常见工作流程

```bash
# 仅被动侦察
amass enum -passive -d example.com -o passive_subs.txt

# 完整主动枚举 + 暴力破解
amass enum -active -brute -w /usr/share/wordlists/subdomains.txt -d example.com

# 组织情报（查找相关 ASN/CIDR）
amass intel -org "Target Corp" -max-dns-queries 2500

# 多域名
amass enum -passive -dL domains.txt -o all_subs.txt

# 枚举完成后生成可视化
amass viz -d3 -dir amass_out/ -d example.com
```

## 资源

| 文件 | 加载时机 |
|------|--------------|
| `references/enum-modes.md` | intel/enum/viz 模式深度解析、配置文件语法、解析器设置 |
