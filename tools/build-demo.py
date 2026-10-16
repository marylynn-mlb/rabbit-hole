"""Build docs/ (the GitHub Pages example) from the real extension pages plus docs/sample-data.js.
Run from the repo root: python3 tools/build-demo.py"""
import os, re, shutil

EXT, OUT = "extension", "docs"
FILES = ["common.js", "art.js", "analyze.js", "book.js", "report.js", "theme.css", "fonts.css", "book.css", "report.css"]
BANNER = ('<div class="sample-banner">Sample data. This is the real Rabbit Hole book and report running on a set of '
          'public pages, not a live extension.  <a href="https://github.com/marylynn-mlb/rabbit-hole">Code on GitHub</a></div>')
CSS = """
.sample-banner{position:sticky;top:0;z-index:50;padding:8px 16px;text-align:center;font:italic 15px/1.3 'EB Garamond',Georgia,serif;background:#2a1a28;color:#e9d9e0;border-bottom:1px solid #6b4a63}
.sample-banner a{color:#f0a8c4}
#settingsCard{display:none!important}
"""

os.makedirs(os.path.join(OUT, "fonts"), exist_ok=True)
for f in FILES: shutil.copy(os.path.join(EXT, f), os.path.join(OUT, f))
for f in os.listdir(os.path.join(EXT, "fonts")): shutil.copy(os.path.join(EXT, "fonts", f), os.path.join(OUT, "fonts", f))
open(os.path.join(OUT, "sample.css"), "w").write(CSS)

for page in ("book.html", "report.html"):
    h = open(os.path.join(EXT, page)).read()
    h = h.replace('<script src="common.js">', '<script src="sample-data.js"></script>\n<script src="shim.js"></script>\n<script src="common.js">', 1)
    h = h.replace("</head>", '<link rel="stylesheet" href="sample.css">\n</head>', 1)
    h = re.sub(r"(<body[^>]*>)", r"\1\n" + BANNER.replace("\\", "\\\\"), h, count=1)
    open(os.path.join(OUT, page), "w").write(h)
shutil.copy("tools/shim.js", os.path.join(OUT, "shim.js"))
open(os.path.join(OUT, ".nojekyll"), "w").write("")
print("built", OUT)
