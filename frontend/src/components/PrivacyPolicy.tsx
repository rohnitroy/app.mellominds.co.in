import React from 'react';

const s: Record<string, React.CSSProperties> = {
  page: { position: 'fixed' as const, inset: 0, overflowY: 'auto' as const, background: '#f8f9fa', padding: '48px 24px', fontFamily: 'Urbanist, sans-serif' },
  container: { maxWidth: '800px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '48px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' },
  logo: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' },
  title: { fontSize: '32px', fontWeight: 700, color: '#082421', margin: '0 0 4px 0' },
  updated: { fontSize: '14px', color: '#6E6E6E', margin: '0 0 40px 0' },
  h2: { fontSize: '18px', fontWeight: 700, color: '#082421', margin: '32px 0 12px 0' },
  p: { fontSize: '15px', color: '#444', lineHeight: 1.8, margin: '0 0 12px 0' },
  ul: { paddingLeft: '20px', margin: '0 0 12px 0' },
  li: { fontSize: '15px', color: '#444', lineHeight: 1.8, marginBottom: '6px' },
  divider: { border: 'none', borderTop: '1px solid #e9ecef', margin: '32px 0' },
  footer: { textAlign: 'center' as const, marginTop: '40px', fontSize: '13px', color: '#9CA3AF' },
};

const PrivacyPolicy: React.FC = () => (
  <div style={s.page}>
    <div style={s.container}>
      <div style={s.logo}>
        <img src="/MelloFevicon 1.png" alt="MelloMinds" style={{ width: '40px', height: '40px' }} />
        <span style={{ fontSize: '22px', fontWeight: 700, color: '#082421' }}>MelloMinds</span>
      </div>

      <h1 style={s.title}>Privacy Policy</h1>
      <p style={s.updated}>Last updated: February 28, 2026</p>

      <hr style={s.divider} />

      <h2 style={s.h2}>1. Introduction</h2>
      <p style={s.p}>Welcome to MelloMinds. We provide a therapy practice management platform designed to streamline operations for mental health professionals. We are committed to protecting the privacy of both our Users (Therapists/Practices) and their Clients. This Privacy Policy explains how we collect, use, and safeguard your information.</p>

      <h2 style={s.h2}>2. Information We Collect</h2>
      <p style={s.p}>We collect information that allows us to provide a secure and efficient service:</p>
      <ul style={s.ul}>
        <li style={s.li}><strong>Account Data:</strong> Names, email addresses, billing information, and professional credentials of therapists.</li>
        <li style={s.li}><strong>Client Data (Sensitive Personal Information):</strong> As a "Data Processor," we store information provided by therapists about their clients, including intake forms, session notes, and treatment plans.</li>
        <li style={s.li}><strong>Usage Data:</strong> IP addresses, browser types, and activity logs to ensure platform security and performance.</li>
        <li style={s.li}><strong>Communication Data:</strong> Records of support requests or feedback provided to us.</li>
      </ul>

      <h2 style={s.h2}>3. Legal Basis for Processing</h2>
      <p style={s.p}>We process data under the following legal frameworks:</p>
      <ul style={s.ul}>
        <li style={s.li}><strong>Consent:</strong> Explicit consent obtained from users at the time of sign-up.</li>
        <li style={s.li}><strong>Contractual Necessity:</strong> To fulfill our service agreement with you.</li>
        <li style={s.li}><strong>Legal Obligation:</strong> To comply with healthcare regulations and tax laws.</li>
      </ul>

      <h2 style={s.h2}>4. Data Security and HIPAA/GDPR Compliance</h2>
      <p style={s.p}>MelloMinds employs industry-leading security measures to protect sensitive health data:</p>
      <ul style={s.ul}>
        <li style={s.li}><strong>Encryption:</strong> All data is encrypted at rest (AES-256) and in transit (TLS 1.2+).</li>
        <li style={s.li}><strong>Access Controls:</strong> Role-based access ensures only authorized personnel can view specific data.</li>
        <li style={s.li}><strong>Data Silos:</strong> Client records are logically separated to prevent cross-account access.</li>
        <li style={s.li}><strong>Audit Logs:</strong> We maintain immutable logs of who accessed what data and when.</li>
      </ul>

      <h2 style={s.h2}>5. Data Sharing and Third Parties</h2>
      <p style={s.p}>We do not sell your data. We only share information with third-party service providers (e.g., AWS for hosting, Stripe for payments) who are contractually bound to the same privacy standards.</p>
      <p style={s.p}><strong>Legal Disclosure:</strong> We may disclose data if required by law (e.g., a court order).</p>

      <h2 style={s.h2}>6. Your Rights</h2>
      <p style={s.p}>Depending on your location, you have the following rights:</p>
      <ul style={s.ul}>
        <li style={s.li}><strong>Access & Portability:</strong> Request a copy of your data in a structured format.</li>
        <li style={s.li}><strong>Correction:</strong> Update inaccurate or incomplete information.</li>
        <li style={s.li}><strong>Erasure ("Right to be Forgotten"):</strong> Request deletion of your data, subject to medical record retention laws (e.g., HIPAA requires 6-year retention).</li>
        <li style={s.li}><strong>Withdrawal of Consent:</strong> You may withdraw consent for data processing at any time.</li>
      </ul>

      <h2 style={s.h2}>7. Data Retention</h2>
      <p style={s.p}>We retain personal data only as long as necessary to provide our services or as required by law. Therapist account data is typically deleted 30 days after account termination, while clinical records may be archived longer to meet healthcare compliance standards.</p>

      <h2 style={s.h2}>8. Contact Information</h2>
      <p style={s.p}>If you have any questions or wish to exercise your data rights, please contact our Data Protection Officer:</p>
      <p style={s.p}>
        <strong>MelloMinds</strong><br />
        Email: <a href="mailto:mellomindsventure@gmail.com" style={{ color: '#2D7579' }}>mellomindsventure@gmail.com</a><br />
        Address: Pune, Maharashtra, India
      </p>

      <hr style={s.divider} />
      <div style={s.footer}>© {new Date().getFullYear()} MelloMinds. All rights reserved.</div>
    </div>
  </div>
);

export default PrivacyPolicy;
