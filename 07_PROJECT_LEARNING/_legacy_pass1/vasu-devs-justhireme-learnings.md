# Forensic Learning Record (Deep Inspection): vasu-devs/JustHireMe

> **Canonical Artifact**: `07_PROJECT_LEARNING/vasu-devs-justhireme-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vasu-devs/JustHireMe](https://github.com/vasu-devs/JustHireMe))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:15.121Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vasu-devs/JustHireMe`
- **Description**: Local-first AI job intelligence workbench for scraping roles, ranking fit, and generating tailored application materials.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2255 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Designs/JustHireMe (Remix)/src/app.jsx`
```
// App root — orchestrates everything
const { useState, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showTweaks": true
}/*EDITMODE-END*/;

const App = () => {
  const [view, setView] = useState("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [ghost, setGhost] = useState(false);
  const [terminal, setTerminal] = useState(TERMINAL_LINES.slice(0, 8));
  const [leads, setLeads] = useState(LEADS);
  const [uptime, setUptime] = useState({ d: 2, h: 14, m: 22 });

  // Live terminal stream
  useEffect(() => {
    let i = 8;
    const id = setInterval(() => {
      const next = TERMINAL_LINES[i % TERMINAL_LINES.length];
      setTerminal(t => [...t, next].slice(-200));
      i++;
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // Uptime ticker
  useEffect(() => {
    const id = setInterval(() => {
      setUptime(u => {
        let m = u.m + 1, h = u.h, d = u.d;
        if (m >= 60) { m = 0; h++; }
        if (h >= 24) { h = 0; d++; }
        return { d, h, m };
      });
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const leadCounts = {
    total:      leads.length,
    discovered: leads.filter(l=>l.status==="discovered").length,
    evaluating: leads.filter(l=>l.status==="evaluating").length,
    tailoring:  leads.filter(l=>l.status==="tailoring").length,
    approved:   leads.filter(l=>l.status==="approved").length,
    applied:    leads.filter(l=>l.status==="applied").length,
  };

  const onFire = (lead) => {
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: "applied" } : l));
    setTerminal(t => [...t, { lvl: "ok", t: "playwright", m: `submitted to ${lead.platform.toLowerCase()} · ${lead.company}` }]);
    setTimeout(() => setDrawer(null), 1200);
  };

  const uptimeStr = `${uptime.d}d ${uptime.h}h ${uptime.m}m`;

  return (
    <div className="row" style={{ height: "100vh" }}>
      <Sidebar
        view={view}
        setView={setView}
        leadCounts={leadCounts}
        online={true}
        latency={42}
        uptime={uptimeStr}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="app-main">
        <Topbar view={view} leadCounts={leadCounts} ghost={ghost} setGhost={setGhost}/>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
          {view === "dashboard" && <DashboardView leads={leads} terminal={terminal} setView={setView} openDrawer={setDrawer}/>}
          {view === "pipeline"  && <PipelineView leads={leads} terminal={terminal} openDrawer={setDrawer}/>}
          {view === "graph"     && <GraphView/>}
          {view === "activity"  && <ActivityView terminal={terminal}/>}
          {view === "profile"   && <ProfileView/>}
        </div>
      </div>

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} ghost={ghost} setGhost={setGhost}/>
      {drawer && <Drawer lead={drawer} onClose={() => setDrawer(null)} onFire={onFire}/>}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);

```

### Core Architecture Module: `Designs/JustHireMe (Remix)/src/data.jsx`
```
// Sample data
const COMPANIES = [
  { name: "Linear",     mark: "L", tone: "purple" },
  { name: "Vercel",     mark: "▲", tone: "blue" },
  { name: "Stripe",     mark: "S", tone: "purple" },
  { name: "Anthropic",  mark: "A", tone: "orange" },
  { name: "Figma",      mark: "F", tone: "pink" },
  { name: "Ramp",       mark: "R", tone: "yellow" },
  { name: "Notion",     mark: "N", tone: "teal" },
  { name: "Cursor",     mark: "C", tone: "green" },
  { name: "Replit",     mark: "R", tone: "coral" },
  { name: "Supabase",   mark: "S", tone: "green" },
  { name: "Mercury",    mark: "M", tone: "blue" },
  { name: "Pitch",      mark: "P", tone: "pink" },
];

const ROLES = [
  "Senior Frontend Engineer",
  "Staff Software Engineer",
  "Full-Stack Engineer (AI Tools)",
  "Product Engineer",
  "Senior Platform Engineer",
  "Founding Engineer",
  "AI Infra Engineer",
  "Design Engineer",
  "Senior Backend Engineer",
  "Engineering Manager",
];

const STATUS_TONE = {
  discovered: { tone: "blue",   label: "Discovered" },
  evaluating: { tone: "yellow", label: "Evaluating" },
  tailoring:  { tone: "purple", label: "Tailoring"  },
  approved:   { tone: "green",  label: "Approved"   },
  applied:    { tone: "orange", label: "Applied"    },
  rejected:   { tone: "pink",   label: "Rejected"   },
};

const PLATFORMS = ["Lever", "Greenhouse", "Ashby", "Workable", "LinkedIn"];

const seed = (i) => {
  const c = COMPANIES[i % COMPANIES.length];
  const r = ROLES[i % ROLES.length];
  const stArr = ["discovered","evaluating","tailoring","approved","applied","rejected"];
  const status = stArr[(i*3+2) % stArr.length];
  return {
    id: "lead-" + (1000 + i),
    title: r,
    company: c.name,
    mark: c.mark,
    tone: c.tone,
    platform: PLATFORMS[i % PLATFORMS.length],
    location: ["Remote · US", "SF, CA", "NYC", "Remote · EU", "Remote · Global"][i % 5],
    salary: ["$180k–$230k", "$210k–$260k", "$160k–$200k", "$240k–$300k", "$190k–$240k"][i % 5],
    match: 72 + ((i * 7) % 27),
    posted: ["2h ago","6h ago","1d ago","2d ago","4h ago","12h ago"][i%6],
    status,
    asset_path: "/cache/resume_" + (1000+i) + ".pdf",
    reasoning: [
      "Your 4 years on real-time React systems (Linear-like collab tools) maps directly to their product engineer remit.",
      "Strong overlap on TypeScript, Postgres, and AI tooling. Flagged 3 of their 5 core requirements as 'expert' in your graph.",
      "Open-source contribution to LangChain raises this above their ATS threshold. Compensation band aligns with your floor.",
    ][i % 3],
  };
};

const LEADS = Array.from({ length: 18 }, (_, i) => seed(i));

const TERMINAL_LINES = [
  { lvl: "info",  t: "scraper.lever",   m: "fetched 24 listings from lever.co/linear" },
  { lvl: "ok",    t: "evaluator",       m: "match score: 0.94 · Senior Frontend (Linear)" },
  { lvl: "info",  t: "graphrag",        m: "embedding 3 new skill nodes → kuzu" },
  { lvl: "warn",  t: "rate-limit",      m: "linkedin throttled, backing off 47s" },
  { lvl: "info",  t: "tailor.resume",   m: "regenerating PDF with skills [react, ts, ws]" },
  { lvl: "ok",    t: "playwright",      m: "form filled 11/11 fields · ready" },
  { lvl: "info",  t: "scraper.gh",      m: "queued: stripe, vercel, ramp, anthropic" },
  { lvl: "info",  t: "evaluator",       m: "match score: 0.71 · Engineering Manager" },
  { lvl: "ok",    t: "tailor.resume",   m: "PDF generated · 1.2s · /cache/resume_1003.pdf" },
  { lvl: "info",  t: "graphrag",        m: "kuzu nodes: 1,247 · edges: 3,891" },
  { lvl: "warn",  t: "evaluator",       m: "skill gap detected: 'rust' · suggesting upskill" },
  { lvl: "ok",    t: "playwright",      m: "submitted application to ashby.hq/figma" },
  { lvl: "info",  t: "scraper.ashby",   m: "polling 14 boards · interval 5m" },
  { lvl: "info",  t: "ws",              m: "client connected · session 7f2a..." },
];

const SKILLS = [
  { name: "TypeScript",     years: 6, tone: "blue" },
  { name: "React",          years: 7, tone: "blue" },
  { name: "Python",         years: 5, tone: "yellow" },
  { name: "Node.js",        years: 6, tone: "green" },
  { name: "PostgreSQL",     years: 4, tone: "blue" },
  { name: "GraphQL",        years: 3, tone: "pink" },
  { name: "WebSockets",     years: 4, tone: "purple" },
  { name: "LangChain",      years: 1, tone: "orange" },
  { name: "Tailwind",       years: 3, tone: "teal" },
  { name: "AWS",            years: 4, tone: "yellow" },
  { name: "Docker",         years: 5, tone: "blue" },
  { name: "Framer Motion",  years: 2, tone: "pink" },
];

const PROJECTS = [
  { name: "Realtime collab editor", company: "Self", year: "2024", tone: "purple" },
  { name: "GraphRAG inference engine", company: "Open source", year: "2025", tone: "orange" },
  { name: "Design system @ scale", company: "Acme Co", year: "2023", tone: "pink" },
  { name: "Distributed scraper",    company: "Side project", year: "2024", tone: "green" },
];

const EXPERIENCES = [
  { role: "Senior Frontend Engineer", company: "Acme Co",   period: "2022 — Present", tone: "blue" },
  { role: "Full-Stack Engineer",      company: "Beam Labs", period: "2020 — 2022",    tone: "purple" },
  { role: "Software Engineer",        company: "Nimbus",    period: "2018 — 2020",    tone: "green" },
];

const GRAPH_STATS = [
  { key: "Candidate",  count: 1,    tone: "orange" },
  { key: "Experience", count: 14,   tone: "blue" },
  { key: "Project",    count: 23,   tone: "purple" },
  { key: "Skill",      count: 187,  tone: "green" },
  { key: "JobLead",    count: 412,  tone: "pink" },
];

window.LEADS = LEADS;
window.STATUS_TONE = STATUS_TONE;
window.TERMINAL_LINES = TERMINAL_LINES;
window.SKILLS = SKILLS;
window.PROJECTS = PROJECTS;
window.EXPERIENCES = EXPERIENCES;
window.GRAPH_STATS = GRAPH_STATS;
window.COMPANIES = COMPANIES;

```

### Core Architecture Module: `Designs/JustHireMe (Remix)/src/drawer.jsx`
```
// Approval Drawer with FIRE button
const Drawer = ({ lead, onClose, onFire }) => {
  const [holding, setHolding] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [fired, setFired] = React.useState(false);
  const intRef = React.useRef(null);

  React.useEffect(() => {
    if (holding && !fired) {
      intRef.current = setInterval(() => {
        setProgress(p => {
          const next = p + 4;
          if (next >= 100) {
            clearInterval(intRef.current);
            setFired(true);
            setTimeout(() => { onFire(lead); }, 700);
            return 100;
          }
          return next;
        });
      }, 22);
    } else if (!holding && !fired) {
      clearInterval(intRef.current);
      setProgress(0);
    }
    return () => clearInterval(intRef.current);
  }, [holding, fired]);

  if (!lead) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <div style={{
        position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)",
        width: "min(1240px, calc(100vw - 48px))",
        height: "min(720px, calc(100vh - 48px))",
        background: "var(--paper)", border: "1px solid var(--line)",
        borderRadius: 24, boxShadow: "var(--shadow-lg)",
        zIndex: 50, overflow: "hidden",
        display: "grid", gridTemplateColumns: "1.4fr 1fr",
        animation: "slide-up .35s ease",
      }}>
        {/* LEFT — PDF preview */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)", background: "var(--paper-2)", overflow: "hidden" }}>
          <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", justifyContent: "space-between", background: "var(--card)" }}>
            <div className="row gap-2">
              <Icon name="file" size={14} color="var(--accent)"/>
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>resume_{lead.id.split("-")[1]}.pdf</span>
              <span className="pill" style={{ background: "var(--green)", color: "var(--green-ink)", fontSize: 10 }}>tailored</span>
            </div>
            <div className="row gap-2">
              <button className="btn btn-icon"><Icon name="external" size={13}/></button>
            </div>
          </div>
          <div style={{ flex: 1, padding: 28, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
            <FakeResume lead={lead}/>
          </div>
        </div>

        {/* RIGHT — Reasoning + FIRE */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--card)" }}>
          <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
            <span className="eyebrow">Approval</span>
            <button className="btn btn-icon" onClick={onClose}><Icon name="x" size={14}/></button>
          </div>
          <div className="scroll" style={{ padding: 22, flex: 1 }}>
            <div className="row gap-3" style={{ marginBottom: 16 }}>
              <CompanyMark tone={lead.tone} mark={lead.mark} size={48}/>
              <div className="col gap-1">
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{lead.company} · {lead.platform}</div>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{lead.title}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{lead.location} · {lead.salary}</div>
              </div>
            </div>

            {/* Match score block */}
            <div style={{
              padding: 16, borderRadius: 14,
              background: `var(--${lead.tone}-soft)`,
              border: `1px solid var(--${lead.tone})`,
              marginBottom: 14,
            }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <span className="eyebrow" style={{ color: `var(--${lead.tone}-ink)` }}>Graph match</span>
                <span className="mono tabular" style={{ fontSize: 12, fontWeight: 600, color: `var(--${lead.tone}-ink)` }}>{lead.match}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "var(--card)", overflow: "hidden" }}>
                <div style={{ width: `${lead.match}%`, height: "100%", background: `var(--${lead.tone}-ink)`, borderRadius: 999 }}/>
              </div>
            </div>

            <div className="eyebrow" style={{ marginBottom: 8 }}>Why this is a match</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1.35, color: "var(--ink)", marginBottom: 16, letterSpacing: "-0.01em" }}>
              <span className="italic-serif" style={{ color: "var(--accent)" }}>“</span>{lead.reasoning}<span className="italic-serif" style={{ color: "var(--accent)" }}>”</span>
            </div>

            <div className="col gap-2" style={{ marginBottom: 16 }}>
              {[
                { tone: "green",  k: "Skills overlap",     v: "9 of 11 required" },
                { tone: "blue",   k: "Experience match",   v: "7 yrs vs 5+ asked" },
                { tone: "purple", k: "Comp band fit",      v: lead.salary },
                { tone: "yellow", k: "ATS confidence",     v: "high" },
              ].map((r, i) => (
                <div key={i} className="row" style={{
                  justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 9,
                  background: `var(--${r.tone}-soft)`,
                  border: `1px solid var(--${r.tone})`,
                }}>
                  <span style={{ fontSize: 12.5, color: `var(--${r.tone}-ink)`, fontWeight: 500 }}>{r.k}</span>
                  <span className="mono tabular" style={{ fontSize: 11.5, color: "var(--ink-2)", fontWeight: 500 }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FIRE area */}
          <div style={{ padding: 18, borderTop: "1px solid var(--line)", background: "var(--paper-2)" }}>
            <div className="row gap-2" style={{ marginBottom: 12, justifyContent: "space-between" }}>
              <button className="btn"><Icon name="file" size={13}/> Edit résumé</button>
              <button className="btn"><Icon name="x" size={13}/> Reject</button>
            </div>
            <button
              onMouseDown={() => setHolding(true)}
              onMouseUp={() => setHolding(false)}
              onMouseLeave={() => setHolding(false)}
              onTouchStart={() => setHolding(true)}
              onTouchEnd={() => setHolding(false)}
              disabled={fired}
              style={{
                width: "100%", padding: "16px 20px",
                background: fired ? "var(--green)" : "var(--accent)",
                color: fired ? "var(--green-ink)" : "white",
                border: `1px solid ${fired ? "var(--green-ink)" : "var(--accent-2)"}`,
                borderRadius: 14, cursor: fired ? "default" : "pointer",
                fontSize: 15, fontWeight: 600, letterSpacing: "0.02em",
                position: "relative", overflow: "hidden",
                boxShadow: holding ? "0 0 0 4px var(--coral-soft), var(--shadow-md)" : "var(--shadow-md)",
                transition: "all .15s ease",
              }}
            >
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${progress}%`,
                background: "rgba(255,255,255,0.18)",
                transition: "width .05s linear",
              }}/>
              <div className="row gap-2" style={{ justifyContent: "center", position: "relative" }}>
                {fired ? (
                  <><Icon name="check" size={16}/> APPLICATION FI
```

### Core Architecture Module: `Designs/JustHireMe (Remix)/src/icons.jsx`
```
// Icons — single source, lucide-style stroke
const Icon = ({ name, size = 16, stroke = 1.7, color = "currentColor", style }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round", style,
  };
  switch (name) {
    case "logo":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" style={style}>
          <rect x="1" y="1" width="30" height="30" rx="9" fill="#1F1A14"/>
          <path d="M10 21 L10 11 M10 11 L16 11 Q22 11 22 16 Q22 21 16 21 L13 21" stroke="#F4EFE6" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <circle cx="22" cy="11" r="2" fill="#C96442"/>
        </svg>
      );
    case "home":     return <svg {...props}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>;
    case "layers":   return <svg {...props}><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="m2 13 10 5 10-5"/><path d="m2 18 10 5 10-5"/></svg>;
    case "graph":    return <svg {...props}><circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><circle cx="8.5" cy="11" r="2"/><circle cx="15.5" cy="11" r="2"/><path d="M12 7v2M10 12l-3 4M14 12l3 4M10 11h4"/></svg>;
    case "pulse":    return <svg {...props}><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>;
    case "user":     return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
    case "settings": return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "ghost":    return <svg {...props}><path d="M9 10h.01M15 10h.01M12 2a7 7 0 0 0-7 7v13l3-2 2 2 2-2 2 2 2-2 3 2V9a7 7 0 0 0-7-7z"/></svg>;
    case "search":   return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "plus":     return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "x":        return <svg {...props}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case "arrow-right": return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "arrow-up": return <svg {...props}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case "upload":   return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>;
    case "file":     return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>;
    case "external": return <svg {...props}><path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>;
    case "check":    return <svg {...props}><path d="m5 12 5 5L20 7"/></svg>;
    case "fire":     return <svg {...props}><path d="M8.5 14.5C8.5 12 10 11 10.5 9c.5 1 .5 2 .5 2s.5-2 .5-3.5c0-.5 0-1.5-.5-2.5 1 .5 3 2 4 4.5.5 1 1 2.5 1 4 0 3-2.5 5.5-5.5 5.5S5 16.5 5 14c0-1 .5-2 1-2.5 0 1 1 2 2.5 3z"/></svg>;
    case "spark":    return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case "key":      return <svg {...props}><circle cx="7" cy="15" r="4"/><path d="m10 12 9-9 3 3-3 3 2 2-3 3-2-2-3 3"/></svg>;
    case "globe":    return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case "link":     return <svg {...props}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>;
    case "filter":   return <svg {...props}><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/></svg>;
    case "play":     return <svg {...props}><path d="m7 4 14 8-14 8z"/></svg>;
    case "pause":    return <svg {...props}><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>;
    case "clock":    return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "trending": return <svg {...props}><path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>;
    case "calendar": return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case "brief":    return <svg {...props}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="8"/></svg>;
  }
};
window.Icon = Icon;

```

### Core Architecture Module: `Designs/JustHireMe (Remix)/src/pipeline.jsx`
```
// Pipeline Dashboard — matte, no glass
const STATUS_TONES = {
  discovered: { bg: "var(--st-discovered-bg)", fg: "var(--st-discovered-fg)", label: "Discovered" },
  evaluating: { bg: "var(--st-evaluating-bg)", fg: "var(--st-evaluating-fg)", label: "Evaluating" },
  tailoring:  { bg: "var(--st-tailoring-bg)",  fg: "var(--st-tailoring-fg)",  label: "Tailoring"  },
  approved:   { bg: "var(--st-approved-bg)",   fg: "var(--st-approved-fg)",   label: "Approved"   },
  applied:    { bg: "var(--st-applied-bg)",    fg: "var(--st-applied-fg)",    label: "Applied"    },
  rejected:   { bg: "var(--st-rejected-bg)",   fg: "var(--st-rejected-fg)",   label: "Rejected"   },
};

const StatusPill = ({ status }) => {
  const c = STATUS_TONES[status] || STATUS_TONES.discovered;
  return (
    <span className="pill" style={{ color: c.fg, background: c.bg }}>
      <span className="dot" style={{ background: c.fg }}/>
      {c.label}
    </span>
  );
};

const JobCard = ({ lead, onClick, active }) => {
  const c = STATUS_TONES[lead.status];
  return (
    <button onClick={onClick} className="lift" style={{
      textAlign: "left", width: "100%", display: "block",
      flex: "0 0 auto",
      border: "1px solid " + (active ? "var(--ink-3)" : "var(--line)"),
      background: active ? "var(--card-2)" : "var(--card)",
      borderRadius: 14, padding: "13px 14px", cursor: "pointer",
      boxShadow: active ? "var(--shadow-md)" : "var(--shadow-sm)",
      position: "relative", overflow: "hidden",
    }}>
      <span style={{
        position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: 4,
        background: c.fg, opacity: 0.7,
      }}/>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginLeft: 8 }}>
        <div className="col gap-1" style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink)" }}>
            {lead.title}
          </div>
          <div className="row gap-2" style={{ fontSize: 12, color: "var(--ink-2)" }}>
            <span style={{ fontWeight: 500 }}>{lead.company}</span>
            <span style={{ color: "var(--ink-4)" }}>·</span>
            <span style={{ color: "var(--ink-3)" }}>{lead.location}</span>
          </div>
        </div>
        <div className="col gap-1" style={{ alignItems: "flex-end" }}>
          <div className="mono" style={{
            fontSize: 11, fontWeight: 600,
            color: lead.match >= 90 ? "var(--ok)" : lead.match >= 80 ? "var(--warn)" : "var(--ink-3)",
          }}>{lead.match}%</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{lead.posted}</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 10, marginLeft: 8, justifyContent: "space-between", alignItems: "center" }}>
        <StatusPill status={lead.status}/>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{lead.platform}</span>
      </div>
    </button>
  );
};

const DiscoveryFeed = ({ leads, selected, onSelect, filter, setFilter }) => {
  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);
  const counts = leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});

  return (
    <div className="card col" style={{ height: "100%", overflow: "hidden" }}>
      <div className="col gap-3" style={{ padding: "16px 16px 12px 16px", borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="col gap-1">
            <span className="eyebrow">Column 01 · Discovery</span>
            <h3 style={{ fontSize: 18, color: "var(--ink)" }}>Live pipeline <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· {leads.length}</span></h3>
          </div>
          <button className="btn btn-icon" aria-label="Refresh"><Icon name="refresh" size={15}/></button>
        </div>
        <div className="row gap-1" style={{ flexWrap: "wrap" }}>
          {[["all","All", leads.length], ...Object.entries(STATUS_TONES).map(([k,v]) => [k, v.label, counts[k]||0])].map(([k, label, n]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500,
              border: "1px solid " + (filter === k ? "var(--ink)" : "var(--line)"),
              background: filter === k ? "var(--ink)" : "transparent",
              color: filter === k ? "var(--paper)" : "var(--ink-2)",
              cursor: "pointer",
            }}>
              {label} <span style={{ opacity: 0.55, marginLeft: 4 }}>{n}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="col gap-2" style={{ padding: 12, overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--ink-3)", fontSize: 13 }}>No leads in this state.</div>
        ) : filtered.map(l => (
          <JobCard key={l.id} lead={l} active={selected?.id === l.id} onClick={() => onSelect(l)}/>
        ))}
      </div>
    </div>
  );
};

const LOG_COLORS = {
  info: "var(--ink-2)",
  ok:   "var(--ok)",
  warn: "var(--warn)",
  err:  "var(--bad)",
};

const AgentTerminal = ({ logs, paused, setPaused, ghost }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && !paused) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs, paused]);

  return (
    <div className="card col" style={{ height: "100%", overflow: "hidden" }}>
      <div className="row" style={{
        padding: "16px 16px 14px 16px", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid var(--line)",
      }}>
        <div className="col gap-1">
          <span className="eyebrow">Column 02 · Agent Stream</span>
          <h3 style={{ fontSize: 18 }}>Thoughts <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· langgraph</span></h3>
        </div>
        <div className="row gap-2">
          <span className="pill" style={{
            color: ghost ? "var(--mauve-ink)" : "var(--ink-2)",
            background: ghost ? "var(--mauve)" : "var(--paper-2)",
          }}>
            <Icon name="ghost" size={11}/>
            {ghost ? "Ghost Mode" : "Human-in-loop"}
          </span>
          <button className="btn btn-icon" onClick={() => setPaused(p => !p)}>
            <Icon name={paused ? "play" : "pause"} size={14}/>
          </button>
        </div>
      </div>

      <div ref={ref} className="terminal" style={{
        flex: 1, overflowY: "auto", padding: "14px 16px 16px 16px",
        background: "var(--paper-2)",
        margin: 12, borderRadius: 12,
        border: "1px solid var(--line)",
      }}>
        {logs.map((log, i) => (
          <div key={i} className="row gap-3" style={{ alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ color: "var(--ink-4)", fontSize: 10.5 }}>{log.t}</span>
            <span style={{
              color: LOG_COLORS[log.lvl], fontSize: 10, fontWeight: 600, textTransform: "uppercase",
              minWidth: 36, letterSpacing: "0.06em",
            }}>{log.lvl}</span>
            <span style={{ color: "var(--ink-2)", flex: 1 }}>{log.msg}</span>
          </div>
        ))}
        <div className="row gap-2" style={{ marginTop: 6, color: "var(--ink-2)" }}>
          <span style={{ color: "var(--accent)" }}>›</span>
          <span className="blink" style={{
            display: "inline-block", width: 7, height: 13,
            background: "var(--ink-2)", verticalAlign: "middle",
          }}/>
        </div>
      </div>
    </div>
  );
};

const KnowledgeGraph = ({ stats }) => {
  const labels = Object.keys(stats);
  const values = Object.values(stats);
  const max = Math.max(...values);
  const cx = 
```

### Core Architecture Module: `Designs/JustHireMe (Remix)/src/profile.jsx`
```
// Profile / Ingestion view — matte
const Profile = ({ skills, projects, ingested, onIngest, onClear }) => {
  const [over, setOver] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setOver(false);
    if (ingested) return;
    setBusy(true);
    let p = 0;
    const tick = setInterval(() => {
      p += Math.random() * 18 + 6;
      setProgress(Math.min(100, p));
      if (p >= 100) { clearInterval(tick); setBusy(false); onIngest(); setProgress(0); }
    }, 150);
  };

  const tones = ["var(--sage)","var(--mauve)","var(--clay)","var(--sky)","var(--butter)","var(--rose)"];
  const toneInks = ["var(--sage-ink)","var(--mauve-ink)","var(--clay-ink)","var(--sky-ink)","var(--butter-ink)","var(--rose-ink)"];

  return (
    <div style={{ flex: 1, padding: "14px 22px 22px 22px", overflowY: "auto", minHeight: 0 }}>
      <div className="col gap-4">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div className="col gap-2">
            <span className="eyebrow">Profile · The Brain</span>
            <h1 style={{ fontSize: 36, lineHeight: 1.05 }}>Teach the agent <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>who you are.</span></h1>
            <p style={{ color: "var(--ink-2)", fontSize: 14, maxWidth: 580, margin: 0 }}>
              Drop a resume. Local GraphRAG extracts skills, projects, and experience into your Kùzu graph. Nothing leaves this machine.
            </p>
          </div>
          {ingested && (
            <button className="btn" onClick={onClear} style={{ color: "var(--bad)" }}>
              <Icon name="trash" size={14}/> Clear graph
            </button>
          )}
        </div>

        <div
          className={"dropzone " + (over ? "over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={handleDrop}
          onClick={() => !ingested && !busy && handleDrop({ preventDefault: () => {} })}
          style={{ padding: "52px 32px", cursor: ingested ? "default" : "pointer", minHeight: 220 }}
        >
          <div className="col gap-3" style={{ alignItems: "center", textAlign: "center" }}>
            {!ingested && !busy && (
              <>
                <div style={{
                  width: 72, height: 72, borderRadius: 18,
                  background: "var(--card)",
                  border: "1px solid var(--line-2)",
                  display: "grid", placeItems: "center",
                  boxShadow: "var(--shadow-md)",
                }}>
                  <Icon name="upload" size={26} stroke={1.6}/>
                </div>
                <div className="col gap-1" style={{ alignItems: "center" }}>
                  <h2 style={{ fontSize: 22, fontFamily: "var(--font-serif)", fontWeight: 500 }}>Drop your résumé here</h2>
                  <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>PDF · DOCX · TXT &nbsp;·&nbsp; up to 10 MB</p>
                </div>
                <button className="btn btn-accent" style={{ marginTop: 6 }}>
                  <Icon name="file" size={14}/> Choose file
                </button>
              </>
            )}
            {busy && (
              <div className="col gap-3" style={{ alignItems: "center", width: "100%", maxWidth: 360 }}>
                <Icon name="spark" size={28} style={{ animation: "spin-slow 2s linear infinite", color: "var(--accent)" }}/>
                <h3 style={{ fontSize: 16 }}>Embedding · {Math.round(progress)}%</h3>
                <div style={{ width: "100%", height: 6, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
                  <div style={{
                    width: progress + "%", height: "100%",
                    background: "var(--accent)",
                    transition: "width .12s linear",
                  }}/>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>extracting entities · graph.write()</span>
              </div>
            )}
            {ingested && (
              <div className="col gap-3" style={{ alignItems: "center" }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 18,
                  background: "var(--sage)",
                  display: "grid", placeItems: "center",
                  border: "1px solid color-mix(in oklch, var(--sage-ink) 25%, transparent)",
                  color: "var(--sage-ink)",
                }}>
                  <Icon name="check" size={30} stroke={2.2}/>
                </div>
                <div className="col gap-1" style={{ alignItems: "center" }}>
                  <h2 style={{ fontSize: 20, fontFamily: "var(--font-serif)", fontWeight: 500 }}>resume_v4.pdf · ingested</h2>
                  <p className="mono" style={{ color: "var(--ink-3)", fontSize: 11, margin: 0 }}>
                    {skills.length} skills · {projects.length} projects · 8 experiences embedded
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {ingested && (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
            <div className="card col gap-3" style={{ padding: 22 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="col gap-1">
                  <span className="eyebrow">Extracted · Skills</span>
                  <h3 style={{ fontSize: 18 }}>{skills.length} skill nodes</h3>
                </div>
                <button className="btn btn-icon"><Icon name="plus" size={14}/></button>
              </div>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                {skills.map((s, i) => (
                  <span key={s} style={{
                    padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                    background: tones[i % tones.length],
                    color: toneInks[i % toneInks.length],
                  }}>{s}</span>
                ))}
              </div>
            </div>

            <div className="card col gap-3" style={{ padding: 22 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="col gap-1">
                  <span className="eyebrow">Extracted · Projects</span>
                  <h3 style={{ fontSize: 18 }}>{projects.length} project nodes</h3>
                </div>
                <button className="btn btn-icon"><Icon name="plus" size={14}/></button>
              </div>
              <div className="col gap-2">
                {projects.map((p, i) => (
                  <div key={p.name} className="row lift" style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: "var(--paper-2)", border: "1px solid var(--line)",
                    justifyContent: "space-between",
                  }}>
                    <div className="row gap-3">
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: tones[i % tones.length], color: toneInks[i % toneInks.length],
                        display: "grid", placeItems: "center",
                      }}>
                        <Icon name="bolt" size={14}/>
                      </div>
                      <div className="col">
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{p.note}</span>
                      </div>
                    </div>
                    <button className="btn btn-icon"><Icon name="external" size={13}/></button>
                  </div>
                ))}
 
```

### Core Architecture Module: `Designs/JustHireMe (Remix)/src/settings.jsx`
```
// Settings modal
const Settings = ({ open, onClose, ghost, setGhost }) => {
  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(640px, 92vw)", maxHeight: "88vh",
        background: "var(--paper)", border: "1px solid var(--line)",
        borderRadius: 20, boxShadow: "var(--shadow-lg)",
        zIndex: 50, overflow: "hidden", display: "flex", flexDirection: "column",
        animation: "slide-up .3s ease",
      }}>
        <div className="row" style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)", justifyContent: "space-between", background: "var(--blue-soft)" }}>
          <div className="col gap-1">
            <span className="eyebrow">Configuration</span>
            <h2 style={{ fontSize: 26 }}>Settings</h2>
          </div>
          <button className="btn btn-icon" onClick={onClose}><Icon name="x" size={15}/></button>
        </div>
        <div className="scroll" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field tone="purple" icon="key" label="Anthropic API key" hint="Used by evaluator + tailor agents" type="password" placeholder="sk-ant-•••••••••••••" defaultValue=""/>
          <Field tone="orange" icon="key" label="OpenAI API key" hint="Fallback for embeddings" type="password" placeholder="sk-•••••••••••••" defaultValue=""/>
          <Field tone="blue" icon="link" label="LinkedIn session cookie" hint="Required for LinkedIn scraper" type="password" placeholder="li_at=•••" defaultValue=""/>
          <Field tone="green" icon="globe" label="Target job boards" hint="One URL per line" type="textarea" defaultValue={"https://lever.co/linear\nhttps://greenhouse.io/stripe\nhttps://ashby.hq/figma\nhttps://jobs.ashbyhq.com/anthropic"}/>

          <div style={{
            padding: 16, borderRadius: 14,
            background: ghost ? "var(--purple-soft)" : "var(--paper-2)",
            border: `1px solid ${ghost ? "var(--purple-ink)" : "var(--line)"}`,
            transition: "all .2s ease",
          }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div className="col gap-1" style={{ flex: 1 }}>
                <div className="row gap-2">
                  <Icon name="ghost" size={14} color={ghost ? "var(--purple-ink)" : "var(--ink-3)"}/>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Ghost mode</div>
                  <span className="pill mono" style={{ background: ghost ? "var(--purple)" : "var(--paper-3)", color: ghost ? "var(--purple-ink)" : "var(--ink-3)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>{ghost ? "autonomous" : "manual"}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                  {ghost ? "Agent applies automatically when match score > 0.85." : "Agent waits for your approval before submitting any application."}
                </div>
              </div>
              <button onClick={() => setGhost(!ghost)} style={{
                width: 46, height: 26, borderRadius: 999,
                background: ghost ? "var(--purple-ink)" : "var(--ink-4)",
                border: "none", cursor: "pointer", padding: 0,
                position: "relative", transition: "background .2s ease",
              }}>
                <span style={{
                  position: "absolute", top: 3, left: ghost ? 23 : 3,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "white", transition: "left .2s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}/>
              </button>
            </div>
          </div>
        </div>
        <div className="row" style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", justifyContent: "flex-end", gap: 8, background: "var(--paper-2)" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onClose}><Icon name="check" size={13}/> Save changes</button>
        </div>
      </div>
    </>
  );
};

const Field = ({ tone, icon, label, hint, type = "text", placeholder, defaultValue }) => (
  <div style={{
    padding: 14, borderRadius: 12,
    background: `var(--${tone}-soft)`,
    border: `1px solid var(--${tone})`,
  }}>
    <div className="row gap-2" style={{ marginBottom: 8 }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: `var(--${tone})`, color: `var(--${tone}-ink)`, display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={12}/>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginLeft: 4 }}>{hint}</div>
    </div>
    {type === "textarea" ? (
      <textarea defaultValue={defaultValue} rows={4} className="mono" style={{
        width: "100%", padding: "10px 12px", borderRadius: 9,
        border: "1px solid var(--line)", background: "var(--card)",
        fontSize: 12, resize: "vertical",
      }}/>
    ) : (
      <input type={type} placeholder={placeholder} defaultValue={defaultValue} className="mono" style={{
        width: "100%", padding: "10px 12px", borderRadius: 9,
        border: "1px solid var(--line)", background: "var(--card)",
        fontSize: 12,
      }}/>
    )}
  </div>
);

window.Settings = Settings;

```

### Core Architecture Module: `Designs/JustHireMe (Remix)/src/sidebar.jsx`
```
// Sidebar — proper nav with sections + counts
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "home",   tone: "blue"   },
  { id: "pipeline",  label: "Pipeline",  icon: "layers", tone: "purple" },
  { id: "graph",     label: "Knowledge", icon: "graph",  tone: "green"  },
  { id: "activity",  label: "Activity",  icon: "pulse",  tone: "orange" },
  { id: "profile",   label: "Profile",   icon: "user",   tone: "pink"   },
];

const Sidebar = ({ view, setView, leadCounts, online, latency, uptime, onSettings }) => {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="row gap-3" style={{ padding: "4px 8px 18px 8px" }}>
        <Icon name="logo" size={32}/>
        <div className="col" style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>JustHireMe</div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>v0.4.2</div>
        </div>
      </div>

      {/* Section: Workspace */}
      <div className="eyebrow" style={{ padding: "0 12px", marginBottom: 4 }}>Workspace</div>
      <div className="col gap-1">
        {NAV.map(n => {
          const active = view === n.id;
          const count = n.id === "pipeline" ? leadCounts.total : null;
          return (
            <div key={n.id} className={"nav-item " + (active ? "active" : "")} onClick={() => setView(n.id)}>
              <div className="nav-icon" style={{
                background: active ? `var(--${n.tone})` : "var(--paper-3)",
                color: active ? `var(--${n.tone}-ink)` : "var(--ink-2)",
              }}>
                <Icon name={n.icon} size={14} stroke={1.8}/>
              </div>
              <span style={{ flex: 1 }}>{n.label}</span>
              {count != null && (
                <span className="mono tabular" style={{
                  fontSize: 10.5, fontWeight: 600,
                  color: active ? `var(--${n.tone}-ink)` : "var(--ink-3)",
                  background: active ? `var(--${n.tone})` : "var(--paper-3)",
                  padding: "2px 7px", borderRadius: 999,
                }}>{count}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Section: Pipeline status */}
      <div className="eyebrow" style={{ padding: "16px 12px 4px 12px" }}>Status breakdown</div>
      <div className="col gap-1">
        {[
          ["evaluating", "Evaluating", "yellow",  leadCounts.evaluating],
          ["tailoring",  "Tailoring",  "purple",  leadCounts.tailoring],
          ["approved",   "Approved",   "green",   leadCounts.approved],
          ["applied",    "Applied",    "orange",  leadCounts.applied],
        ].map(([k, label, tone, n]) => (
          <div key={k} className="row" style={{
            padding: "7px 12px", fontSize: 12, color: "var(--ink-2)", justifyContent: "space-between",
            borderRadius: 8,
          }}>
            <div className="row gap-2">
              <span style={{ width: 8, height: 8, borderRadius: 3, background: `var(--${tone})`, border: `1px solid var(--${tone}-ink)`, opacity: 0.85 }}/>
              <span>{label}</span>
            </div>
            <span className="mono tabular" style={{ color: "var(--ink-3)", fontSize: 11 }}>{n || 0}</span>
          </div>
        ))}
      </div>

      <div className="grow"/>

      {/* Footer: status + gear */}
      <div className="card-flat" style={{ padding: 10, background: "var(--card)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="col" style={{ gap: 2 }}>
            <div className="row gap-2">
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: online ? "var(--ok)" : "var(--bad)",
                boxShadow: `0 0 0 3px ${online ? 'rgba(91,140,68,0.18)' : 'rgba(180,69,44,0.18)'}`,
                animation: online ? "blink 2s ease-in-out infinite" : "none",
              }}/>
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>{online ? "Online" : "Offline"}</span>
            </div>
            <span className="mono tabular" style={{ fontSize: 10, color: "var(--ink-3)" }}>{latency}ms · up {uptime}</span>
          </div>
          <button className="btn btn-icon" onClick={onSettings} aria-label="Settings"><Icon name="settings" size={15}/></button>
        </div>
      </div>
    </aside>
  );
};

window.Sidebar = Sidebar;
window.NAV = NAV;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #131** (2026-06-18): **[Bug]: : Update vite in website/ to fix high severity security issues**
  *Symptoms*: ### Summary  I was auditing the repo and found a couple high severity vulnerabilities in the `website/ `folder's dependencies. **Details:**  - GHSA-v6wh-96g9-6wx3 (vite): NTLMv2 hash disclosure on Windows [link](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) - GHSA-fx2h-pf6j-xcff (vite): server.fs.deny bypass on Windows [link](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)  Both affect vite 8.0.0 - 8.0.15. `npm audit fix` in `website/` cleans it up nicely (now 0 vulns). **Suggestion**: Bump vite in `website/package.json to >= 8.0.16 or latest.` Happy to help with a PR if needed! Thanks for maintaining the project.  ### Steps to reproduce  npm audit fix  ### Expected behavior  .  ### OS / app version  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks a lot @veeresh-bikkaneti , im pushing a new version out with all these dependecies resolved and bumped up to Latest stable version.

- **Issue #121** (2026-07-18): **[Bug]: _parse() and _parse_wellfound() defined twice in scout.py — LLM logic silently overwritten**
  *Symptoms*: ### Summary  Two functions in `automation/scout.py` are each defined twice in the same file.  The second definitions overwrite the first ones at module load time, making the  original LLM-based extraction logic permanently unreachable dead code.  ### Steps to reproduce  1. Open `backend/automation/scout.py` 2. Search for `def _parse` — two definitions appear 3. Search for `def _parse_wellfound` — two definitions appear 4. Run: python -m pyflakes automation/scout.py    Output confirms: "redefinition of unused '_parse' from line 288"  ### Expected behavior  Each function should be defined exactly once. The intended implementation  (either the LLM logic or the web_sources wrapper) should be the only definition present.  ### OS / app version  Discovered via static analysis (pyflakes) — not OS-specific
  **Post-Mortem & Fix Analysis**:
  > ﻿Good catch at the time - this was resolved by the web_sources refactor: each of these functions now has exactly one definition (a thin delegate into backend/automation/web_sources.py, where the extraction logic lives). ruff F811 runs clean over the module today. Closing as fixed. 

- **Issue #92** (2026-07-18): **[Bug]: Customize One Job gives error even with URL and sufficient job details entered?**
  *Symptoms*: ### Summary  Hi,  Giving this software a try to see if can provide more options than standard search and apply.  I was not able to complete the setup as the app got stalled in the **Customize One Job** step. I installed **JustHireMe v1.0.38 AppImage on Ubuntu 24.04.4 LTS** and tried to Analyze and Generate to see what would happen but got the below error. I'm using my local **Ollama** setup as a provider which is running in the background. It was able to retrieve around 145 jobs but no more, which I assume has to do with the constraints I put in initially.  <img width="1916" height="992" alt="Image" src="https://github.com/user-attachments/assets/bb504c90-1290-4826-83bb-ce2b6b5b4fe4" />  Also, I was not able to get the **Export Graph** button to work.  <img width="1440" height="112" alt="Image" src="https://github.com/user-attachments/assets/1a9bbadb-8ebf-4de8-b011-0aeb4a8a92ca" />  I'm likely doing something wrong but thought I'd mention my experience.  Also, there a setting for Dark Theme?  Thank you, MB  ### Steps to reproduce  1. Install 2. Open 3. Upload Resume (.docx) 4. Installed the runtime pack by itself upon my approval. 5. Asked it to search for jobs based on my typed criteria. 6. Went to **Customize One Job** where it failed. 7. I opted to choose another of the retrieved jobs, still would not Customize the Res for the job.  ### Expected behavior  Don't know was not able to get to next step.  ### OS / app version  Ubuntu 24.04.4 LTS, JustHireMe v1.0.38 AppImage
  **Post-Mortem & Fix Analysis**:
  > ﻿All three parts of this are resolved in current releases:  1. **Customize One Job errors**: the pre-generation readiness check was rewritten (the code comment literally cites this issue). It now gates on substance, not tech keywords, and Ollama hiccups retry with backoff and degrade to a deterministic package instead of erroring out. 2. **Export Graph**: that button was removed in the graph page redesign rather than fixed in place. If you'd still like a graph export, open a fresh feature request and we'll spec it properly. 3. **Dark theme**: shipped - Light / Dark / System in Settings.  Please try the latest release (you were on v1.0.38; a lot has moved). Closing; reopen if generation still fails for you on current builds. 

- **Issue #61** (2026-05-18): **[Bug]: Fix - concurrent profile deletion race condition (SQLite read-modify-write hazard)**
  *Symptoms*: ### Summary  ## Bug Rapidly deleting multiple profile items (skills, experience, etc.) causes them to reappear in the UI. The deleted items also persist in the Kuzu graph and LanceDB vector store.  ## Root Cause FastAPI runs DELETE requests concurrently in threadpool workers via asyncio.to_thread. Both PROFILE_SNAPSHOT_KEY and PROFILE_DELETIONS_KEY are stored as JSON in SQLite and follow a read-modify-write pattern:  1. Thread 1 reads snapshot → [A, B] 2. Thread 2 reads snapshot → [A, B]   3. Thread 1 deletes A → saves [B] 4. Thread 2 deletes B → saves [A]  ← overwrites Thread 1's write  Result: A is restored. Its tombstone is also lost, so it stays in Kuzu + LanceDB.  ## Proposed Fix Add a reentrant lock around all profile write operations in backend/data/graph/profile.py:  import threading, functools  _profile_write_lock = threading.RLock()  def _profile_write_locked(func):     @functools.wraps(func)     def wrapper(*args, **kwargs):         with _profile_write_lock:             return func(*args, **kwargs)     return wrapper  Decorate: save_profile_snapshot, _remember_profile_deletion, _forget_profile_deletion, delete_skill, _delete_text_node  RLock (reentrant) is needed because these functions call each other internally.  ## Reproduction Open profile → rapidly click delete on multiple skills/experience items → items disappear then reappear  ### Steps to reproduce  1. Open JustHireMe → navigate to Profile tab 2. Add 3+ skills if not already present 3. Rapidly click the tra

- **Issue #39** (2026-05-16): **[Bug]: Showing just a ? for not filling required fields in Model Selection**
  *Symptoms*: ### Summary  I was trying to configure NVIDIA NIM for the model and chose custom models for all the steps and configured all the below steps with the API keys. However, when I submit it just shows ?Submit without showing the fields that needs input or something. Tried changing so many fields and turning on off many togglers.   Can't figure out which fields more it needs.   ### Steps to reproduce  1. Install the app 2. Configure the model in advance settings 3. Configure the parameters  4. Click on submit or save  ### Expected behavior  An error message or highlighting the fields is much more helpful.  ### OS / app version  Windows 11
  **Post-Mortem & Fix Analysis**:
  > Hey @ghoshzsh  Thanks a lot for reporting this issue , this will be fixed with the new version , im currently working on a new microservice based architecture so this might take a bit longer but it surely will be fixed.  Once again really appreciate the effort.

- **Issue #26** (2026-05-08): **[Bug]: Generate Package buttons show false success when backend generation fails**
  *Symptoms*: ### Summary    The `Generate Package` actions in the lead cards can look successful even when backend generation fails.  Right now the UI sets a temporary queued/generating state when the user clicks generate, but it does not check whether the backend response was actually successful. If the backend returns a non-2xx response, the user can still briefly see a success-looking state instead of an actionable error.  Affected areas  - lead card generate action - pipeline card generate action  ### Steps to reproduce  1. Open a lead where package generation can fail. 2. Trigger `Generate Package`. 3. Make the backend return an error response such as `409` or `500`. 4. Observe that the UI still shows a queued/generating state instead of surfacing the backend error clearly.  ### Expected behavior  If package generation fails, the UI should: - check `response.ok` - stop the generating state immediately - show the backend error message when available  ### OS / app version  _No response_

- **Issue #24** (2026-05-08): **[Bug]: macOS/Linux build-sidecar.sh script fails due to incorrect PyInstaller distpath**
  *Symptoms*: ### Summary  The scripts/build-sidecar.sh script fails to bundle the Python sidecar on macOS/Linux correctly. The PyInstaller --distpath is incorrectly pointing to ../src-tauri/resources instead of ../src-tauri/resources/backend. This causes PyInstaller to build the executable directly into the resources directory as a file named backend, which crashes the final cp command and breaks the Tauri startup flow since Tauri expects a directory structure of resources/backend/backend-<triple>.  ### Steps to reproduce  Clone the repository on macOS or Linux. Run npm install and install backend requirements with uv. Run bash scripts/build-sidecar.sh. See the error cp: src-tauri/resources/backend/backend-aarch64-apple-darwin: Not a directory.  ### Expected behavior  The Python sidecar executable should be placed properly in src-tauri/resources/backend/ and renamed with the correct Tauri triple-target name, matching the exact behavior of the Windows .ps1 script.  ### OS / app version  macOS (M-series / ARM64 or Intel)
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the bug , currently this software is in alpha stage I am currently first pushing a  general POC version , once that is achieved I'll move on to diversification and integrating other OS , please bear with it for the time.

- **Issue #22** (2026-05-07): **[Bug]: macOS/Linux build-sidecar.sh script fails due to incorrect PyInstaller distpath**
  *Symptoms*: ### Summary  The scripts/build-sidecar.sh script fails to bundle the Python sidecar on macOS/Linux correctly. The PyInstaller --distpath is incorrectly pointing to ../src-tauri/resources instead of ../src-tauri/resources/backend. This causes PyInstaller to build the executable directly into the resources directory as a file named backend, which crashes the final cp command and breaks the Tauri startup flow since Tauri expects a directory structure of resources/backend/backend-<triple>.  ### Steps to reproduce  Clone the repository on macOS or Linux. Run npm install and install backend requirements with uv. Run bash scripts/build-sidecar.sh. See the error cp: src-tauri/resources/backend/backend-aarch64-apple-darwin: Not a directory.  ### Expected behavior  The Python sidecar executable should be placed properly in src-tauri/resources/backend/ and renamed with the correct Tauri triple-target name, matching the exact behavior of the Windows .ps1 script.  ### OS / app version  macOS (M-series / ARM64 or Intel)

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `08e5fb26` (2026-09-22)
**Commit Message**: fix(website): accept a Supabase URL pasted with /rest/v1

The waitlist API appends /rest/v1 itself, so a Project URL copied as
https://<ref>.supabase.co/rest/v1/ produced 404s. Strip the suffix.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `website/api/waitlist.js` (modified, +2/-1)
```diff
@@ -37,7 +37,8 @@ function normalizeSource(value) {
 }
 
 function supabaseConfig() {
-  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
+  // Accept the Project URL as pasted, including the common ".../rest/v1/" form.
+  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
   const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
   return url && key ? { url, key } : null;
 }
```

---

### Incident Patch 2: `d890eb2d` (2026-09-22)
**Commit Message**: fix(website): make the iPhone page navbar opaque

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `website/src/ios/ios.css` (modified, +1/-3)
```diff
@@ -171,9 +171,7 @@ main > section { width: min(1180px, calc(100% - 32px)); margin-inline: auto; }
   height: 64px;
   padding: 0 10px 0 12px;
   border-radius: 14px;
-  background: color-mix(in srgb, var(--card) 97%, transparent);
-  backdrop-filter: blur(18px) saturate(140%);
-  -webkit-backdrop-filter: blur(14px) saturate(140%);
+  background: var(--card);
   box-shadow: 3px 4px 0 var(--shadow);
   transition: box-shadow 0.35s var(--ease);
 }
```

---

### Incident Patch 3: `1d1eac8a` (2026-09-22)
**Commit Message**: fix(website): use the JustHireMe J-check mark on the iPhone page

Replaces the old D mark in the /ios/ header, favicon and home-screen icon
with the current brand mark used on @justhiremeai.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `website/ios/index.html` (modified, +3/-2)
```diff
@@ -24,8 +24,9 @@
     <meta name="theme-color" content="#f6f5f0" media="(prefers-color-scheme: light)" />
     <meta name="theme-color" content="#20222b" media="(prefers-color-scheme: dark)" />
     <link rel="canonical" href="https://justhireme.ai/ios/" />
-    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
-    <link rel="apple-touch-icon" href="/favicon.svg" />
+    <link rel="icon" href="/ios/favicon-32.png" type="image/png" sizes="32x32" />
+    <link rel="icon" href="/ios/icon-64.png" type="image/png" sizes="64x64" />
+    <link rel="apple-touch-icon" href="/ios/apple-touch-icon.png" />
     <link rel="preload" href="/ios/fonts/InstrumentSerif-Regular.ttf" as="font" type="font/ttf" crossorigin />
     <link rel="preload" href="/ios/fonts/InstrumentSans-Regular.ttf" as="font" type="font/ttf" crossorigin />
     <link rel="preload" href="/ios/matches.webp" as="image" type="image/webp" />
```

**File**: `website/src/ios/ios.css` (modified, +2/-2)
```diff
@@ -62,8 +62,6 @@
     --shadow: rgb(0 0 0 / 0.25);
     --bezel: #0f1015;
   }
-  /* The favicon mark is a dark tile; give it a paper backing so it reads on the dark chrome. */
-  .brand img { background: #f4f3ee; border-radius: 9px; padding: 1px; }
 }
 
 *, *::before, *::after { box-sizing: border-box; }
@@ -175,6 +173,8 @@ main > section { width: min(1180px, calc(100% - 32px)); margin-inline: auto; }
   border-bottom: 1px solid var(--rule);
 }
 .brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; text-decoration: none; }
+/* The JustHireMe mark sits on its own paper tile, like the app icon. */
+.brand img { border-radius: 8px; box-shadow: 0 0 0 1px var(--line); }
 .header-nav { display: flex; gap: 22px; margin-left: auto; font-size: 15px; color: var(--copy); }
 .header-nav a { text-decoration: none; }
 .header-nav a:hover { color: var(--ink); }
```

**File**: `website/src/ios/main.jsx` (modified, +1/-1)
```diff
@@ -362,7 +362,7 @@ function Header() {
   return (
     <header className="site-header">
       <a className="brand" href="/ios/" aria-label="JustHireMe for iPhone">
-        <img src="/favicon.svg" alt="" width="28" height="28" />
+        <img src="/ios/icon-64.png" alt="" width="32" height="32" />
         <span>JustHireMe</span>
       </a>
       <nav className="header-nav" aria-label="Primary">
```

---

### Incident Patch 4: `6ed82bae` (2026-07-02)
**Commit Message**: fix(ingest): bound every untrusted input so one document can't stall the sidecar

Hardening across the résumé/PDF/LinkedIn/portfolio/GitHub ingest paths, all of
which previously read unbounded input into memory or the parser:

- Résumé text capped at MAX_INGEST_CHARS (200k) before the LLM + the twice-run
  deterministic parser; the router truncates a pasted `raw` over 2M chars.
- PDF reader uses strict=False (tolerate real-world malformed PDFs), caps pages
  (300) and accumulated text (200k chars), and skips a single bad page instead
  of aborting — a decompression-bomb / thousands-of-pages PDF can't hang pypdf.
- LinkedIn .zip: reject a CSV member whose declared OR actual decompressed size
  exceeds 64MB (zip-bomb guard; members are read in-memory, so no zip-slip); and
  emit an empty period instead of a contextless bare "Present".
- Portfolio HTTP fallback streams with an 8MB body ceiling + content-type
  short-circuit instead of buffering + lower-casing the whole body.
- GitHub fetch: detect SECONDARY rate limits (403 + Retry-After even when
  remaining>0) so the backoff actually runs, and lower the per-request timeout
  45s -> 20s.

Tests: zip-bomb member rejected, normal membe

**File**: `backend/profile/github_ingestor.py` (modified, +16/-5)
```diff
@@ -137,18 +137,29 @@ async def _fetch(url: str, token: str | None, *, _retries: int = 2) -> dict | li
     last_exc: Exception | None = None
     for attempt in range(_retries + 1):
         try:
-            async with httpx.AsyncClient(timeout=45) as client:
+            async with httpx.AsyncClient(timeout=20) as client:
                 response = await client.get(url, headers=_gh_headers(token))
                 if response.status_code == 404:
                     return None
                 if response.status_code in {403, 429}:
                     limit_remaining = response.headers.get("x-ratelimit-remaining")
-                    # If rate-limited (429 or 403 with 0 remaining), retry after back-off
-                    is_rate_limit = response.status_code == 429 or (
-                        limit_remaining is not None and limit_remaining == "0"
+                    retry_after_hdr = response.headers.get("retry-after")
+                    try:
+                        remaining = int(limit_remaining) if limit_remaining is not None else None
+                    except (TypeError, ValueError):
+                        remaining = None
+                    # Rate-limited when: 429, OR 403 with the primary quota exhausted
+                    # (remaining <= 0), OR a SECONDARY rate limit — a 403 carrying a
+                    # Retry-After header even though remaining > 0. The old check
+                    # string-compared remaining to "0" and ignored Retry-After, so
+                    # secondary limits skipped the backoff and failed immediately.
+                    is_rate_limit = (
+                        response.status_code == 429
+                        or (remaining is not None and remaining <= 0)
+                        or retry_after_hdr is not None
                     )
                     if is_rate_limit and attempt < _retries:
-                        retry_after = int(response.headers.get("retry-after", "0") or "0")
+                        retry_after = int(retry_after_hdr or "0") if str(retry_after_hdr or "").isdigit() else 0
                         wait = max(retry_after, 2 ** (attempt + 1))
                         _log.info("github rate limit on %s, retrying in %ds (attempt %d/%d)", url, wait, attempt + 1, _retries)
                         await asyncio.sleep(min(wait, 30))
```

**File**: `backend/profile/ingest_documents.py` (modified, +31/-3)
```diff
@@ -20,6 +20,12 @@
 # under this.
 _MAX_DOCX_MEMBER_BYTES = 64 * 1024 * 1024
 
+# Bounds on PDF extraction: a résumé is a handful of pages. These stop a
+# decompression-bomb / thousands-of-pages PDF from hanging pypdf or exhausting
+# memory and stalling the sidecar.
+_MAX_PDF_PAGES = 300
+_MAX_PDF_TEXT_CHARS = 200_000
+
 
 def _read_zip_member(archive: zipfile.ZipFile, name: str) -> bytes:
     info = archive.getinfo(name)
@@ -70,9 +76,31 @@ def _document(path: str) -> str:
 def _pdf(path: str) -> str:
     try:
         from pypdf import PdfReader
-        pages = PdfReader(path).pages
-        text = "\n".join(pg.extract_text() or "" for pg in pages)
-        if not text.strip():
+        # strict=False: tolerate the malformed-but-readable PDFs real users upload
+        # instead of raising on the first spec violation.
+        reader = PdfReader(path, strict=False)
+        parts: list[str] = []
+        total = 0
+        truncated = False
+        for index, page in enumerate(reader.pages):
+            if index >= _MAX_PDF_PAGES:
+                _log.warning("PDF exceeds %d pages; reading only the first %d: %s", _MAX_PDF_PAGES, _MAX_PDF_PAGES, path)
+                truncated = True
+                break
+            try:
+                chunk = page.extract_text() or ""
+            except Exception as exc:
+                # One bad page must not abort extraction of the rest.
+                _log.warning("PDF page %d extract error (%s): %s", index, path, exc)
+                continue
+            parts.append(chunk)
+            total += len(chunk)
+            if total >= _MAX_PDF_TEXT_CHARS:
+                _log.warning("PDF text exceeded %d chars; truncating: %s", _MAX_PDF_TEXT_CHARS, path)
+                truncated = True
+                break
+        text = "\n".join(parts)
+        if not text.strip() and not truncated:
             _log.warning("PDF has no extractable text (may be scanned/image-only): %s", path)
         return text
     except Exception as exc:
```

**File**: `backend/profile/ingestor.py` (modified, +8/-0)
```diff
@@ -12,6 +12,11 @@
 
 _log = get_logger(__name__)
 
+# Upper bound on résumé text fed to the LLM + deterministic parser. A real résumé
+# is a few KB; this bounds both LLM token cost and the (twice-run) regex parser
+# against a pathologically large paste/PDF so a single ingest can't stall the sidecar.
+MAX_INGEST_CHARS = 200_000
+
 def run(raw: str = "", pdf: str | None = None) -> C:
     from llm import call_llm, provider_needs_key, resolve_config
 
@@ -176,6 +181,9 @@ def ingest(raw: str = "", pdf: str | None = None) -> C:
             )
         _log.warning("No usable text for extraction - returning empty profile")
         return C(n="Unknown", s="")
+    if len(txt) > MAX_INGEST_CHARS:
+        _log.warning("résumé text %d chars exceeds cap %d; truncating for extraction", len(txt), MAX_INGEST_CHARS)
+        txt = txt[:MAX_INGEST_CHARS]
     p = run(txt)
     # Capture before merge/normalize, which rebuild C and drop loc.
     extracted_loc = str(getattr(p, "loc", "") or "").strip()
```

**File**: `backend/profile/linkedin_parser.py` (modified, +17/-3)
```diff
@@ -6,6 +6,10 @@
 
 _log = get_logger(__name__)
 
+# Decompressed-size ceiling per CSV member: a ~tens-of-MB zip whose members expand
+# to gigabytes would OOM-kill the sidecar otherwise. A real LinkedIn CSV is small.
+_MAX_CSV_MEMBER_BYTES = 64 * 1024 * 1024
+
 
 def _read_csv(zf: zipfile.ZipFile, name: str) -> list[dict]:
     """Find and parse a CSV by filename pattern (case-insensitive)."""
@@ -14,11 +18,19 @@ def _read_csv(zf: zipfile.ZipFile, name: str) -> list[dict]:
     if not candidates:
         _log.warning("linkedin export: %s not found in ZIP", name)
         return []
-    with zf.open(candidates[0]) as f:
+    member = candidates[0]
+    # Reject on the declared uncompressed size first (cheap), then bound the actual
+    # bytes read in case a crafted archive under-reports its member size.
+    if zf.getinfo(member).file_size > _MAX_CSV_MEMBER_BYTES:
+        raise ValueError(f"LinkedIn export member {member!r} too large (zip-bomb guard)")
+    with zf.open(member) as f:
+        raw = f.read(_MAX_CSV_MEMBER_BYTES + 1)
+        if len(raw) > _MAX_CSV_MEMBER_BYTES:
+            raise ValueError(f"LinkedIn export member {member!r} exceeded {_MAX_CSV_MEMBER_BYTES} bytes")
         # Lenient decode (like the other ingest paths): some real LinkedIn exports —
         # and files re-saved by Excel — carry cp1252/latin-1 bytes, and a strict
         # decode aborted the ENTIRE import over one bad character. utf-8-sig strips BOM.
-        text = f.read().decode("utf-8-sig", errors="replace")
+        text = raw.decode("utf-8-sig", errors="replace")
     reader = csv.DictReader(io.StringIO(text))
     return [dict(r) for r in reader]
 
@@ -70,7 +82,9 @@ def parse_linkedin_export(zip_bytes: bytes) -> dict:
             desc  = (row.get("Description") or "").strip()
             loc   = (row.get("Location") or "").strip()
             if role or co:
-                period = f"{start} – {end}" if start else end
+                # Without a start date, a bare "Present" is contextless noise —
+                # emit an empty period instead (matches the Education branch).
+                period = f"{start} – {end}" if start else ""
                 d = desc
                 if loc:
                     d = f"{d}\n{loc}".strip() if d else loc
```

**File**: `backend/profile/portfolio_crawl.py` (modified, +26/-5)
```diff
@@ -31,6 +31,10 @@
 
 MAX_PAGES = 100
 MAX_TEXT_PER_PAGE = 200000
+# Hard ceiling on a single fetched page body in the HTTP fallback. A hostile or
+# misconfigured host can otherwise stream an unbounded body and OOM the sidecar
+# (or starve the default thread pool). A real portfolio page is well under this.
+MAX_HTTP_RESPONSE_BYTES = 8 * 1024 * 1024
 # Per page, click up to this many candidate cards/buttons to reveal modal or
 # inline-expanded detail (case studies, demo videos) that is not in the initial
 # DOM. Bounded so a click-heavy page can't blow the crawl budget.
@@ -365,12 +369,29 @@ def _block_private_request(request):
                 continue
             seen.add(current)
             try:
-                response = client.get(current)
-                response.raise_for_status()
-                content_type = response.headers.get("content-type", "")
-                if "text/html" not in content_type and "<html" not in response.text.lower():
+                # Stream so a non-text or oversized body is rejected BEFORE it is
+                # fully buffered/decoded (avoids OOM + wasted whole-body .lower()).
+                with client.stream("GET", current) as response:
+                    response.raise_for_status()
+                    final_url = str(response.url)
+                    content_type = response.headers.get("content-type", "").lower()
+                    if content_type and "html" not in content_type and "text" not in content_type:
+                        continue
+                    declared = response.headers.get("content-length", "")
+                    if declared.isdigit() and int(declared) > MAX_HTTP_RESPONSE_BYTES:
+                        _log.warning("portfolio page %s too large (%s bytes); skipping", current, declared)
+                        continue
+                    buf = bytearray()
+                    for chunk in response.iter_bytes():
+                        buf.extend(chunk)
+                        if len(buf) > MAX_HTTP_RESPONSE_BYTES:
+                            _log.warning("portfolio page %s exceeded %d bytes; truncating", current, MAX_HTTP_RESPONSE_BYTES)
+                            break
+                    charset = response.charset_encoding or "utf-8"
+                body_text = bytes(buf).decode(charset, errors="replace")
+                if "text/html" not in content_type and "<html" not in body_text.lower():
                     continue
-                snapshot = _snapshot_html(str(response.url), response.text)
+                snapshot = _snapshot_html(final_url, body_text)
                 pages.append(snapshot)
                 for link in _prioritize_links(url, snapshot.links):
                     href = _canonical_url(link["href"])
```

---

### Incident Patch 5: `ed34491a` (2026-07-02)
**Commit Message**: fix(automation): stop the Read-form flow from making the sidecar unreachable

The "Local backend is unreachable / sidecar may have restarted" error during
Read form came from the single-worker event loop stalling, not a crash:

- actuator.read_form had no overall wall-clock and an un-timeboxed
  browser.close() inside the try body — a wedged Chromium pinned the coroutine
  and leaked the browser process (cumulatively -> backend unreachable). Now the
  whole session runs under asyncio.wait_for(45s) and browser.close() is a
  time-boxed (5s) finally, so a hung page can't hold the loop or leak.
- The SSRF assert_public_url check now runs BEFORE launching Chromium (was
  after), so an internal/blocked URL is rejected without paying a browser spawn.
- automation.read_lead_form ran blocking SQLite/graph/file reads directly on the
  event loop; under DB-lock contention that stalled every coroutine including
  /health. Wrapped the four reads in asyncio.to_thread, matching the sibling
  `fire` endpoint.

**File**: `backend/api/routers/automation.py` (modified, +8/-4)
```diff
@@ -149,16 +149,20 @@ async def read_lead_form(
         repo: Repository = Depends(get_repository),
         service=Depends(get_automation_service),
     ):
-        lead = repo.leads.get_lead_by_id(job_id)
+        # Run the blocking SQLite/graph/file reads off the event loop (as the
+        # sibling `fire` endpoint does). On the single-worker sidecar, a blocking
+        # read under DB-lock contention would stall EVERY coroutine — including
+        # /health — so the UI reports the backend as unreachable.
+        lead = await asyncio.to_thread(repo.leads.get_lead_by_id, job_id)
         if not lead:
             raise HTTPException(404, "lead not found")
 
         url = (body.url or lead.get("url") or "").strip()
         if not url:
             raise HTTPException(400, "no url available for this lead")
 
-        profile = repo.profile.get_profile()
-        cfg = repo.settings.get_settings()
+        profile = await asyncio.to_thread(repo.profile.get_profile)
+        cfg = await asyncio.to_thread(repo.settings.get_settings)
         # The profile is FLAT: the candidate name is profile["n"], not a "candidate"
         # sub-dict (there is none), and no "full_name" setting is ever written. Read
         # it the way get_lead_for_fire_sync does, else the form-read preview shows a
@@ -175,7 +179,7 @@ async def read_lead_form(
             "current_company": cfg.get("current_company", ""),
         }
 
-        cover_letter = resolve_cover_letter_text(lead.get("cover_letter_asset", ""), _log)
+        cover_letter = await asyncio.to_thread(resolve_cover_letter_text, lead.get("cover_letter_asset", ""), _log)
 
         return await service.read_form(url, identity, cover_letter=cover_letter)
 
```

**File**: `backend/automation/actuator.py` (modified, +92/-60)
```diff
@@ -11,6 +11,11 @@
 
 _log = get_logger(__name__)
 
+# Wall-clock ceiling for a single read_form session (nav + field probing +
+# screenshot + close). Past this the coroutine is cancelled so a slow/blocking
+# page can't pin the single-worker sidecar and make the backend look unreachable.
+READ_FORM_DEADLINE_S = 45
+
 _AUTO_APPLY_ENABLED = os.environ.get("JHM_AUTO_APPLY", "false").lower() == "true"
 
 _TYPE_TO_CANDIDATE_KEY = {
@@ -58,77 +63,104 @@ async def read_form(
 
     candidate_with_cl = {**candidate, "cover_letter": cover_letter}
 
-    result_fields = []
+    result_fields: list[dict] = []
     unmatched: list[str] = []
     screenshot_b64 = ""
     error = None
 
+    # SSRF guard FIRST, before spawning Chromium: the lead URL is LLM-extracted
+    # from an untrusted page, so reject non-public hosts up front — an internal
+    # URL must never cost a browser launch (DoS amplification) or be reached.
     try:
-        async with async_playwright() as pw:
-            browser = await launch_chromium(pw, headless=True)
-            ctx = await browser.new_context(
-                viewport={"width": 1280, "height": 900},
-                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
-            )
-            # SSRF guard: the lead URL is LLM-extracted from an untrusted page, so
-            # reject non-public hosts before navigating, and abort redirect hops.
-            await asyncio.to_thread(assert_public_url, url)
-            await ctx.route("**/*", block_private_route)
-            page = await ctx.new_page()
-            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
-            await page.wait_for_timeout(2000)
-
-            for field_cfg in fields_cfg:
-                sel = field_cfg["selector"]
-                ftype = field_cfg["type"]
-                answer = resolve_answer(ftype, candidate_with_cl)
-                found = False
-
-                try:
-                    el = page.locator(sel).first
-                    await el.wait_for(state="visible", timeout=1500)
-                    found = True
-                except Exception as log_exc:
-                    logging.getLogger(__name__).warning('suppressed exception in backend/automation/actuator.py:read_form: %s', log_exc)
-                    found = False
-
-                if not found:
-                    confidence = "low"
-                elif platform:
-                    confidence = "high"
-                else:
-                    confidence = "medium"
-
-                result_fields.append({
-                    "type":          ftype,
-                    "label":         ftype.replace("_", " ").title(),
-                    "selector":      sel.split(",")[0].strip(),
-                    "answer":        answer,
-                    "found_on_page": found,
-                    "confidence":    confidence,
-                })
-
+        await asyncio.to_thread(assert_public_url, url)
+    except Exception as exc:
+        _log.warning("read_form rejected non-public url %s: %s", url, exc)
+        return {
+            "platform": platform,
+            "platform_label": "Generic form",
+            "screenshot_b64": "",
+            "fields": [],
+            "unmatched_labels": [],
+            "error": str(exc),
+        }
+
+    async def _fill_and_capture(page) -> None:
+        nonlocal screenshot_b64
+        for field_cfg in fields_cfg:
+            sel = field_cfg["selector"]
+            ftype = field_cfg["type"]
+            answer = resolve_answer(ftype, candidate_with_cl)
+            found = False
             try:
-                labels = await page.locator("label").all_text_contents()
-                covered_words = {"first", "last", "email", "phone", "linkedin",
-                                 "github", "website", "city", "cover", "resume", "name"}
-                for lbl in labels:
-                    lbl_lower = lbl.lower().strip()
-                
```

---

### Incident Patch 6: `74f73fbf` (2026-07-02)
**Commit Message**: fix(ingest): accept real-world profile JSON shapes instead of a raw 422

POST /ingest/profile bound a rigid Pydantic model (ProfileImportBody), so
FastAPI validated the body BEFORE the handler — a profile whose `skills` was a
grouped {"languages":[...],"frontend":[...]} object (or any alt-keyed shape)
died with a raw 422 detail array, and the handler's own tolerant "partial"
fallback plus the fully shape-tolerant service/normalizer were unreachable.

- Endpoint now takes the raw JSON object: json.loads + dict-guard + a 5MB
  serialized-size cap; only genuinely broken input (not-JSON / not-an-object /
  oversized) is refused, with a human-readable message.
- normalize_profile_payload gains coerce_skills_shape(): a grouped {cat:[names]}
  dict flattens to categorized skills (was iterating dict KEYS -> inventing
  skills named "languages"/"frontend"), a flat string list and alt-keyed
  ({skill,title,label}) dicts are accepted, and scalar/garbage coerces to [].
- Field caps that lived on the removed Pydantic model are now enforced by
  TRUNCATION in the normalizer (name/summary/description/impact/...), so an
  oversized field never rejects the whole payload.
- Raised the skills cap 100

**File**: `backend/api/routers/ingestion.py` (modified, +44/-65)
```diff
@@ -7,14 +7,27 @@
 import contextlib
 from pathlib import Path
 
-from fastapi import APIRouter, File, Form, HTTPException, UploadFile
-from pydantic import BaseModel, Field
+from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
+from pydantic import Field
 
 from api.rate_limit import RateLimiter, require_rate_limit
 from api.dependencies import get_profile_service
 from core.types import StrictBody
 
 MAX_UPLOAD_SIZE = 10 * 1024 * 1024
+# Serialized-JSON ceiling for the profile-import body: generous for any real
+# profile (a rich profile is a few hundred KB) while refusing an abusive blob
+# before it is parsed/normalized. Kept separate from MAX_UPLOAD_SIZE (files).
+MAX_PROFILE_JSON_BYTES = 5 * 1024 * 1024
+# Hard cap on pasted résumé text, so a giant paste can't buffer unbounded in the
+# form parser. The parser itself truncates further (profile.ingestor MAX_INGEST_CHARS).
+MAX_RAW_RESUME_CHARS = 2_000_000
+
+_EMPTY_IMPORT_STATS = {
+    "skills": 0, "experience": 0, "projects": 0,
+    "education": 0, "certifications": 0, "achievements": 0,
+    "vector_sync": "skipped",
+}
 
 
 class GithubIngestBody(StrictBody):
@@ -31,54 +44,12 @@ class PortfolioIngestBody(StrictBody):
     )
 
 
-class ProfileSkill(BaseModel):
-    name: str = Field(max_length=160)
-    category: str = Field(default="general", max_length=80)
-
-
-class ProfileExperience(BaseModel):
-    role: str = Field(default="", max_length=200)
-    company: str = Field(default="", max_length=200)
-    period: str = Field(default="", max_length=100)
-    description: str = Field(default="", max_length=5000)
-
-
-class ProfileProject(BaseModel):
-    title: str = Field(default="", max_length=200)
-    stack: str = Field(default="", max_length=500)
-    repo: str = Field(default="", max_length=500)
-    impact: str = Field(default="", max_length=1000)
-
-
-class ProfileEntry(BaseModel):
-    title: str = Field(max_length=500)
-
-
-class ProfileIdentity(BaseModel):
-    email: str = Field(default="", max_length=200)
-    phone: str = Field(default="", max_length=50)
-    linkedin_url: str = Field(default="", max_length=500)
-    github_url: str = Field(default="", max_length=500)
-    website_url: str = Field(default="", max_length=500)
-    city: str = Field(default="", max_length=200)
-
-
-class ProfileCandidate(BaseModel):
-    name: str = Field(default="", max_length=160)
-    summary: str = Field(default="", max_length=4000)
-
-
-class ProfileImportBody(BaseModel):
-    """Accepts any subset of fields - all are optional."""
-
-    candidate: ProfileCandidate = Field(default_factory=ProfileCandidate)
-    identity: ProfileIdentity = Field(default_factory=ProfileIdentity)
-    skills: list[ProfileSkill] = Field(default_factory=list)
-    experience: list[ProfileExperience] = Field(default_factory=list)
-    projects: list[ProfileProject] = Field(default_factory=list)
-    education: list[ProfileEntry] = Field(default_factory=list)
-    certifications: list[ProfileEntry] = Field(default_factory=list)
-    achievements: list[ProfileEntry] = Field(default_factory=list)
+# NOTE: POST /ingest/profile intentionally does NOT bind a strict Pydantic body.
+# Profile JSON shapes vary too much (grouped-dict skills, list stacks, alt keys),
+# and a strict model 422'd valid data before the tolerant normalizer could run.
+# The endpoint takes the raw JSON object; profile.normalization.normalize_profile_payload
+# coerces + bounds every field. Field caps that used to live on the removed
+# Profile* models are enforced there by truncation.
 
 
 def _read_profile_template(path: Path, logger) -> dict:
@@ -173,6 +144,11 @@ async def ingest(
         require_rate_limit(ingest_limiter)
         if file and file.filename and file.size and file.size > MAX_UPLOAD_SIZE:
             raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_SIZE // 1024 // 1024} MB)")
+        # Bound pasted text so an oversized paste can't pin the parser; the p
```

**File**: `backend/profile/normalization.py` (modified, +75/-13)
```diff
@@ -2,6 +2,7 @@
 import logging
 
 import re
+from collections.abc import Mapping
 from typing import Any
 from urllib.parse import unquote, urlparse
 
@@ -12,6 +13,49 @@
 # Re-exported here for backward compatibility with existing call sites.
 from data.skill_taxonomy import SKILL_CANONICAL
 
+_log = logging.getLogger(__name__)
+
+# Upper bounds on how many of each entry we keep. Generous — a power user's
+# profile can carry well over 100 skills — while still bounding graph/vector cost.
+MAX_SKILLS = 200
+MAX_PROJECTS = 80
+MAX_EDUCATION = 30
+MAX_TEXT_ENTRIES = 40
+
+
+def coerce_skills_shape(raw: Any) -> list[Any]:
+    """Coerce any reasonable ``skills`` shape into the flat list normalize_skills
+    expects, so real-world profile JSON never fails to import.
+
+    Handles: a grouped dict ``{"languages": ["Python"], "frontend": ["React"]}``
+    (category = group name), a flat string list ``["Python", "React"]``, a list of
+    ``{name,category}`` / alt-keyed dicts, and mixtures. Anything else -> ``[]``.
+    """
+    if isinstance(raw, Mapping):
+        out: list[Any] = []
+        for group, names in raw.items():
+            items = names if isinstance(names, list) else [names]
+            for name in items:
+                if isinstance(name, Mapping):
+                    entry = dict(name)
+                    entry.setdefault("category", str(group))
+                    out.append(entry)
+                elif name is not None and str(name).strip():
+                    out.append({"name": str(name), "category": str(group)})
+        return out
+    if isinstance(raw, list):
+        return raw
+    return []
+
+
+def _cap(value: Any, limit: int) -> str:
+    """Bound a free-text field to ``limit`` chars. Replaces the per-field
+    max_length caps that used to live on the (now-removed) Pydantic import model —
+    oversized values are truncated here rather than 422'd at the API boundary."""
+    text = str(value or "")
+    return text[:limit] if len(text) > limit else text
+
+
 # Precompile the whole-token alias patterns ONCE at import. The ingest skill-scan
 # runs this vocabulary against every project + experience description; the old code
 # rebuilt a fresh regex for each of the ~77 entries on every call.
@@ -155,7 +199,7 @@ def normalize_profile_payload(data: dict[str, Any]) -> dict[str, Any]:
     data = dict(data or {})
     candidate = _normalize_candidate(data.get("candidate") or data)
     identity = dict(data.get("identity") or {})
-    skills = normalize_skills(data.get("skills") or [])
+    skills = normalize_skills(coerce_skills_shape(data.get("skills")))
     experience = normalize_experiences(data.get("experience") or [])
     projects = normalize_projects(data.get("projects") or [], known_skills=[item["name"] for item in skills])
     education = normalize_education_entries(data.get("education") or [])
@@ -227,7 +271,11 @@ def normalize_skills(raw_items: list[Any]) -> list[dict[str, str]]:
     seen: set[str] = set()
     for raw in raw_items:
         item = _as_dict(raw)
-        value = item.get("name", item.get("n", raw if isinstance(raw, str) else ""))
+        value = (
+            item.get("name") or item.get("n") or item.get("skill")
+            or item.get("title") or item.get("label")
+            or (raw if isinstance(raw, str) else "")
+        )
         category = _clean_inline_text(item.get("category", item.get("cat", "general"))) or "general"
         for skill in split_skill_names(str(value or "")):
             if not _valid_skill(skill):
@@ -236,8 +284,10 @@ def normalize_skills(raw_items: list[Any]) -> list[dict[str, str]]:
             if key in seen:
                 continue
             seen.add(key)
-            out.append({"name": skill, "category": category})
-    return out[:100]
+            out.append({"name": _cap(skill, 160), "category": _cap(category, 80)})
+    if len(out) > MAX_SKILLS:
+        _log.warning("normalize_skills: truncating %d skills to %d", len(
```

**File**: `backend/tests/test_api.py` (modified, +38/-1)
```diff
@@ -988,12 +988,49 @@ def test_profile_import_valid_skills(self):
         self.assertEqual(resp.status_code, 200)
         self.assertGreaterEqual(resp.json()["stats"]["skills"], 0)
 
+    def test_profile_import_grouped_skills_dict(self):
+        # Bug: a grouped {category: [names]} skills object used to 422 at the
+        # rigid Pydantic gate. It must now import as real skills, categorized by
+        # group name — never a raw validation error.
+        resp = post(
+            "/api/v1/ingest/profile",
+            json={
+                "candidate": {"name": "Vasu"},
+                "skills": {
+                    "languages": ["Python", "TypeScript"],
+                    "frontend": ["React", "Vite"],
+                },
+                "projects": [{"title": "JustHireMe", "stack": ["Python", "React"]}],
+            },
+        )
+        self.assertEqual(resp.status_code, 200)
+        self.assertIn(resp.json().get("status"), {"ok", "partial"})
+
+    def test_profile_import_flat_string_skills(self):
+        # A flat list of skill strings is also accepted (no {name} wrapper needed).
+        resp = post(
+            "/api/v1/ingest/profile",
+            json={"skills": ["Python", "React", "PostgreSQL"]},
+        )
+        self.assertEqual(resp.status_code, 200)
+
+    def test_profile_import_not_a_json_object(self):
+        # A JSON array (not an object) is a clear 400 with a human message, not a
+        # Pydantic detail array.
+        resp = post("/api/v1/ingest/profile", json=["Python", "React"])
+        self.assertEqual(resp.status_code, 400)
+
     def test_profile_import_skill_name_too_long(self):
+        # Tolerant contract: an oversized/garbage skill name is accepted (never a
+        # raw 422) and simply not imported — the normalizer bounds/validates fields
+        # instead of the API boundary rejecting the whole payload.
         resp = post(
             "/api/v1/ingest/profile",
             json={"skills": [{"name": "x" * 200, "category": "language"}]},
         )
-        self.assertEqual(resp.status_code, 422)
+        self.assertEqual(resp.status_code, 200)
+        self.assertIn(resp.json().get("status"), {"ok", "partial"})
+        self.assertEqual(resp.json().get("stats", {}).get("skills"), 0)
 
     def test_profile_template_endpoint(self):
         resp = get("/api/v1/ingest/profile/template")
```

**File**: `backend/tests/test_ingestion_hardening.py` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+"""Ingestion pipeline hardening: tolerant profile shapes + input caps + zip-bomb guard.
+
+Unit-level (no DB/graph) so these run fast under the suite's global sqlite fake.
+"""
+
+from __future__ import annotations
+
+import io
+import zipfile
+
+import pytest
+
+from profile.normalization import (
+    MAX_SKILLS,
+    coerce_skills_shape,
+    normalize_profile_payload,
+    normalize_skills,
+)
+
+
+def _skill_names(payload: dict) -> list[str]:
+    return [s["name"] for s in payload["skills"]]
+
+
+class TestSkillsShapeTolerance:
+    def test_grouped_dict_flattens_to_categorized_skills(self):
+        out = normalize_profile_payload({
+            "skills": {"languages": ["Python", "TypeScript"], "frontend": ["React"]}
+        })
+        names = _skill_names(out)
+        assert "Python" in names and "React" in names
+        # category name must NOT leak in as a skill
+        assert "languages" not in [n.lower() for n in names]
+        cats = {s["name"]: s["category"] for s in out["skills"]}
+        assert cats.get("Python") == "languages"
+        assert cats.get("React") == "frontend"
+
+    def test_flat_string_list(self):
+        out = normalize_profile_payload({"skills": ["Python", "PostgreSQL"]})
+        assert "Python" in _skill_names(out)
+
+    def test_list_of_alt_keyed_dicts(self):
+        # skill dicts keyed 'skill'/'title'/'label' instead of 'name'
+        out = normalize_skills(coerce_skills_shape([
+            {"skill": "Python"}, {"title": "React"}, {"label": "Rust"},
+        ]))
+        got = {s["name"] for s in out}
+        assert {"Python", "React", "Rust"} <= got
+
+    def test_grouped_dict_with_scalar_values(self):
+        out = normalize_skills(coerce_skills_shape({"primary": "Python"}))
+        assert any(s["name"] == "Python" for s in out)
+
+    def test_grouped_dict_with_nested_dicts(self):
+        out = normalize_skills(coerce_skills_shape({"lang": [{"name": "Python"}]}))
+        assert any(s["name"] == "Python" and s["category"] == "lang" for s in out)
+
+    @pytest.mark.parametrize("garbage", [None, 42, "just a string", 3.14])
+    def test_non_list_non_dict_coerces_empty(self, garbage):
+        assert coerce_skills_shape(garbage) == []
+
+    def test_list_stack_project_is_accepted(self):
+        out = normalize_profile_payload({"projects": [{"title": "X", "stack": ["Python", "React"]}]})
+        assert out["projects"], "a project with a list stack must import"
+        assert "Python" in out["projects"][0]["stack"]
+
+    def test_skills_are_capped(self):
+        many = [f"Skill{i}" for i in range(MAX_SKILLS + 50)]
+        out = normalize_profile_payload({"skills": many})
+        assert len(out["skills"]) <= MAX_SKILLS
+
+
+class TestFieldCaps:
+    def test_oversized_summary_truncated_not_rejected(self):
+        out = normalize_profile_payload({"candidate": {"name": "A", "summary": "z" * 9000}})
+        assert len(out["candidate"]["summary"]) <= 4000
+
+    def test_oversized_experience_description_truncated(self):
+        out = normalize_profile_payload({
+            "experience": [{"role": "Engineer", "company": "Acme", "description": "d" * 9000}]
+        })
+        assert out["experience"], "experience should import"
+        assert len(out["experience"][0]["description"]) <= 5000
+
+
+class TestLinkedInZipBomb:
+    def _zip_with_member(self, name: str, size: int) -> bytes:
+        buf = io.BytesIO()
+        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
+            # highly compressible payload -> tiny archive, large decompressed size
+            zf.writestr(name, b"A" * size)
+        return buf.getvalue()
+
+    def test_oversized_member_rejected(self):
+        from profile.linkedin_parser import _MAX_CSV_MEMBER_BYTES, _read_csv
+
+        payload = self._zip_with_member("Skills.csv", _MAX_CSV_MEMBER_BYTES + 1)
+        with zipfile.ZipFile(io.BytesIO(payload)) as zf, pytest.raises(ValueError):
+            _read_cs
```

---

### Incident Patch 7: `9cd2dcdf` (2026-07-02)
**Commit Message**: fix(ci): ignore transitive quick-xml RUSTSEC advisories in cargo audit

The Dependency-audit job's `cargo audit` step fails on RUSTSEC-2026-0194 and
RUSTSEC-2026-0195 in quick-xml 0.39.x, pulled transitively via
tauri -> tauri-utils -> plist -> quick-xml. The fix is quick-xml >= 0.41.0, but
plist (latest 1.9.0) still requires `quick-xml ^0.39.2`, so the upgrade is
blocked upstream until tauri/plist move. main's lock carries the same
quick-xml 0.39.4, so this is a newly-published advisory that gates any fresh CI
run, not a regression from the deps bump. The affected path is Apple .plist
parsing inside Tauri's own bundling, not attacker-controlled input here, so the
DoS surface is negligible.

Add src-tauri/.cargo/audit.toml with a documented ignore for the two IDs
(picked up by the bare `cd src-tauri && cargo audit` in ci.yml and by local
runs) — mirroring the PIP_AUDIT_IGNORE_VULNS pattern for transitive Python ML
advisories. Remove once tauri/plist ship quick-xml >= 0.41.

**File**: `src-tauri/.cargo/audit.toml` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# cargo-audit configuration.
+#
+# These advisories are in `quick-xml` 0.39.x, pulled in transitively as
+# tauri -> tauri-utils -> plist -> quick-xml. The fix is quick-xml >= 0.41.0,
+# but `plist` (latest 1.9.0) still requires `quick-xml ^0.39.2`, so the upgrade
+# is blocked upstream until tauri/plist bump their quick-xml dependency. The
+# affected code path is Apple .plist parsing inside Tauri's own bundling/config,
+# not attacker-controlled input in this app, so the practical DoS surface is
+# negligible. Remove these entries once tauri/plist ship a quick-xml >= 0.41.
+#
+# Mirrors the PIP_AUDIT_IGNORE_VULNS pattern used for transitive Python ML
+# advisories in .github/workflows/{ci,release}.yml.
+[advisories]
+ignore = [
+    "RUSTSEC-2026-0194",  # quick-xml: quadratic run time on duplicate attribute names
+    "RUSTSEC-2026-0195",  # quick-xml: unbounded namespace-declaration allocation (DoS)
+]
```

---

### Incident Patch 8: `75fc3f6b` (2026-07-02)
**Commit Message**: fix(feedback): persist an exactly-0 recomputed match score, not the base

update_learning_scores wrote the match score as
`int(ranked.get("score") or ranked.get("base_score") or 0)`. Python's `or`
short-circuits on any falsy value, so a feedback recompute that legitimately
drove a low-base lead to a match score of exactly 0 (a strong negative
preference delta on a lead whose base match was <=12) persisted the higher
base_score instead of 0 — a silent wrong result for that edge. Fall back to
the base only when the caller supplied no score at all (key absent/None); a
computed 0 now survives as 0. Regression test drives b to exactly 0 via a
mocked preference delta and asserts it persists.

**File**: `backend/data/sqlite/leads.py` (modified, +5/-2)
```diff
@@ -289,8 +289,11 @@ def update_learning_scores(updates: list[tuple[str, dict, int]], db_path: str =
             int(ranked.get("learning_delta") or 0),
             str(ranked.get("learning_reason") or "")[:700],
             # Match score + its idempotency base (feedback re-rank). Fall back to the
-            # base so a caller that didn't compute a match delta never zeroes the score.
-            int(ranked.get("score") or ranked.get("base_score") or 0),
+            # base only when the caller didn't compute a match score at all (key
+            # absent/None) — a legitimately-computed score of exactly 0 (a strong
+            # negative feedback delta driving a low-base lead to the floor) must
+            # persist as 0, not silently revert to the higher base_score.
+            int(ranked["score"] if ranked.get("score") is not None else (ranked.get("base_score") or 0)),
             int(ranked.get("base_score") or 0),
             job_id,
         )
```

**File**: `backend/tests/test_feedback_recompute.py` (modified, +34/-0)
```diff
@@ -115,6 +115,34 @@ def _run(script: str, tmp_path) -> subprocess.CompletedProcess:
 """
 
 
+_MATCH_ZERO = """
+import sys
+sys.path.insert(0, "backend")
+from unittest import mock
+from data.sqlite.connection import init_sql
+init_sql()
+from data.sqlite.leads import save_lead, save_lead_feedback, update_lead_score, get_lead_by_id
+from ranking.service import RankingService
+
+save_lead({"job_id": "a", "title": "Registered Nurse", "platform": "greenhouse",
+           "url": "https://x/a", "signal_score": 50, "kind": "job", "status": "matched"})
+save_lead_feedback("a", "not_relevant", "")   # an example must exist or recompute no-ops
+save_lead({"job_id": "b", "title": "Line Cook", "platform": "greenhouse",
+           "url": "https://x/b", "signal_score": 40, "kind": "job", "status": "matched"})
+update_lead_score("b", 10, "weak base match", [], [], preserve_status=True)  # low base match = 10
+
+rs = RankingService()
+# Strong negative preference delta drives b's match score to exactly 0.
+with mock.patch("ranking.feedback_semantic.preference_deltas", return_value={"b": -10, "a": -10}):
+    rs._recompute_feedback_signals(500)
+persisted = int(get_lead_by_id("b")["score"])
+# The regression: `0 or base_score` used to short-circuit and persist the base (10);
+# a legitimately-computed match score of exactly 0 must survive as 0.
+assert persisted == 0, persisted
+print("MATCH_ZERO_OK")
+"""
+
+
 def test_feedback_recompute_reranks_open_leads(tmp_path):
     result = _run(_RERANK, tmp_path)
     assert result.returncode == 0, result.stderr
@@ -127,6 +155,12 @@ def test_feedback_reranks_match_score_idempotently(tmp_path):
     assert "MATCH_RERANK_OK" in result.stdout
 
 
+def test_feedback_reranks_match_score_to_exactly_zero(tmp_path):
+    result = _run(_MATCH_ZERO, tmp_path)
+    assert result.returncode == 0, result.stderr
+    assert "MATCH_ZERO_OK" in result.stdout
+
+
 def test_recompute_is_noop_without_feedback(tmp_path):
     result = _run(_NOOP, tmp_path)
     assert result.returncode == 0, result.stderr
```

---

### Incident Patch 9: `411ec30a` (2026-07-02)
**Commit Message**: fix(discovery): clean role query + strict aggregator title-match for relevant results

A real scan surfaced that profile-derived search terms were noisy: the query became
"Applied AI Engineer Full-Stack Engineer — Internal Finance & P&L Platform"
(summary + a project-laden experience title + an em-dash mojibake), so the keyless
aggregator returned unrelated German sales/admin roles that the quality gate then
filtered to nothing. Fix:
- _clean_role_query(): reduce the profile terms to a short, clean role phrase — cut
  at project/detail separators (space-dashes, punctuation, "at"), treat non-ASCII as
  a boundary, drop filler ("summary"/"profile"), keep internal hyphens (Full-Stack).
- Arbeitnow: match the role against the job TITLE only, not tags (a tag-based match
  let "Technical Sales Support" tagged "engineering" through).
Verified against the live profile: query "Applied AI Engineer", aggregator now
returns real engineer roles (Software/Backend/Java/Network Engineer + 40 from Muse).

**File**: `backend/core/config.py` (modified, +29/-2)
```diff
@@ -194,6 +194,31 @@ def profile_for_discovery(profile: dict | None, cfg: dict) -> dict:
     return profile
 
 
+def _clean_role_query(terms: list[str]) -> str:
+    """A short, clean ROLE phrase for the aggregator/community search queries.
+
+    Profile-derived terms are noisy — a summary like "Applied AI Engineer. Engineer
+    Summary" or an experience title like "Full-Stack Engineer — Internal Finance & P&L
+    Platform" would make a keyless job API return unrelated results (that then get
+    quality-gated to nothing). Strip project/detail suffixes, encoding artifacts and
+    filler words, and return the first genuine 1-5 word role phrase.
+    """
+    for term in terms:
+        # Non-ASCII noise (incl. mojibake em-dashes) becomes a separator, not deleted,
+        # so "Full-Stack Engineer — Internal Finance" cuts cleanly to the role.
+        s = re.sub(r"[^\x20-\x7e]+", " | ", str(term))
+        # Cut at the first separator introducing a project/detail. Only a SPACE-padded
+        # dash counts (so "Full-Stack"/"Front-End" keep their internal hyphen).
+        head = re.split(r"\s+[-—–]\s+|[|(:·•/]|\.\s+|\bat\b", s, maxsplit=1)[0]
+        head = re.sub(r"\b(summary|profile|resume|cv|experience)\b", " ", head, flags=re.I)
+        head = re.sub(r"\s+", " ", head).strip(" ,.-&")
+        words = head.split()
+        if head and 1 <= len(words) <= 5:
+            return head
+    first = (terms[0] if terms else "").strip()
+    return " ".join(first.split()[:4]) or "jobs"
+
+
 def terms_for_discovery(profile: dict, limit: int = 4) -> list[str]:
     terms: list[str] = []
     summary = str(profile.get("desired_position") or profile.get("s") or "").strip()
@@ -278,8 +303,10 @@ def has_explicit_discovery_targets(cfg: dict | None) -> bool:
 def profile_free_source_targets(profile: dict) -> str:
     if not has_profile_discovery_signal(profile):
         return ""
-    terms = terms_for_discovery(profile, 3)
-    role_query = " ".join(terms[:2])
+    terms = terms_for_discovery(profile, 4)
+    # A clean, focused role phrase drives the keyless aggregator + community search;
+    # the raw concatenated terms produced unrelated results that got gate-filtered away.
+    role_query = _clean_role_query(terms)
     location = str((profile or {}).get("_discovery_location") or "").strip()
     lines = [
         # Keyless structured aggregator FIRST: real jobs for the candidate's role in
```

**File**: `backend/discovery/sources/aggregator.py` (modified, +4/-2)
```diff
@@ -116,8 +116,10 @@ async def _fetch_arbeitnow(role_terms: list[str]) -> list[dict]:
         if not title or not url:
             continue
         tags = job.get("tags") or []
-        haystack = " ".join([title, " ".join(str(t) for t in tags if t)])
-        if not _matches_role(haystack, role_terms):
+        # Match the TITLE (not tags): Arbeitnow is a broad, Germany-heavy feed and a
+        # tag-based match let unrelated roles ("Technical Sales Support" tagged
+        # "engineering") through. The role phrase must be in the actual job title.
+        if not _matches_role(title, role_terms):
             continue
         location = str(job.get("location") or "").strip()
         remote = "remote" if job.get("remote") else ""
```

**File**: `backend/tests/test_discovery_backbone.py` (modified, +13/-0)
```diff
@@ -50,6 +50,19 @@ def test_profile_free_source_targets_are_zero_config_and_adaptive():
     assert not any(x.startswith("ats:") for x in nurse_lines)   # but no tech ATS flood
 
 
+def test_clean_role_query_strips_noise():
+    from core.config import _clean_role_query
+    # project-laden title + em-dash separator -> just the role phrase (internal hyphen kept)
+    assert _clean_role_query(["Full-Stack Engineer — Internal Finance & P&L Platform"]) == "Full-Stack Engineer"
+    # non-ASCII/mojibake acts as a separator, not deleted
+    assert _clean_role_query(["Full-Stack Engineer � Internal Finance"]) == "Full-Stack Engineer"
+    # summary filler dropped, sentence split on ". "
+    assert _clean_role_query(["Applied AI Engineer. Engineer Summary"]) == "Applied AI Engineer"
+    # falls through to the next usable term when the first is empty after cleaning
+    assert _clean_role_query(["", "Registered Nurse"]) == "Registered Nurse"
+    assert _clean_role_query([]) == "jobs"
+
+
 def test_aggregator_target_parsing_and_category_mapping():
     assert agg._muse_category(agg._role_terms("registered nurse icu")) == "Healthcare"
     assert agg._muse_category(agg._role_terms("senior software engineer")) == "Software Engineering"
```

---

### Incident Patch 10: `65c4764b` (2026-07-02)
**Commit Message**: fix(generation): field-neutral fallback resume/cover (no hardcoded software leak)

The deterministic fallback (used when the LLM is unavailable) hardcoded software
language — "Software Engineer" role default, and a cover letter claiming "production
systems using technologies central to your stack" and "the tools and patterns your
team uses daily" — so a nurse/lawyer/teacher's fallback documents read as software.
Derive the role from the JD title / candidate's own target role, and rewrite the
cover template in field-neutral language. Verified: a nurse fallback cover/resume
has zero software leaks.

**File**: `backend/generation/generators/resume.py` (modified, +23/-4)
```diff
@@ -137,8 +137,23 @@ def _prioritized_skills(profile: dict, lead: dict, limit: int = 28) -> list[str]
     return _compact_list([*exact, *fuzzy, *rest], limit)
 
 
+def _fallback_role(profile: dict, lead: dict) -> str:
+    """Field-neutral role label: the JD title, else the candidate's own target role /
+    summary, else a neutral phrase — never a hardcoded 'Software Engineer'."""
+    title = str(lead.get("title") or "").strip()
+    if title:
+        return title
+    desired = str(profile.get("desired_position") or "").strip()
+    if desired:
+        return desired
+    summary = str(profile.get("s") or "").strip()
+    if summary:
+        return summary.split(".")[0].split(",")[0].strip()[:60] or "the advertised role"
+    return "the advertised role"
+
+
 def _role_headline(profile: dict, lead: dict, skills: list[str]) -> str:
-    target = _safe_text(str(lead.get("title") or "Software Engineer").strip()) or "Software Engineer"
+    target = _safe_text(_fallback_role(profile, lead)) or "the advertised role"
     summary = _safe_summary(str(profile.get("s") or "").strip())
     if summary:
         first = _clean_sentence(summary).rstrip(".")
@@ -331,7 +346,7 @@ def _fallback_package(profile: dict, lead: dict, template: str = "") -> _DocPack
     selected = _rank_projects(profile, lead, limit=2)
     name = profile.get("n") or "Candidate"
     identity: dict = profile.get("identity") if isinstance(profile.get("identity"), dict) else {}
-    title = _safe_text(str(lead.get("title") or "Software Engineer")) or "Software Engineer"
+    title = _safe_text(_fallback_role(profile, lead)) or "the advertised role"
     company = _safe_text(str(lead.get("company") or "the company")) or "the company"
     skills_raw = profile.get("skills", [])
     education = profile.get("education", [])
@@ -417,11 +432,15 @@ def _fallback_package(profile: dict, lead: dict, template: str = "") -> _DocPack
         resume += f"\n## EDUCATION\n{edu_lines}\n"
 
     all_skills = prioritized_skills
+    # Field-neutral fallback: no hardcoded "software engineering" / "stack" / "production
+    # systems" language, so a nurse/lawyer/teacher's fallback cover letter reads correctly.
+    background = ", ".join(all_skills[:5]) if all_skills else (_safe_text(str(profile.get("s") or "").strip()) or "this field")
+    recent = ", ".join(p.get("title", "a key project") for p in selected[:3]) if selected else "relevant work in this field"
     cover = f"""Dear {company} team,
 
-I am writing to apply for the {title} position at {company}. My background in {", ".join(all_skills[:5]) if all_skills else "software engineering"} aligns directly with the requirements outlined in your posting.
+I am writing to apply for the {title} position at {company}. My background in {background} aligns directly with the requirements outlined in your posting.
 
-In my recent work, I have built and shipped {", ".join(p.get('title','Project') for p in selected[:3]) if selected else "production systems"} using technologies central to your stack. These projects demonstrate hands-on experience with the tools and patterns your team uses daily.
+In my recent work on {recent}, I have built directly relevant experience and a track record of delivering the outcomes your team is looking for.
 
 I would welcome the opportunity to discuss how my experience maps to your needs. Thank you for your consideration.
 
```

#### Recent Merged Pull Requests:
- **PR #194** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 15 updates (@dependabot[bot])
- **PR #193** (closed): chore(deps): bump the cargo-minor-and-patch group across 1 directory with 7 updates (@dependabot[bot])
- **PR #192** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 14 updates (@dependabot[bot])
- **PR #191** (closed): chore(deps): bump the cargo-minor-and-patch group across 1 directory with 6 updates (@dependabot[bot])
- **PR #190** (closed): fix(scripts): create sidecar-manifest.json stub in prepare-sidecar-placeholder (@JimmyNewtron711)
- **PR #188** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 13 updates (@dependabot[bot])
- **PR #186** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 14 updates (@dependabot[bot])
- **PR #183** (closed): chore(deps): bump the npm-minor-and-patch group across 1 directory with 12 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
