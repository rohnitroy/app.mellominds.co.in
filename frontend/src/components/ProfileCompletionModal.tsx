import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { User } from 'react-iconly';
import styles from './ProfileCompletionModal.module.css';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  featureName?: string;
}

const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  isOpen,
  onClose,
  featureName = 'this feature'
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleCompleteProfile = () => {
    if (onClose) onClose();
    navigate('/settings/my-profile');
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  return createPortal(
    <div className={styles.container}>
      {/* Backdrop */}
      <div
        className={styles.backdrop}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Complete Your Profile</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <User set="bold" primaryColor="#082421" size="large" />
          </div>

          <p className={styles.message}>
            To access <strong>{featureName}</strong>, please complete your profile first.
          </p>

          <div className={styles.requiredFields}>
            <h3>Required Information:</h3>
            <ul>
              <li>Phone Number</li>
              <li>Date of Birth</li>
              <li>Gender</li>
              <li>Specialization</li>
              <li>Country</li>
              <li>State</li>
              <li>City</li>
              <li>Pincode</li>
              <li>Clinic Address</li>
            </ul>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={handleClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.completeButton}
            onClick={handleCompleteProfile}
            type="button"
          >
            Complete Profile
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProfileCompletionModal;
