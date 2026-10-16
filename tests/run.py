import json, subprocess, sys, time, os
from playwright.sync_api import sync_playwright
PORT=8765
srv=subprocess.Popen([sys.executable,os.path.join(os.path.dirname(os.path.abspath(__file__)),"server.py"),str(PORT)])
time.sleep(0.8)
EXT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","extension"))
base="http://news.localhost:%d"%PORT
def dump(sw, label):
    d=sw.evaluate("""async()=>{const all=await chrome.storage.local.get(null);const out={};for(const k of Object.keys(all)){if(k.startsWith('trail:'))out[k]=all[k];}
      return {active:all.active||null,trails:out,session:await chrome.storage.session.get(null)}}""")
    print("\n== "+label)
    print(" active:", json.dumps(d["active"]))
    for k,t in d["trails"].items():
        print(" trail %s '%s' state=%s end=%s nodes=%d"%(k[6:],t["title"],t["state"],t.get("endReason"),len(t["nodes"])))
        byid={n["id"]:n for n in t["nodes"]}
        def depth(n):
            c=0
            while n["parent"] and n["parent"] in byid: n=byid[n["parent"]]; c+=1
            return c
        for n in t["nodes"]:
            print("   %s%s [%s] dwell=%.1fs %s"%("  "*depth(n),n["title"] or n["url"],n["transition"],n["dwellMs"]/1000,n["url"].replace(base,"")))
    return d
try:
  with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context("/tmp/rh-profile-%d"%os.getpid(),headless=False,
        args=["--headless=new","--disable-extensions-except="+EXT,"--load-extension="+EXT,"--no-first-run"])
    sw=None
    ctx.new_page().goto("about:blank")
    for _ in range(80):
        if ctx.service_workers: sw=ctx.service_workers[0]; break
        time.sleep(0.25)
    print("service worker:", sw.url if sw else None)
    ext_id=sw.url.split("/")[2]
    page1=ctx.new_page(); page1.goto(base+"/"); page1.wait_for_timeout(500)
    ui=ctx.new_page(); ui.goto("chrome-extension://%s/panel.html"%ext_id); ui.wait_for_timeout(500)
    tab=sw.evaluate("async()=>{const t=await chrome.tabs.query({url:'%s/*'});return {id:t[0].id,url:t[0].url,title:t[0].title}}"%base)
    print("start tab:",tab)
    r=ui.evaluate("(tab)=>new Promise(res=>chrome.runtime.sendMessage({type:'start',tab},res))",tab); print("start ->",r)
    page1.bring_to_front(); page1.wait_for_timeout(11000)       # dwell on Home (>8s)
    page1.click("a[href='/a']"); page1.wait_for_load_state(); page1.wait_for_timeout(1500)
    with ctx.expect_page() as np: page1.click("a[href='/b']")
    page2=np.value; page2.wait_for_load_state(); page2.bring_to_front(); page2.wait_for_timeout(1500)
    page2.click("a[href='/c']"); page2.wait_for_load_state(); page2.wait_for_timeout(1200)
    page1.bring_to_front(); page1.click("a[href='/e']"); page1.wait_for_load_state(); page1.wait_for_timeout(1000)
    page1.goto("http://bank.localhost:%d/"%PORT); page1.wait_for_timeout(1200)     # skipped site
    page1.goto(base+"/d"); page1.wait_for_timeout(1200)
    d=dump(sw,"after browsing")
    # pause: nothing recorded
    ui.evaluate("()=>new Promise(res=>chrome.runtime.sendMessage({type:'pause'},res))")
    page1.goto(base+"/a"); page1.wait_for_timeout(1000)
    d2=dump(sw,"while paused (should not add /a)")
    ui.evaluate("()=>new Promise(res=>chrome.runtime.sendMessage({type:'resume'},res))")
    page1.goto(base+"/e"); page1.wait_for_timeout(1000)
    # untracked tab must be ignored
    other=ctx.new_page(); other.goto(base+"/c"); other.wait_for_timeout(800)
    dump(sw,"after resume + an unrelated tab (should add /e only)")
    other.close()
    # close tabs one by one; trail ends when all tracked tabs are closed
    page2.close(); page1.wait_for_timeout(500)
    r=ui.evaluate("()=>new Promise(res=>chrome.runtime.sendMessage({type:'surface'},res))"); print("\nsurface ->",r)
    dump(sw,"after surface")
    ctx.close()
finally:
    srv.terminate()
