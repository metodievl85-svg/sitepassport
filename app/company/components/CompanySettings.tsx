import Link from 'next/link'

type CompanySettingsProps = {
  companyName: string
  companyNameDraft: string
  savingCompanyName: boolean
  companyNameMessage: string
  inductionLink: string
  savingInductionLink: boolean
  inductionLinkMessage: string
  setCompanyNameDraft: (value: string) => void
  setInductionLink: (value: string) => void
  handleSaveCompanyName: () => void
  handleSaveInductionLink: () => void
  handleCopySiteLink: () => void
}

export default function CompanySettings({
  companyName,
  companyNameDraft,
  savingCompanyName,
  companyNameMessage,
  inductionLink,
  savingInductionLink,
  inductionLinkMessage,
  setCompanyNameDraft,
  setInductionLink,
  handleSaveCompanyName,
  handleSaveInductionLink,
  handleCopySiteLink,
}: CompanySettingsProps) {
  return (
    <>
      <section className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div className="company-settings-row">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#09154b' }}>
              Company name
            </h2>

            <p style={{ margin: '8px 0 0', fontSize: 15, color: '#5a6f96', lineHeight: 1.45 }}>
              This name will appear on your printable site QR poster.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={companyNameDraft}
              onChange={(event) => setCompanyNameDraft(event.target.value)}
              placeholder="Enter company name"
              style={{
                minHeight: 50,
                minWidth: 260,
                borderRadius: 14,
                border: '1px solid #d7e1ef',
                padding: '0 14px',
                fontSize: 15,
                fontWeight: 800,
              }}
            />

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveCompanyName}
              disabled={savingCompanyName}
              style={{
                opacity: savingCompanyName ? 0.65 : 1,
                cursor: savingCompanyName ? 'not-allowed' : 'pointer',
              }}
            >
              {savingCompanyName ? 'Saving...' : 'Save name'}
            </button>
          </div>
        </div>

        {companyNameMessage ? (
          <div
            style={{
              marginTop: 14,
              fontSize: 14,
              fontWeight: 800,
              color: companyNameMessage.includes('saved') ? '#167342' : '#b42318',
            }}
          >
            {companyNameMessage}
          </div>
        ) : null}

        {companyName ? (
          <div
            style={{
              marginTop: 14,
              fontSize: 14,
              color: '#5a6f96',
              fontWeight: 800,
            }}
          >
            Current saved name: {companyName}
          </div>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div className="company-settings-row">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#09154b' }}>
              Induction link
            </h2>

            <p style={{ margin: '8px 0 0', fontSize: 15, color: '#5a6f96', lineHeight: 1.45 }}>
              Paste your existing online induction link here. This will be attached when
              you press Send induction.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={inductionLink}
              onChange={(event) => setInductionLink(event.target.value)}
              placeholder="https://..."
              style={{
                minHeight: 50,
                minWidth: 360,
                borderRadius: 14,
                border: '1px solid #d7e1ef',
                padding: '0 14px',
                fontSize: 15,
                fontWeight: 800,
              }}
            />

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveInductionLink}
              disabled={savingInductionLink}
              style={{
                opacity: savingInductionLink ? 0.65 : 1,
                cursor: savingInductionLink ? 'not-allowed' : 'pointer',
              }}
            >
              {savingInductionLink ? 'Saving...' : 'Save link'}
            </button>
          </div>
        </div>

        {inductionLinkMessage ? (
          <div
            style={{
              marginTop: 14,
              fontSize: 14,
              fontWeight: 800,
              color: inductionLinkMessage.includes('saved') ? '#167342' : '#b42318',
            }}
          >
            {inductionLinkMessage}
          </div>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div className="company-site-row">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#09154b' }}>
              Site QR link
            </h2>

            <p style={{ margin: '8px 0 0', fontSize: 15, color: '#5a6f96', lineHeight: 1.45 }}>
              Permanent site sign-in link. Print the QR once and place it on site.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCopySiteLink}>
              Copy site link
            </button>

            <Link href="/company/print-qr" className="btn btn-primary">
              Print site QR
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        .company-settings-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
        }

        .company-site-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        @media (max-width: 900px) {
          .company-settings-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}