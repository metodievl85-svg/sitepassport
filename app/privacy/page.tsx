export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', lineHeight: 1.7 }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> 25 April 2026</p>

      <p>
        SitePassport is a digital construction worker passport platform. This Privacy Policy explains
        how we collect, use, store, and protect personal data when workers and companies use our service.
      </p>

      <h2>1. Who we are</h2>
      <p>
        SitePassport operates through <strong>https://www.sitepassportapp.co.uk</strong>.
        For privacy or legal questions, contact us at:
      </p>
      <p><strong>Email:</strong> info@sitepassportapp.co.uk</p>

      <h2>2. What personal data we collect</h2>
      <p>We may collect and store the following information:</p>
      <ul>
        <li>Name</li>
        <li>Email address</li>
        <li>Phone number</li>
        <li>Job role / trade</li>
        <li>Company name</li>
        <li>Profile photo</li>
        <li>CSCS card details and expiry date</li>
        <li>Right to Work expiry date</li>
        <li>Qualification names, card numbers, and expiry dates</li>
        <li>Worker passport QR code/public scan link</li>
        <li>Company saved worker records</li>
        <li>Login/account information handled through Supabase authentication</li>
      </ul>

      <h2>3. How we use your data</h2>
      <p>We use your data to:</p>
      <ul>
        <li>Create and manage worker passport profiles</li>
        <li>Allow workers to show credentials and expiry dates</li>
        <li>Allow companies to scan and save worker passport records</li>
        <li>Show expiry status such as Valid, Expiring, or Expired</li>
        <li>Provide login, signup, and password reset features</li>
        <li>Improve safety, onboarding, and document visibility on construction sites</li>
        <li>Maintain and secure the SitePassport platform</li>
      </ul>

      <h2>4. Legal basis for processing</h2>
      <p>
        We process personal data where it is necessary to provide the SitePassport service,
        manage user accounts, support construction site onboarding, protect the platform,
        and respond to user requests.
      </p>

      <h2>5. Who can see your data</h2>
      <p>
        Workers can create and manage their own passport information. Companies can view worker
        information when they scan a worker QR code or save a worker to their company dashboard.
      </p>
      <p>
        A worker public scan page may be visible to anyone who has the worker’s QR code or public scan link.
        Do not share your QR code or public link with anyone you do not trust.
      </p>

      <h2>6. Where your data is stored</h2>
      <p>
        SitePassport uses Supabase for authentication and database storage. Data may be stored on secure
        cloud infrastructure used by our service providers.
      </p>

      <h2>7. How long we keep data</h2>
      <p>
        We keep personal data for as long as your account or passport profile is active, or as long as needed
        to provide the service, meet legal obligations, resolve disputes, and maintain security.
      </p>

      <h2>8. Your rights</h2>
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

      <h2>9. Security</h2>
      <p>
        We take reasonable steps to protect personal data, including secure authentication,
        HTTPS, hosted database services, and access controls. No online service is 100% secure,
        so users should protect their login details and only share QR codes responsibly.
      </p>

      <h2>10. Children</h2>
      <p>
        SitePassport is intended for construction workers and companies. It is not intended for children.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy as SitePassport grows. The latest version will always be available
        on this page.
      </p>

      <h2>12. Contact</h2>
      <p>
        For privacy requests or questions, email:
        <br />
        <strong>info@sitepassportapp.co.uk</strong>
      </p>

      <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        SitePassport is registered with the Information Commissioner’s Office (ICO) under registration number: ZC135297.
      </p>
    </main>
  )
}