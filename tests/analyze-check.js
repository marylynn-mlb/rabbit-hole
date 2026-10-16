// Usage: node tests/analyze-check.js path/to/your-export.json  (prints what the report layer finds; your export stays local)
const vm=require("vm"),fs=require("fs");
const ctx=vm.createContext({URL,console,Date,Math,JSON,Object,Array,String,RegExp});
const ext=require("path").join(__dirname,"..","extension")+"/";
vm.runInContext(fs.readFileSync(ext+"common.js","utf8")+"\n;"+fs.readFileSync(ext+"analyze.js","utf8")+"\n;this.RA=RA;",ctx);
const d=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const R=ctx.RA.analyze(d.trails,{});
const strip=(o)=>JSON.stringify(o,(k,v)=>k==="stops"&&Array.isArray(v)&&v.length>4?v.slice(0,4).concat(["...+"+(v.length-4)]):v,1);
console.log("STATS",strip(R.stats));
console.log("MODES flips",R.modes.flips.map(r=>r.title),"reads",R.modes.reads.map(r=>r.title));
console.log("LONG",R.longReads.map(r=>[r.label.slice(0,50),Math.round(r.ms/60000*10)/10]));
console.log("HOSTS",R.hosts.map(h=>[h.host,Math.round(h.ms/6000)/10,h.trails]));
console.log("SESSIONS",R.sessions.map(s=>[s.when,s.from,s.to,s.trails.length,Math.round(s.activeMs/60000),s.breaks.map(b=>Math.round(b/60000))]));
console.log("WORDS");R.returningWords.forEach(w=>console.log(" ",w.terms.join("+"),"trails",w.trails,"days",w.days,"|",w.stops.slice(0,3).map(s=>s.label.slice(0,40)).join(" ; ")));
console.log("SEEN→SOUGHT");R.seenThenSought.forEach(s=>console.log(" ",s.query,"| terms",s.terms,"| seen:",s.seen.slice(0,60),"| gap h",Math.round(s.gapMs/360000)/10));
console.log("LOOSE");R.loose.forEach(l=>console.log(" ",l.kind,l.text.slice(0,60),l.count||"",l.secs));
