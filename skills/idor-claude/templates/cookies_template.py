#!/usr/bin/env python3
"""Convert a Cookie-Editor browser-extension JSON export into the Playwright
cookie format used by probe_idor.py.

Usage:
    python3 cookies_template.py <input.json> > cookies_pw.py

Or, inline:
    python3 cookies_template.py < pasted.json

The Cookie-Editor extension exports an array of cookie objects:
    {"name":"foo","value":"bar","domain":"target.com","path":"/","secure":true,
     "httpOnly":false,"sameSite":"lax",...}

Playwright `context.add_cookies()` expects:
    {"name": "foo", "value": "bar", "domain": "target.com", "path": "/",
     "secure": True, "httpOnly": False, "sameSite": "Lax"}

The differences are:
- Python booleans (True/False, capital).
- sameSite normalized to one of {"Strict", "Lax", "None"} (Cookie-Editor uses
  lowercase or omits it).
- Drop fields Playwright doesn't accept (storeId, hostOnly, session,
  expirationDate is OK to keep as `expires` — see mapping below).
"""
import json, sys


def normalize_same_site(v):
    if v is None:
        return "Lax"
    v = str(v).lower()
    if v in ("no_restriction", "none"):
        return "None"
    if v in ("lax",):
        return "Lax"
    if v in ("strict",):
        return "Strict"
    return "Lax"


def convert(cookie_editor_json):
    out = []
    for c in cookie_editor_json:
        item = {
            "name": c["name"],
            "value": c["value"],
            "domain": c["domain"],
            "path": c.get("path", "/"),
            "secure": bool(c.get("secure", False)),
            "httpOnly": bool(c.get("httpOnly", False)),
            "sameSite": normalize_same_site(c.get("sameSite")),
        }
        # Playwright accepts `expires` (unix seconds, int)
        if "expirationDate" in c and c["expirationDate"]:
            item["expires"] = int(c["expirationDate"])
        out.append(item)
    return out


def main():
    src = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
    data = json.loads(src)
    converted = convert(data)
    # Emit as Python literal so it can be pasted into probe_idor.py
    print("COOKIES = [")
    for c in converted:
        parts = ", ".join(f'"{k}": {repr(v)}' for k, v in c.items())
        print(f"    {{{parts}}},")
    print("]")


if __name__ == "__main__":
    main()
