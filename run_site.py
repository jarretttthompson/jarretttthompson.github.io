#!/usr/bin/env python3
"""Simple dev helper to serve the static site and open it in a browser."""
import contextlib
import http.server
import os
import socket
import subprocess
import sys
import threading
import webbrowser
from typing import List, Optional

PORT = 8000
# Bind all interfaces so phones/tablets on the same Wi‑Fi can reach this machine.
LISTEN_HOST = "0.0.0.0"
LOCAL_HOST = "127.0.0.1"
ROOT = os.path.dirname(os.path.abspath(__file__))

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A003 - match base signature
        pass


def find_open_port(host: str, port: int) -> int:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        while True:
            try:
                sock.bind((host, port))
                return port
            except OSError:
                port += 1


def _udp_route_ip() -> Optional[str]:
    """IP of the interface used for the default route (wrong if a VPN captures all traffic)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def _macos_wifi_ips() -> List[str]:
    """Wi‑Fi / Ethernet IPs from ipconfig (usually what your phone needs on LAN)."""
    out: List[str] = []
    if sys.platform != "darwin":
        return out
    for iface in ("en0", "en1", "en2"):
        try:
            r = subprocess.run(
                ["ipconfig", "getifaddr", iface],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            ip = (r.stdout or "").strip()
            if ip and not ip.startswith("127."):
                out.append(ip)
        except (OSError, subprocess.TimeoutExpired):
            pass
    return out


def lan_ipv4_candidates() -> List[str]:
    """
    Addresses to try on your phone. Order: macOS interface IPs first (Wi‑Fi),
    then UDP-route IP. VPNs often make the UDP method return a tunnel address
    that your phone cannot reach — if so, use the 192.168.x.x / 10.x line from
    `ipconfig getifaddr en0` instead.
    """
    seen: set = set()
    ordered: List[str] = []
    udp = _udp_route_ip()
    for ip in _macos_wifi_ips() + ([udp] if udp else []):
        if not ip or ip.startswith("127.") or ip in seen:
            continue
        seen.add(ip)
        ordered.append(ip)
    return ordered


def run_server():
    os.chdir(ROOT)
    port = find_open_port(LISTEN_HOST, PORT)
    server = http.server.ThreadingHTTPServer((LISTEN_HOST, port), QuietHandler)

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    local_url = f"http://{LOCAL_HOST}:{port}/index.html"
    print(f"Serving {ROOT}")
    print(f"  This computer:  {local_url}")
    print(f"  Port:           {port}  (use this same port on your phone)")
    candidates = lan_ipv4_candidates()
    if candidates:
        print("  Phone / tablet (try in order — same Wi‑Fi, not guest/VPN):")
        for ip in candidates:
            print(f"    → http://{ip}:{port}/index.html")
        print("  If none load: VPN may be stealing the route — disconnect VPN or run")
        print("    ipconfig getifaddr en0   and use that IP + port above.")
        print("  macOS Firewall: allow incoming for Python if the phone times out.")
    else:
        print("  Could not detect LAN IP — run:  ipconfig getifaddr en0")
        print(f"  Then open:  http://THAT_IP:{port}/index.html")
    # One obvious line: port is always :PORT before /index.html
    print("")
    if candidates:
        print(f"  >>> On your phone:  http://{candidates[0]}:{port}/index.html")
    else:
        print(f"  >>> On your phone:  http://<run ipconfig getifaddr en0>:{port}/index.html")
    print("")
    webbrowser.open(local_url)

    try:
        thread.join()
    except KeyboardInterrupt:
        print("\nStopping server…")
        server.shutdown()


if __name__ == "__main__":
    run_server()
