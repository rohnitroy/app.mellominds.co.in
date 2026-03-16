import React from 'react';
import styles from './UpgradePlanModal.module.css';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const plans = [
    {
      name: 'Free',
      price: '₹0',
      period: 'forever',
      description: 'Perfect for getting started',
      features: [
        { text: '1 Calendar/Resource', included: true },
        { text: 'Up to 10 bookings/month', included: true },
        { text: 'Basic availability settings', included: true },
        { text: 'Email notifications', included: true },
        { text: 'Google Calendar integration', included: true },
        { text: 'Basic client management', included: true },
        { text: 'Payment gateway integration', included: false },
        { text: 'Client notes & profiles', included: false },
        { text: 'SMS notifications', included: false },
        { text: 'Priority support', included: false }
      ],
      buttonText: 'Current Plan',
      buttonDisabled: true,
      popular: false
    },
    {
      name: 'Professional',
      price: '₹999',
      period: 'per month',
      description: 'For growing practices',
      features: [
        { text: 'Unlimited calendars', included: true },
        { text: 'Unlimited bookings', included: true },
        { text: 'Advanced availability settings', included: true },
        { text: 'Email + SMS notifications', included: true },
        { text: 'Payment gateway integration', included: true },
        { text: 'Client notes & clinical profiles', included: true },
        { text: 'Custom booking forms', included: true },
        { text: 'Automated reminders', included: true },
        { text: 'Priority support', included: true },
        { text: 'Remove branding', included: true }
      ],
      buttonText: 'Start 14-Day Free Trial',
      buttonDisabled: false,
      popular: true
    },
    {
      name: 'Premium',
      price: '₹1,999',
      period: 'per month',
      description: 'For established clinics',
      features: [
        { text: 'Everything in Professional', included: true },
        { text: 'Team management', included: true },
        { text: 'Advanced analytics & reports', included: true },
        { text: 'Custom domain', included: true },
        { text: 'Webhook integrations', included: true },
        { text: 'API access', included: true },
        { text: 'Video consultation integration', included: true },
        { text: 'Client portal access', included: true },
        { text: 'White-label solution', included: true },
        { text: 'Dedicated account manager', included: true }
      ],
      buttonText: 'Start 14-Day Free Trial',
      buttonDisabled: false,
      popular: false
    }
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
              {plan.popular && <div className={styles.popularBadge}>Most Popular</div>}
              
              <div className={styles.planHeader}>
                <h3>{plan.name}</h3>
                <div className={styles.priceSection}>
                  <span className={styles.price}>{plan.price}</span>
                  <span className={styles.period}>/{plan.period}</span>
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
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>

        <div className={styles.enterpriseSection}>
          <h3>Need more? Try Enterprise</h3>
          <p>Custom integrations, multi-location support, advanced security, and dedicated support</p>
          <button className={styles.contactButton}>Contact Sales</button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlanModal;
