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
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="#000" />
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
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M16 11C16 8.79 14.21 7 12 7C9.79 7 8 8.79 8 11C8 13.21 9.79 15 12 15C14.21 15 16 13.21 16 11ZM8 11V10.99H8.01V11H8Z" fill="#000" />
                                        <path d="M1 18V20H23V18C23 15.34 17.67 14 15 14H9C6.33 14 1 15.34 1 18Z" fill="#000" />
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
