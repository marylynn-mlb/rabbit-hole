"""Regenerate docs/img/*.jpg previews from the built demo. Run after tools/build-demo.py."""
import subprocess, time
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(["python3", "-m", "http.server", "8766", "-d", "docs"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1200, "height": 900})
        pg.goto("http://localhost:8766/book.html"); pg.wait_for_timeout(1200)
        pg.screenshot(path="docs/img/book.jpg", type="jpeg", quality=82, clip={"x": 0, "y": 40, "width": 1200, "height": 860})
        pg.goto("http://localhost:8766/report.html"); pg.wait_for_timeout(1200)
        pg.screenshot(path="docs/img/report.jpg", type="jpeg", quality=82, clip={"x": 0, "y": 40, "width": 1200, "height": 860})
        b.close()
finally:
    srv.kill()
