import http.server, socketserver, sys
PORT=int(sys.argv[1])
PAGES={
 "/": ("Home of the test site", ["/a","/b@new","http://bank.localhost:%d/"%PORT,"/d"]),
 "/a": ("Page A: olbers", ["/e","/b@new"]),
 "/b": ("Page B opened in a new tab", ["/c"]),
 "/c": ("Page C deeper still", []),
 "/d": ("Page D after the skipped site", []),
 "/e": ("Page E from A", ["/"]),
}
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        path=self.path.split("?")[0]
        if path=="/favicon.ico": self.send_response(204); self.end_headers(); return
        if path.startswith("/spa"):
            body="<!doctype html><title>SPA shell</title><h1>spa</h1><script>function go(p){history.pushState({},'',p)}</script>"
            d=body.encode(); self.send_response(200); self.send_header("Content-Type","text/html"); self.send_header("Content-Length",str(len(d))); self.end_headers(); self.wfile.write(d); return
        if path=="/paper.pdfish":
            body="<!doctype html><title>/Users/someone/Documents/old/.texpad/my_paper_18.dvi</title><h1>paper</h1>"
            d=body.encode(); self.send_response(200); self.send_header("Content-Type","text/html"); self.send_header("Content-Length",str(len(d))); self.end_headers(); self.wfile.write(d); return
        title,links=PAGES.get(path,("Unknown page "+path,[]))
        if "bank" in self.headers.get("Host",""): title,links="Your account balance",["/"]
        body="<!doctype html><title>%s</title><h1>%s</h1>"%(title,title)
        for l in links:
            new=l.endswith("@new"); l=l.replace("@new","")
            body+='<p><a id="l%s" href="%s"%s>%s</a></p>'%(abs(hash(l))%10000,l,' target="_blank"' if new else "",l)
        d=body.encode(); self.send_response(200); self.send_header("Content-Type","text/html"); self.send_header("Content-Length",str(len(d))); self.end_headers(); self.wfile.write(d)
class S(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads=True
S(("127.0.0.1",PORT),H).serve_forever()
