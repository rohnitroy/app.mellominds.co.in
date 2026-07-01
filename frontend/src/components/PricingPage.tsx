import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './PricingPage.module.css';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';

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
      'Razorpay payments per therapist',
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
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [processing, setProcessing] = useState<string | null>(null);

  // Price per plan per interval (yearly ≈ 2 months free)
  const PRICE: Record<string, { monthly: number; yearly: number }> = {
    individual: { monthly: 699, yearly: 6710 },
    team: { monthly: 1499, yearly: 14390 },
  };
  const unitPrice = (planId: string) => PRICE[planId]?.[billingInterval] ?? 0;
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated, user, checkAuth } = useAuth();

  const loadRazorpay = () => new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.head.appendChild(script);
  });

  // Razorpay subscription checkout, run inline on this page (no separate modal/page)
  const handleSubscribe = async (planKey: 'individual' | 'team', seats: number, interval: 'monthly' | 'yearly') => {
    setProcessing(planKey);
    try {
      const subRes = await fetch(`${API_BASE_URL}/api/plan/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan_key: planKey, seats, interval }),
      });
      const sub = await subRes.json();
      if (!subRes.ok) { toast.error(sub.error || 'Could not start subscription'); setProcessing(null); return; }

      await loadRazorpay();
      await new Promise<void>((resolve) => {
        const options = {
          key: sub.key_id,
          subscription_id: sub.subscription_id,
          name: 'MelloMinds',
          description: `${planKey === 'team' ? `Team plan — ${seats} seats` : 'Individual plan'} (${interval})`,
          prefill: { name: user?.user_name || '', email: user?.email || '' },
          handler: async (response: any) => {
            try {
              const verifyRes = await fetch(`${API_BASE_URL}/api/plan/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_key: planKey,
                  seats,
                  interval,
                }),
              });
              if (verifyRes.ok) {
                await checkAuth();
                toast.success(`Upgraded to ${planKey === 'team' ? 'Team' : 'Individual'} plan!`);
                navigate('/dashboard');
              } else {
                const err = await verifyRes.json();
                toast.error(err.error || 'Payment verification failed');
              }
            } catch {
              toast.error('Payment verification failed. Please contact support.');
            } finally {
              resolve();
            }
          },
          modal: { ondismiss: () => { toast.warning('Payment cancelled.'); resolve(); } },
          theme: { color: '#082421' },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      });
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  // Choose the Free plan (logged-in onboarding) → mark selected, enter the app
  const chooseFree = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/select-free`, { method: 'POST', credentials: 'include' });
      if (res.ok) { await checkAuth(); toast.success('You’re on the Free plan.'); navigate('/dashboard'); }
      else toast.error('Could not continue. Please try again.');
    } catch { toast.error('Network error. Please try again.'); }
  };

  const handlePlanCta = (plan: Plan) => {
    if (plan.ctaLink.startsWith('mailto:')) { window.location.href = plan.ctaLink; return; }
    if (plan.id === 'individual' || plan.id === 'team') {
      if (!isAuthenticated) { navigate('/signup'); return; }
      if (plan.id === user?.plan_name) { toast.info('This is already your current plan.'); return; }
      // Switching from one paid plan to another cancels the old subscription first
      const onPaidPlan = user?.plan_name === 'individual' || user?.plan_name === 'team';
      if (onPaidPlan) {
        const ok = window.confirm(
          `Switching to ${plan.name} will cancel your current ${user?.plan_name === 'team' ? 'Team' : 'Individual'} subscription and start a new one. Continue?`
        );
        if (!ok) return;
      }
      handleSubscribe(plan.id, plan.id === 'team' ? teamSeats : 1, billingInterval);
      return;
    }
    // Free plan: logged-in users select it and enter; guests go to signup
    if (plan.id === 'free') {
      if (isAuthenticated) chooseFree();
      else navigate('/signup');
      return;
    }
    navigate(plan.ctaLink);
  };

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

        {/* Monthly / Annual toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f3f4', borderRadius: '999px', padding: '4px', marginTop: '16px' }}>
          {(['monthly', 'yearly'] as const).map(iv => (
            <button
              key={iv}
              onClick={() => setBillingInterval(iv)}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: '999px', padding: '8px 18px',
                fontFamily: 'Urbanist', fontWeight: 700, fontSize: '13px',
                background: billingInterval === iv ? '#082421' : 'transparent',
                color: billingInterval === iv ? '#fff' : '#6E6E6E',
              }}
            >
              {iv === 'monthly' ? 'Monthly' : 'Annual'}
              {iv === 'yearly' && <span style={{ marginLeft: '6px', color: billingInterval === iv ? '#F9E141' : '#2D7579' }}>save ~20%</span>}
            </button>
          ))}
        </div>
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
              {plan.id === 'free' ? (
                <>
                  <span className={styles.price}>₹0</span>
                  <span className={styles.period}>/month</span>
                </>
              ) : (() => {
                const perSeatSuffix = plan.id === 'team' ? '/seat' : '';
                const monthly = PRICE[plan.id].monthly;
                const yearly = PRICE[plan.id].yearly;
                const yearlyIfMonthly = monthly * 12;      // what 12 monthly payments would cost
                const saving = yearlyIfMonthly - yearly;    // saved by paying annually
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', width: '100%' }}>
                    {billingInterval === 'yearly' && (
                      <span style={{ fontSize: '15px', color: '#9CA3AF', fontFamily: 'Urbanist', textDecoration: 'line-through' }}>
                        ₹{yearlyIfMonthly.toLocaleString('en-IN')}{perSeatSuffix}/year
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span className={styles.price}>₹{unitPrice(plan.id).toLocaleString('en-IN')}</span>
                      <span className={styles.period}>{perSeatSuffix}{billingInterval === 'yearly' ? '/year' : '/month'}</span>
                    </div>
                    <span style={{ display: 'inline-block', fontSize: '13px', color: '#1a7f4b', background: '#e8f7ee', borderRadius: '8px', padding: '4px 10px', fontFamily: 'Urbanist', fontWeight: 700 }}>
                      {billingInterval === 'monthly'
                        ? `Pay yearly ₹${yearly.toLocaleString('en-IN')}${perSeatSuffix} · save ₹${saving.toLocaleString('en-IN')}`
                        : `You save ₹${saving.toLocaleString('en-IN')}${perSeatSuffix}/year`}
                    </span>
                  </div>
                );
              })()}
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
                  Total: <span className={styles.totalAmount}>₹{(teamSeats * unitPrice('team')).toLocaleString('en-IN')}</span><span className={styles.totalPeriod}>{billingInterval === 'yearly' ? '/year' : '/month'}</span>
                </div>
              </div>
            )}

            <button
              className={`${styles.cta} ${plan.featured ? styles.ctaPrimary : styles.ctaSecondary}`}
              onClick={() => handlePlanCta(plan)}
              disabled={processing === plan.id || (isAuthenticated && user?.plan_selected !== false && plan.id === user?.plan_name)}
            >
              {processing === plan.id ? 'Processing…' : (isAuthenticated && user?.plan_selected !== false && plan.id === user?.plan_name) ? 'Current Plan' : plan.cta}
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
              onClick={() => handlePlanCta(plan)}
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
            <p>Credit cards, debit cards, UPI, and netbanking via Razorpay.</p>
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
