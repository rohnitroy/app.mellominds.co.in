import React, { useState } from 'react';
import styles from './EnterprisLeadModal.module.css';
import API_BASE_URL from '../config/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL = {
  name: '',
  phone: '',
  email: '',
  company_name: '',
  company_website: '',
  message: '',
};

const EnterprisLeadModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !form.company_name.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/enterprise/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm(INITIAL);
    setSubmitted(false);
    setError('');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose}>×</button>

        {submitted ? (
          <div className={styles.successState}>
            <div className={styles.successIcon}>✓</div>
            <h2>We'll be in touch!</h2>
            <p>Thanks for your interest in MelloMinds Enterprise. Our team will reach out to you within 1–2 business days.</p>
            <button className={styles.doneBtn} onClick={handleClose}>Done</button>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <div className={styles.badge}>Enterprise</div>
              <h2>Get in touch with us</h2>
              <p>Tell us about your organization and we'll tailor a plan for you.</p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Full Name <span>*</span></label>
                  <input
                    name="name"
                    type="text"
                    placeholder="Your full name"
                    value={form.name}
                    onChange={handleChange}
                    autoComplete="name"
                  />
                </div>
                <div className={styles.field}>
                  <label>Phone Number <span>*</span></label>
                  <input
                    name="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={handleChange}
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label>Email Address <span>*</span></label>
                <input
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Company Name <span>*</span></label>
                  <input
                    name="company_name"
                    type="text"
                    placeholder="Your organization"
                    value={form.company_name}
                    onChange={handleChange}
                  />
                </div>
                <div className={styles.field}>
                  <label>Company Website <span className={styles.optional}>(optional)</span></label>
                  <input
                    name="company_website"
                    type="url"
                    placeholder="https://yourcompany.com"
                    value={form.company_website}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label>Message <span className={styles.optional}>(optional)</span></label>
                <textarea
                  name="message"
                  rows={4}
                  placeholder="Tell us about your needs, team size, or any questions..."
                  value={form.message}
                  onChange={handleChange}
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Sending...' : 'Send Enquiry'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default EnterprisLeadModal;
