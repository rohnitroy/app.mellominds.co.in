import React from 'react';
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
      'Unlimited public booking page',
      'Up to 5 booking calendars',
      'Client intake forms',
      'Session notes & templates',
      'Client database',
      'Google Calendar sync',
      'Google Meet integration',
      'Basic analytics (3 months)',
      'In-app & email notifications',
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
      'Everything in Free',
      'Razorpay integration',
      'Cashfree integration',
      'Online payment processing',
      'Invoice generation',
      'Refund management',
      'Custom profile link',
      'File attachments in notes',
      'Client activities & homework',
      'Unlimited analytics',
      'Email reminders configuration',
      'Payment reports',
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
      'Everything in Individual',
      'Unlimited therapist seats',
      'Unlimited calendars',
      'Shared client database',
      'Role-based access',
      'Therapist performance analytics',
      'Revenue per therapist tracking',
      'Team collaboration',
      'Shared templates',
      'Client-facing dashboard',
      'Bulk import/export',
      'Advanced reporting',
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
      'White-label domain',
      'Custom branding',
      'REST API & Webhooks',
      'GraphQL API',
      'SSO/SAML integration',
      'Custom report builder',
      'Advanced security & compliance',
      'Dedicated account manager',
      'Priority support (24/7)',
      'Phone & Slack support',
      'Custom implementation',
    ],
  },
];

const PricingPage: React.FC = () => {
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
              <span className={styles.price}>{plan.price}</span>
              <span className={styles.period}>{plan.period}</span>
            </div>

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
