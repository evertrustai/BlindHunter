---
name: deep-research-offensive
description: >
  此技能适用于用户询问关于"deep-research-offensive"、"研究 CVE 和漏洞"、
  "漏洞利用分析和 PoC 代码"、"红队目标的 OSINT"、"红队规划和威胁情报"等问题。
  攻击性安全研究：CVE 分析、漏洞利用研究、漏洞评估、红队侦察和威胁情报综合。
---

# 深度研究——攻击性安全

系统性攻击性研究工作流，涵盖 CVE 分析、漏洞利用研究、漏洞评估和红队情报。专为授权安全研究场景设计。

> **范围**：仅对拥有明确书面授权的目标使用。

---

## MCP 工具参考（已验证）

| 函数名 | 工具 | 用途 |
|---|---|---|
| `mcp_io_github_tav_tavily_search` | Tavily Search | 跨网络关键词搜索——主要搜索工具 |
| `mcp_io_github_tav_tavily_map` | Tavily Map | 在抓取前枚举公告/文档站点的 URL |
| `mcp_firecrawl_fir_firecrawl_scrape` | Firecrawl Scrape | 从已知 URL 获取完整页面内容 |
| `mcp_firecrawl_fir_firecrawl_extract` | Firecrawl Extract | 从已知 URL 提取结构化 JSON 字段——最快获取 CVSS、CPE |
| `mcp_firecrawl_fir_firecrawl_crawl` | Firecrawl Crawl | 抓取多页公告门户的所有页面 |
| `mcp_microsoft_pla_browser_run_code` | Playwright | JS 渲染页面、DataTable（ExploitDB）、需登录的内容 |
| xcancel.com via Playwright | X/Twitter 搜索 | 无需认证的 Twitter 搜索代理——CVE、恶意软件、PoC 推文 |
| `api.fxtwitter.com` via Firecrawl | FxTwitter API | 零认证 JSON，获取完整帖子/线程内容和用户信息 |
| `tg.i-c-a.su/json/{channel}` via Firecrawl | Telegram（零认证） | 获取任何公开 Telegram 频道的完整 JSON 消息 |
| `t.me/s/{channel}` via Playwright | Telegram 预览 | 公开频道最近约 30 条帖子，JS 渲染 |

---

## 调用优化

遵循此决策树——**第一次成功即停止**以避免浪费调用：

```
1. Need broad search across multiple sites?
   → Tavily search  (fast, 1 credit)

2. Need specific fields from a known URL (CVSS, CPE, refs)?
   → Firecrawl extract  with JSON schema  (structured, 1-shot)

3. Need full page content from a known URL?
   → Firecrawl scrape  with onlyMainContent:true

4. Firecrawl returned "Processing..." or empty tables?
   → Playwright  with waitUntil:'networkidle'

5. Need ALL pages of a site (vendor bulletin portal)?
   → Firecrawl crawl  (most expensive — use last, limit ≤ 10)
```

**并行运行独立调用**——针对不同 URL 的 Tavily 搜索和 Firecrawl 调用是独立的。

---

## Tavily：查询优化（来自官方文档）

### 查询规则
- 每个查询**最多 400 个字符**——视为简洁的网络搜索，而非提示词
- **每个查询一个主题**——将复杂研究拆分为并行运行的子查询
- **使用 `include_domains`** 限制到可信来源（最多 300 个域；保持列表简短）
- **使用 `exclude_domains`** 过滤噪声（最多 150 个域）
- **不要在查询字符串中使用 `site:`**——改用 `include_domains` 参数

### `search_depth`——按用例选择

| 深度 | 费用 | 内容类型 | 使用场景 |
|---|---|---|---|
| `ultra-fast` | 1 | NLP 摘要 | 实时、对延迟敏感 |
| `fast` | 1 | 排序分块 | 快速定向摘要 |
| `basic` | 1 | NLP 摘要 | 通用（默认） |
| `advanced` | 2 | 排序分块 | 特定事实、最高精度 |

- 广泛发现（侦察、威胁情报扫描）使用 `basic`
- 需要确切字段（CVSS 向量、受影响版本）时使用 `advanced` + `chunks_per_source: 3`
- 避免使用 `auto_parameters: true`——可能静默升级为 `advanced`（2 点费用）

### `topic` 参数
- `general` — 广泛网络（默认）
- `news` — 仅新闻来源；结果包含 `published_date`——用于"在野外被利用"情报
- `finance` — 金融来源

### 时间过滤
- `time_range`: `day` / `week` / `month` / `year`——按时效过滤
- `start_date` / `end_date`: `YYYY-MM-DD`——精确日期范围用于公告新鲜度检查

### `max_results`
- 默认：5——大多数 CVE 查询足够
- 仅在需要广泛覆盖时使用 10（侦察扫描）
- 较高的值会降低平均结果质量并消耗更多上下文 token

### 处理结果后处理
- 在传递 URL 给 Firecrawl 之前过滤 `score > 0.7`——丢弃低相关性结果
- 在获取完整内容之前使用 `title` 字段进行快速关键词扫描

---

## 研究工作流程

### CVE 深度调查

并行运行步骤 1–3，然后跟进找到的 URL：

**步骤 1——NVD 结构化数据**（Firecrawl extract——获取结构化字段最快）
```
tool: mcp_firecrawl_fir_firecrawl_extract
urls: ["https://nvd.nist.gov/vuln/detail/CVE-YYYY-NNNNN"]
schema: {
  "cvss_score": string,
  "cvss_vector": string,
  "cwe": string,
  "affected_versions": [string],
  "references": [string]
}
```

**步骤 2——PoC 搜索**（并行 3 个 Tavily 查询）
```
query 1: "CVE-YYYY-NNNNN" exploit PoC
  include_domains: ["github.com"]
  search_depth: basic, max_results: 5

query 2: CVE-YYYY-NNNNN exploit
  include_domains: ["sploitus.com", "packetstormsecurity.com"]
  search_depth: basic, max_results: 5

query 3: CVE-YYYY-NNNNN exploited ransomware APT campaign
  topic: news, time_range: year, max_results: 5
```

**步骤 3——ExploitDB**（Playwright——必需，JS 渲染的 DataTable）
```javascript
async (page) => {
  await page.goto('https://www.exploit-db.com/search?cve=YYYY-NNNNN',
    { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('#exploits-table tbody tr');
    return rows.length > 0 && !rows[0].textContent.includes('Processing');
  }, { timeout: 15000 }).catch(() => null);
  return await page.locator('#exploits-table tbody tr').allInnerTexts();
}
```

**步骤 4——GitHub PoC 仓库**（Firecrawl scrape，对步骤 2 中找到的每个仓库）
```
tool: mcp_firecrawl_fir_firecrawl_scrape
formats: ["markdown"]
onlyMainContent: true
```

**步骤 5——CISA KEV 检查 + 厂商公告**（并行）
```
Firecrawl extract: https://www.cisa.gov/known-exploited-vulnerabilities-catalog?field_cve=CVE-YYYY-NNNNN
  schema: { "in_kev": bool, "due_date": string, "required_action": string }

Firecrawl scrape: [vendor advisory URL from NVD references]
  onlyMainContent: true
```

---

### 目标侦察

并行运行所有查询（每个查询一个主题）：

```
query 1: [product] [version] vulnerability 2025
  search_depth: basic, max_results: 5

query 2: [product] CVE critical severity
  include_domains: ["nvd.nist.gov", "cve.mitre.org"]
  search_depth: basic, max_results: 5

query 3: [product] exploit PoC
  include_domains: ["github.com", "exploit-db.com", "sploitus.com"]
  search_depth: basic, max_results: 5

query 4: [product] security advisory patch
  include_domains: ["[vendor.com]"]
  time_range: year, search_depth: basic, max_results: 5
```

在爬取前使用 Tavily map 枚举厂商门户：
```
tool: mcp_io_github_tav_tavily_map
url: https://[vendor.com]/security
max_depth: 2, max_breadth: 10
select_paths: ["/advisory", "/security", "/cve", "/vulns"]
```

---

### ATT&CK 技术查询

```
tool: mcp_firecrawl_fir_firecrawl_scrape
url: https://attack.mitre.org/techniques/T[ID]/
onlyMainContent: true

# Cross-check with Tavily for real-world procedure examples:
query: T[ID] [technique name] red team procedure example
search_depth: advanced, chunks_per_source: 3, max_results: 5
```

---

## 输出模板

```
## Target Summary（目标摘要）
[资产、范围、参与类型]

## Vulnerability Matrix（漏洞矩阵）
| CVE | CVSS | PoC | In CISA KEV | Priority |
|-----|------|-----|-------------|----------|

## CVE Deep Dives（CVE 深度调查）

### CVE-YYYY-NNNNN — [简称]
- **CVSS**: X.X (CVSS:3.1/AV:.../AC:.../PR:.../UI:.../S:.../C:.../I:.../A:...)
- **CWE**: CWE-[ID] — [名称]
- **受影响版本**: [产品] [来自 CPE 的版本]
- **PoC**: [URL 或"未公开"]
- **补丁 / 公告**: [URL]
- **CISA KEV**: 是/否——如适用请注明截止日期
- **在野利用 (Exploited ITW)**: 是/否——[来源 + 日期]
- **红队备注**: [访问条件、所需权限、需绕过的缓解措施、链式利用潜力]

## Attack Chain（攻击链）
[阶段 → 技术 T[ID] → CVE → 方法]

## Mitigations and Detection（缓解措施与检测）
[每个阶段的补丁、配置、日志来源 / SIEM 规则]

## Sources（来源）
[1] URL — 来源 — 日期 — 评分
```

---

## X/Twitter 情报

X/Twitter 是以下内容的主要实时来源：
- CVE PoC 发布和 0day 披露
- 恶意软件样本、C2 IOC、勒索软件变种
- 红队工具发布（新 BOF、免杀技术）
- 威胁行为者活动和行动公告
- 安全研究人员评论和建议

### xcancel——零认证 Twitter 搜索代理

xcancel.com 无需任何认证即可代理 Twitter 的高级搜索。使用 Playwright（页面为 JS 渲染）。

**基础搜索：**
```
https://xcancel.com/search?f=tweets&q=CVE-2024-NNNNN+exploit
```

**完整选项——所有参数：**
```
https://xcancel.com/search?f=tweets
  &q=windows+exploit          # URL-encoded search query
  &since=2025-01-01           # date range start (YYYY-MM-DD)
  &until=2026-02-18           # date range end (YYYY-MM-DD)
  &min_faves=5                # minimum likes — filters noise
  # --- include filters (f-) ---
  &f-nativeretweets=on        # include native retweets
  &f-media=on                 # include posts with media
  &f-videos=on                # include posts with video
  &f-news=on                  # include news links
  &f-native_video=on          # include native (uploaded) video
  &f-replies=on               # include replies
  &f-links=on                 # include external links
  &f-images=on                # include image posts
  &f-quote=on                 # include quote tweets
  &f-spaces=on                # include Spaces
  # --- exclude filters (e-) ---
  &e-nativeretweets=on        # exclude retweets
  &e-replies=on               # exclude replies (thread noise)
```

**典型攻击性研究查询（无转推、无回复、带日期过滤）：**
```
https://xcancel.com/search?f=tweets&q=CVE-2024-NNNNN+PoC&e-nativeretweets=on&e-replies=on&since=2024-01-01&until=2026-02-18&min_faves=2
```

**xcancel 的 Playwright 配方：**
```javascript
async (page) => {
  const query = encodeURIComponent('CVE-2024-NNNNN exploit PoC');
  await page.goto(
    `https://xcancel.com/search?f=tweets&q=${query}&e-nativeretweets=on&e-replies=on&since=2024-01-01&min_faves=2`,
    { waitUntil: 'networkidle', timeout: 30000 }
  );
  await page.waitForSelector('.timeline-item', { timeout: 15000 }).catch(() => null);
  const tweets = await page.locator('.timeline-item').allInnerTexts();
  return tweets.slice(0, 20); // cap at 20 results
}
```

### FxTwitter API——零认证 JSON 获取帖子/线程内容

FxTwitter 提供了一个公开只读 API，无需认证、无需注册速率限制，输出干净的 JSON。使用 Firecrawl scrape 获取。

**获取帖子或线程（包含完整文本、媒体、指标、回复）：**
```
https://api.fxtwitter.com/status/{POST_ID}
```

**获取用户信息：**
```
https://api.fxtwitter.com/{username}
```

**示例——获取帖子并提取结构化字段：**
```
tool: mcp_firecrawl_fir_firecrawl_extract
urls: ["https://api.fxtwitter.com/status/1890765432198765432"]
prompt: "Extract tweet text, author, date, media URLs, and reply tweets if present."
schema: {
  "text": "string",
  "author": "string",
  "date": "string",
  "media": ["string"],
  "replies": [{ "author": "string", "text": "string" }]
}
```

**使用模式——何时使用 FxTwitter API：**
1. Tavily 或 xcancel 找到一个有趣的帖子 URL
2. 从 URL 中提取帖子 ID：`twitter.com/user/status/{ID}` 或 `x.com/user/status/{ID}`
3. 获取 `https://api.fxtwitter.com/status/{ID}` 以获得完整线程和元数据

### Python 选项——twitter_search.py (scripts/twitter_search.py)

使用 `twikit 2.x` 进行批量/脚本化搜索。

> **⚠ 需要真实的 X 账户。** 自 2023 年起，访客/匿名模式被 Cloudflare 拦截。
> Tavily（`site:twitter.com OR site:x.com`）是**零认证替代方案**，无需任何账户即可使用。

```bash
pip install twikit

# First run: login and save session cookies (cookies_file auto-handled by twikit)
python scripts/twitter_search.py "CVE-2024-12345 PoC exploit" \
    --auth-info-1 your_username --auth-info-2 you@example.com \
    --password yourpassword --cookies-file cookies.json

# Subsequent runs: cookies exist → no re-login needed
python scripts/twitter_search.py "windows 0day" --cookies-file cookies.json \
    --since 2025-01-01 --until 2026-02-18 \
    --min-likes 5 --count 20 --pages 3 --json -o results.json

# Latest tweets from a specific researcher
python scripts/twitter_search.py "nmap red team" --cookies-file cookies.json \
    --mode Latest --from-user taviso

# User profile
python scripts/twitter_search.py --user malwareunicorn --cookies-file cookies.json
```

关键参数：`--auth-info-1`, `--auth-info-2`, `--password`, `--totp-secret`, `--cookies-file`, `--mode Latest|Top|Media`, `--count N`（最多 20）, `--pages N`（分页）, `--since/--until YYYY-MM-DD`, `--min-likes N`, `--from-user`, `--lang CODE`, `--json`, `-o FILE`。

输出包含每条结果的 `fxtwitter_url`——用 Firecrawl extract 获取完整线程。

**何时使用 twikit vs Tavily：**
- **无账户** → 使用 Tavily 加 `site:twitter.com OR site:x.com`
- **有账户且需要数量/分页/过滤** → 使用 `twitter_search.py`

---

## Telegram 情报

Telegram 是以下内容的主要发布渠道：
- CVE PoC 发布（通常早于任何公开公告）
- 恶意软件样本、信息窃取日志、勒索软件源码泄露
- 红队工具发布（C2、BOF、加载器、免杀）
- 威胁行为者聊天、初始访问经纪人广告、数据泄露公告
- 在 GitHub 或 X 上发布几小时内即被删除的内容

### 零认证访问方法（无需账户）

**方法 1——tg.i-c-a.su（最佳）：** 返回包含消息、媒体 URL、浏览量、反应的完整 JSON。
```
tool: mcp_firecrawl_fir_firecrawl_scrape
url: https://tg.i-c-a.su/json/{channel}
onlyMainContent: false

# Paginate backwards with ?before={message_id}
https://tg.i-c-a.su/json/news4hack?before=500

# RSS feed for feed-reader-style polling
https://tg.i-c-a.su/rss/{channel}
```

**方法 2——t.me/s/ 预览：** 最近约 30 条帖子。使用 Playwright（JS 渲染）。
```javascript
async (page) => {
  await page.goto('https://t.me/s/news4hack', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.tgme_widget_message', { timeout: 15000 }).catch(() => null);
  const posts = await page.locator('.tgme_widget_message').allInnerTexts();
  return posts.slice(0, 20);
}
```

**方法 3——Tavily 搜索**（已索引的摘要，无需抓取）：
```
query: CVE-2025 PoC exploit site:t.me
search_depth: fast, max_results: 10
```

### 精选攻击性安全频道

**S 级——优先使用**

| 频道 | 链接 | 成员数 | 专注方向 |
|---|---|---|---|
| @news4hack (Pentester) | `t.me/news4hack` | ~2.8K | 每日 CVE + PoC GitHub 链接、红队、AD 攻击、Web RCE/LPE |
| @cveNotify | `t.me/cveNotify` | ~17.7K | 实时 CVE 通知——最快的 CVE 动态 |
| @learnexploit (0Day.Today) | `t.me/learnexploit` | ~21K | 公开漏洞利用、0day、PoC Web/服务器、黑客工具——最丰富的 PoC 来源 |

**A 级——强信号**

| 频道 | 链接 | 专注方向 |
|---|---|---|
| @PentestingNews | `t.me/PentestingNews` | 渗透测试、红队、OSINT、恶意软件分析、逆向工程（约 20K） |
| @BlueRedTeam | `t.me/BlueRedTeam` | 红队工具、CVE PoC、内网攻击（约 5.2K） |
| @androidMalware | `t.me/androidMalware` | Android/iOS 漏洞利用、移动 CVE、间谍软件分析（约 43K） |
| @bugbountyresources | `t.me/bugbountyresources` | 漏洞报告、新漏洞、漏洞赏金技巧（约 10K） |
| @githubredteam | `t.me/githubredteam` | 中文红队 GitHub 仓库监控——新鲜 PoC，常早于英文覆盖 |
| @sochub_ar | `t.me/sochub_ar` | SOCHUB CVE 频道——公告级 CVE 动态，结构化 |

**B 级——小众 / 地下信号**

| 频道 | 链接 | 专注方向 | 备注 |
|---|---|---|---|
| @vxunderground | `t.me/vxunderground` | 恶意软件样本、论文、勒索软件源码泄露、APT 情报 | 合法研究；主要恶意软件存档 |
| @ckearsenal（御魂军火库） | `t.me/ckearsenal` | 中文地下：PoC、漏洞利用、C2 模板、恶意软件分析 | 高噪声、高信号——需仔细过滤 |
| @cybersecurityresources | `t.me/cybersecurityresources` | Web 安全、渗透测试笔记、漏洞挖掘（约 7K） | 内容广泛但活跃 |

### Telegram 频道研究工作流

```
# 1. Check a channel's recent content (zero-auth, instant JSON)
tool: mcp_firecrawl_fir_firecrawl_scrape
url: https://tg.i-c-a.su/json/cveNotify
onlyMainContent: false

# 2. Found a relevant post? Get its full content via t.me/s/ permalink
tool: mcp_firecrawl_fir_firecrawl_scrape
url: https://t.me/s/cveNotify/{message_id}
onlyMainContent: true

# 3. Post links to GitHub PoC? → Firecrawl scrape the repo
tool: mcp_firecrawl_fir_firecrawl_scrape
url: https://github.com/{user}/{repo}
onlyMainContent: true

# 4. Broad keyword search across all indexed Telegram content
tool: mcp_io_github_tav_tavily_search
query: CVE-2025-NNNNN PoC exploit site:t.me
search_depth: fast, max_results: 10
```

---

## 操作注意事项

- **流量**：Firecrawl 和 Playwright 会产生真实 HTTP 流量。在实际渗透测试中，仅使用 Tavily（已索引/缓存的结果）以避免直接接触目标。
- **速率限制**：Firecrawl crawl：`limit ≤ 10`、`maxDiscoveryDepth ≤ 2`。
- **时效性**：对于新鲜 CVE，Tavily 结果可能已是数周前的——始终通过 Firecrawl extract 直接从 NVD 和 CISA 验证 CVSS/KEV。
- **评分过滤**：在使用 Firecrawl 获取完整内容前，丢弃 `score < 0.5` 的 Tavily 结果。

## 参考资源

- [references/mcp-tools.md](references/mcp-tools.md) — Tavily、Firecrawl、Playwright 的完整参数参考及已验证配方
- [references/sources.md](references/sources.md) — 精选安全情报来源，包含可用于 `include_domains` 的域名列表
- [references/attack-chain-templates.md](references/attack-chain-templates.md) — 与 ATT&CK 对齐的攻击链模板
