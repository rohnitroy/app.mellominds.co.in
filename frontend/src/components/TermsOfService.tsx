import React from 'react';

const s: Record<string, React.CSSProperties> = {
  page: { position: 'fixed', inset: 0, overflowY: 'auto', background: '#f8f9fa', padding: '48px 24px', fontFamily: 'Urbanist, sans-serif' },
  container: { maxWidth: '800px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '48px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' },
  logo: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' },
  title: { fontSize: '32px', fontWeight: 700, color: '#082421', margin: '0 0 4px 0' },
  updated: { fontSize: '14px', color: '#6E6E6E', margin: '0 0 40px 0' },
  h2: { fontSize: '18px', fontWeight: 700, color: '#082421', margin: '32px 0 12px 0' },
  p: { fontSize: '15px', color: '#444', lineHeight: 1.8, margin: '0 0 12px 0' },
  ul: { paddingLeft: '20px', margin: '0 0 12px 0' },
  li: { fontSize: '15px', color: '#444', lineHeight: 1.8, marginBottom: '6px' },
  note: { background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', margin: '12px 0', fontSize: '14px', color: '#5d4037' },
  divider: { border: 'none', borderTop: '1px solid #e9ecef', margin: '32px 0' },
  footer: { textAlign: 'center' as const, marginTop: '40px', fontSize: '13px', color: '#9CA3AF' },
};

const TermsOfService: React.FC = () => (
  <div style={s.page}>
    <div style={s.container}>
      <div style={s.logo}>
        <img src="/MelloFevicon 1.png" alt="MelloMinds" style={{ width: '40px', height: '40px' }} />
        <span style={{ fontSize: '22px', fontWeight: 700, color: '#082421' }}>MelloMinds</span>
      </div>

      <h1 style={s.title}>Terms of Service</h1>
      <p style={s.updated}>Effective Date: February 28, 2026</p>

      <hr style={s.divider} />

      <h2 style={s.h2}>1. Acceptance of Terms</h2>
      <p style={s.p}>By creating an account or using the MelloMinds platform, you ("the User," "the Therapist," or "the Practice") agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company or legal entity, you represent that you have the authority to bind such entity to these terms.</p>

      <h2 style={s.h2}>2. Description of Service</h2>
      <p style={s.p}>MelloMinds provides a software-as-a-service (SaaS) platform for therapy practice management, including but not limited to scheduling, intake forms, session notes, and billing.</p>
      <div style={s.note}>
        <strong>Important Disclosure:</strong> MelloMinds is a technology provider. We do not provide mental health services, medical advice, or crisis intervention. We are not responsible for the clinical outcomes or the professional conduct of the therapists using our platform.
      </div>

      <h2 style={s.h2}>3. User Accounts and Security</h2>
      <ul style={s.ul}>
        <li style={s.li}><strong>Eligibility:</strong> You must be a licensed mental health professional (or an authorized administrative representative) to use the platform for clinical purposes.</li>
        <li style={s.li}><strong>Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your login credentials. You must notify us immediately of any unauthorized use of your account.</li>
        <li style={s.li}><strong>Accuracy:</strong> You agree to provide accurate, current, and complete information during the registration process.</li>
      </ul>

      <h2 style={s.h2}>4. Professional Responsibility and Compliance</h2>
      <ul style={s.ul}>
        <li style={s.li}><strong>Clinical Judgment:</strong> The User retains sole responsibility for their clinical decisions, treatment plans, and patient interactions.</li>
        <li style={s.li}><strong>Legal Compliance:</strong> You are responsible for ensuring your use of MelloMinds complies with local laws and professional ethics (e.g., HIPAA in the US, GDPR in Europe, or DPDPA in India).</li>
        <li style={s.li}><strong>Patient Consent:</strong> You represent that you have obtained all necessary consents from your clients to store their personal and health information on MelloMinds.</li>
      </ul>

      <h2 style={s.h2}>5. Fees and Payment</h2>
      <ul style={s.ul}>
        <li style={s.li}><strong>Subscription:</strong> Services are provided on a subscription basis (Monthly/Annual). Fees are non-refundable except where required by law.</li>
        <li style={s.li}><strong>Changes:</strong> We reserve the right to modify our pricing with at least 30 days' notice.</li>
        <li style={s.li}><strong>Taxes:</strong> Users are responsible for all applicable taxes associated with their use of the service.</li>
      </ul>

      <h2 style={s.h2}>6. Intellectual Property</h2>
      <ul style={s.ul}>
        <li style={s.li}><strong>Our Content:</strong> MelloMinds owns all rights, titles, and interests in the platform's software, design, logos, and original content.</li>
        <li style={s.li}><strong>User Content:</strong> You retain ownership of all data, notes, and records you upload. You grant MelloMinds a limited, non-exclusive license to host and process this data solely to provide the services to you.</li>
      </ul>

      <h2 style={s.h2}>7. Prohibited Use</h2>
      <p style={s.p}>You agree not to:</p>
      <ul style={s.ul}>
        <li style={s.li}>Use the platform for any illegal or unauthorized purpose.</li>
        <li style={s.li}>Reverse engineer, decompile, or attempt to extract the source code of the platform.</li>
        <li style={s.li}>Upload any content that infringes on third-party intellectual property or privacy rights.</li>
        <li style={s.li}>Use the service to transmit viruses or malicious code.</li>
      </ul>

      <h2 style={s.h2}>8. Limitation of Liability</h2>
      <p style={s.p}>To the maximum extent permitted by law, MelloMinds (and its affiliates/officers) shall not be liable for any indirect, incidental, special, or consequential damages, including loss of profits, data, or professional reputation. Our total liability for any claim arising out of these terms shall not exceed the amount paid by you to MelloMinds in the 12 months preceding the claim.</p>

      <h2 style={s.h2}>9. Termination</h2>
      <ul style={s.ul}>
        <li style={s.li}><strong>By You:</strong> You may cancel your account at any time via the dashboard.</li>
        <li style={s.li}><strong>By Us:</strong> We may suspend or terminate your access if you breach these terms or fail to pay subscription fees.</li>
        <li style={s.li}><strong>Data Export:</strong> Upon termination, we will provide a 30-day window for you to export your clinical records before they are permanently deleted from our active servers.</li>
      </ul>

      <h2 style={s.h2}>10. Governing Law</h2>
      <p style={s.p}>These terms are governed by the laws of India. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts in Pune, Maharashtra.</p>

      <hr style={s.divider} />
      <div style={s.footer}>© {new Date().getFullYear()} MelloMinds. All rights reserved.</div>
    </div>
  </div>
);

export default TermsOfService;
