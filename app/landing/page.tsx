'use client'

import { useEffect, useState } from 'react'

type Tier = {
  name: string
  lim: string
  m: number
  y: number
  pop?: boolean
  feats: string[]
}

const DATA: Record<'site' | 'agency', Tier[]> = {
  site: [
    { name: 'Small', lim: 'Up to 25 workers', m: 49, y: 41, feats: ['QR verify & sign in/out', 'Digital inductions', 'Live attendance', 'Expiry alerts'] },
    { name: 'Medium', lim: 'Up to 75 workers', m: 79, y: 66, pop: true, feats: ['Everything in Small', 'Two-way messaging', 'Photo & drawing sharing', 'Priority support'] },
    { name: 'Large', lim: 'Up to 250 workers', m: 139, y: 115, feats: ['Everything in Medium', 'Multi-crew dashboard', 'Full compliance export', 'Audit trail'] },
    { name: 'Unlimited', lim: 'No worker cap', m: 249, y: 207, feats: ['Everything in Large', 'No limits', 'Megaproject ready', 'Dedicated onboarding'] },
  ],
  agency: [
    { name: 'Small', lim: 'Up to 50 workers', m: 79, y: 66, feats: ['Full data on one scan', 'CSCS, quals, NI, bank', 'Place & pay ready', 'Worker consent built in'] },
    { name: 'Medium', lim: 'Up to 150 workers', m: 149, y: 124, pop: true, feats: ['Everything in Small', 'Multi-site placements', 'Bulk worker import', 'Priority support'] },
    { name: 'Large', lim: 'Up to 500 workers', m: 299, y: 249, feats: ['Everything in Medium', 'Workforce analytics', 'Compliance reporting', 'Account manager'] },
    { name: 'Enterprise', lim: 'Unlimited workforce', m: 499, y: 415, feats: ['Everything in Large', 'No limits', 'Custom integrations', 'Dedicated onboarding'] },
  ],
}

const CSS = `
.nk{
  --ink:#0b1020;--ink-2:#11182e;--blue:#2563ff;--blue-bright:#4d7bff;--amber:#ffb302;
  --paper:#f6f7fb;--paper-2:#eceef6;--line:rgba(11,16,32,.10);--line-d:rgba(255,255,255,.10);
  --muted:#5b6479;--muted-d:#9aa3bd;--white:#fff;--r:18px;
  font-family:'DM Sans',sans-serif;background:var(--paper);color:var(--ink);line-height:1.55;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;position:relative;
}
.nk *{box-sizing:border-box;margin:0;padding:0}
.nk h1,.nk h2,.nk h3,.nk .syne{font-family:'Syne',sans-serif;letter-spacing:-.02em;line-height:1.02}
.nk a{color:inherit;text-decoration:none}
.nk .wrap{max-width:1180px;margin:0 auto;padding:0 28px}
.nk .hl{background:linear-gradient(180deg,transparent 62%,rgba(255,179,2,.55) 0)}
.nk .grid-bg{position:absolute;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(circle at 70% 0%,#000 0%,transparent 70%);opacity:.6}
.nk nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(12px);background:rgba(246,247,251,.78);border-bottom:1px solid var(--line)}
.nk .nav-inner{display:flex;align-items:center;justify-content:space-between;height:68px}
.nk .logo{display:flex;align-items:center;gap:10px;font-family:'Syne';font-weight:800;font-size:21px;letter-spacing:-.03em}
.nk .logo .mark{height:30px;width:auto;flex:none}
.nk .nav-links{display:flex;align-items:center;gap:30px;font-size:15px;font-weight:500;color:var(--muted)}
.nk .nav-links a:hover{color:var(--ink)}
.nk .btn{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-family:'DM Sans';border-radius:11px;padding:11px 20px;font-size:15px;cursor:pointer;border:0;transition:transform .15s ease,box-shadow .2s ease,background .2s}
.nk .btn-primary{background:var(--ink);color:#fff}
.nk .btn-blue{background:var(--blue);color:#fff}
.nk .btn-blue:hover{transform:translateY(-2px);box-shadow:0 14px 34px -10px rgba(37,99,255,.6)}
.nk .btn-ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.nk .btn-ghost:hover{border-color:var(--ink)}
.nk .hero{position:relative;z-index:1;padding:74px 0 60px}
.nk .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:54px;align-items:center}
.nk .eyebrow{display:inline-flex;align-items:center;gap:9px;font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--blue);background:rgba(37,99,255,.09);border:1px solid rgba(37,99,255,.2);padding:7px 14px;border-radius:100px;margin-bottom:24px}
.nk .eyebrow .dot{width:7px;height:7px;border-radius:50%;background:var(--blue);box-shadow:0 0 0 4px rgba(37,99,255,.18)}
.nk h1.hero-title{font-size:clamp(40px,5.4vw,68px);font-weight:800}
.nk .hero p.sub{font-size:19px;color:var(--muted);margin:22px 0 30px;max-width:520px}
.nk .hero-cta{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.nk .trust{display:flex;align-items:center;gap:22px;margin-top:30px;font-size:13.5px;color:var(--muted);flex-wrap:wrap}
.nk .trust b{color:var(--ink);font-weight:600}
.nk .trust .sep{width:1px;height:16px;background:var(--line)}
.nk .phone{width:300px;margin:0 auto;background:var(--ink);border-radius:38px;padding:12px;box-shadow:0 40px 80px -30px rgba(11,16,32,.6),0 0 0 1px rgba(11,16,32,.1);position:relative}
.nk .phone .screen{background:var(--white);border-radius:28px;overflow:hidden}
.nk .ph-top{background:var(--ink);color:#fff;padding:18px 18px 16px}
.nk .ph-top .nm{font-family:'Syne';font-weight:700;font-size:17px}
.nk .ph-top .rl{font-size:11.5px;color:var(--muted-d);margin-top:2px}
.nk .ph-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(43,209,121,.16);color:#23b56b;font-size:11px;font-weight:600;padding:5px 9px;border-radius:7px;margin-top:12px}
.nk .ph-badge .d{width:6px;height:6px;border-radius:50%;background:#27c46f}
.nk .ph-body{padding:16px}
.nk .ph-card{border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:10px;display:flex;align-items:center;gap:11px}
.nk .ph-ic{width:34px;height:34px;border-radius:9px;flex:none;display:grid;place-items:center;font-size:16px}
.nk .ph-card .t{font-weight:600;font-size:13px}
.nk .ph-card .s{font-size:11px;color:var(--muted)}
.nk .ph-card .pill{margin-left:auto;font-size:10px;font-weight:600;padding:4px 8px;border-radius:6px}
.nk .pill-ok{background:rgba(43,209,121,.14);color:#1f9e5d}
.nk .pill-soon{background:rgba(255,179,2,.18);color:#a9760a}
.nk .float-tag{position:absolute;background:#fff;border:1px solid var(--line);border-radius:13px;padding:11px 14px;box-shadow:0 18px 40px -18px rgba(11,16,32,.4);font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:9px}
.nk .float-tag .ic{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;font-size:15px;flex:none}
.nk .ft-1{top:18px;left:-26px;animation:nkbob 5s ease-in-out infinite}
.nk .ft-2{bottom:40px;right:-30px;animation:nkbob 5s ease-in-out infinite .8s}
@keyframes nkbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
.nk .mock{position:relative}
.nk .cdm{position:relative;z-index:1;background:var(--ink);color:#fff;border-radius:var(--r);padding:30px 34px;margin:14px 0 0;display:flex;align-items:center;gap:26px;overflow:hidden}
.nk .cdm::after{content:"";position:absolute;right:-40px;top:-40px;width:220px;height:220px;background:repeating-linear-gradient(45deg,var(--amber) 0 14px,#0b1020 14px 28px);opacity:.16;border-radius:50%}
.nk .cdm .reg{font-family:'Syne';font-weight:800;font-size:13px;letter-spacing:.04em;color:var(--amber);background:rgba(255,179,2,.12);border:1px solid rgba(255,179,2,.3);padding:8px 13px;border-radius:9px;flex:none}
.nk .cdm p{font-size:16px;color:var(--muted-d);max-width:760px}
.nk .cdm p b{color:#fff;font-weight:600}
.nk section.blk{position:relative;z-index:1;padding:80px 0}
.nk .sec-head{max-width:640px;margin-bottom:46px}
.nk .kicker{font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--blue);margin-bottom:14px}
.nk h2.sec-title{font-size:clamp(30px,3.6vw,44px);font-weight:800}
.nk .sec-head p{color:var(--muted);font-size:18px;margin-top:16px}
.nk .prob-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.nk .prob{background:var(--white);border:1px solid var(--line);border-radius:var(--r);padding:28px;position:relative}
.nk .prob .x{font-family:'Syne';font-weight:800;color:#e0573e;font-size:15px;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.nk .prob h3{font-size:19px;font-weight:700;margin-bottom:8px}
.nk .prob p{color:var(--muted);font-size:15px}
.nk .feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.nk .feat{background:var(--white);border:1px solid var(--line);border-radius:var(--r);padding:26px;transition:transform .2s ease,box-shadow .25s ease,border-color .2s}
.nk .feat:hover{transform:translateY(-4px);box-shadow:0 24px 50px -28px rgba(11,16,32,.4);border-color:rgba(37,99,255,.35)}
.nk .feat .fic{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;font-size:22px;margin-bottom:16px;background:var(--paper-2)}
.nk .feat h3{font-size:18px;font-weight:700;margin-bottom:7px}
.nk .feat p{color:var(--muted);font-size:14.5px}
.nk .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.nk .step{position:relative;padding-top:18px}
.nk .step .no{font-family:'Syne';font-weight:800;font-size:54px;color:var(--paper-2);line-height:1;position:absolute;top:-12px;right:0}
.nk .step .bar{width:42px;height:4px;background:var(--blue);border-radius:3px;margin-bottom:18px}
.nk .step h3{font-size:20px;font-weight:700;margin-bottom:9px;position:relative;z-index:1}
.nk .step p{color:var(--muted);font-size:15px}
.nk .price-controls{display:flex;flex-direction:column;align-items:center;gap:20px;margin-bottom:42px}
.nk .seg{display:inline-flex;background:var(--paper-2);border-radius:13px;padding:5px;gap:4px}
.nk .seg button{border:0;background:transparent;font-family:'DM Sans';font-weight:600;font-size:14.5px;padding:9px 22px;border-radius:9px;cursor:pointer;color:var(--muted);transition:.18s}
.nk .seg button.on{background:#fff;color:var(--ink);box-shadow:0 2px 8px -2px rgba(11,16,32,.2)}
.nk .bill-toggle{display:inline-flex;align-items:center;gap:13px;font-size:14.5px;font-weight:500;color:var(--muted)}
.nk .switch{width:50px;height:28px;border-radius:100px;background:var(--ink);position:relative;cursor:pointer;transition:.2s}
.nk .switch::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:.2s}
.nk .switch.year{background:var(--blue)}
.nk .switch.year::after{left:25px}
.nk .save-tag{font-size:12px;font-weight:600;color:#1f9e5d;background:rgba(43,209,121,.14);padding:4px 10px;border-radius:7px}
.nk .tiers{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;align-items:stretch}
.nk .tier{background:var(--white);border:1px solid var(--line);border-radius:var(--r);padding:26px 22px;display:flex;flex-direction:column;position:relative;transition:transform .2s,box-shadow .25s}
.nk .tier:hover{transform:translateY(-4px);box-shadow:0 24px 54px -30px rgba(11,16,32,.45)}
.nk .tier.pop{border:1.5px solid var(--ink);box-shadow:0 24px 54px -28px rgba(11,16,32,.4)}
.nk .tier .poptag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--amber);color:var(--ink);font-family:'Syne';font-weight:700;font-size:11px;letter-spacing:.05em;padding:5px 13px;border-radius:8px}
.nk .tier .tname{font-family:'Syne';font-weight:700;font-size:18px}
.nk .tier .tlim{font-size:13px;color:var(--muted);margin-top:4px;min-height:18px}
.nk .tier .tprice{margin:18px 0 4px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:42px;line-height:1;letter-spacing:-.02em;font-feature-settings:"tnum" 1}
.nk .tier .tprice small{font-size:15px;font-weight:500;color:var(--muted);font-family:'DM Sans'}
.nk .tier .tann{font-size:12.5px;color:var(--muted);min-height:18px}
.nk .tier ul{list-style:none;margin:18px 0 22px;display:flex;flex-direction:column;gap:9px}
.nk .tier li{font-size:13.5px;display:flex;align-items:flex-start;gap:9px;color:#39405a}
.nk .tier li .ck{color:var(--blue);font-weight:700;flex:none;margin-top:1px}
.nk .tier .btn{margin-top:auto;justify-content:center;width:100%}
.nk .free-row{margin-top:20px;background:linear-gradient(100deg,var(--ink),var(--ink-2));color:#fff;border-radius:var(--r);padding:24px 30px;display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.nk .free-row .tag{font-family:'Syne';font-weight:800;font-size:13px;color:var(--ink);background:var(--amber);padding:7px 13px;border-radius:9px;flex:none}
.nk .free-row p{font-size:15.5px;color:var(--muted-d)}
.nk .free-row p b{color:#fff;font-weight:600}
.nk .price-note{text-align:center;color:var(--muted);font-size:13.5px;margin-top:22px}
.nk .cta{position:relative;z-index:1;margin:30px 0 70px}
.nk .cta-box{background:linear-gradient(135deg,var(--blue),#1742c9);border-radius:26px;padding:60px 40px;text-align:center;color:#fff;position:relative;overflow:hidden}
.nk .cta-box::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(circle at 50% 120%,#000,transparent 70%)}
.nk .cta-box h2{font-size:clamp(30px,4vw,46px);font-weight:800;position:relative}
.nk .cta-box p{font-size:18px;color:rgba(255,255,255,.85);margin:16px auto 30px;max-width:480px;position:relative}
.nk .cta-box .btn{position:relative}
.nk .btn-amber{background:var(--amber);color:var(--ink)}
.nk .btn-amber:hover{transform:translateY(-2px);box-shadow:0 16px 40px -12px rgba(255,179,2,.6)}
.nk .btn-white-line{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.4)}
.nk .btn-white-line:hover{background:rgba(255,255,255,.16)}
.nk footer{position:relative;z-index:1;border-top:1px solid var(--line);padding:40px 0 50px}
.nk .foot-grid{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap}
.nk .foot-links{display:flex;gap:24px;font-size:14px;color:var(--muted)}
.nk .foot-links a:hover{color:var(--ink)}
.nk .foot-copy{font-size:13.5px;color:var(--muted)}
.nk .rv{opacity:0;transform:translateY(22px);transition:opacity .7s ease,transform .7s ease}
.nk .rv.in{opacity:1;transform:none}
@media(max-width:920px){
  .nk .hero-grid{grid-template-columns:1fr;gap:36px}
  .nk .mock{display:none}
  .nk .prob-grid,.nk .feat-grid,.nk .steps,.nk .tiers{grid-template-columns:1fr}
  .nk .feat-grid{grid-template-columns:1fr 1fr}
  .nk .nav-links a:not(.btn){display:none}
  .nk .cdm{flex-direction:column;align-items:flex-start;gap:16px}
}
@media(max-width:560px){
  .nk .wrap{padding:0 18px}
  .nk .feat-grid{grid-template-columns:1fr}
  .nk .trust .sep{display:none}
  .nk .free-row{flex-direction:column;align-items:flex-start}
}
`

export default function LandingPage() {
  const [aud, setAud] = useState<'site' | 'agency'>('site')
  const [year, setYear] = useState(false)

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.nk .rv').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const tiers = DATA[aud]
  const onLabel = { color: 'var(--ink)', fontWeight: 600 } as const

  return (
    <div className="nk">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="grid-bg" />

      <nav>
        <div className="wrap nav-inner">
          <div className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nekaid-logo.png" alt="NekaID" className="mark" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display="none"}} />
            NekaID
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="/login" className="btn btn-ghost">Login</a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap hero-grid">
          <div className="rv in">
            <span className="eyebrow"><span className="dot" />Live on UK construction sites</span>
            <h1 className="hero-title">The digital passport that gets workers <span className="hl">on site, signed in, compliant.</span></h1>
            <p className="sub">CSCS cards, qualifications, Right to Work and inductions — in one phone passport. Scan a QR, see compliance instantly. No more paper forms in a folder no one reads.</p>
            <div className="hero-cta">
              <a href="/login" className="btn btn-blue">Start free for 14 days →</a>
              <a href="#how" className="btn btn-ghost">See how it works</a>
            </div>
            <div className="trust">
              <span><b>Real workers</b> on site today</span>
              <span className="sep" />
              <span><b>CDM 2015</b> aligned</span>
              <span className="sep" />
              <span><b>No card</b> for the trial</span>
            </div>
          </div>

          <div className="mock rv in">
            <div className="float-tag ft-1"><span className="ic" style={{ background: 'rgba(43,209,121,.16)' }}>✓</span>Signed in · 07:42</div>
            <div className="float-tag ft-2"><span className="ic" style={{ background: 'rgba(37,99,255,.14)' }}>⤿</span>Induction complete</div>
            <div className="phone">
              <div className="screen">
                <div className="ph-top">
                  <div className="nm">Sample Worker</div>
                  <div className="rl">Groundworker · CSCS Blue</div>
                  <span className="ph-badge"><span className="d" />Compliant · on site</span>
                </div>
                <div className="ph-body">
                  <div className="ph-card"><span className="ph-ic" style={{ background: 'rgba(37,99,255,.12)' }}>🪪</span><div><div className="t">CSCS Card</div><div className="s">Exp. 11 Mar 2027</div></div><span className="pill pill-ok">Valid</span></div>
                  <div className="ph-card"><span className="ph-ic" style={{ background: 'rgba(255,179,2,.16)' }}>🎓</span><div><div className="t">First Aid at Work</div><div className="s">Exp. 02 Jul 2026</div></div><span className="pill pill-soon">28 days</span></div>
                  <div className="ph-card"><span className="ph-ic" style={{ background: 'rgba(43,209,121,.14)' }}>📋</span><div><div className="t">Site Induction</div><div className="s">Plot 4 — completed</div></div><span className="pill pill-ok">Done</span></div>
                  <div className="ph-card"><span className="ph-ic" style={{ background: 'rgba(37,99,255,.12)' }}>📍</span><div><div className="t">Attendance</div><div className="s">In since 07:42</div></div><span className="pill pill-ok">Live</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="wrap">
          <div className="cdm rv">
            <span className="reg">CDM 2015</span>
            <p><b>The law already expects this.</b> Principal contractors must check competence and keep workers informed of site risks. NekaID makes that an audit trail you can pull up in seconds — not a box of signed sheets.</p>
          </div>
        </div>
      </header>

      <section className="blk" id="problem">
        <div className="wrap">
          <div className="sec-head rv">
            <div className="kicker">The problem</div>
            <h2 className="sec-title">Paper doesn&apos;t survive a building site.</h2>
            <p>Inductions get lost, cards expire unnoticed, and when an HSE inspector turns up you&apos;re digging through folders. Compliance shouldn&apos;t be a filing exercise.</p>
          </div>
          <div className="prob-grid">
            <div className="prob rv"><div className="x">✕ Today</div><h3>Folders no one reads</h3><p>Induction sheets and card photocopies pile up in the cabin. Finding one worker&apos;s record takes ten minutes you don&apos;t have.</p></div>
            <div className="prob rv"><div className="x">✕ Today</div><h3>Cards expire silently</h3><p>A CSCS card lapses and nobody notices until an inspection — or an incident. The risk sits hidden until it&apos;s too late.</p></div>
            <div className="prob rv"><div className="x">✕ Today</div><h3>Sign-in by clipboard</h3><p>Who&apos;s on site right now? In an evacuation, a paper sheet at the gate is the difference between a head count and a guess.</p></div>
            <div className="prob rv"><div className="x">✕ Today</div><h3>No single source of truth</h3><p>Quals on one system, attendance on another, messages on WhatsApp. Nothing joins up, nothing&apos;s auditable.</p></div>
          </div>
        </div>
      </section>

      <section className="blk" id="features" style={{ background: 'var(--paper-2)' }}>
        <div className="wrap">
          <div className="sec-head rv">
            <div className="kicker">What you get</div>
            <h2 className="sec-title">One passport. The whole site, sorted.</h2>
            <p>Everything a worker carries and everything a site needs to prove compliance — in a phone app workers actually keep installed.</p>
          </div>
          <div className="feat-grid">
            <div className="feat rv"><div className="fic">🪪</div><h3>Worker passport</h3><p>CSCS, qualifications, Right to Work and certificate photos in one place. Built once, carried site to site.</p></div>
            <div className="feat rv"><div className="fic">📲</div><h3>QR scan to verify</h3><p>Scan a worker&apos;s code and see live compliance instantly. The view adapts to whether you&apos;re a site or an agency.</p></div>
            <div className="feat rv"><div className="fic">📍</div><h3>GPS sign in / out</h3><p>Tap to sign in. Automatic sign-out by geofence when a worker leaves site. Accurate attendance, no clipboard.</p></div>
            <div className="feat rv"><div className="fic">📋</div><h3>Digital inductions</h3><p>Send safety and site inductions through the app. Completion shows on the worker&apos;s passport the moment it&apos;s done.</p></div>
            <div className="feat rv"><div className="fic">🔔</div><h3>Expiry alerts</h3><p>Managers get a push and email 30 and 7 days before any card or qualification expires. Never caught out again.</p></div>
            <div className="feat rv"><div className="fic">💬</div><h3>Two-way messaging</h3><p>Text, photos and drawings between managers and workers, with push notifications. Site comms that stay on record.</p></div>
          </div>
        </div>
      </section>

      <section className="blk" id="how">
        <div className="wrap">
          <div className="sec-head rv">
            <div className="kicker">How it works</div>
            <h2 className="sec-title">Up and running before the morning brief.</h2>
          </div>
          <div className="steps">
            <div className="step rv"><div className="no">01</div><div className="bar" /><h3>Worker builds a passport</h3><p>They add their details, CSCS card and qualifications once. It lives on their phone as an installed app.</p></div>
            <div className="step rv"><div className="no">02</div><div className="bar" /><h3>Site scans the QR</h3><p>One scan shows compliance, runs the induction and signs them in. Agencies see the fuller picture they need to place and pay.</p></div>
            <div className="step rv"><div className="no">03</div><div className="bar" /><h3>You stay compliant</h3><p>Live attendance, induction records and expiry alerts roll up to your dashboard — and your director sees every site, free.</p></div>
          </div>
        </div>
      </section>

      <section className="blk" id="pricing" style={{ background: 'var(--paper-2)' }}>
        <div className="wrap">
          <div className="sec-head rv" style={{ margin: '0 auto 32px', textAlign: 'center', maxWidth: 680 }}>
            <div className="kicker">Pricing</div>
            <h2 className="sec-title">Simple per-site pricing. Workers always free.</h2>
            <p style={{ marginLeft: 'auto', marginRight: 'auto' }}>Pick what fits your site or agency. The decision-maker&apos;s view is free — so the whole company can see the value before rolling out.</p>
          </div>

          <div className="price-controls rv">
            <div className="seg">
              <button className={aud === 'site' ? 'on' : ''} onClick={() => setAud('site')}>Site managers</button>
              <button className={aud === 'agency' ? 'on' : ''} onClick={() => setAud('agency')}>Agencies</button>
            </div>
            <div className="bill-toggle">
              <span style={year ? undefined : onLabel}>Monthly</span>
              <div
                className={`switch ${year ? 'year' : ''}`}
                role="switch"
                aria-checked={year}
                onClick={() => setYear((v) => !v)}
              />
              <span style={year ? onLabel : undefined}>Annual</span>
              <span className="save-tag">Save ~17%</span>
            </div>
          </div>

          <div className="tiers">
            {tiers.map((t) => {
              const price = year ? t.y : t.m
              const ann = year ? `£${t.m}/mo billed monthly` : `£${t.y}/mo billed yearly`
              return (
                <div className={`tier ${t.pop ? 'pop' : ''} rv in`} key={`${aud}-${t.name}`}>
                  {t.pop && <span className="poptag">★ POPULAR</span>}
                  <div className="tname">{t.name}</div>
                  <div className="tlim">{t.lim}</div>
                  <div className="tprice">£{price}<small>/mo</small></div>
                  <div className="tann">{ann}</div>
                  <ul>{t.feats.map((f) => <li key={f}><span className="ck">✓</span>{f}</li>)}</ul>
                  <a href="/login" className={`btn ${t.pop ? 'btn-blue' : 'btn-ghost'}`}>Start free trial</a>
                </div>
              )
            })}
          </div>

          <div className="free-row rv">
            <span className="tag">FREE · £0</span>
            <p><b>Director / Admin view.</b> See every site, every worker and full company compliance at no cost. The decision-maker gets in free, sees it work, and rolls NekaID out everywhere.</p>
          </div>

          <p className="price-note">All prices exclude VAT, shown clearly at checkout. Annual billed yearly (~2 months free). 14-day free trial on every paid tier — no card required.</p>
        </div>
      </section>

      <section className="cta">
        <div className="wrap">
          <div className="cta-box rv">
            <h2>Get your first site live this week.</h2>
            <p>Start the 14-day trial, build a passport, scan it in. No card, no commitment — see it work on a real site.</p>
            <div className="hero-cta" style={{ justifyContent: 'center' }}>
              <a href="/login" className="btn btn-amber">Start free trial →</a>
              <a href="/login" className="btn btn-white-line">Talk to us</a>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot-grid">
          <div className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nekaid-logo.png" alt="NekaID" className="mark" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display="none"}} />
            NekaID
          </div>
          <div className="foot-links">
            <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/login">Contact</a>
          </div>
          <div className="foot-copy">© 2026 NekaID · Digital worker passports</div>
        </div>
      </footer>
    </div>
  )
}
