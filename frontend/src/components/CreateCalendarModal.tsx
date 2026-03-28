import React from 'react';
import styles from './CreateCalendarModal.module.css';

interface CreateCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectType: (type: string) => void;
}

const CreateCalendarModal: React.FC<CreateCalendarModalProps> = ({ isOpen, onClose, onSelectType }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                <h2 className={styles.title}>Choose Calendar Type</h2>

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Bookings</h3>
                    <div className={styles.grid}>
                        {/* One on One */}
                        <div className={styles.card} onClick={() => onSelectType('one_on_one')}>
                            <div className={styles.cardContent}>
                                <div className={styles.iconWrapper}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#082421" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="8" r="4"/>
                                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                                    </svg>
                                </div>
                                <div className={styles.cardText}>
                                    <h4 className={styles.cardTitle}>One on one</h4>
                                    <p className={styles.cardDescription}>Allow invitees to schedule 1:1 meetings with you.</p>
                                </div>
                            </div>
                        </div>

                        {/* Group */}
                        <div className={styles.card} onClick={() => onSelectType('group')}>
                            <div className={styles.cardContent}>
                                <div className={styles.iconWrapper}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#082421" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="9" cy="7" r="3"/>
                                        <circle cx="15" cy="7" r="3"/>
                                        <path d="M3 21v-1a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v1"/>
                                    </svg>
                                </div>
                                <div className={styles.cardText}>
                                    <h4 className={styles.cardTitle}>Group</h4>
                                    <p className={styles.cardDescription}>Accept multiple registrations for the same session.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateCalendarModal;
