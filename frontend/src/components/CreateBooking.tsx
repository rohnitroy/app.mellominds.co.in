import React, { useState, useEffect } from 'react';
import styles from './CreateBooking.module.css';
import SendBookingLinkModal from './SendBookingLinkModal';
import DateInput from './DateInput';
import CustomDropdown from './CustomDropdown';
import { useToast } from '../context/ToastContext';

interface CreateBookingProps {
    onBack?: () => void;
}

interface Calendar {
    id: string;
    title: string;
    duration: string;
}

const CreateBooking: React.FC<CreateBookingProps> = ({ onBack }) => {
    const toast = useToast();
    const [formData, setFormData] = useState({
        clientName: '',
        clientWhatsApp: '',
        clientEmail: '',
        selectedDate: '',
        selectedCalendar: '',
        sessionType: {
            online: false,
            inPerson: false
        }
    });

    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
    const [showSendLinkModal, setShowSendLinkModal] = useState<boolean>(false);

    useEffect(() => {
        const fetchCalendars = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/calendars', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    setCalendars(data);
                }
            } catch (error) {
                console.error('Failed to fetch calendars:', error);
            }
        };
        fetchCalendars();
    }, []);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSessionTypeChange = (type: 'online' | 'inPerson') => {
        setFormData(prev => ({
            ...prev,
            sessionType: {
                online: type === 'online',
                inPerson: type === 'inPerson'
            }
        }));
    };

    const handleCreateBooking = async () => {
        if (!formData.selectedCalendar || !formData.selectedDate || !selectedTimeSlot || !formData.clientName) {
            toast.warning('Please fill in all required fields');
            return;
        }

        try {
            // Parse time slot (e.g. "12:00PM")
            const timeMatch = selectedTimeSlot.match(/(\d+):(\d+)(AM|PM)/);
            if (!timeMatch) return;

            let hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const period = timeMatch[3];

            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;

            const startTime = new Date(formData.selectedDate);
            startTime.setHours(hours, minutes, 0, 0);

            const payload = {
                calendar_id: formData.selectedCalendar,
                start_time: startTime.toISOString(),
                client_name: formData.clientName,
                client_email: formData.clientEmail,
                client_phone: formData.clientWhatsApp, // Assuming this maps to phone
                payment_amount: 2700
                // session_type could be sent if backend supported it, but it expects calendar_id mainly
            };

            const response = await fetch('http://localhost:3001/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast.success('Booking created successfully!');
                if (onBack) onBack();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to create booking');
            }
        } catch (error) {
            console.error('Error creating booking:', error);
            toast.error('Failed to connect to server');
        }
    };

    const timeSlots = ['12:00PM', '1:00PM', '2:00PM', '3:00PM', '4:00PM']; // Expanded for testing

    return (
        <div className={styles.createBookingContent}>
            <div className={styles.pageHeader}>
                <div className={styles.backButton} onClick={onBack}>
                    <img src="/Iconly/Light-Outline/Arrow - Left.svg" alt="Back" />
                </div>
                <h1>Create a Booking</h1>
            </div>

            <div className={styles.formContainer}>
                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            Client Name<span className={styles.required}>*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Enter client name"
                            value={formData.clientName}
                            onChange={(e) => handleInputChange('clientName', e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            Client WhatsApp No.<span className={styles.required}>*</span>
                        </label>
                        <div className={styles.phoneInputContainer}>
                            <div className={styles.countryCode}>+91</div>
                            <input
                                type="text"
                                placeholder="Enter client whatsapp number"
                                value={formData.clientWhatsApp}
                                onChange={(e) => handleInputChange('clientWhatsApp', e.target.value)}
                                className={styles.phoneInput}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            Client Email Address<span className={styles.required}>*</span>
                        </label>
                        <input
                            type="email"
                            placeholder="Enter client email address"
                            value={formData.clientEmail}
                            onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Select Date</label>
                        <div className={styles.dateInputContainer}>
                            <DateInput
                                value={formData.selectedDate}
                                onChange={(val) => handleInputChange('selectedDate', val)}
                                className={styles.dateInput}
                                min={new Date().toISOString().split('T')[0]}
                            />
                            <img src="/Iconly/Bulk/Calendar.svg" alt="Calendar" className={styles.calendarIcon} />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Select Calendar</label>
                        <CustomDropdown
                            options={[
                                { value: '', label: 'Select Calendar' },
                                ...calendars.map(cal => ({
                                    value: cal.id.toString(),
                                    label: `${cal.title} (${cal.duration})`
                                }))
                            ]}
                            value={formData.selectedCalendar}
                            onChange={(value) => handleInputChange('selectedCalendar', value)}
                            placeholder="Select Calendar"
                        />
                    </div>
                </div>

                <div className={styles.availableSlotsSection}>
                    <div className={styles.slotsHeader}>
                        <h3>Available Slots</h3>
                        <div className={styles.sessionTypeOptions}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={formData.sessionType.online}
                                    onChange={() => handleSessionTypeChange('online')}
                                    className={styles.checkbox}
                                />
                                Online
                            </label>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={formData.sessionType.inPerson}
                                    onChange={() => handleSessionTypeChange('inPerson')}
                                    className={styles.checkbox}
                                />
                                In-person
                            </label>
                        </div>
                    </div>

                    <div className={styles.timeSlots}>
                        {timeSlots.map((slot) => (
                            <button
                                key={slot}
                                className={`${styles.timeSlot} ${selectedTimeSlot === slot ? styles.selectedSlot : ''}`}
                                onClick={() => setSelectedTimeSlot(slot)}
                            >
                                {slot}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.grandTotal}>
                        <span className={styles.totalLabel}>Grand Total:</span>
                        <span className={styles.totalAmount}>Rs. 2700/-</span>
                    </div>

                    <div className={styles.actionButtons}>
                        <button className={styles.payLaterBtn} onClick={handleCreateBooking}>Pay Later/Cash</button>
                        <button
                            className={styles.sendPaymentBtn}
                            onClick={() => setShowSendLinkModal(true)}
                        >
                            Send Payment Link
                        </button>
                    </div>
                </div>
            </div>

            <SendBookingLinkModal
                isOpen={showSendLinkModal}
                onClose={() => setShowSendLinkModal(false)}
            />
        </div>
    );
};

export default CreateBooking;
