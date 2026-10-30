#!/usr/bin/env python3
"""Blind XSS callback receiver — logs all incoming requests"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse, datetime

class CallbackHandler(BaseHTTPRequestHandler):
    def log_request(self, code="-", size="-"):
        pass
    
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        print(f"[{datetime.datetime.now()}] BLIND XSS CALLBACK")
        print(f"  Path: {parsed.path}")
        print(f"  Params: {params}")
        print(f"  Headers: {dict(self.headers)}")
        print(f"  IP: {self.client_address[0]}")
        print("-" * 50)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")
    
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b""
        print(f"[{datetime.datetime.now()}] BLIND XSS POST CALLBACK")
        print(f"  Path: {self.path}")
        print(f"  Body: {body}")
        print(f"  Headers: {dict(self.headers)}")
        print(f"  IP: {self.client_address[0]}")
        print("-" * 50)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
    server = HTTPServer(("0.0.0.0", port), CallbackHandler)
    print(f"[*] Blind XSS callback server on port {port}")
    print(f"[*] Use payloads pointing to: http://YOUR_IP:{port}/")
    print(f"[*] Your IP: run 'curl ifconfig.me' to get it")
    server.serve_forever()
