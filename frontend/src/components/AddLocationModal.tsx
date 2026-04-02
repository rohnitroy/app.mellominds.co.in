import React, { useState } from 'react';
import styles from './AddLocationModal.module.css';

interface AddLocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectLocation: (locationData: any) => void;
    isGoogleConnected: boolean;
    onConnectGoogle: () => void;
}

const AddLocationModal: React.FC<AddLocationModalProps> = ({ isOpen, onClose, onSelectLocation, isGoogleConnected, onConnectGoogle }) => {
    const [activeTab, setActiveTab] = useState<'video' | 'physical'>('video');

    // Physical Location Form State
    const [physicalForm, setPhysicalForm] = useState({
        name: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: '',
        phone: '',
        email: ''
    });

    if (!isOpen) return null;

    const handlePhysicalSubmit = () => {
        // Validate required fields if needed
        onSelectLocation({
            type: 'in_person',
            details: physicalForm
        });
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Session Mode</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>
                    <div className={styles.tabs}>
                        <div
                            className={`${styles.tab} ${activeTab === 'video' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('video')}
                        >
                            <svg className={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 7l-7 5 7 5V7z" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            <span className={styles.tabLabel}>Video<br />Conference</span>
                        </div>
                        <div
                            className={`${styles.tab} ${activeTab === 'physical' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('physical')}
                        >
                            <svg className={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span className={styles.tabLabel}>In-Person</span>
                        </div>
                    </div>

                    {activeTab === 'video' && (
                        <div className={styles.optionList}>
                            <div
                                className={styles.optionItem}
                                onClick={() => {
                                    onSelectLocation({ type: 'google_meet' });
                                    onClose();
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <img src="/google-meet-logo.svg" alt="Google Meet" className={styles.optionIcon} style={{ width: '24px', height: '24px' }} />
                                <div className={styles.optionText}>
                                    <h4>Google Meet</h4>
                                    <p>Web conference using Google meet</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'physical' && (
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Location Name*</label>
                                <input
                                    className={styles.input}
                                    placeholder="e.g., Main Office"
                                    value={physicalForm.name}
                                    onChange={e => setPhysicalForm({ ...physicalForm, name: e.target.value })}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Street Address*</label>
                                <input
                                    className={styles.input}
                                    placeholder="Street address"
                                    value={physicalForm.address}
                                    onChange={e => setPhysicalForm({ ...physicalForm, address: e.target.value })}
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>City*</label>
                                    <input
                                        className={styles.input}
                                        placeholder="City"
                                        value={physicalForm.city}
                                        onChange={e => setPhysicalForm({ ...physicalForm, city: e.target.value })}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>State/Province*</label>
                                    <input
                                        className={styles.input}
                                        placeholder="State/Province"
                                        value={physicalForm.state}
                                        onChange={e => setPhysicalForm({ ...physicalForm, state: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>ZIP/Postal Code*</label>
                                    <input
                                        className={styles.input}
                                        placeholder="ZIP/Postal code"
                                        value={physicalForm.zip}
                                        onChange={e => setPhysicalForm({ ...physicalForm, zip: e.target.value })}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Country*</label>
                                    <input
                                        className={styles.input}
                                        placeholder="Country"
                                        value={physicalForm.country}
                                        onChange={e => setPhysicalForm({ ...physicalForm, country: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Phone(if any)</label>
                                    <input
                                        className={styles.input}
                                        placeholder="Phone number"
                                        value={physicalForm.phone}
                                        onChange={e => setPhysicalForm({ ...physicalForm, phone: e.target.value })}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Email(if any)</label>
                                    <input
                                        className={styles.input}
                                        placeholder="Contact email"
                                        value={physicalForm.email}
                                        onChange={e => setPhysicalForm({ ...physicalForm, email: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {activeTab === 'physical' && (
                    <div className={styles.footer}>
                        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                        <button className={styles.addBtn} onClick={handlePhysicalSubmit}>Save</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddLocationModal;
