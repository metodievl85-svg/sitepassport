// app/landing/page.tsx
// Landing page — lives at nekaid.co.uk/landing
// app/page.tsx (auth router) is untouched

import Link from 'next/link'

export default function LandingPage() {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" />
      <style>{`
        :root {
          --black: #08090c;
          --surface: #0f1117;
          --surface2: #161922;
          --blue: #2563EB;
          --blue-light: #3B82F6;
          --blue-glow: rgba(37,99,235,0.15);
          --white: #ffffff;
          --text: #e8eaf0;
          --muted: rgba(232,234,240,0.5);
          --muted2: rgba(232,234,240,0.25);
          --border: rgba(255,255,255,0.07);
          --border2: rgba(255,255,255,0.12);
          --teal: #0d9488;
          --teal-light: #14b8a6;
        }
        .landing * { box-sizing: border-box; margin: 0; padding: 0; }
        .landing { font-family: 'DM Sans', sans-serif; background: var(--black); color: var(--text); line-height: 1.6; overflow-x: hidden; font-weight: 300; }
        .landing a { color: inherit; text-decoration: none; }

        /* NAV */
        .l-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; padding: 1.1rem 3rem; border-bottom: 1px solid var(--border); background: rgba(8,9,12,0.9); backdrop-filter: blur(16px); }
        .l-nav-logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.35rem; letter-spacing: -0.03em; color: var(--white); }
        .l-nav-logo span { color: var(--blue-light); }
        .l-nav-links { display: flex; gap: 2rem; align-items: center; }
        .l-nav-links a { font-size: 0.85rem; color: var(--muted); transition: color 0.2s; }
        .l-nav-links a:hover { color: var(--white); }
        .l-nav-cta { background: var(--blue); color: var(--white) !important; padding: 0.5rem 1.25rem; border-radius: 6px; font-size: 0.85rem; font-weight: 500; transition: background 0.2s; }
        .l-nav-cta:hover { background: var(--blue-light); }

        /* HERO */
        .l-hero { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; padding-top: 72px; }
        .l-hero-left { display: flex; flex-direction: column; justify-content: center; padding: 5rem 3rem; }
        .l-tag { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--blue-light); margin-bottom: 2rem; border: 1px solid rgba(59,130,246,0.3); padding: 0.35rem 0.85rem; border-radius: 100px; width: fit-content; }
        .l-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--blue-light); display: block; animation: lpulse 2s infinite; }
        @keyframes lpulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .l-h1 { font-family: 'Syne', sans-serif; font-size: clamp(2.4rem,3.5vw,3.8rem); font-weight: 800; line-height: 1.05; letter-spacing: -0.03em; color: var(--white); margin-bottom: 1.5rem; }
        .l-h1 em { font-style: normal; color: var(--blue-light); }
        .l-hero-sub { font-size: 1rem; color: var(--muted); max-width: 480px; margin-bottom: 2.5rem; line-height: 1.75; }
        .l-btns { display: flex; gap: 0.75rem; margin-bottom: 3.5rem; flex-wrap: wrap; }
        .l-btn-blue { background: var(--blue); color: var(--white); padding: 0.8rem 1.75rem; border-radius: 8px; font-size: 0.95rem; font-weight: 500; transition: background 0.2s; display: inline-block; }
        .l-btn-blue:hover { background: var(--blue-light); }
        .l-btn-ghost { border: 1px solid var(--border2); color: var(--text); padding: 0.8rem 1.75rem; border-radius: 8px; font-size: 0.95rem; font-weight: 400; transition: border-color 0.2s; display: inline-block; }
        .l-btn-ghost:hover { border-color: rgba(255,255,255,0.3); }
        .l-trust { display: flex; gap: 2rem; flex-wrap: wrap; }
        .l-trust-item { display: flex; flex-direction: column; }
        .l-trust-num { font-family: 'Syne', sans-serif; font-size: 1.6rem; font-weight: 700; color: var(--white); line-height: 1; }
        .l-trust-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted2); margin-top: 2px; }

        /* HERO MOCKUP */
        .l-hero-right { background: var(--surface); border-left: 1px solid var(--border); display: flex; align-items: center; justify-content: center; padding: 3rem 2.5rem; position: relative; overflow: hidden; }
        .l-hero-right::before { content: ''; position: absolute; top: -100px; right: -100px; width: 400px; height: 400px; border-radius: 50%; background: var(--blue-glow); filter: blur(80px); pointer-events: none; }
        .l-mockup { width: 100%; max-width: 380px; background: #0a0b0f; border: 1px solid var(--border2); border-radius: 16px; overflow: hidden; box-shadow: 0 32px 64px rgba(0,0,0,0.6); position: relative; z-index: 1; }
        .l-mockup-bar { background: #111318; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
        .l-mockup-logo { font-family: 'Syne', sans-serif; font-size: 0.8rem; font-weight: 700; color: var(--white); }
        .l-mockup-logo span { color: var(--blue-light); }
        .l-mockup-live { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; color: #4ade80; text-transform: uppercase; letter-spacing: 0.08em; }
        .l-live-dot { width: 5px; height: 5px; border-radius: 50%; background: #4ade80; }
        .l-mockup-body { padding: 1.25rem; }
        .l-mlabel { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted2); margin-bottom: 0.75rem; }
        .l-workers { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; }
        .l-wrow { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; background: var(--surface2); border-radius: 8px; border: 1px solid var(--border); }
        .l-av { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 600; flex-shrink: 0; }
        .av-b { background: rgba(37,99,235,0.25); color: #93c5fd; }
        .av-g { background: rgba(74,222,128,0.15); color: #4ade80; }
        .av-a { background: rgba(251,191,36,0.15); color: #fbbf24; }
        .l-winfo { flex: 1; min-width: 0; }
        .l-wname { font-size: 0.75rem; font-weight: 500; color: var(--white); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .l-wrole { font-size: 0.62rem; color: var(--muted2); }
        .l-badge { font-size: 0.58rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
        .s-in { background: rgba(74,222,128,0.12); color: #4ade80; }
        .s-out { background: rgba(255,255,255,0.06); color: var(--muted2); }
        .s-pending { background: rgba(251,191,36,0.12); color: #fbbf24; }
        .l-mdivider { height: 1px; background: var(--border); margin: 1rem 0; }
        .l-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; }
        .l-stat { background: var(--surface2); border-radius: 8px; padding: 0.6rem 0.75rem; border: 1px solid var(--border); }
        .l-stat-num { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 700; color: var(--white); }
        .l-stat-label { font-size: 0.58rem; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 1px; }
        .l-induction { margin-top: 1rem; background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2); border-radius: 8px; padding: 0.75rem; }
        .l-ind-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .l-ind-title { font-size: 0.72rem; font-weight: 500; color: var(--white); }
        .l-ind-pct { font-size: 0.65rem; color: var(--blue-light); font-weight: 600; }
        .l-progress { height: 3px; background: var(--border); border-radius: 100px; overflow: hidden; }
        .l-progress-fill { height: 100%; width: 72%; background: var(--blue-light); border-radius: 100px; }

        /* SECTIONS */
        .l-section-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--blue-light); font-weight: 500; margin-bottom: 1.25rem; }
        .l-h2 { font-family: 'Syne', sans-serif; font-size: clamp(2rem,3vw,2.8rem); font-weight: 700; line-height: 1.1; letter-spacing: -0.025em; color: var(--white); margin-bottom: 1.25rem; }

        /* PROBLEMS */
        .l-problem-strip { background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 5rem 3rem; }
        .l-problem-inner { max-width: 1140px; margin: 0 auto; }
        .l-problems { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-top: 2.5rem; }
        .l-prob { background: var(--surface); padding: 1.75rem; }
        .l-prob-x { color: rgba(239,68,68,0.4); font-size: 1rem; margin-bottom: 1rem; font-weight: 700; }
        .l-prob-title { font-family: 'Syne', sans-serif; font-size: 0.88rem; font-weight: 600; color: var(--white); margin-bottom: 0.5rem; line-height: 1.3; }
        .l-prob-desc { font-size: 0.78rem; color: var(--muted); line-height: 1.6; }

        /* CDM */
        .l-cdm { background: var(--blue); padding: 4rem 3rem; text-align: center; }
        .l-cdm-inner { max-width: 680px; margin: 0 auto; }
        .l-cdm h2 { font-family: 'Syne', sans-serif; color: var(--white); margin-bottom: 1rem; font-size: clamp(1.5rem,2.5vw,2.2rem); font-weight: 700; letter-spacing: -0.02em; }
        .l-cdm p { color: rgba(255,255,255,0.7); margin-bottom: 2rem; font-size: 0.95rem; line-height: 1.75; }
        .l-btn-white { background: var(--white); color: #1e3a8a; padding: 0.85rem 2rem; border-radius: 8px; font-size: 0.95rem; font-weight: 500; display: inline-block; transition: opacity 0.2s; }
        .l-btn-white:hover { opacity: 0.9; }

        /* FEATURES */
        .l-features { background: var(--surface); padding: 6rem 3rem; border-top: 1px solid var(--border); }
        .l-features-inner { max-width: 1140px; margin: 0 auto; }
        .l-feat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; margin-top: 3rem; }
        .l-feat { border: 1px solid var(--border); border-radius: 12px; padding: 1.75rem; background: var(--black); transition: border-color 0.2s; }
        .l-feat:hover { border-color: rgba(59,130,246,0.3); }
        .l-feat-icon { width: 36px; height: 36px; border-radius: 8px; background: rgba(37,99,235,0.15); display: flex; align-items: center; justify-content: center; font-size: 1rem; margin-bottom: 1.25rem; }
        .l-feat-title { font-family: 'Syne', sans-serif; font-size: 0.95rem; font-weight: 600; color: var(--white); margin-bottom: 0.5rem; }
        .l-feat-desc { font-size: 0.82rem; color: var(--muted); line-height: 1.65; }

        /* HOW IT WORKS */
        .l-how { padding: 6rem 3rem; border-top: 1px solid var(--border); }
        .l-how-inner { max-width: 1140px; margin: 0 auto; }
        .l-steps { margin-top: 3rem; display: grid; grid-template-columns: repeat(4,1fr); position: relative; }
        .l-steps::before { content: ''; position: absolute; top: 22px; left: 10%; right: 10%; height: 1px; background: var(--border); z-index: 0; }
        .l-step { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 1.5rem; position: relative; z-index: 1; }
        .l-step-circle { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--border2); background: var(--surface2); display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-size: 0.8rem; font-weight: 700; color: var(--blue-light); margin-bottom: 1.25rem; flex-shrink: 0; }
        .l-step h3 { font-family: 'Syne', sans-serif; font-size: 0.88rem; font-weight: 600; color: var(--white); margin-bottom: 0.5rem; line-height: 1.3; }
        .l-step p { font-size: 0.78rem; color: var(--muted); line-height: 1.6; }

        /* PRICING */
        .l-pricing { background: var(--surface); padding: 6rem 3rem; border-top: 1px solid var(--border); }
        .l-pricing-inner { max-width: 1140px; margin: 0 auto; }
        .l-pricing-sub { font-size: 0.9rem; color: var(--muted); margin-bottom: 2.5rem; }
        .l-plans { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 0.75rem; margin-bottom: 2rem; }
        .l-plan { border: 1px solid var(--border); border-radius: 12px; padding: 1.4rem; background: var(--black); display: flex; flex-direction: column; }
        .l-plan.featured { border-color: var(--blue); background: rgba(37,99,235,0.05); }
        .l-plan.agency { border-color: var(--teal); background: rgba(13,148,136,0.05); }
        .l-plan-badge { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.2rem 0.55rem; border-radius: 100px; font-weight: 600; display: inline-block; margin-bottom: 0.85rem; width: fit-content; }
        .badge-blue { background: var(--blue); color: #fff; }
        .badge-teal { background: var(--teal); color: #fff; }
        .l-plan-name { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.09em; color: var(--muted); font-weight: 500; margin-bottom: 0.4rem; }
        .l-plan-price { font-family: 'Syne', sans-serif; font-size: 1.6rem; font-weight: 800; color: var(--white); line-height: 1; margin-bottom: 0.2rem; }
        .l-plan-price sub { font-size: 0.68rem; font-weight: 400; color: var(--muted); vertical-align: baseline; font-family: 'DM Sans', sans-serif; }
        .l-plan-min { font-size: 0.67rem; color: var(--muted2); margin-bottom: 1.1rem; padding-bottom: 1.1rem; border-bottom: 1px solid var(--border); line-height: 1.4; }
        .l-plan-features { list-style: none; display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.5rem; flex: 1; }
        .l-plan-features li { font-size: 0.73rem; color: var(--muted); display: flex; gap: 0.4rem; align-items: flex-start; line-height: 1.4; }
        .l-plan-features li.blue::before { content: '✓'; color: var(--blue-light); font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .l-plan-features li.teal::before { content: '✓'; color: var(--teal-light); font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .l-plan-btn { display: block; text-align: center; padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 500; transition: opacity 0.2s; margin-top: auto; }
        .l-plan-btn:hover { opacity: 0.85; }
        .btn-outline-blue { border: 1px solid var(--blue); color: var(--blue-light); }
        .btn-outline-blue:hover { background: rgba(37,99,235,0.1); }
        .btn-solid-blue { background: var(--blue); color: #fff; }
        .btn-solid-teal { background: var(--teal); color: #fff; }
        .l-roi { padding: 1.25rem 1.5rem; border-left: 2px solid var(--blue); background: rgba(37,99,235,0.06); border-radius: 0 8px 8px 0; margin-bottom: 1rem; }
        .l-roi p { font-size: 0.83rem; color: var(--muted); line-height: 1.7; }
        .l-roi strong { color: var(--white); }
        .l-agency-note { padding: 1.25rem 1.5rem; border-left: 2px solid var(--teal); background: rgba(13,148,136,0.06); border-radius: 0 8px 8px 0; }
        .l-agency-note p { font-size: 0.83rem; color: var(--muted); line-height: 1.7; }
        .l-agency-note strong { color: var(--white); }

        /* CTA */
        .l-cta { padding: 8rem 3rem; text-align: center; }
        .l-cta-inner { max-width: 600px; margin: 0 auto; }
        .l-cta-inner p { color: var(--muted); margin-bottom: 2.5rem; font-size: 0.95rem; }

        /* FOOTER */
        .l-footer { border-top: 1px solid var(--border); padding: 2rem 3rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .l-footer-logo { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.95rem; color: var(--white); }
        .l-footer-logo span { color: var(--blue-light); }
        .l-footer-links { display: flex; gap: 1.5rem; }
        .l-footer-links a { font-size: 0.78rem; color: var(--muted2); transition: color 0.2s; }
        .l-footer-links a:hover { color: var(--muted); }
        .l-footer-copy { font-size: 0.72rem; color: var(--muted2); }

        @media (max-width: 768px) {
          .l-nav { padding: 1rem 1.25rem; }
          .l-nav-links a:not(.l-nav-cta) { display: none; }

          .l-hero { grid-template-columns: 1fr; min-height: auto; }
          .l-hero-left { padding: 4rem 1.25rem 2rem; }
          .l-hero-right { display: none; }

          .l-problem-strip { padding: 3rem 1.25rem; }
          .l-problems { grid-template-columns: 1fr 1fr; }

          .l-cdm { padding: 3rem 1.25rem; }

          .l-features { padding: 4rem 1.25rem; }
          .l-feat-grid { grid-template-columns: 1fr 1fr; gap: 0.75rem; }

          .l-how { padding: 4rem 1.25rem; }
          .l-steps { grid-template-columns: 1fr 1fr; gap: 2rem; }
          .l-steps::before { display: none; }

          .l-pricing { padding: 4rem 1.25rem; }
          .l-plans { grid-template-columns: 1fr; gap: 0.75rem; }

          .l-cta { padding: 4rem 1.25rem; }

          .l-footer { padding: 1.5rem 1.25rem; flex-direction: column; align-items: flex-start; gap: 1rem; }
          .l-footer-links { flex-wrap: wrap; gap: 1rem; }
        }

        @media (max-width: 480px) {
          .l-problems { grid-template-columns: 1fr; }
          .l-feat-grid { grid-template-columns: 1fr; }
          .l-steps { grid-template-columns: 1fr; }
          .l-trust { gap: 1.25rem; }
        }
      `}</style>

      <div className="landing">

        {/* NAV */}
        <nav className="l-nav">
          <div className="l-nav-logo">Neka<span>ID</span></div>
          <div className="l-nav-links">
            <Link href="#features">Features</Link>
            <Link href="#how">How it works</Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="/login" className="l-nav-cta">Log in</Link>
          </div>
        </nav>

        {/* HERO */}
        <div className="l-hero">
          <div className="l-hero-left">
            <div className="l-tag"><span className="l-dot" />Built for UK construction</div>
            <h1 className="l-h1">Can you prove every operative is <em>compliant</em> right now?</h1>
            <p className="l-hero-sub">NekaID is the digital passport that gives site managers instant visibility of credentials, inductions, and attendance — on any site, from any device.</p>
            <div className="l-btns">
              <Link href="/login" className="l-btn-blue">Get started free</Link>
              <Link href="#how" className="l-btn-ghost">See how it works</Link>
            </div>
            <div className="l-trust">
              <div className="l-trust-item">
                <span className="l-trust-num">2 min</span>
                <span className="l-trust-label">Operative sign-up</span>
              </div>
              <div className="l-trust-item">
                <span className="l-trust-num">QR</span>
                <span className="l-trust-label">Instant passport scan</span>
              </div>
              <div className="l-trust-item">
                <span className="l-trust-num">CDM</span>
                <span className="l-trust-label">2015 compliant records</span>
              </div>
            </div>
          </div>
          <div className="l-hero-right">
            <div className="l-mockup">
              <div className="l-mockup-bar">
                <span className="l-mockup-logo">Neka<span>ID</span></span>
                <span className="l-mockup-live"><span className="l-live-dot" />Live dashboard</span>
              </div>
              <div className="l-mockup-body">
                <div className="l-mlabel">Operatives on site today</div>
                <div className="l-workers">
                  <div className="l-wrow">
                    <div className="l-av av-g">JT</div>
                    <div className="l-winfo">
                      <div className="l-wname">James Turner</div>
                      <div className="l-wrole">Electrician · CSCS Gold</div>
                    </div>
                    <span className="l-badge s-in">Signed in</span>
                  </div>
                  <div className="l-wrow">
                    <div className="l-av av-b">SR</div>
                    <div className="l-winfo">
                      <div className="l-wname">Sofia Reyes</div>
                      <div className="l-wrole">Site Manager · SMSTS</div>
                    </div>
                    <span className="l-badge s-in">Signed in</span>
                  </div>
                  <div className="l-wrow">
                    <div className="l-av av-a">MB</div>
                    <div className="l-winfo">
                      <div className="l-wname">Marcus Brown</div>
                      <div className="l-wrole">Bricklayer · CSCS Blue</div>
                    </div>
                    <span className="l-badge s-pending">Induction due</span>
                  </div>
                  <div className="l-wrow">
                    <div className="l-av av-b">PK</div>
                    <div className="l-winfo">
                      <div className="l-wname">Paul Kelly</div>
                      <div className="l-wrole">Scaffolder · CISRS</div>
                    </div>
                    <span className="l-badge s-out">Signed out</span>
                  </div>
                </div>
                <div className="l-mdivider" />
                <div className="l-stats">
                  <div className="l-stat"><div className="l-stat-num">12</div><div className="l-stat-label">On site</div></div>
                  <div className="l-stat"><div className="l-stat-num">11</div><div className="l-stat-label">Inducted</div></div>
                  <div className="l-stat"><div className="l-stat-num">1</div><div className="l-stat-label">Action needed</div></div>
                </div>
                <div className="l-induction">
                  <div className="l-ind-top">
                    <span className="l-ind-title">Site induction — Block B</span>
                    <span className="l-ind-pct">72% complete</span>
                  </div>
                  <div className="l-progress"><div className="l-progress-fill" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PROBLEM */}
        <div className="l-problem-strip">
          <div className="l-problem-inner">
            <div className="l-section-label">The problem</div>
            <h2 className="l-h2">Paper is a liability, not a process</h2>
            <div className="l-problems">
              <div className="l-prob">
                <div className="l-prob-x">✗</div>
                <div className="l-prob-title">HSE visits without warning</div>
                <div className="l-prob-desc">An inspector asks to see induction records for every operative. You have paper forms in a portacabin.</div>
              </div>
              <div className="l-prob">
                <div className="l-prob-x">✗</div>
                <div className="l-prob-title">Expired credentials unnoticed</div>
                <div className="l-prob-desc">An operative&apos;s CSCS card expired months ago. Nobody noticed. They&apos;ve been on site — that&apos;s your liability.</div>
              </div>
              <div className="l-prob">
                <div className="l-prob-x">✗</div>
                <div className="l-prob-title">No real-time site visibility</div>
                <div className="l-prob-desc">In an emergency muster, you can&apos;t confirm who&apos;s on site. Paper sign-in sheets are incomplete or missing.</div>
              </div>
              <div className="l-prob">
                <div className="l-prob-x">✗</div>
                <div className="l-prob-title">Inductions with no audit trail</div>
                <div className="l-prob-desc">Workers briefed verbally or on paper. When they leave, there&apos;s no verifiable record it happened.</div>
              </div>
            </div>
          </div>
        </div>

        {/* CDM BANNER */}
        <div className="l-cdm">
          <div className="l-cdm-inner">
            <h2>CDM 2015 requires proof that every worker was inducted.</h2>
            <p>If an HSE inspector visits your site and you cannot demonstrate that every person has been inducted, you face an improvement notice — or in serious cases, prosecution. NekaID gives you that evidence instantly, for every operative, on every site.</p>
            <Link href="/login" className="l-btn-white">Start protecting your site today</Link>
          </div>
        </div>

        {/* FEATURES */}
        <div className="l-features" id="features">
          <div className="l-features-inner">
            <div className="l-section-label">What NekaID does</div>
            <h2 className="l-h2">Everything in one place.<br />Nothing on paper.</h2>
            <div className="l-feat-grid">
              {[
                { icon: '🪪', title: 'Digital operative passport', desc: 'Every operative gets a digital passport with their photo, CSCS card, qualifications, and certificates — scannable via QR code in seconds.' },
                { icon: '📍', title: 'GPS-assisted attendance', desc: 'Workers sign in with one tap on their phone. At the end of the day, GPS detects when they leave the site and signs them out automatically.' },
                { icon: '📋', title: 'Digital inductions', desc: 'Send site-specific inductions to workers before they arrive. Completion is tracked and stored — your CDM 2015 evidence, done.' },
                { icon: '🔔', title: 'Expiry alerts', desc: 'Get push notifications 30 days before any operative\'s CSCS card or qualification expires. No compliance surprises.' },
                { icon: '💬', title: 'Two-way messaging', desc: 'Send messages, documents, and images directly to operatives. They receive push notifications — no email or phone number needed.' },
                { icon: '📊', title: 'Live site dashboard', desc: 'See who\'s on site right now, who\'s completed inductions, and who needs attention — all updating in real time.' },
              ].map((f) => (
                <div key={f.title} className="l-feat">
                  <div className="l-feat-icon">{f.icon}</div>
                  <div className="l-feat-title">{f.title}</div>
                  <div className="l-feat-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="l-how" id="how">
          <div className="l-how-inner">
            <div className="l-section-label">How it works</div>
            <h2 className="l-h2">Up and running in under ten minutes</h2>
            <div className="l-steps">
              {[
                { n: '01', title: 'Operative creates their passport', desc: 'Signs up, uploads CSCS card and qualifications. Two minutes. Installs NekaID as an app on their phone.' },
                { n: '02', title: 'Manager scans on arrival', desc: 'Site manager scans the operative\'s QR code on day one. All credentials visible instantly — no forms, no waiting.' },
                { n: '03', title: 'One tap to sign in', desc: 'Worker taps sign in on their phone each morning. GPS automatically signs them out when they leave the site.' },
                { n: '04', title: 'Inductions tracked digitally', desc: 'Send inductions through the app. Workers complete on their phone. Records stored automatically, ready for any audit.' },
              ].map((s) => (
                <div key={s.n} className="l-step">
                  <div className="l-step-circle">{s.n}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PRICING */}
        <div className="l-pricing" id="pricing">
          <div className="l-pricing-inner">
            <div className="l-section-label">Pricing</div>
            <h2 className="l-h2">Pay per operative. Scale as you grow.</h2>
            <p className="l-pricing-sub">No long-term contracts. Cancel anytime.</p>
            <div className="l-plans">
              <div className="l-plan">
                <div className="l-plan-name">Starter</div>
                <div className="l-plan-price">Free</div>
                <div className="l-plan-min">For individual operatives</div>
                <ul className="l-plan-features">
                  <li className="blue">Digital passport</li>
                  <li className="blue">QR code profile</li>
                  <li className="blue">Credential storage</li>
                </ul>
                <Link href="/login" className="l-plan-btn btn-outline-blue">Create free account</Link>
              </div>
              <div className="l-plan">
                <div className="l-plan-name">Pro</div>
                <div className="l-plan-price">£4<sub>/worker/mo</sub></div>
                <div className="l-plan-min">Up to 20 workers · min £49/mo</div>
                <ul className="l-plan-features">
                  <li className="blue">GPS-assisted attendance</li>
                  <li className="blue">Digital inductions</li>
                  <li className="blue">Two-way messaging</li>
                  <li className="blue">Push notifications</li>
                  <li className="blue">Live site dashboard</li>
                </ul>
                <Link href="/login" className="l-plan-btn btn-solid-blue">Get started</Link>
              </div>
              <div className="l-plan featured">
                <div className="l-plan-badge badge-blue">Most popular</div>
                <div className="l-plan-name">Business</div>
                <div className="l-plan-price">£3.50<sub>/worker/mo</sub></div>
                <div className="l-plan-min">Up to 100 workers · min £149/mo</div>
                <ul className="l-plan-features">
                  <li className="blue">Everything in Pro</li>
                  <li className="blue">Multi-site management</li>
                  <li className="blue">Attendance reports</li>
                  <li className="blue">Expiry alerts</li>
                  <li className="blue">Priority support</li>
                </ul>
                <Link href="/login" className="l-plan-btn btn-solid-blue">Get started</Link>
              </div>
              <div className="l-plan">
                <div className="l-plan-name">Enterprise</div>
                <div className="l-plan-price">£2.50<sub>/worker/mo</sub></div>
                <div className="l-plan-min">Unlimited workers · min £499/mo</div>
                <ul className="l-plan-features">
                  <li className="blue">Everything in Business</li>
                  <li className="blue">Custom branding &amp; logo</li>
                  <li className="blue">Dedicated account manager</li>
                  <li className="blue">Custom features available</li>
                  <li className="blue">Onboarding support</li>
                </ul>
                <Link href="/login" className="l-plan-btn btn-solid-blue">Get started</Link>
              </div>
              <div className="l-plan agency">
                <div className="l-plan-badge badge-teal">For agencies</div>
                <div className="l-plan-name">Agency</div>
                <div className="l-plan-price">£2<sub>/worker/mo</sub></div>
                <div className="l-plan-min">Unlimited workers · no minimum</div>
                <ul className="l-plan-features">
                  <li className="teal">Full worker passport visibility</li>
                  <li className="teal">Credential expiry alerts</li>
                  <li className="teal">Compliance dashboard</li>
                  <li className="teal">Works across all client sites</li>
                  <li className="teal">Worker placement tracking</li>
                </ul>
                <Link href="/login" className="l-plan-btn btn-solid-teal">Get started</Link>
              </div>
            </div>
            <div className="l-roi">
              <p><strong>200 operatives on Business costs £500/month.</strong> One HSE improvement notice costs more than that in paperwork, delays, and management time alone. NekaID pays for itself the first time an inspector visits.</p>
            </div>
            <div style={{ marginTop: '1rem' }} className="l-agency-note">
              <p><strong>Running a labour agency?</strong> Keep your entire workforce compliant across every client site — credentials, expirations, and attendance — all in one dashboard. At £2/worker, it&apos;s the most cost-effective compliance tool available.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="l-cta">
          <div className="l-cta-inner">
            <h2 className="l-h2">Your site. Your workers.<br />Fully compliant.</h2>
            <p>Join construction teams across the UK who&apos;ve replaced paper processes with NekaID. Setup takes under ten minutes.</p>
            <Link href="/login" className="l-btn-blue" style={{ padding: '0.9rem 2.25rem', fontSize: '1rem' }}>Get started free</Link>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="l-footer">
          <div className="l-footer-logo">Neka<span>ID</span></div>
          <div className="l-footer-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="mailto:info@nekaid.co.uk">Contact</Link>
          </div>
          <div className="l-footer-copy">© 2026 NekaID · Built for UK construction</div>
        </footer>

      </div>
    </>
  )
}
