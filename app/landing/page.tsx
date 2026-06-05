'use client'

import { useEffect, useState } from 'react'

type Tier = { n: string; l: string; m: number; y: number; pop?: boolean; f: string[] }

const DATA: Record<'site' | 'agency', Tier[]> = {
  site: [
    { n: 'Small', l: 'Up to 25 workers', m: 49, y: 41, f: ['QR verify & sign in/out', 'Digital inductions', 'Live attendance', 'Expiry alerts', 'Two-way messaging', 'Photo & drawing sharing'] },
    { n: 'Medium', l: 'Up to 75 workers', m: 79, y: 66, pop: true, f: ['QR verify & sign in/out', 'Digital inductions', 'Live attendance', 'Expiry alerts', 'Two-way messaging', 'Photo & drawing sharing'] },
    { n: 'Large', l: 'Up to 250 workers', m: 139, y: 115, f: ['QR verify & sign in/out', 'Digital inductions', 'Live attendance', 'Expiry alerts', 'Two-way messaging', 'Photo & drawing sharing'] },
    { n: 'Unlimited', l: 'No worker cap', m: 249, y: 207, f: ['QR verify & sign in/out', 'Digital inductions', 'Live attendance', 'Expiry alerts', 'Two-way messaging', 'Photo & drawing sharing', 'Custom branding'] },
  ],
  agency: [
    { n: 'Small', l: 'Up to 50 workers', m: 79, y: 66, f: ['Full data on one scan', 'CSCS, quals, NI, bank', 'Digital inductions', 'Two-way messaging', 'Photo & drawing sharing', 'Expiry alerts'] },
    { n: 'Medium', l: 'Up to 150 workers', m: 149, y: 124, pop: true, f: ['Full data on one scan', 'CSCS, quals, NI, bank', 'Digital inductions', 'Two-way messaging', 'Photo & drawing sharing', 'Expiry alerts'] },
    { n: 'Large', l: 'Up to 500 workers', m: 299, y: 249, f: ['Full data on one scan', 'CSCS, quals, NI, bank', 'Digital inductions', 'Two-way messaging', 'Photo & drawing sharing', 'Expiry alerts'] },
    { n: 'Enterprise', l: 'Unlimited workforce', m: 499, y: 415, f: ['Full data on one scan', 'CSCS, quals, NI, bank', 'Digital inductions', 'Two-way messaging', 'Photo & drawing sharing', 'Expiry alerts', 'Custom branding'] },
  ],
}

const CSS = `
body.nk-landing{background:#0c0b0a !important}
body.nk-landing > footer{display:none !important}
body.nk-landing::before{content:"";position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

.nkx{
  --bg:#0c0b0a;--bg-2:#131110;--bg-3:#1a1715;--gold:#c9a86a;--gold-bright:#e2c489;--gold-deep:#9c7e44;
  --cream:#f3efe6;--cream-dim:#cfc8ba;--muted:#938c80;--line:rgba(243,239,230,.10);--line-2:rgba(243,239,230,.16);--ok:#7fb98a;
  background:var(--bg);color:var(--cream);font-family:'DM Sans',sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden;
}
.nkx *{box-sizing:border-box;margin:0;padding:0}
.nkx h1,.nkx h2,.nkx h3{font-family:'Fraunces',serif;font-weight:400;line-height:1.05;letter-spacing:-.015em}
.nkx a{color:inherit;text-decoration:none}
.nkx .wrap{max-width:1200px;margin:0 auto;padding:0 32px}
.nkx .kk{font-family:'DM Sans';font-size:12px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}
.nkx .lbtn{display:inline-flex;align-items:center;gap:9px;font-family:'DM Sans';font-weight:600;font-size:14.5px;border-radius:2px;padding:14px 26px;cursor:pointer;border:0;min-height:auto;box-shadow:none;transition:.3s ease;letter-spacing:.01em}
.nkx .lbtn-gold{background:var(--gold);color:#1a1510}
.nkx .lbtn-gold:hover{background:var(--gold-bright);transform:translateY(-2px)}
.nkx .lbtn-line{background:transparent;color:var(--cream);border:1px solid var(--line-2)}
.nkx .lbtn-line:hover{border-color:var(--gold);color:var(--gold)}
.nkx nav{position:sticky;top:0;z-index:100;background:rgba(12,11,10,.72);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.nkx .nav-in{display:flex;align-items:center;justify-content:space-between;height:78px}
.nkx .lbrand{display:flex;align-items:center;gap:11px;margin:0;letter-spacing:normal;font-weight:400}
.nkx .lbrand img{height:30px;width:auto;display:block}
.nkx .lbrand .wm{font-family:'Fraunces',serif;font-weight:500;font-size:23px;letter-spacing:.01em}
.nkx .lbrand .wm b{color:var(--gold);font-weight:500}
.nkx .nav-links{display:flex;align-items:center;gap:38px;font-size:14.5px;color:var(--cream-dim)}
.nkx .nav-links a:not(.lbtn):hover{color:var(--gold)}
.nkx .lhero{position:relative;padding:96px 0 90px}
.nkx .hero-glow{position:absolute;top:-160px;right:-120px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,106,.12),transparent 62%);pointer-events:none}
.nkx .hero-in{position:relative;display:grid;grid-template-columns:1.08fr .92fr;gap:64px;align-items:center}
.nkx .tagline{display:inline-flex;align-items:center;gap:10px;margin-bottom:30px;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--cream-dim)}
.nkx .tagline .ln{width:34px;height:1px;background:var(--gold)}
.nkx h1.head{font-size:clamp(42px,5.6vw,76px);font-weight:400}
.nkx h1.head em{font-style:italic;color:var(--gold)}
.nkx .lhero p.lede{margin:30px 0 38px;font-size:18.5px;color:var(--cream-dim);max-width:480px;line-height:1.62}
.nkx .hero-cta{display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.nkx .hero-foot{display:flex;align-items:center;gap:26px;margin-top:42px;padding-top:30px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
.nkx .hero-foot b{color:var(--cream);font-weight:500;font-family:'Fraunces',serif;font-size:22px;display:block;margin-bottom:2px}
.nkx .hero-foot .sep{width:1px;height:34px;background:var(--line)}
.nkx .cardwrap{perspective:1600px}
.nkx .cred{position:relative;width:100%;max-width:400px;margin:0 auto;aspect-ratio:1.586/1;border-radius:18px;background:linear-gradient(150deg,#211c16 0%,#15110d 55%,#0d0a08 100%);border:1px solid rgba(201,168,106,.28);box-shadow:0 50px 90px -40px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05);padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between;transform:rotateY(-13deg) rotateX(6deg);transition:transform .6s ease;overflow:hidden}
.nkx .cardwrap:hover .cred{transform:rotateY(-6deg) rotateX(3deg)}
.nkx .cred::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(226,196,137,.10) 47%,transparent 60%);pointer-events:none}
.nkx .cred-top{display:flex;justify-content:space-between;align-items:flex-start}
.nkx .cred-top .lbl{font-size:9.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);font-weight:600}
.nkx .cred-top .vf{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ok);display:flex;align-items:center;gap:5px}
.nkx .cred-top .vf::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok)}
.nkx .chip{width:48px;height:36px;border-radius:7px;background:linear-gradient(135deg,#e2c489,#9c7e44);position:relative;box-shadow:inset 0 1px 2px rgba(255,255,255,.5)}
.nkx .chip::before,.nkx .chip::after{content:"";position:absolute;left:8px;right:8px;height:1px;background:rgba(60,40,15,.5)}
.nkx .chip::before{top:12px}.nkx .chip::after{top:22px}
.nkx .cred-name{font-family:'Fraunces',serif;font-size:25px;font-weight:500;color:var(--cream);margin-bottom:3px}
.nkx .cred-role{font-size:11.5px;letter-spacing:.04em;color:var(--cream-dim)}
.nkx .cred-row{display:flex;gap:8px;margin-top:14px}
.nkx .cred-tag{font-size:9.5px;letter-spacing:.06em;padding:5px 10px;border-radius:100px;border:1px solid var(--line-2);color:var(--cream-dim)}
.nkx .cred-tag.g{border-color:rgba(201,168,106,.4);color:var(--gold)}
.nkx .cred-bottom{display:flex;justify-content:space-between;align-items:flex-end}
.nkx .cred-qr{width:50px;height:50px;border-radius:6px;background:repeating-linear-gradient(0deg,var(--cream) 0 3px,transparent 3px 6px),repeating-linear-gradient(90deg,var(--cream) 0 3px,transparent 3px 6px);opacity:.85;background-color:rgba(243,239,230,.06)}
.nkx .cred-no{font-size:10px;letter-spacing:.18em;color:var(--muted);text-align:right}
.nkx .cred-no b{display:block;color:var(--gold);font-weight:600;font-size:11px;margin-top:3px;letter-spacing:.12em}
.nkx .float-note{position:absolute;left:-30px;bottom:46px;background:rgba(20,17,16,.92);backdrop-filter:blur(8px);border:1px solid var(--line-2);border-radius:12px;padding:13px 16px;display:flex;align-items:center;gap:11px;box-shadow:0 24px 50px -20px rgba(0,0,0,.8);animation:nk-fl 6s ease-in-out infinite}
.nkx .float-note .ic{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:rgba(127,185,138,.15);color:var(--ok);font-size:14px}
.nkx .float-note .tx{font-size:12px}.nkx .float-note .tx span{display:block;font-size:10px;color:var(--muted)}
@keyframes nk-fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.nkx .band{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:26px 0;overflow:hidden}
.nkx .band-in{display:flex;align-items:center;justify-content:center;gap:48px;flex-wrap:wrap;font-family:'Fraunces',serif;font-size:15px;color:var(--muted);letter-spacing:.02em}
.nkx .band-in .dot{color:var(--gold)}
.nkx section.s{padding:130px 0;position:relative}
.nkx .lead{max-width:720px;margin-bottom:72px}
.nkx .lead h2{font-size:clamp(32px,4.2vw,52px);margin:18px 0 0}
.nkx .lead h2 em{font-style:italic;color:var(--gold)}
.nkx .lead p{color:var(--cream-dim);font-size:18px;margin-top:22px;max-width:560px}
.nkx .rows{border-top:1px solid var(--line)}
.nkx .row{display:grid;grid-template-columns:64px 1fr 1.1fr;gap:32px;align-items:start;padding:40px 0;border-bottom:1px solid var(--line);transition:.3s}
.nkx .row:hover{background:linear-gradient(90deg,rgba(201,168,106,.04),transparent)}
.nkx .row .rn{font-family:'Fraunces',serif;font-style:italic;font-size:26px;color:var(--gold);line-height:1}
.nkx .row h3{font-size:26px;font-weight:500}
.nkx .row p{color:var(--cream-dim);font-size:16px;line-height:1.6}
.nkx .fgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.nkx .f{background:var(--bg);padding:42px 34px;transition:.35s}
.nkx .f:hover{background:var(--bg-2)}
.nkx .f .fi{font-size:22px;color:var(--gold);margin-bottom:22px}
.nkx .f h3{font-size:21px;font-weight:500;margin-bottom:11px}
.nkx .f p{color:var(--muted);font-size:15px;line-height:1.6}
.nkx .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:50px}
.nkx .stp{position:relative}
.nkx .stp .sn{font-family:'Fraunces',serif;font-size:15px;color:var(--gold);letter-spacing:.2em;border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:26px;display:block}
.nkx .stp h3{font-size:24px;font-weight:500;margin-bottom:12px}
.nkx .stp p{color:var(--cream-dim);font-size:16px}
.nkx .price-top{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:30px;margin-bottom:56px}
.nkx .pc{display:flex;flex-direction:column;gap:18px;align-items:flex-end}
.nkx .seg{display:inline-flex;border:1px solid var(--line-2);border-radius:2px;overflow:hidden}
.nkx .seg button{border:0;background:transparent;color:var(--muted);font-family:'DM Sans';font-weight:600;font-size:13.5px;padding:11px 22px;cursor:pointer;transition:.25s;letter-spacing:.02em}
.nkx .seg button.on{background:var(--gold);color:#1a1510}
.nkx .bt{display:inline-flex;align-items:center;gap:12px;font-size:13.5px;color:var(--muted)}
.nkx .sw{width:46px;height:25px;border-radius:100px;border:1px solid var(--line-2);position:relative;cursor:pointer;transition:.25s}
.nkx .sw::after{content:"";position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:50%;background:var(--muted);transition:.25s}
.nkx .sw.on{border-color:var(--gold)}.nkx .sw.on::after{left:24px;background:var(--gold)}
.nkx .save{font-size:11px;color:var(--gold);letter-spacing:.08em}
.nkx .tiers{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.nkx .t{background:var(--bg);padding:38px 28px;display:flex;flex-direction:column;position:relative;transition:.35s}
.nkx .t:hover{background:var(--bg-2)}
.nkx .t.pop{background:linear-gradient(180deg,rgba(201,168,106,.07),var(--bg) 40%);box-shadow:inset 0 2px 0 var(--gold)}
.nkx .t .pop-l{position:absolute;top:18px;right:22px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
.nkx .t .tn{font-family:'Fraunces',serif;font-size:23px;font-weight:500}
.nkx .t .tl{font-size:13px;color:var(--muted);margin-top:5px;min-height:19px}
.nkx .t .tp{font-family:'DM Sans';font-weight:600;font-size:44px;line-height:1;margin:26px 0 4px;letter-spacing:-.02em;font-feature-settings:"tnum" 1}
.nkx .t .tp small{font-size:14px;color:var(--muted);font-weight:500}
.nkx .t .ta{font-size:12.5px;color:var(--muted);min-height:18px}
.nkx .t ul{list-style:none;margin:26px 0 30px;display:flex;flex-direction:column;gap:12px}
.nkx .t li{font-size:13.5px;color:var(--cream-dim);display:flex;gap:11px;align-items:flex-start;line-height:1.45}
.nkx .t li .ck{color:var(--gold);flex:none}
.nkx .t .lbtn{margin-top:auto;justify-content:center;width:100%}
.nkx .director{margin-top:1px;background:linear-gradient(120deg,var(--bg-3),var(--bg-2));border:1px solid var(--line);padding:34px 40px;display:flex;align-items:center;gap:26px;flex-wrap:wrap}
.nkx .director .free{font-family:'Fraunces',serif;font-style:italic;font-size:30px;color:var(--gold);flex:none}
.nkx .director p{color:var(--cream-dim);font-size:16px;max-width:760px}
.nkx .director p b{color:var(--cream);font-weight:500}
.nkx .pnote{text-align:center;color:var(--muted);font-size:13px;margin-top:30px;letter-spacing:.01em}
.nkx .cta{padding:140px 0;text-align:center;position:relative}
.nkx .cta-glow{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:700px;height:400px;background:radial-gradient(ellipse,rgba(201,168,106,.10),transparent 65%);pointer-events:none}
.nkx .cta h2{font-size:clamp(34px,5vw,62px);position:relative}
.nkx .cta h2 em{font-style:italic;color:var(--gold)}
.nkx .cta p{color:var(--cream-dim);font-size:18px;margin:24px auto 38px;max-width:460px;position:relative}
.nkx .cta .hero-cta{justify-content:center;position:relative}
.nkx footer.lfoot{border-top:1px solid var(--line);padding:54px 0}
.nkx .foot{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap}
.nkx .foot .wm{font-family:'Fraunces',serif;font-size:21px}
.nkx .foot .wm b{color:var(--gold);font-weight:500}
.nkx .foot-links{display:flex;gap:30px;font-size:14px;color:var(--muted)}
.nkx .foot-links a:hover{color:var(--gold)}
.nkx .foot-c{font-size:13px;color:var(--muted)}
.nkx .rv{opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}
.nkx .rv.in{opacity:1;transform:none}
@media(max-width:980px){
  .nkx .hero-in{grid-template-columns:1fr;gap:54px}
  .nkx .cardwrap{order:-1}
  .nkx .fgrid,.nkx .steps,.nkx .tiers{grid-template-columns:1fr 1fr}
  .nkx .row{grid-template-columns:40px 1fr;gap:20px}
  .nkx .row p{grid-column:2}
}
@media(max-width:620px){
  .nkx .wrap{padding:0 22px}
  .nkx .nav-links a:not(.lbtn){display:none}
  .nkx .fgrid,.nkx .steps,.nkx .tiers{grid-template-columns:1fr}
  .nkx .hero-foot{gap:16px}.nkx .hero-foot .sep{display:none}
  .nkx .director{flex-direction:column;align-items:flex-start}
  .nkx .band-in{gap:24px}
}
`

export default function LandingPage() {
  const [aud, setAud] = useState<'site' | 'agency'>('site')
  const [year, setYear] = useState(false)

  useEffect(() => {
    document.body.classList.add('nk-landing')
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.nkx .rv').forEach((el) => io.observe(el))
    return () => {
      document.body.classList.remove('nk-landing')
      io.disconnect()
    }
  }, [])

  const tiers = DATA[aud]

  return (
    <div className="nkx">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav>
        <div className="wrap nav-in">
          <div className="lbrand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nekaid-logo.png" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            <span className="wm">Neka<b>ID</b></span>
          </div>
          <div className="nav-links">
            <a href="#why">Why NekaID</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="/login" className="lbtn lbtn-line">Login</a>
          </div>
        </div>
      </nav>

      <header className="lhero">
        <div className="hero-glow" />
        <div className="wrap hero-in">
          <div className="rv in">
            <span className="tagline"><span className="ln" />Live on UK construction sites</span>
            <h1 className="head">The credential that <em>moves</em> with the worker.</h1>
            <p className="lede">One digital passport for CSCS, qualifications, Right to Work and inductions. Scanned in seconds, verified on site, compliant by design.</p>
            <div className="hero-cta">
              <a href="/login" className="lbtn lbtn-gold">Start free for 14 days</a>
              <a href="#how" className="lbtn lbtn-line">See how it works</a>
            </div>
            <div className="hero-foot">
              <div><b>Seconds</b>to verify a worker</div>
              <div className="sep" />
              <div><b>CDM 2015</b>aligned by design</div>
              <div className="sep" />
              <div><b>£0</b>director &amp; admin view</div>
            </div>
          </div>

          <div className="cardwrap rv in">
            <div className="cred">
              <div className="cred-top">
                <div><div className="lbl">NekaID · Worker Passport</div></div>
                <div className="vf">Verified</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <div className="chip" style={{ marginBottom: 16 }} />
                  <div className="cred-name">Sample Worker</div>
                  <div className="cred-role">Groundworker · CSCS Blue</div>
                  <div className="cred-row">
                    <span className="cred-tag g">Compliant</span>
                    <span className="cred-tag">CSCS Valid</span>
                    <span className="cred-tag">Inducted</span>
                  </div>
                </div>
              </div>
              <div className="cred-bottom">
                <div className="cred-qr" />
                <div className="cred-no">Member since 2026<b>NK · 0042</b></div>
              </div>
            </div>
            <div className="float-note"><span className="ic">✓</span><span className="tx">Signed in · 07:42<span>Plot 4 · on site</span></span></div>
          </div>
        </div>
      </header>

      <div className="band">
        <div className="wrap band-in">
          <span>CSCS &amp; Qualifications <span className="dot">·</span> Right to Work <span className="dot">·</span> Digital Inductions <span className="dot">·</span> GPS Attendance <span className="dot">·</span> Expiry Alerts</span>
        </div>
      </div>

      <section className="s" id="why">
        <div className="wrap">
          <div className="lead rv">
            <span className="kk">Why NekaID</span>
            <h2>Paper doesn&apos;t survive a building site. <em>A passport does.</em></h2>
            <p>Inductions get lost, cards expire unnoticed, and an inspection turns into a scramble through folders. NekaID makes compliance something you carry, not something you file.</p>
          </div>
          <div className="rows">
            <div className="row rv"><div className="rn">01</div><div><h3>One source of truth</h3></div><p>Every credential, induction and attendance record in a single passport — built once by the worker, carried from site to site.</p></div>
            <div className="row rv"><div className="rn">02</div><div><h3>Verified in seconds</h3></div><p>Scan a worker&apos;s code and see live compliance instantly. The view adapts to whether the scanner is a site or an agency.</p></div>
            <div className="row rv"><div className="rn">03</div><div><h3>Nothing expires unseen</h3></div><p>Automatic alerts reach the manager 30 and 7 days before any card or qualification lapses. The risk surfaces before it bites.</p></div>
            <div className="row rv"><div className="rn">04</div><div><h3>An audit trail, on demand</h3></div><p>Attendance, inductions and competence are recorded as you go — the evidence CDM 2015 expects, ready in a moment, not a box.</p></div>
          </div>
        </div>
      </section>

      <section className="s" id="features" style={{ background: 'var(--bg-2)' }}>
        <div className="wrap">
          <div className="lead rv">
            <span className="kk">The platform</span>
            <h2>Everything the site needs. <em>Nothing it doesn&apos;t.</em></h2>
          </div>
          <div className="fgrid">
            <div className="f rv"><div className="fi">◈</div><h3>Worker passport</h3><p>CSCS, qualifications, Right to Work and certificate photos held in one secure profile.</p></div>
            <div className="f rv"><div className="fi">⌁</div><h3>QR verification</h3><p>One scan reveals live compliance — a restricted view for sites, full detail for agencies.</p></div>
            <div className="f rv"><div className="fi">⟟</div><h3>GPS attendance</h3><p>Tap to sign in; automatic sign-out by geofence when a worker leaves site. No clipboard.</p></div>
            <div className="f rv"><div className="fi">▤</div><h3>Digital inductions</h3><p>Send safety and site inductions through the app; completion lands on the passport instantly.</p></div>
            <div className="f rv"><div className="fi">◷</div><h3>Expiry alerts</h3><p>Push and email warnings 30 and 7 days before any credential expires. Never caught out.</p></div>
            <div className="f rv"><div className="fi">✉</div><h3>Two-way messaging</h3><p>Text, photos and drawings between managers and workers — site comms kept on record.</p></div>
          </div>
        </div>
      </section>

      <section className="s" id="how">
        <div className="wrap">
          <div className="lead rv">
            <span className="kk">How it works</span>
            <h2>Up and running before the <em>morning brief.</em></h2>
          </div>
          <div className="steps">
            <div className="stp rv"><span className="sn">STEP I</span><h3>The worker builds it once</h3><p>Details, CSCS card and qualifications, added once and installed on their phone as an app.</p></div>
            <div className="stp rv"><span className="sn">STEP II</span><h3>The site scans the code</h3><p>A single scan confirms compliance, runs the induction and signs the worker in.</p></div>
            <div className="stp rv"><span className="sn">STEP III</span><h3>You stay compliant</h3><p>Live attendance, induction records and expiry alerts roll up to your dashboard automatically.</p></div>
          </div>
        </div>
      </section>

      <section className="s" id="pricing" style={{ background: 'var(--bg-2)' }}>
        <div className="wrap">
          <div className="price-top">
            <div className="lead rv" style={{ marginBottom: 0 }}>
              <span className="kk">Pricing</span>
              <h2>Per site. <em>Workers always free.</em></h2>
            </div>
            <div className="pc rv">
              <div className="seg">
                <button className={aud === 'site' ? 'on' : ''} onClick={() => setAud('site')}>Site managers</button>
                <button className={aud === 'agency' ? 'on' : ''} onClick={() => setAud('agency')}>Agencies</button>
              </div>
              <div className="bt">
                <span style={{ color: year ? 'var(--muted)' : 'var(--cream)' }}>Monthly</span>
                <div className={`sw ${year ? 'on' : ''}`} onClick={() => setYear((v) => !v)} role="switch" aria-checked={year} />
                <span style={{ color: year ? 'var(--cream)' : 'var(--muted)' }}>Annual</span>
                <span className="save">— save ~17%</span>
              </div>
            </div>
          </div>

          <div className="tiers">
            {tiers.map((t) => {
              const p = year ? t.y : t.m
              const a = year ? `£${t.m}/mo billed monthly` : `£${t.y}/mo billed yearly`
              return (
                <div className={`t ${t.pop ? 'pop' : ''} rv in`} key={`${aud}-${t.n}`}>
                  {t.pop && <span className="pop-l">Most chosen</span>}
                  <div className="tn">{t.n}</div>
                  <div className="tl">{t.l}</div>
                  <div className="tp">£{p}<small> /mo</small></div>
                  <div className="ta">{a}</div>
                  <ul>{t.f.map((x) => <li key={x}><span className="ck">—</span>{x}</li>)}</ul>
                  <a href="/login" className={`lbtn ${t.pop ? 'lbtn-gold' : 'lbtn-line'}`}>Start free trial</a>
                </div>
              )
            })}
          </div>

          <div className="director rv">
            <span className="free">Free</span>
            <p><b>Director &amp; admin view.</b> Every site, every worker and full company compliance — at no cost. The decision-maker sees the whole picture, then rolls NekaID out across the business.</p>
          </div>

          <p className="pnote">All prices exclude VAT, shown at checkout · Annual billed yearly (~2 months free) · 14-day free trial on every tier, no card required.</p>
        </div>
      </section>

      <section className="cta">
        <div className="cta-glow" />
        <div className="wrap">
          <div className="rv in">
            <h2>Get your first site live <em>this week.</em></h2>
            <p>Build a passport, scan it in, watch the dashboard update. No card, no commitment.</p>
            <div className="hero-cta">
              <a href="/login" className="lbtn lbtn-gold">Start free trial</a>
              <a href="/login" className="lbtn lbtn-line">Speak with us</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="lfoot">
        <div className="wrap foot">
          <span className="wm">Neka<b>ID</b></span>
          <div className="foot-links">
            <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/login">Contact</a>
          </div>
          <div className="foot-c">© 2026 NekaID — Digital worker passports</div>
        </div>
      </footer>
    </div>
  )
}
