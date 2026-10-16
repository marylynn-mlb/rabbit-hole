"""Turn a real trail export into a shareable sample.

Usage: python3 tools/make-sample.py <export.json> <trail-id> [<trail-id> ...]
Writes docs/sample-data.js. Review the printed stop list before committing.

Only the trails you name are kept. Notes and landing text are dropped, titles that are
file paths are replaced by the file name from the address, and pages on the
PERSONAL_HOSTS list are cut back to the bare site. Your export itself stays out of the repo.
"""
import json, re, sys, os, urllib.parse

PERSONAL_HOSTS = {"www.pinterest.com": "Pinterest", "pinterest.com": "Pinterest"}
KEEP = ("id", "parent", "createdAt", "dwellMs", "kind", "state", "transition", "title", "query", "url", "host", "mattered", "returns", "returnedAt")

def clean_title(title, url):
    t = re.sub(r"^\(\d+\+?\)\s*", "", (title or "").strip())
    if re.match(r"^([/~\\]|[A-Za-z]:[\\/])", t) or "/Users/" in t or "\\Users\\" in t:
        seg = urllib.parse.unquote(urllib.parse.urlparse(url).path.rstrip("/").split("/")[-1])
        t = re.sub(r"\.[A-Za-z0-9]{2,4}$", "", seg).replace("_", " ").replace("+", " ").strip()
    return t

def main():
    src, ids = sys.argv[1], set(sys.argv[2:])
    data = json.load(open(src))
    out, seen = [], set()
    for t in data["trails"]:
        if t["id"] not in ids or t["id"] in seen: continue
        seen.add(t["id"])
        nodes = []
        for n in t["nodes"]:
            m = {k: n[k] for k in KEEP if k in n and n[k] not in (None, "", [])}
            m["note"] = ""
            host = (n.get("host") or "").lower()
            if host in PERSONAL_HOSTS:
                m["url"] = "https://" + host + "/"; m["title"] = PERSONAL_HOSTS[host]
            else:
                m["title"] = clean_title(n.get("title"), n["url"])
            nodes.append(m)
        out.append({"id": t["id"], "title": clean_title(t.get("title"), ""), "titleAuto": True, "landing": "", "state": "done",
                    "startedAt": t["startedAt"], "endedAt": t["endedAt"], "endReason": t.get("endReason", "surfaced"), "nodes": nodes})
    missing = ids - seen
    if missing: sys.exit("not found: " + ", ".join(sorted(missing)))
    os.makedirs("docs", exist_ok=True)
    open("docs/sample-data.js", "w").write("window.__RH_SAMPLE = " + json.dumps({"trails": out}, indent=1, ensure_ascii=False) + ";\n")
    for t in out:
        print("\n##", t["title"])
        for n in t["nodes"]: print("  ", (n.get("query") or n.get("title") or "")[:60], "|", n["url"][:90])

main()
