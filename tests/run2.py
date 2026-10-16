
import json, subprocess, sys, time, os
from playwright.sync_api import sync_playwright
PORT=8766
srv=subprocess.Popen([sys.executable,os.path.join(os.path.dirname(os.path.abspath(__file__)),"server.py"),str(PORT)]); time.sleep(0.8)
EXT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","extension")); base="http://news.localhost:%d"%PORT
try:
  with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context("/tmp/rh2-%d"%os.getpid(),headless=False,args=["--headless=new","--disable-extensions-except="+EXT,"--load-extension="+EXT,"--no-first-run"])
    sw=None
    for _ in range(40):
        if ctx.service_workers: sw=ctx.service_workers[0]; break
        time.sleep(0.25)
    ext=sw.url.split("/")[2]
    pg=ctx.new_page(); pg.goto(base+"/spa"); pg.wait_for_timeout(500)
    ui=ctx.new_page(); ui.goto("chrome-extension://%s/panel.html"%ext); ui.wait_for_timeout(400)
    tab=sw.evaluate("async()=>{const t=await chrome.tabs.query({url:'%s/*'});return {id:t[0].id,url:t[0].url,title:t[0].title}}"%base)
    ui.evaluate("(tab)=>new Promise(r=>chrome.runtime.sendMessage({type:'start',tab},r))",tab)
    pg.bring_to_front(); pg.wait_for_timeout(800)
    pg.evaluate("go('/spa/one')"); pg.wait_for_timeout(2200)
    pg.evaluate("go('/spa/two')"); pg.wait_for_timeout(300)
    pg.go_back(); pg.wait_for_timeout(300)       # back to /spa/one
    pg.go_back(); pg.wait_for_timeout(300)       # back to /spa
    pg.goto(base+"/paper.pdfish"); pg.wait_for_timeout(2500)   # let title refresh fire
    pg.goto(base+"/a"); pg.wait_for_timeout(400)
    pg.goto(base+"/"); pg.wait_for_timeout(400)
    pg.go_back(); pg.wait_for_timeout(400)       # back to /a: return
    pg.goto(base+"/e"); pg.wait_for_timeout(2500)
    d=sw.evaluate("async()=>{const a=await chrome.storage.local.get(null);return Object.values(a).filter(x=>x&&x.nodes)}")
    for t in d:
        byid={n["id"]:n for n in t["nodes"]}
        print("nodes:",len(t["nodes"]))
        for n in t["nodes"]:
            dep=0;m=n
            while m["parent"] and m["parent"] in byid: m=byid[m["parent"]];dep+=1
            print("  "*dep+"%r  [%s] returns=%s %s"%(n["title"],n["transition"],n.get("returns"),n["url"].replace(base,"")))
    ctx.close()
finally: srv.terminate()
