export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', lineHeight: 1.7 }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> 8 June 2026</p>

      <p>
        NekaID is a UK construction workforce verification and site management platform.
        This Privacy Policy explains how we collect, use, store, and protect personal data
        when workers, companies, agencies, and visitors use our service. We are committed
        to complying with the UK General Data Protection Regulation (UK GDPR) and the
        Data Protection Act 2018.
      </p>

      <h2>1. Who we are</h2>
      <p>
        The data controller for personal data processed through NekaID is:
      </p>
      <p>
        <strong>Lyuben Metodiev trading as NekaID</strong><br />
        Website: <strong>nekaid.co.uk</strong><br />
        Email: <strong>info@nekaid.co.uk</strong><br />
        ICO registration number: <strong>ZC135297</strong>
      </p>

      <h2>2. Who this policy applies to</h2>
      <p>This policy applies to all users of the NekaID platform, which has three account types:</p>
      <ul>
        <li><strong>Workers (operatives)</strong> — construction workers who create a digital passport and manage their own credentials, documents, and personal information.</li>
        <li><strong>Companies (site managers)</strong> — businesses and site managers who use NekaID to verify worker credentials, manage site attendance, and send inductions.</li>
        <li><strong>Agencies (labour agencies)</strong> — labour hire and staffing agencies who manage a pool of workers, handle placements, and access full worker passport data including sensitive fields where consent has been given.</li>
      </ul>

      <h2>3. Data we collect from workers</h2>
      <p>Workers may enter any or all of the following information into their NekaID passport profile:</p>
      <ul>
        <li>Full name</li>
        <li>Email address</li>
        <li>Phone number</li>
        <li>Profile selfie photo (<em>face_photo</em>) — used as a messaging avatar only and not included on the public scan page</li>
        <li>CSCS card photo, card number, expiry date, and verification status</li>
        <li>Trade / job title</li>
        <li>Current employer / company name</li>
        <li>National Insurance (NI) number</li>
        <li>Passport photo page (image of identity document)</li>
        <li>Right to work document photo (passport, BRP, visa, or share code letter) and right to work expiry date</li>
        <li>Qualifications: name, certificate number, expiry date, and certificate photo — multiple qualifications per worker</li>
        <li>Bank details: bank name, account number, and sort code</li>
        <li>Next of kin: full name and phone number (third-party personal data — see section 5)</li>
        <li>Medical information and conditions (optional)</li>
        <li>General notes (optional)</li>
        <li>GPS location at the time of site sign-in, and site attendance records including sign-in and sign-out times and dates</li>
        <li>Push notification subscription endpoint (used to deliver expiry reminders and updates)</li>
        <li>Messages and attachments (photos and PDFs) sent via in-app messaging</li>
      </ul>

      <h2>4. Data we collect from companies and agencies</h2>
      <p>When a company or agency creates an account and uses the NekaID platform, we may collect and process:</p>
      <ul>
        <li>Account email address and login credentials</li>
        <li>Account role (company or agency)</li>
        <li>Site name, site address, and GPS coordinates (companies)</li>
        <li>Workforce pool records and placement records (agencies)</li>
        <li>Messages sent to workers via in-app messaging</li>
        <li>Induction content created and sent to workers (companies)</li>
      </ul>

      <h2>5. Sensitive personal data</h2>
      <p>
        The following fields are considered sensitive or special category personal data under UK GDPR.
        They are <strong>entirely voluntary</strong> — workers are never required to enter them,
        and the platform functions fully without them:
      </p>
      <ul>
        <li>National Insurance number</li>
        <li>Passport photo (image of identity document)</li>
        <li>Right to work document photo</li>
        <li>Bank details (bank name, account number, sort code)</li>
        <li>Medical information</li>
        <li>Next of kin details (which constitute personal data about a third party)</li>
      </ul>
      <p>
        The legal basis for processing these fields is <strong>explicit consent</strong>. Workers
        voluntarily enter this information and control who can access it by choosing whether to share
        their QR code or passport link. Workers may withdraw consent and remove any of these fields
        at any time via the Edit Passport page.
      </p>
      <p>
        Where next of kin details are provided, the worker confirms they have the consent of that
        individual to share their contact information with NekaID and with parties the worker shares
        their passport with.
      </p>

      <h2>6. Who can access worker data — access tiers</h2>
      <p>NekaID operates a three-tier access model:</p>
      <ul>
        <li>
          <strong>Unauthenticated viewers</strong> — anyone with the worker's QR code or public scan link
          can see the worker's <em>name and CSCS card photo only</em>. No other data is visible.
        </li>
        <li>
          <strong>Company accounts</strong> — authenticated company users can see all work-relevant
          fields, including: name, profile photo, email, phone, trade, company, NI number, CSCS card
          number and expiry, right to work expiry and document photo, qualifications, next of kin,
          medical information, and notes. Company accounts <strong>cannot</strong> see passport photos
          or bank details.
        </li>
        <li>
          <strong>Agency accounts</strong> — authenticated agency users have full access to all fields
          including passport photo and bank details, where the worker has entered them.
        </li>
      </ul>
      <p>
        Workers control access to their data by choosing whether to share their QR code or passport
        link. NekaID does not share worker data with any party the worker has not chosen to share with.
      </p>

      <h2>7. Legal basis for processing</h2>
      <ul>
        <li>
          <strong>Contract performance (Article 6(1)(b) UK GDPR)</strong> — processing of core
          passport fields (name, email, CSCS details, trade, company) is necessary to provide the
          NekaID service as described.
        </li>
        <li>
          <strong>Explicit consent (Article 6(1)(a) and Article 9(2)(a) UK GDPR)</strong> — processing
          of sensitive fields including NI number, bank details, passport photo, right to work document
          photo, medical information, and next of kin details, all of which are voluntarily provided
          and may be withdrawn at any time.
        </li>
        <li>
          <strong>Legitimate interests (Article 6(1)(f) UK GDPR)</strong> — processing related to
          push notifications, expiry reminders, in-app messaging, and platform security, where these
          interests are not overridden by individual rights.
        </li>
        <li>
          <strong>Legal obligation (Article 6(1)(c) UK GDPR)</strong> — processing necessary to
          support right to work verification in accordance with UK employment law.
        </li>
      </ul>

      <h2>8. How and where data is stored</h2>
      <p>NekaID uses the following data processors, all of which operate under GDPR-compliant data processing agreements:</p>
      <ul>
        <li>
          <strong>Supabase (supabase.com)</strong> — database and file storage, EU-hosted. Acts as our
          primary data processor. Photos and documents are stored in Supabase Storage with Row Level
          Security policies. Sensitive text fields are encrypted at rest.
        </li>
        <li>
          <strong>Vercel (vercel.com)</strong> — application hosting and serverless functions.
          GDPR-compliant. Does not store personal data beyond request logs.
        </li>
        <li>
          <strong>Resend (resend.com)</strong> — transactional email delivery including expiry
          notifications and account confirmation emails. GDPR-compliant.
        </li>
        <li>
          <strong>Cloudflare (cloudflare.com)</strong> — DNS routing. No personal data is stored
          by Cloudflare in connection with NekaID.
        </li>
      </ul>

      <h2>9. Data retention</h2>
      <p>
        Personal data is retained for as long as an account remains active or as long as necessary
        to provide the service.
      </p>
      <p>
        On account deletion: all personal data is deleted within <strong>30 days</strong>. Sensitive
        fields (NI number, bank details, and passport photo) are deleted <strong>immediately</strong>
        upon account deletion request.
      </p>
      <p>
        Some records may be retained beyond this period where required by law, for fraud prevention,
        or for security and audit purposes.
      </p>

      <h2>10. Your rights under UK GDPR</h2>
      <p>You have the following rights in relation to your personal data:</p>
      <ul>
        <li><strong>Right of access</strong> — you may request a copy of the personal data we hold about you.</li>
        <li><strong>Right to rectification</strong> — you may correct inaccurate data at any time via the Edit Passport page.</li>
        <li><strong>Right to erasure</strong> — you may request deletion of your account and associated data.</li>
        <li><strong>Right to restrict processing</strong> — you may request that we limit how we use your data in certain circumstances.</li>
        <li><strong>Right to data portability</strong> — you may request your data in a structured, commonly used, machine-readable format.</li>
        <li><strong>Right to withdraw consent</strong> — you may remove sensitive fields (NI number, bank details, passport photo, medical info, next of kin) at any time via the Edit Passport page. Withdrawal does not affect the lawfulness of prior processing.</li>
        <li><strong>Right to object</strong> — you may object to processing carried out on the basis of legitimate interests.</li>
      </ul>
      <p>
        To exercise any of these rights, contact us at <strong>info@nekaid.co.uk</strong>. We will
        respond within <strong>30 days</strong>.
      </p>

      <h2>11. Cookies and local storage</h2>
      <p>
        NekaID uses cookies and browser local storage for authentication sessions, platform
        functionality, and attendance features. For full details, please see our{' '}
        <a href="/cookies">Cookie Policy</a>.
      </p>

      <h2>12. Children</h2>
      <p>
        NekaID is intended for use by adults aged 18 and over. It is not directed at children and
        we do not knowingly collect personal data from anyone under the age of 18. If you believe
        a minor has created an account, please contact us at info@nekaid.co.uk.
      </p>

      <h2>13. Complaints</h2>
      <p>
        If you are unhappy with how we handle your personal data, you have the right to complain
        to the UK Information Commissioner's Office (ICO):
      </p>
      <ul>
        <li>Website: <strong>ico.org.uk</strong></li>
        <li>Phone: <strong>0303 123 1113</strong></li>
        <li>NekaID ICO registration number: <strong>ZC135297</strong></li>
      </ul>

      <h2>14. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy as NekaID develops. Material changes will be notified
        by email to all registered users. The latest version will always be available on this page.
      </p>

      <h2>15. Contact</h2>
      <p>
        <strong>Lyuben Metodiev trading as NekaID</strong><br />
        Email: <strong>info@nekaid.co.uk</strong><br />
        Website: <strong>nekaid.co.uk</strong><br />
        ICO registration number: <strong>ZC135297</strong>
      </p>
    </main>
  )
}
