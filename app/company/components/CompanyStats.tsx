type CompanyStatsProps = {
  savedWorkersCount: number
  scansToday: number
  onSiteCount: number
  visitorsOnSiteCount: number
  activeWorkers: number
  expiringSoonCount: number
  expiredCount: number
  onVisitorsClick: () => void
  onExpiringSoonClick: () => void
  onExpiredClick: () => void
}

export default function CompanyStats({
  savedWorkersCount,
  scansToday,
  onSiteCount,
  visitorsOnSiteCount,
  activeWorkers,
  expiringSoonCount,
  expiredCount,
  onVisitorsClick,
  onExpiringSoonClick,
  onExpiredClick,
}: CompanyStatsProps) {
  return (
    <>
      <section className="company-stats-grid">
        <div style={{ background:'#fbfdff',border:'1px solid #d7e1ef',borderRadius:22,padding:18 }}>
          <div className="meta-label">Saved operatives</div>
          <div style={{fontSize:34,fontWeight:900,color:'#09154b',lineHeight:1,marginTop:8}}>
            {savedWorkersCount}
          </div>
        </div>

        <div style={{ background:'#fbfdff',border:'1px solid #d7e1ef',borderRadius:22,padding:18 }}>
          <div className="meta-label">Scans today</div>
          <div style={{fontSize:34,fontWeight:900,color:'#09154b',lineHeight:1,marginTop:8}}>
            {scansToday}
          </div>
        </div>

        <div style={{ background:'#ecfdf3',border:'1px solid #b7e4c7',borderRadius:22,padding:18 }}>
          <div className="meta-label">On site now</div>
          <div style={{fontSize:34,fontWeight:900,color:'#167342',lineHeight:1,marginTop:8}}>
            {onSiteCount}
          </div>
        </div>

        <button
          type="button"
          className="company-stats-button"
          onClick={onVisitorsClick}
          style={{
            textAlign:'left',
            background:'#eef3ff',
            border:'1px solid #cdd9ff',
            borderRadius:22,
            padding:18,
            cursor:'pointer'
          }}
        >
          <div className="meta-label">Visitors on site</div>

          <div style={{fontSize:34,fontWeight:900,color:'#243caa',lineHeight:1,marginTop:8}}>
            {visitorsOnSiteCount}
          </div>

          <div style={{marginTop:8,fontSize:12,fontWeight:900,color:'#243caa'}}>
            Click to view
          </div>
        </button>

        <div style={{ background:'#fbfdff',border:'1px solid #d7e1ef',borderRadius:22,padding:18 }}>
          <div className="meta-label">Active</div>
          <div style={{fontSize:34,fontWeight:900,color:'#167342',lineHeight:1,marginTop:8}}>
            {activeWorkers}
          </div>
        </div>

        <button
          type="button"
          className="company-stats-button"
          onClick={onExpiringSoonClick}
          style={{
            textAlign:'left',
            background:'#fff8ea',
            border:'1px solid #efd6ac',
            borderRadius:22,
            padding:18,
            cursor:'pointer'
          }}
        >
          <div className="meta-label">Expiring soon</div>
          <div style={{fontSize:34,fontWeight:900,color:'#9b5d00',lineHeight:1,marginTop:8}}>
            {expiringSoonCount}
          </div>
          <div style={{marginTop:8,fontSize:12,fontWeight:900,color:'#9b5d00'}}>
            Click to view
          </div>
        </button>

        <button
          type="button"
          className="company-stats-button"
          onClick={onExpiredClick}
          style={{
            textAlign:'left',
            background:'#fff1f1',
            border:'1px solid #efc1c1',
            borderRadius:22,
            padding:18,
            cursor:'pointer'
          }}
        >
          <div className="meta-label">Expired</div>
          <div style={{fontSize:34,fontWeight:900,color:'#b42318',lineHeight:1,marginTop:8}}>
            {expiredCount}
          </div>
          <div style={{marginTop:8,fontSize:12,fontWeight:900,color:'#b42318'}}>
            Click to view
          </div>
        </button>
      </section>

      <style jsx>{`
        .company-stats-grid{
          display:grid;
          grid-template-columns:repeat(7,minmax(0,1fr));
          gap:14px;
          margin-bottom:24px;
        }

        .company-stats-grid > div,
        .company-stats-grid > button{
          min-width:0;
        }

        .company-stats-button{
          appearance:none;
          font-family:inherit;
        }

        @media (max-width:1200px){
          .company-stats-grid{
            grid-template-columns:repeat(4,minmax(0,1fr));
          }
        }

        @media (max-width:800px){
          .company-stats-grid{
            grid-template-columns:repeat(2,minmax(0,1fr));
          }
        }

        @media (max-width:440px){
          .company-stats-grid{
            grid-template-columns:1fr;
          }
        }
      `}</style>
    </>
  )
}