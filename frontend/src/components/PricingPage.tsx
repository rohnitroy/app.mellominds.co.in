import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './PricingPage.module.css';

interface Plan {
  id: string;
  name: string;
  price: string | number;
  period: string;
  description: string;
  badge?: string;
  featured?: boolean;
  cta: string;
  ctaLink: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: '/month',
    description: 'For therapists just getting started',
    cta: 'Get Started Free',
    ctaLink: '/signup',
    features: [
      'Up to 5 public booking pages',
      'Up to 5 booking calendars',
      'Weekly availability scheduling',
      'Custom intake forms',
      'Client database & profiles',
      'Session notes with templates',
      'Google Calendar 2-way sync',
      'Google Meet session links',
      'Client transfer management',
      'In-app notifications',
      'Basic email notifications',
      'Dashboard (3-month analytics)',
      'Public booking payment tracking',
    ],
  },
  {
    id: 'individual',
    name: 'Individual',
    price: '₹699',
    period: '/month',
    description: 'For solo practitioners',
    badge: 'Most Popular',
    featured: true,
    cta: 'Upgrade Now',
    ctaLink: '/upgrade',
    features: [
      'Unlimited public booking pages',
      'Unlimited booking calendars',
      'Weekly availability scheduling',
      'Custom intake forms',
      'Client database & profiles',
      'Session notes with templates',
      'File attachments in notes',
      'Google Calendar & Meet integration',
      'Client transfer management',
      'Razorpay payment integration',
      'Cashfree payment integration',
      'Online payment checkout',
      'Payment signature verification',
      'Refund management & processing',
      'Payment invoices & reports',
      'Custom profile link',
      'Client activities & homework',
      'Reminder scheduling',
      'Email reminder configuration',
      'Full email notification control',
      'Unlimited analytics',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: '₹1,499',
    period: '/seat/month',
    description: 'For group practices',
    cta: 'Upgrade Now',
    ctaLink: '/upgrade',
    features: [
      'Up to 20 therapist seats (₹1,499/seat)',
      'Unlimited booking calendars per therapist',
      'Shared client database',
      'Role-based access (owner & members)',
      'Member invitation & management',
      'Seat usage tracking (up to 20 seats)',
      'Organization settings management',
      'Razorpay & Cashfree per therapist',
      'Payment processing & refunds',
      'Client transfer controls',
      'Client activity & homework',
      'Reminder scheduling & configuration',
      'Custom profile links per therapist',
      'Team analytics (owner view)',
      'Revenue per therapist tracking',
      'Session completion rates',
      'Client retention metrics',
      'Dashboard customization',
      'Google Calendar & Meet integration',
      'File attachments in notes',
      'Full email notification control',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'pricing',
    description: 'For large organizations',
    cta: 'Talk to Sales',
    ctaLink: 'mailto:sales@mellominds.co.in',
    features: [
      'Everything in Team',
      'White-label domain (coming soon)',
      'Custom branding (coming soon)',
      'REST API & Webhooks (coming soon)',
      'GraphQL API (coming soon)',
      'SSO/SAML integration (coming soon)',
      'Advanced audit logs',
      'Dedicated account manager',
      'Priority email support',
      'Phone support',
      'Custom feature roadmap',
      'Implementation assistance',
    ],
  },
];

const PricingPage: React.FC = () => {
  const [teamSeats, setTeamSeats] = useState(3);
  const navigate = useNavigate();

  useEffect(() => {
    // Block mobile access - redirect to dashboard
    if (window.innerWidth <= 768) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Simple, Transparent Pricing</h1>
        <p className={styles.subtitle}>
          Choose the plan that fits your practice. All plans include core booking features.
        </p>
      </div>

      {/* Pricing Cards - Free, Individual, Team */}
      <div className={styles.cardsContainer}>
        {PLANS.slice(0, 3).map((plan) => (
          <div
            key={plan.id}
            className={`${styles.card} ${plan.featured ? styles.featured : ''}`}
          >
            {plan.badge && <div className={styles.badge}>{plan.badge}</div>}

            <h2 className={styles.planName}>{plan.name}</h2>
            <p className={styles.planDescription}>{plan.description}</p>

            <div className={styles.priceSection}>
              <span className={styles.price}>{plan.id === 'team' ? '₹1,499' : plan.price}</span>
              <span className={styles.period}>{plan.id === 'team' ? '/seat/month' : plan.period}</span>
            </div>

            {plan.id === 'team' && (
              <div className={styles.seatSelector}>
                <label htmlFor="team-seats" className={styles.seatLabel}>
                  Select Number of Seats
                </label>
                <div className={styles.seatControl}>
                  <button
                    className={styles.seatBtn}
                    onClick={() => setTeamSeats(Math.max(3, teamSeats - 1))}
                    disabled={teamSeats <= 3}
                  >
                    −
                  </button>
                  <input
                    id="team-seats"
                    type="number"
                    min="3"
                    max="20"
                    value={teamSeats}
                    onChange={(e) => {
                      const val = Math.max(3, Math.min(20, parseInt(e.target.value) || 3));
                      setTeamSeats(val);
                    }}
                    className={styles.seatInput}
                  />
                  <button
                    className={styles.seatBtn}
                    onClick={() => setTeamSeats(Math.min(20, teamSeats + 1))}
                    disabled={teamSeats >= 20}
                  >
                    +
                  </button>
                </div>
                <div className={styles.totalPrice}>
                  Total: <span className={styles.totalAmount}>₹{(teamSeats * 1499).toLocaleString('en-IN')}</span><span className={styles.totalPeriod}>/month</span>
                </div>
              </div>
            )}

            <button
              className={`${styles.cta} ${plan.featured ? styles.ctaPrimary : styles.ctaSecondary}`}
              onClick={() => {
                if (plan.ctaLink.startsWith('mailto:')) {
                  window.location.href = plan.ctaLink;
                } else {
                  window.location.href = plan.ctaLink;
                }
              }}
            >
              {plan.cta}
            </button>

            <div className={styles.featuresList}>
              {plan.features.map((feature, idx) => (
                <div key={idx} className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Enterprise Plan - Horizontal Container */}
      <div className={styles.enterpriseContainer}>
        {PLANS.slice(3, 4).map((plan) => (
          <div
            key={plan.id}
            className={styles.enterpriseCard}
          >
            <div className={styles.enterpriseContent}>
              <div>
                <h2 className={styles.planName}>{plan.name}</h2>
                <p className={styles.planDescription}>{plan.description}</p>
              </div>

              <div className={styles.priceSection}>
                <span className={styles.price}>{plan.price}</span>
                <span className={styles.period}>{plan.period}</span>
              </div>
            </div>

            <div className={styles.enterpriseFeatures}>
              <div className={styles.featuresList}>
                {plan.features.map((feature, idx) => (
                  <div key={idx} className={styles.featureItem}>
                    <span className={styles.checkmark}>✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              className={`${styles.cta} ${styles.ctaPrimary}`}
              onClick={() => {
                if (plan.ctaLink.startsWith('mailto:')) {
                  window.location.href = plan.ctaLink;
                } else {
                  window.location.href = plan.ctaLink;
                }
              }}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div className={styles.faqSection}>
        <h2 className={styles.faqTitle}>Frequently Asked Questions</h2>

        <div className={styles.faqGrid}>
          <div className={styles.faqItem}>
            <h3>Can I cancel anytime?</h3>
            <p>
              Yes. Individual & Team plans can be cancelled anytime with no penalty. Your access continues
              until the end of your billing cycle.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>Can I upgrade my plan?</h3>
            <p>
              Yes. Upgrade anytime; your first month of the new plan is pro-rated based on your current plan's
              cost.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>How does Team plan work?</h3>
            <p>
              Base price is ₹1,499/month per therapist seat. For 2 therapists, it's ₹2,998/month. You only pay
              for active seats.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>What payment methods do you accept?</h3>
            <p>Credit cards, debit cards, UPI, and netbanking via Razorpay or Cashfree.</p>
          </div>

          <div className={styles.faqItem}>
            <h3>Is there a money-back guarantee?</h3>
            <p>
              Yes. Cancel within 14 days of upgrade for a full refund. No questions asked.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>What happens to my data if I downgrade?</h3>
            <p>
              Your data is never deleted. Some features may be restricted (e.g., file attachments on Free
              plan).
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className={styles.ctaSection}>
        <h2>Ready to get started?</h2>
        <p>Start with Free, upgrade whenever you're ready.</p>
        <button
          className={styles.ctaButton}
          onClick={() => (window.location.href = '/signup')}
        >
          Get Started Now
        </button>
      </div>
    </div>
  );
};

export default PricingPage;
