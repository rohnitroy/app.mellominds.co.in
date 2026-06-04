import React, { useState } from 'react';
import styles from './UpgradePlanModal.module.css';
import EnterprisLeadModal from './EnterprisLeadModal';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({ isOpen, onClose }) => {
  const [showLeadForm, setShowLeadForm] = useState(false);

  if (!isOpen) return null;

  const plans = [
    {
      name: 'Free (Early Access)',
      price: '₹0',
      period: 'forever',
      description: 'Everything you need to run your practice',
      features: [
        { text: 'Booking calendars (one-on-one, group, couples)', included: true },
        { text: 'Public booking page with shareable link', included: true },
        { text: 'Custom intake form questions', included: true },
        { text: 'Google Calendar & Google Meet integration', included: true },
        { text: 'Weekly availability scheduling', included: true },
        { text: 'Client database & session history', included: true },
        { text: 'Session notes & customizable templates', included: true },
        { text: 'Client activity & homework tracking', included: true },
        { text: 'Client transfer system', included: true },
        { text: 'Dashboard analytics & stats', included: true },
        { text: 'In-app & email notifications', included: true },
        { text: 'Offline payments (Cash / UPI)', included: true },
        { text: 'Payments & invoice dashboard', included: true },
        { text: 'Custom profile link', included: false },
        { text: 'Payment gateway (Cashfree / Razorpay)', included: false },
        { text: 'Manage reminder schedules', included: false },
        { text: 'WhatsApp reminders', included: false },
        { text: 'Automated refund management', included: false },
        { text: 'Dedicated account manager', included: false },
        { text: 'Priority support', included: false },
        { text: 'Add team members', included: false },
      ],
      buttonText: 'Current Plan',
      buttonDisabled: true,
      popular: false,
      customPrice: null,
    },
    {
      name: 'Individual',
      price: '₹699',
      period: 'per month',
      description: 'Grow your practice with essential pro features',
      features: [
        { text: 'Everything in Free Tier, plus:', included: true },
        { text: 'Custom profile link (your own URL)', included: true },
        { text: 'Payment gateway integration (Cashfree / Razorpay)', included: true },
        { text: 'Online payments on booking page', included: true },
        { text: 'Automated refund management', included: true },
        { text: 'Manage & configure reminder schedules', included: true },
        { text: 'Dedicated account manager', included: true },
        { text: 'Priority support', included: true },
        { text: 'Custom domain & white-label branding', included: false },
        { text: 'Unlimited calendars & bookings', included: false },
        { text: 'Advanced analytics & reporting', included: false },
        { text: 'Add team members', included: false },
        { text: 'API access & webhook integrations', included: false },
      ],
      buttonText: 'Upgrade to Individual',
      buttonDisabled: false,
      popular: false,
      customPrice: null,
    },
    {
      name: 'Team',
      price: '₹1,499',
      period: 'per seat/month',
      description: 'Full power + team collaboration for your organization',
      features: [
        { text: 'Everything in Free Tier, plus:', included: true },
        { text: 'Custom profile link (your own URL)', included: true },
        { text: 'Payment gateway integration (Cashfree / Razorpay)', included: true },
        { text: 'Online payments on booking page', included: true },
        { text: 'Automated refund management', included: true },
        { text: 'Manage & configure reminder schedules', included: true },
        { text: 'WhatsApp reminders to clients', included: true },
        { text: 'Custom domain & white-label branding', included: true },
        { text: 'Unlimited calendars & bookings', included: true },
        { text: 'Advanced analytics & reporting', included: true },
        { text: 'Add team members (up to 20 seats)', included: true },
        { text: 'API access & webhook integrations', included: true },
        { text: 'Dedicated account manager', included: true },
        { text: 'Priority support', included: true },
      ],
      buttonText: 'Upgrade to Team',
      buttonDisabled: false,
      popular: true,
      customPrice: null,
    },
  ];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>

        <div className={styles.modalHeader}>
          <h2>Upgrade Your Plan</h2>
          <p>Choose the perfect plan for your practice</p>
        </div>

        <div className={styles.plansContainer}>
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`${styles.planCard} ${plan.popular ? styles.popularPlan : ''}`}
            >
              {plan.popular && <div className={styles.popularBadge}>Recommended</div>}

              <div className={styles.planHeader}>
                <h3>{plan.name}</h3>
                <div className={styles.priceSection}>
                  {plan.customPrice ? (
                    <span className={styles.price}>{plan.customPrice}</span>
                  ) : (
                    <>
                      <span className={styles.price}>{plan.price}</span>
                      <span className={styles.period}>/{plan.period}</span>
                    </>
                  )}
                </div>
                <p className={styles.description}>{plan.description}</p>
              </div>

              <ul className={styles.featuresList}>
                {plan.features.map((feature, idx) => (
                  <li key={idx} className={feature.included ? styles.included : styles.notIncluded}>
                    <span className={styles.checkmark}>
                      {feature.included ? '✓' : '×'}
                    </span>
                    {feature.text}
                  </li>
                ))}
              </ul>

              <button
                className={`${styles.planButton} ${plan.buttonDisabled ? styles.disabled : ''}`}
                disabled={plan.buttonDisabled}
                onClick={
                  !plan.buttonDisabled
                    ? () => setShowLeadForm(true)
                    : undefined
                }
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>

      <EnterprisLeadModal isOpen={showLeadForm} onClose={() => setShowLeadForm(false)} />
    </div>
  );
};

export default UpgradePlanModal;
