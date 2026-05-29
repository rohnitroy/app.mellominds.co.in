import React, { useState } from 'react';
import styles from './CreateBooking.module.css';
import SendBookingLinkModal from './components/SendBookingLinkModal';
import DateInput from './components/DateInput';

interface CreateBookingProps {
  onBack?: () => void;
}

const CreateBooking: React.FC<CreateBookingProps> = ({ onBack }) => {
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

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [showSendLinkModal, setShowSendLinkModal] = useState<boolean>(false);

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

  const timeSlots = ['12:00PM'];

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
            <div className={styles.selectContainer}>
              <select
                value={formData.selectedCalendar}
                onChange={(e) => handleInputChange('selectedCalendar', e.target.value)}
                className={styles.select}
              >
                <option value="">Select</option>
                <option value="calendar1">Calendar 1</option>
                <option value="calendar2">Calendar 2</option>
              </select>
            </div>
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
            <button className={styles.payLaterBtn}>Pay Later/Cash</button>
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