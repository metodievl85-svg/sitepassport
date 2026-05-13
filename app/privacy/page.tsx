export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', lineHeight: 1.7 }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> 13 May 2026</p>

      <p>
        NekaID is a UK construction workforce verification and site management platform.
        This Privacy Policy explains how we collect, use, store, and protect personal data
        when workers, companies, site managers, and visitors use our service.
      </p>

      <h2>1. Who we are</h2>
      <p>
        NekaID operates through <strong>https://www.nekaid.co.uk</strong>.
        During our rebrand, some services may still redirect from or reference
        <strong> https://www.sitepassportapp.co.uk</strong>.
      </p>
      <p>
        For privacy or legal questions, contact us at:
        <br />
        <strong>Email:</strong> info@nekaid.co.uk
      </p>

      <h2>2. What personal data we collect</h2>
      <p>We may collect and store the following information:</p>
      <ul>
        <li>Name</li>
        <li>Email address</li>
        <li>Phone number</li>
        <li>Job role / trade</li>
        <li>Company name</li>
        <li>Profile photo or uploaded card/certificate images</li>
        <li>CSCS card details and expiry date</li>
        <li>Right to Work expiry date</li>
        <li>Qualification names, card numbers, and expiry dates</li>
        <li>Worker passport QR code and public scan link</li>
        <li>Company saved worker records</li>
        <li>Site attendance sign-in and sign-out records</li>
        <li>Visitor sign-in and sign-out records</li>
        <li>GPS/location verification data used for site attendance checks</li>
        <li>Induction request and completion status</li>
        <li>Login/account information handled through Supabase authentication</li>
      </ul>

      <p>
        Medical information provided by operatives is optional and collected only for
        health and safety purposes on construction sites. This data is considered sensitive
        and is securely stored. It is visible only to authorised company users, such as
        site managers, and is not shared publicly or used for automated decision-making.
      </p>

      <h2>3. How we use your data</h2>
      <p>We use your data to:</p>
      <ul>
        <li>Create and manage worker passport profiles</li>
        <li>Allow workers to show credentials and expiry dates</li>
        <li>Allow companies to scan and save worker passport records</li>
        <li>Show expiry status such as Valid, Expiring, or Expired</li>
        <li>Provide QR code verification features</li>
        <li>Provide site sign-in and sign-out features</li>
        <li>Help companies monitor who is currently on site</li>
        <li>Support visitor sign-in and sign-out records</li>
        <li>Send and track induction requests</li>
        <li>Provide login, signup, password reset, and account deletion features</li>
        <li>Improve safety, onboarding, and document visibility on construction sites</li>
        <li>Maintain and secure the NekaID platform</li>
      </ul>

      <h2>4. Legal basis for processing</h2>
      <p>
        We process personal data where it is necessary to provide the NekaID service,
        manage user accounts, support construction site onboarding, protect the platform,
        comply with legal obligations, and respond to user requests.
      </p>

      <h2>5. Who can see your data</h2>
      <p>
        Workers can create and manage their own passport information. Companies can view
        worker information when they scan a worker QR code or save a worker to their
        company dashboard.
      </p>
      <p>
        A worker public scan page may be visible to anyone who has the worker’s QR code
        or public scan link. Do not share your QR code or public link with anyone you do
        not trust.
      </p>

      <h2>6. GPS and location data</h2>
      <p>
        NekaID may use GPS/location data when workers or visitors sign in or sign out of a
        site. This is used to support attendance verification and site safety records.
      </p>
      <p>
        NekaID does not continuously track users in the background.
      </p>

      <h2>7. Qualification and verification data</h2>
      <p>
        Workers may upload qualification information, certificates, cards, or supporting
        documents. Unless a record is clearly marked as verified by NekaID, uploaded
        information should be treated as self-declared.
      </p>
      <p>
        Companies remain responsible for carrying out their own workforce compliance,
        Right to Work, CSCS, and site safety checks where required.
      </p>

      <h2>8. Where your data is stored</h2>
      <p>
        NekaID uses Supabase for authentication and database storage. The platform may also
        use services such as Vercel and other hosting, email, or infrastructure providers.
        Data may be stored on secure cloud infrastructure used by our service providers.
      </p>

      <h2>9. How long we keep data</h2>
      <p>
        We keep personal data for as long as your account or passport profile is active, or
        as long as needed to provide the service, meet legal obligations, resolve disputes,
        maintain security, and support compliance records.
      </p>

      <h2>10. Your rights</h2>
      <p>Under UK data protection law, you may have rights including:</p>
      <ul>
        <li>The right to access your personal data</li>
        <li>The right to correct inaccurate data</li>
        <li>The right to request deletion of your data</li>
        <li>The right to restrict processing</li>
        <li>The right to object to certain processing</li>
        <li>The right to data portability</li>
        <li>The right to complain to the Information Commissioner’s Office</li>
      </ul>

      <h2>11. Account deletion</h2>
      <p>
        Users may request or use available account deletion features to delete their account
        and associated personal information. Some records may be retained where legally
        required or where needed for security, audit, or compliance purposes.
      </p>

      <h2>12. Security</h2>
      <p>
        We take reasonable steps to protect personal data, including secure authentication,
        HTTPS, hosted database services, and access controls. No online service is 100%
        secure, so users should protect their login details and only share QR codes
        responsibly.
      </p>

      <h2>13. Children</h2>
      <p>
        NekaID is intended for construction workers, companies, site managers, contractors,
        and authorised visitors. It is not intended for children.
      </p>

      <h2>14. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy as NekaID grows. The latest version will always
        be available on this page.
      </p>

      <h2>15. Contact</h2>
      <p>
        For privacy requests or questions, email:
        <br />
        <strong>info@nekaid.co.uk</strong>
      </p>

      <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        NekaID is registered with the Information Commissioner’s Office (ICO) under
        registration number: ZC135297.
      </p>
    </main>
  )
}