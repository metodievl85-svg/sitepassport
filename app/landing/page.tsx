'use client'

import { useState } from 'react'
import Link from 'next/link'

const DATA = {
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

type Tier = { n: string; l: string; m: number; y: number; pop?: boolean; f: string[] }

export default function LandingPage() {
  const [tab, setTab] = useState<'site' | 'agency'>('site')
  const [yearly, setYearly] = useState(false)

  const tiers: Tier[] = DATA[tab]

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />

      <style>{`
        .nkx *{box-sizing:border-box;margin:0;padding:0}
        .nkx{
          --nk-blue:#16307f;
          --nk-blue-mid:#1a3a99;
          --nk-accent:#3b82f6;
          --nk-accent-light:#93c5fd;
          --nk-gold:#c8a44a;
          --nk-bg:#080c1a;
          --nk-bg2:#0d1428;
          --nk-bg3:#111936;
          --nk-text:#f0f2f8;
          --nk-muted:#8892b0;
          --nk-border:rgba(255,255,255,0.08);
          --nk-border2:rgba(255,255,255,0.14);
          --nk-green:#22c55e;
          --nk-amber:#fbbf24;
          background:var(--nk-bg);
          color:var(--nk-text);
          font-family:'DM Sans',sans-serif;
          font-size:16px;
          line-height:1.6;
          overflow-x:hidden;
        }
        .nkx h1,.nkx h2,.nkx h3,.nkx h4{font-family:'Fraunces',serif;line-height:1.15}

        /* NAV */
        .nkx .lnav{position:sticky;top:0;z-index:100;background:rgba(8,12,26,0.9);backdrop-filter:blur(20px);border-bottom:1px solid var(--nk-border);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between}
        .nkx .lnav-logo{font-family:'Fraunces',serif;font-size:22px;font-weight:500;color:#fff;letter-spacing:-0.02em;text-decoration:none}
        .nkx .lnav-logo span{color:var(--nk-accent-light)}
        .nkx .lnav-links{display:flex;align-items:center;gap:32px}
        .nkx .lnav-links a{color:var(--nk-muted);text-decoration:none;font-size:14px;font-weight:500;transition:color 0.2s}
        .nkx .lnav-links a:hover{color:var(--nk-text)}
        .nkx .lnav-cta{display:flex;align-items:center;gap:10px}
        .nkx .lbtn-login{background:none;border:1px solid var(--nk-border2);color:var(--nk-text);padding:8px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.2s;text-decoration:none;display:inline-flex;align-items:center}
        .nkx .lbtn-login:hover{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.25)}
        .nkx .lbtn-primary{background:var(--nk-blue);border:none;color:#fff;padding:8px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.2s;text-decoration:none;display:inline-flex;align-items:center}
        .nkx .lbtn-primary:hover{background:var(--nk-blue-mid)}

        /* HERO */
        .nkx .lhero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:100px 40px 80px;position:relative;overflow:hidden}
        .nkx .lhero-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 60% 20%,rgba(22,48,127,0.35) 0%,transparent 70%);pointer-events:none}
        .nkx .lhero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:60px 60px;pointer-events:none}
        .nkx .lhero-inner{max-width:1200px;margin:0 auto;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;position:relative;z-index:1}
        .nkx .lhero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(22,48,127,0.3);border:1px solid rgba(59,130,246,0.3);border-radius:100px;padding:6px 14px;font-size:12px;font-weight:600;color:var(--nk-accent-light);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:24px}
        .nkx .lhero-dot{width:6px;height:6px;background:var(--nk-green);border-radius:50%;animation:nkpulse 2s infinite}
        @keyframes nkpulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .nkx .lhero h1{font-size:58px;font-weight:400;color:#fff;margin-bottom:24px;letter-spacing:-0.02em}
        .nkx .lhero h1 em{font-style:italic;color:var(--nk-accent-light)}
        .nkx .lhero-sub{font-size:18px;color:var(--nk-muted);line-height:1.7;margin-bottom:40px;max-width:480px}
        .nkx .lhero-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
        .nkx .lbtn-hero{background:var(--nk-blue);border:none;color:#fff;padding:14px 28px;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.2s;text-decoration:none;display:inline-flex;align-items:center}
        .nkx .lbtn-hero:hover{background:var(--nk-blue-mid);transform:translateY(-1px)}
        .nkx .lbtn-ghost{background:none;border:1px solid var(--nk-border2);color:var(--nk-text);padding:14px 28px;border-radius:10px;font-size:16px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.2s;text-decoration:none;display:inline-flex;align-items:center}
        .nkx .lbtn-ghost:hover{border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.05)}
        .nkx .lhero-trust{margin-top:48px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
        .nkx .lhero-trust-text{font-size:13px;color:var(--nk-muted)}
        .nkx .ltrust-badge{background:rgba(255,255,255,0.04);border:1px solid var(--nk-border);border-radius:8px;padding:5px 12px;font-size:12px;color:var(--nk-muted);font-weight:500}

        /* PASSPORT MOCKUP */
        .nkx .lpassport{position:relative;padding:30px}
        .nkx .lpc{background:linear-gradient(135deg,#0d1e52 0%,#16307f 50%,#1e40a0 100%);border:1px solid rgba(59,130,246,0.3);border-radius:20px;padding:28px;box-shadow:0 40px 80px rgba(0,0,0,0.5);position:relative;overflow:hidden}
        .nkx .lpc::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 80% 20%,rgba(255,255,255,0.06) 0%,transparent 60%);pointer-events:none}
        .nkx .lpc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
        .nkx .lpc-logo{font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:0.1em;text-transform:uppercase}
        .nkx .lpc-badge{background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;color:#4ade80;letter-spacing:0.05em}
        .nkx .lpc-worker{display:flex;gap:16px;align-items:center;margin-bottom:20px}
        .nkx .lpc-avatar{width:64px;height:64px;border-radius:12px;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:rgba(255,255,255,0.7);font-family:'Fraunces',serif;flex-shrink:0}
        .nkx .lpc-worker h3{font-family:'DM Sans',sans-serif;font-size:18px;font-weight:700;color:#fff;margin-bottom:2px}
        .nkx .lpc-worker p{font-size:13px;color:rgba(255,255,255,0.5)}
        .nkx .lpc-divider{height:1px;background:rgba(255,255,255,0.08);margin:16px 0}
        .nkx .lpc-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .nkx .lpc-label{font-size:11px;color:rgba(255,255,255,0.4);font-weight:500;text-transform:uppercase;letter-spacing:0.06em}
        .nkx .lpc-val{font-size:13px;font-weight:600}
        .nkx .lpc-val.green{color:#4ade80}
        .nkx .lpc-val.amber{color:#fbbf24}
        .nkx .lpc-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
        .nkx .lpc-chip{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:5px 10px;font-size:11px;color:rgba(255,255,255,0.6);font-weight:500}
        .nkx .lpc-chip.on{background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.25);color:#4ade80}
        .nkx .lpc-scan{margin-top:20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between}
        .nkx .lpc-scan-text{font-size:12px;color:rgba(255,255,255,0.35)}
        .nkx .lpc-qr{width:32px;height:32px;display:grid;grid-template-columns:repeat(5,1fr);gap:2px}
        .nkx .lpc-qr span{border-radius:1px}
        .nkx .lfloat{position:absolute;background:rgba(10,16,36,0.96);border:1px solid var(--nk-border2);border-radius:12px;padding:12px 16px;z-index:2}
        .nkx .lfloat.tr{top:0;right:0}
        .nkx .lfloat.bl{bottom:0;left:0}
        .nkx .lfloat-label{font-size:10px;color:var(--nk-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px}
        .nkx .lfloat-val{font-size:20px;font-weight:700;font-family:'Fraunces',serif}
        .nkx .lfloat-val.green{color:var(--nk-green)}
        .nkx .lfloat-val.blue{color:var(--nk-accent-light)}
        .nkx .lfloat-sub{font-size:11px;color:var(--nk-muted);margin-top:2px}

        /* STATS */
        .nkx .lstats{background:var(--nk-bg2);border-top:1px solid var(--nk-border);border-bottom:1px solid var(--nk-border);padding:32px 40px}
        .nkx .lstats-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:40px}
        .nkx .lstat{text-align:center}
        .nkx .lstat-num{font-family:'Fraunces',serif;font-size:44px;font-weight:500;color:#fff;margin-bottom:4px}
        .nkx .lstat-num span{color:var(--nk-accent-light)}
        .nkx .lstat-label{font-size:13px;color:var(--nk-muted)}

        /* SECTIONS */
        .nkx .lsec{padding:100px 40px}
        .nkx .lsec-inner{max-width:1200px;margin:0 auto}
        .nkx .lsec.dark{background:var(--nk-bg2)}
        .nkx .leyebrow{font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--nk-accent-light);margin-bottom:16px}
        .nkx .lsec-title{font-size:48px;font-weight:400;color:#fff;margin-bottom:20px;line-height:1.1}
        .nkx .lsec-title em{font-style:italic;color:var(--nk-accent-light)}
        .nkx .lsec-sub{font-size:18px;color:var(--nk-muted);max-width:560px;line-height:1.7}

        /* WHY */
        .nkx .lwhy-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:60px}
        .nkx .lwhy-card{background:var(--nk-bg2);border:1px solid var(--nk-border);border-radius:16px;padding:32px;transition:border-color 0.2s}
        .nkx .lwhy-card:hover{border-color:var(--nk-border2)}
        .nkx .lwhy-card.feat{background:linear-gradient(135deg,rgba(22,48,127,0.4),rgba(22,48,127,0.15));border-color:rgba(59,130,246,0.3);grid-column:span 2;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
        .nkx .lwhy-icon{width:48px;height:48px;background:rgba(22,48,127,0.4);border:1px solid rgba(59,130,246,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:20px}
        .nkx .lwhy-card h3{font-family:'Fraunces',serif;font-size:22px;font-weight:500;color:#fff;margin-bottom:10px}
        .nkx .lwhy-card p{font-size:15px;color:var(--nk-muted);line-height:1.7}
        .nkx .lwhy-num{font-family:'Fraunces',serif;font-size:80px;font-weight:400;color:rgba(59,130,246,0.12);line-height:1;margin-bottom:16px}
        .nkx .lcompliance-box{background:rgba(22,48,127,0.3);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:24px}
        .nkx .lcompliance-label{font-size:13px;color:var(--nk-muted);margin-bottom:16px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em}
        .nkx .lcompliance-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:8px;margin-bottom:8px}
        .nkx .lcompliance-row.ok{background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2)}
        .nkx .lcompliance-row.warn{background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2)}
        .nkx .lcompliance-row span:first-child{font-size:13px;color:rgba(255,255,255,0.7)}
        .nkx .lcompliance-row span:last-child{font-size:12px;font-weight:700}
        .nkx .lcompliance-row.ok span:last-child{color:#4ade80}
        .nkx .lcompliance-row.warn span:last-child{color:#fbbf24}

        /* FEATURES GRID */
        .nkx .lfeat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--nk-border);border:1px solid var(--nk-border);border-radius:16px;overflow:hidden;margin-top:60px}
        .nkx .lfeat-cell{background:var(--nk-bg2);padding:36px 32px;transition:background 0.2s}
        .nkx .lfeat-cell:hover{background:var(--nk-bg3)}
        .nkx .lfeat-icon{font-size:28px;margin-bottom:16px;display:block}
        .nkx .lfeat-title{font-family:'Fraunces',serif;font-size:20px;font-weight:500;color:#fff;margin-bottom:8px}
        .nkx .lfeat-desc{font-size:14px;color:var(--nk-muted);line-height:1.7}

        /* STEPS */
        .nkx .lsteps{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:60px;position:relative}
        .nkx .lsteps::before{content:'';position:absolute;top:27px;left:calc(16.66% + 16px);right:calc(16.66% + 16px);height:1px;background:linear-gradient(90deg,var(--nk-blue),rgba(59,130,246,0.3),var(--nk-blue));z-index:0}
        .nkx .lstep{position:relative;z-index:1}
        .nkx .lstep-num{width:56px;height:56px;background:var(--nk-blue);border:1px solid rgba(59,130,246,0.4);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:22px;font-weight:500;color:#fff;margin-bottom:24px}
        .nkx .lstep h3{font-family:'Fraunces',serif;font-size:22px;font-weight:500;color:#fff;margin-bottom:10px}
        .nkx .lstep p{font-size:15px;color:var(--nk-muted);line-height:1.7}
        .nkx .lstep-tag{display:inline-block;background:rgba(22,48,127,0.3);border:1px solid rgba(59,130,246,0.2);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:600;color:var(--nk-accent-light);text-transform:uppercase;letter-spacing:0.06em;margin-top:14px}

        /* PRICING */
        .nkx .lptabs{display:flex;background:rgba(255,255,255,0.05);border:1px solid var(--nk-border2);border-radius:10px;padding:4px;width:fit-content;margin:0 auto 20px}
        .nkx .lptab{padding:8px 28px;border-radius:7px;font-size:14px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.2s;color:#fff;background:none}
        .nkx .lptab.on{background:var(--nk-blue);color:#fff}
        .nkx .lptab:not(.on){color:rgba(255,255,255,0.7)}
        .nkx .lptoggle{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:48px;font-size:14px}
        .nkx .lptoggle-pill{width:44px;height:24px;background:var(--nk-blue);border-radius:100px;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0}
        .nkx .lptoggle-dot{width:18px;height:18px;background:#fff;border-radius:50%;position:absolute;top:3px;left:3px;transition:transform 0.2s}
        .nkx .lpsave{background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.25);border-radius:100px;padding:3px 10px;font-size:11px;font-weight:700;color:#4ade80}
        .nkx .lpgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .nkx .lpcard{background:var(--nk-bg2);border:1px solid var(--nk-border);border-radius:16px;padding:28px 24px;position:relative;transition:border-color 0.2s;display:flex;flex-direction:column}
        .nkx .lpcard:hover{border-color:var(--nk-border2)}
        .nkx .lpcard.hot{background:linear-gradient(160deg,rgba(22,48,127,0.5),rgba(13,30,82,0.8));border-color:rgba(59,130,246,0.5);box-shadow:0 0 40px rgba(22,48,127,0.3)}
        .nkx .lppop{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--nk-blue);color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:100px;white-space:nowrap;letter-spacing:0.04em}
        .nkx .lptier{font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}
        .nkx .lplimit{font-size:13px;color:var(--nk-muted);margin-bottom:20px}
        .nkx .lpamount{display:flex;align-items:baseline;gap:4px;margin-bottom:4px}
        .nkx .lpcurr{font-size:22px;font-weight:600;color:#fff;font-family:'Fraunces',serif}
        .nkx .lpnum{font-family:'Fraunces',serif;font-size:52px;font-weight:400;color:#fff;line-height:1}
        .nkx .lpperiod{font-size:14px;color:var(--nk-muted)}
        .nkx .lpalt{font-size:12px;color:var(--nk-muted);margin-bottom:24px}
        .nkx .lpdivider{height:1px;background:var(--nk-border);margin:20px 0}
        .nkx .lpfeats{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:28px;flex:1}
        .nkx .lpfeats li{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--nk-muted)}
        .nkx .lpfeats li::before{content:'✓';color:var(--nk-green);font-weight:700;font-size:13px;flex-shrink:0;margin-top:1px}
        .nkx .lpfeats li.xtra::before{content:'★';color:var(--nk-gold)}
        .nkx .lpbtn{width:100%;padding:12px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.2s;border:none;text-align:center;display:block;text-decoration:none}
        .nkx .lpbtn.out{background:none;border:1px solid var(--nk-border2);color:var(--nk-text)}
        .nkx .lpbtn.out:hover{border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.05)}
        .nkx .lpbtn.fill{background:var(--nk-blue);color:#fff}
        .nkx .lpbtn.fill:hover{background:var(--nk-blue-mid)}

        /* PROOF */
        .nkx .lproof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:60px}
        .nkx .lproof-card{background:var(--nk-bg3);border:1px solid var(--nk-border);border-radius:16px;padding:28px}
        .nkx .lproof-stars{color:var(--nk-gold);font-size:14px;margin-bottom:16px;letter-spacing:2px}
        .nkx .lproof-quote{font-size:15px;color:var(--nk-text);line-height:1.7;margin-bottom:20px;font-style:italic}
        .nkx .lproof-author{display:flex;align-items:center;gap:12px}
        .nkx .lproof-avatar{width:40px;height:40px;border-radius:50%;background:var(--nk-blue);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;font-family:'Fraunces',serif;flex-shrink:0}
        .nkx .lproof-name{font-size:14px;font-weight:600;color:#fff}
        .nkx .lproof-role{font-size:12px;color:var(--nk-muted)}

        /* CTA */
        .nkx .lcta{padding:120px 40px;text-align:center;position:relative;overflow:hidden}
        .nkx .lcta-bg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 50%,rgba(22,48,127,0.4) 0%,transparent 70%);pointer-events:none}
        .nkx .lcta-inner{position:relative;z-index:1;max-width:700px;margin:0 auto}
        .nkx .lcta-inner h2{font-size:52px;font-weight:400;color:#fff;margin-bottom:20px;line-height:1.1}
        .nkx .lcta-inner h2 em{font-style:italic;color:var(--nk-accent-light)}
        .nkx .lcta-inner p{font-size:18px;color:var(--nk-muted);margin-bottom:40px}
        .nkx .lcta-actions{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap}
        .nkx .lcta-note{font-size:13px;color:var(--nk-muted);margin-top:20px}

        /* FOOTER */
        .nkx .lfoot{background:var(--nk-bg2);border-top:1px solid var(--nk-border);padding:60px 40px 40px}
        .nkx .lfoot-inner{max-width:1200px;margin:0 auto}
        .nkx .lfoot-top{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:60px;margin-bottom:48px}
        .nkx .lfoot-brand-name{font-family:'Fraunces',serif;font-size:24px;font-weight:500;color:#fff;margin-bottom:12px}
        .nkx .lfoot-brand-name span{color:var(--nk-accent-light)}
        .nkx .lfoot-brand p{font-size:14px;color:var(--nk-muted);line-height:1.7;max-width:280px}
        .nkx .lfoot-col h4{font-size:13px;font-weight:700;color:var(--nk-text);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px}
        .nkx .lfoot-col a{display:block;font-size:14px;color:var(--nk-muted);text-decoration:none;margin-bottom:10px;transition:color 0.2s}
        .nkx .lfoot-col a:hover{color:var(--nk-text)}
        .nkx .lfoot-bottom{border-top:1px solid var(--nk-border);padding-top:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
        .nkx .lfoot-bottom p{font-size:13px;color:var(--nk-muted)}

        @media(max-width:900px){
          .nkx .lhero-inner{grid-template-columns:1fr}
          .nkx .lpassport{display:none}
          .nkx .lstats-inner{grid-template-columns:repeat(2,1fr)}
          .nkx .lwhy-grid{grid-template-columns:1fr}
          .nkx .lwhy-card.feat{grid-column:span 1;grid-template-columns:1fr}
          .nkx .lfeat-grid{grid-template-columns:1fr}
          .nkx .lsteps{grid-template-columns:1fr}
          .nkx .lsteps::before{display:none}
          .nkx .lpgrid{grid-template-columns:repeat(2,1fr)}
          .nkx .lproof-grid{grid-template-columns:1fr}
          .nkx .lfoot-top{grid-template-columns:1fr 1fr}
          .nkx .lnav-links{display:none}
          .nkx .lsec{padding:60px 20px}
          .nkx .lhero{padding:80px 20px 60px}
          .nkx .lhero h1{font-size:38px}
          .nkx .lsec-title{font-size:32px}
        }
      `}</style>

      <div className="nkx">
        {/* NAV */}
        <nav className="lnav">
          <a href="/landing" className="lnav-logo">Neka<span>ID</span></a>
          <div className="lnav-links">
            <a href="#why">Why NekaID</a>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="lnav-cta">
            <Link href="/login" className="lbtn-login">Log in</Link>
            <Link href="/login?mode=signup" className="lbtn-primary">Start free trial</Link>
          </div>
        </nav>

        {/* HERO */}
        <div className="lhero">
          <div className="lhero-bg" />
          <div className="lhero-grid" />
          <div className="lhero-inner">
            <div>
              <div className="lhero-badge">
                <span className="lhero-dot" />
                Live on UK construction sites
              </div>
              <h1>The credential that <em>travels</em> with your workforce.</h1>
              <p className="lhero-sub">One digital passport per operative. Every CSCS card, qualification, induction, and right-to-work check — verified in seconds, compliant by design.</p>
              <div className="lhero-actions">
                <Link href="/login?mode=signup" className="lbtn-hero">Start free for 14 days</Link>
                <a href="#how" className="lbtn-ghost">See how it works →</a>
              </div>
              <div className="lhero-trust">
                <span className="lhero-trust-text">Built for UK sites</span>
                <span className="ltrust-badge">CDM 2015 aligned</span>
                <span className="ltrust-badge">GDPR compliant</span>
                <span className="ltrust-badge">No paper. Ever.</span>
              </div>
            </div>
            <div className="lpassport">
              <div className="lfloat tr">
                <div className="lfloat-label">On site now</div>
                <div className="lfloat-val green">14</div>
                <div className="lfloat-sub">↑ 3 since yesterday</div>
              </div>
              <div className="lpc">
                <div className="lpc-header">
                  <div className="lpc-logo">NekaID · Digital Passport</div>
                  <div className="lpc-badge">✓ VERIFIED</div>
                </div>
                <div className="lpc-worker">
                  <div className="lpc-avatar">JS</div>
                  <div>
                    <h3>J. Smith</h3>
                    <p>Carpenter · NVQ Level 2</p>
                  </div>
                </div>
                <div className="lpc-divider" />
                <div className="lpc-row"><span className="lpc-label">CSCS Card</span><span className="lpc-val green">Valid · Mar 2027</span></div>
                <div className="lpc-row"><span className="lpc-label">Right to Work</span><span className="lpc-val green">Verified ✓</span></div>
                <div className="lpc-row"><span className="lpc-label">Induction</span><span className="lpc-val green">Completed ✓</span></div>
                <div className="lpc-row"><span className="lpc-label">Signed in</span><span className="lpc-val amber">Today · 07:42</span></div>
                <div className="lpc-chips">
                  <span className="lpc-chip on">IPAF</span>
                  <span className="lpc-chip on">First Aid</span>
                  <span className="lpc-chip on">PASMA</span>
                  <span className="lpc-chip">Asbestos</span>
                </div>
                <div className="lpc-scan">
                  <span className="lpc-scan-text">Scan to verify · nekaid.co.uk</span>
                  <div className="lpc-qr">
                    {[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1].map((v,i)=>(
                      <span key={i} style={{background:v?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.15)'}} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="lfloat bl">
                <div className="lfloat-label">Expiry alert</div>
                <div className="lfloat-val blue">30 days</div>
                <div className="lfloat-sub">Push + email sent</div>
              </div>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="lstats">
          <div className="lstats-inner">
            <div className="lstat"><div className="lstat-num"><span>2</span>sec</div><div className="lstat-label">To verify any operative</div></div>
            <div className="lstat"><div className="lstat-num"><span>£0</span></div><div className="lstat-label">For workers — always free</div></div>
            <div className="lstat"><div className="lstat-num"><span>100</span>%</div><div className="lstat-label">CDM 2015 audit-ready</div></div>
            <div className="lstat"><div className="lstat-num"><span>14</span>day</div><div className="lstat-label">Free trial, no commitment</div></div>
          </div>
        </div>

        {/* WHY */}
        <section className="lsec" id="why">
          <div className="lsec-inner">
            <div className="leyebrow">Why NekaID</div>
            <h2 className="lsec-title">Paper doesn&apos;t survive<br />a building site. <em>A passport does.</em></h2>
            <p className="lsec-sub">Inductions get lost, cards expire unnoticed, and an inspection turns into a scramble through folders. NekaID makes compliance something you carry, not something you file.</p>
            <div className="lwhy-grid">
              <div className="lwhy-card feat">
                <div>
                  <div className="lwhy-num">01</div>
                  <h3>One source of truth</h3>
                  <p>Every credential, induction, attendance record, and qualification — built once by the operative, verified once, carried from site to site forever. No more chasing paperwork.</p>
                </div>
                <div className="lcompliance-box">
                  <div className="lcompliance-label">Live compliance view</div>
                  <div className="lcompliance-row ok"><span>CSCS Card</span><span>VALID ✓</span></div>
                  <div className="lcompliance-row ok"><span>Right to Work</span><span>VERIFIED ✓</span></div>
                  <div className="lcompliance-row warn"><span>First Aid</span><span>EXPIRES 28 DAYS</span></div>
                  <div className="lcompliance-row ok"><span>Site Induction</span><span>COMPLETED ✓</span></div>
                </div>
              </div>
              <div className="lwhy-card">
                <div className="lwhy-icon">⚡</div>
                <h3>Verified in seconds</h3>
                <p>Scan a worker&apos;s QR code and see live compliance instantly. The view adapts — restricted for public, full detail for site managers, complete picture for agencies.</p>
              </div>
              <div className="lwhy-card">
                <div className="lwhy-icon">🔔</div>
                <h3>Nothing expires unseen</h3>
                <p>Automatic push and email alerts reach the manager 30 and 7 days before any card or qualification lapses. The risk surfaces before it bites.</p>
              </div>
              <div className="lwhy-card">
                <div className="lwhy-icon">📋</div>
                <h3>An audit trail, on demand</h3>
                <p>Attendance, inductions, toolbox talks, and competence are recorded as you go — the evidence CDM 2015 expects, ready in a moment, not a box.</p>
              </div>
              <div className="lwhy-card">
                <div className="lwhy-icon">🏗️</div>
                <h3>Built for the real site</h3>
                <p>GPS sign-in, manual override, daily attendance register with PDF export — designed by people who know that not every operative remembers their phone every morning.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="lsec dark" id="features">
          <div className="lsec-inner">
            <div className="leyebrow">The platform</div>
            <h2 className="lsec-title">Everything the site needs.<br /><em>Nothing it doesn&apos;t.</em></h2>
            <div className="lfeat-grid">
              {[
                {icon:'🪪',title:'Worker passport',desc:'CSCS, qualifications, Right to Work, NI number, bank details, next of kin — all in one secure digital profile, built once by the operative.'},
                {icon:'📷',title:'QR verification',desc:'One scan confirms live compliance. Restricted view for sites, full detail for agencies, public name and photo only for unauthenticated scans.'},
                {icon:'📍',title:'GPS attendance',desc:'Tap to sign in. Auto sign-out by geofence or 16:30 daily. Manual override for managers. Live headcount on the dashboard, always accurate.'},
                {icon:'📚',title:'Digital inductions',desc:'Send safety and site inductions through the app. Completion lands on the operative\'s passport with timestamp and signature.'},
                {icon:'🛡️',title:'Toolbox talks',desc:'10 pre-written templates covering working at height, COSHH, electrical safety and more. Send to all or select operatives. Signed in 60 seconds.'},
                {icon:'💬',title:'Two-way messaging',desc:'Text, images, and PDFs between managers and operatives — with push notifications. Group broadcasts for agencies across entire placements.'},
                {icon:'📊',title:'Attendance register',desc:'Weekly and monthly view of who was on site. GPS and manual entries. Export as a professional PDF register — audit-ready, dated, signed.'},
                {icon:'⏰',title:'Expiry alerts',desc:'Push and email warnings 30 and 7 days before any credential expires. Never get caught out by a lapsed CSCS card during an inspection.'},
                {icon:'👥',title:'Team & organisation',desc:'Multi-user teams under one account. Owners, admins, and members — each seeing the right data for their role across all sites.'},
              ].map((f,i)=>(
                <div key={i} className="lfeat-cell">
                  <span className="lfeat-icon">{f.icon}</span>
                  <div className="lfeat-title">{f.title}</div>
                  <p className="lfeat-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="lsec" id="how">
          <div className="lsec-inner">
            <div className="leyebrow">How it works</div>
            <h2 className="lsec-title">Up and running before<br /><em>the morning brief.</em></h2>
            <div className="lsteps">
              <div className="lstep">
                <div className="lstep-num">1</div>
                <h3>The operative builds it once</h3>
                <p>They add their CSCS card, photo, qualifications, and right to work. It installs as an app on their phone. Shared by link — no app store required.</p>
                <span className="lstep-tag">5 minutes</span>
              </div>
              <div className="lstep">
                <div className="lstep-num">2</div>
                <h3>The site scans the code</h3>
                <p>One QR scan confirms live compliance, runs the induction, and signs the operative in. Managers see the dashboard update in real time.</p>
                <span className="lstep-tag">Under 2 seconds</span>
              </div>
              <div className="lstep">
                <div className="lstep-num">3</div>
                <h3>You stay compliant</h3>
                <p>Attendance, inductions, toolbox talks, and expiry alerts roll up automatically. The audit trail builds itself while you focus on the job.</p>
                <span className="lstep-tag">Zero admin</span>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="lsec" id="pricing" style={{background:'var(--nk-bg)'}}>
          <div className="lsec-inner">
            <div className="leyebrow" style={{textAlign:'center'}}>Pricing</div>
            <h2 className="lsec-title" style={{textAlign:'center'}}>Per site. <em>Workers always free.</em></h2>
            <p className="lsec-sub" style={{textAlign:'center',margin:'0 auto 40px'}}>Simple, transparent pricing. Start free for 14 days — card required, cancel any time.</p>

            <div className="lptabs">
              <button className={`lptab${tab==='site'?' on':''}`} onClick={()=>setTab('site')}>Site Managers</button>
              <button className={`lptab${tab==='agency'?' on':''}`} onClick={()=>setTab('agency')}>Agencies</button>
            </div>

            <div className="lptoggle">
              <span style={{color:yearly?'var(--nk-muted)':'var(--nk-text)',fontWeight:yearly?400:600}}>Monthly</span>
              <div className="lptoggle-pill" onClick={()=>setYearly(y=>!y)}>
                <div className="lptoggle-dot" style={{transform:yearly?'translateX(20px)':'translateX(0)'}} />
              </div>
              <span style={{color:yearly?'var(--nk-text)':'var(--nk-muted)',fontWeight:yearly?600:400}}>Annual</span>
              {yearly && <span className="lpsave">Save ~17%</span>}
            </div>

            <div className="lpgrid">
              {tiers.map((t,i)=>{
                const price = yearly ? t.y : t.m
                const alt = yearly ? `£${t.m}/mo billed monthly` : `£${t.y}/mo billed annually`
                const isLast = t.n==='Unlimited'||t.n==='Enterprise'
                return (
                  <div key={i} className={`lpcard${t.pop?' hot':''}`}>
                    {t.pop && <div className="lppop">Most chosen</div>}
                    <div className="lptier">{t.n}</div>
                    <div className="lplimit">{t.l}</div>
                    <div className="lpamount">
                      <span className="lpcurr">£</span>
                      <span className="lpnum">{price}</span>
                    </div>
                    <div className="lpperiod">/mo · {yearly?'billed yearly':'billed monthly'}</div>
                    <div className="lpalt">{alt}</div>
                    <div className="lpdivider" />
                    <ul className="lpfeats">
                      {t.f.map((f,j)=>(
                        <li key={j} className={isLast&&j===t.f.length-1?'xtra':''}>{f}</li>
                      ))}
                    </ul>
                    <Link href="/login?mode=signup" className={`lpbtn${t.pop?' fill':' out'}`}>Start free trial</Link>
                  </div>
                )
              })}
            </div>

            <p style={{textAlign:'center',marginTop:'20px',fontSize:'14px',color:'var(--nk-muted)'}}>
              <strong style={{color:'var(--nk-text)'}}>Director &amp; admin view included free.</strong> Every site, every worker, full company compliance — at no cost.
            </p>
            <p style={{textAlign:'center',marginTop:'8px',fontSize:'13px',color:'var(--nk-muted)'}}>
              14-day free trial on every tier · Card required · Cancel any time
            </p>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="lsec dark">
          <div className="lsec-inner">
            <div className="leyebrow">Trusted on site</div>
            <h2 className="lsec-title">Real sites. <em>Real results.</em></h2>
            <div className="lproof-grid">
              {[
                {initials:'LS',quote:'We went from chasing paper induction forms every Monday morning to having everything done before the operatives arrive on site. The QR scan is faster than signing a paper register.',name:'L. Smith',role:'Site Manager · Rigby & Rigby'},
                {initials:'TH',quote:'The attendance register alone saves me an hour every Friday. I export a PDF, hand it to the agency, and that\'s the week done. No spreadsheets, no phone calls.',name:'T. Howard',role:'Project Manager · Civil Works'},
                {initials:'MC',quote:'Having every operative\'s right to work and CSCS status visible in one dashboard — with automatic expiry warnings — means I can put workers on site with complete confidence.',name:'M. Clarke',role:'Director · Labour Agency'},
              ].map((p,i)=>(
                <div key={i} className="lproof-card">
                  <div className="lproof-stars">★★★★★</div>
                  <p className="lproof-quote">&ldquo;{p.quote}&rdquo;</p>
                  <div className="lproof-author">
                    <div className="lproof-avatar">{p.initials}</div>
                    <div>
                      <div className="lproof-name">{p.name}</div>
                      <div className="lproof-role">{p.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="lcta">
          <div className="lcta-bg" />
          <div className="lcta-inner">
            <h2>Get your first site live <em>this week.</em></h2>
            <p>Build a passport, scan it in, watch the dashboard update. 14 days free, card required.</p>
            <div className="lcta-actions">
              <Link href="/login?mode=signup" className="lbtn-hero">Start free for 14 days</Link>
              <a href="mailto:info@nekaid.co.uk" className="lbtn-ghost">Speak with us</a>
            </div>
            <p className="lcta-note">No setup fees · No long-term contracts · Cancel any time</p>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="lfoot">
          <div className="lfoot-inner">
            <div className="lfoot-top">
              <div className="lfoot-brand">
                <div className="lfoot-brand-name">Neka<span>ID</span></div>
                <p>Digital worker passports for UK construction sites. Compliant by design, built for the field.</p>
              </div>
              <div className="lfoot-col">
                <h4>Product</h4>
                <a href="#why">Why NekaID</a>
                <a href="#features">Features</a>
                <a href="#how">How it works</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div className="lfoot-col">
                <h4>Company</h4>
                <a href="mailto:info@nekaid.co.uk">Contact</a>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
                <Link href="/cookies">Cookies</Link>
              </div>
              <div className="lfoot-col">
                <h4>Account</h4>
                <Link href="/login">Log in</Link>
                <Link href="/login?mode=signup">Start free trial</Link>
              </div>
            </div>
            <div className="lfoot-bottom">
              <p>© 2026 NekaID Ltd · ICO: ZC135297 · Digital worker passports</p>
              <p>Made for UK construction</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
