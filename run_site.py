#!/usr/bin/env python3
"""Simple dev helper to serve the static site and open it in a browser."""
from __future__ import annotations

import contextlib
import http.server
import os
import socket
import threading
import webbrowser

PORT = 8000
HOST = "127.0.0.1"
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


def run_server():
    os.chdir(ROOT)
    port = find_open_port(HOST, PORT)
    server = http.server.ThreadingHTTPServer((HOST, port), QuietHandler)

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    url = f"http://{HOST}:{port}/index.html"
    print(f"Serving {ROOT} at {url}")
    webbrowser.open(url)

    try:
        thread.join()
    except KeyboardInterrupt:
        print("\nStopping server…")
        server.shutdown()


if __name__ == "__main__":
    run_server()
