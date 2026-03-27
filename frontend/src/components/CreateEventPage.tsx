import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './CreateEventPage.module.css';
import { useAuth } from '../context/AuthContext';
import AddLocationModal from './AddLocationModal';
import QuestionModal from './QuestionModal';
import CustomDropdown from './CustomDropdown';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';

const CreateEventPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const toast = useToast();
    
    // Check if we're in edit mode
    const isEditMode = location.state?.isEditing || false;
    const existingCalendar = location.state?.calendar;
    
    // Retrieve type passed from previous screen if available
    const initialType = existingCalendar?.type || location.state?.type || 'one_on_one';

    const [activeTab, setActiveTab] = useState('basic');
    const [isSlugEdited, setIsSlugEdited] = useState(false);
    const [showAddLocationModal, setShowAddLocationModal] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);

    const [eventData, setEventData] = useState({
        name: existingCalendar?.title || '',
        description: existingCalendar?.description || '',
        url: existingCalendar?.slug || '',
        color: '#3787F8', // Default blue
        locations: [{ type: 'google_meet' }] as any[],
        duration: existingCalendar?.duration?.replace(' m', '') || '60',
        owner: user?.user_name || 'Therapist',
    });

    const [scheduleData, setScheduleData] = useState({
        duration: '30',
        durationUnit: 'Minutes',
        dateRangeType: 'calendar_days', // calendar_days, business_days, range, indefinitely
        dateRangeValue: '60',
        selectedSchedule: 'default', // Default mock schedule
        slotInterval: '30',
        bufferType: 'after_event', // before_event, after_event
        bufferTime: '0',
        minNotice: '0'
    });

    const [formData, setFormData] = useState({
        heading: 'Registration',
        questions: [
            { id: 1, label: 'Name', type: 'text', key: 'name', required: true, persistent: true },
            { id: 2, label: 'Email address', type: 'email', key: 'email', required: true, persistent: true }
        ]
    });

    const [paymentData, setPaymentData] = useState({
        acceptPayment: false,
        paymentGateways: [] as string[],
        prices: [] as any[],
        cancellation: {
            enabled: false,
            window: '24',
            unit: 'hours',
            refundType: 'full', // full, partial, none
            refundPercentage: '50'
        },
        reschedule: {
            enabled: false,
            window: '24',
            unit: 'hours',
            type: 'free', // free, paid
            fee: ''
        }
    });

    const [isGatewayDropdownOpen, setIsGatewayDropdownOpen] = useState(false);
    const [showPriceInput, setShowPriceInput] = useState(false);
    const [newPrice, setNewPrice] = useState({
        amount: '',
        currency: 'INR',
        label: ''
    });

    const handleGatewayChange = (gateway: string) => {
        setPaymentData(prev => {
            const gateways = prev.paymentGateways.includes(gateway)
                ? prev.paymentGateways.filter(g => g !== gateway)
                : [...prev.paymentGateways, gateway];
            return { ...prev, paymentGateways: gateways };
        });
    };

    const handleAddPrice = () => {
        if (!newPrice.amount || !newPrice.currency) return;
        setPaymentData(prev => ({
            ...prev,
            prices: [...prev.prices, { ...newPrice, id: Date.now() }]
        }));
        setNewPrice({ amount: '', currency: 'INR', label: '' });
        setShowPriceInput(false);
    };

    const removePrice = (id: number) => {
        setPaymentData(prev => ({
            ...prev,
            prices: prev.prices.filter(p => p.id !== id)
        }));
    };

    const navItems = [
        { id: 'basic', label: 'Basic', icon: '⚙️' },
        { id: 'schedule', label: 'Schedule', icon: '📅' },
        { id: 'form', label: 'Form', icon: '📝' },
        { id: 'payment', label: 'Payment', icon: '💳' },
    ];

    // Simplified schedule management: fetch the user's single availability schedule
    const [displayAvailability, setDisplayAvailability] = useState<{ day: string; time: string }[]>([
        { day: 'SUN', time: 'Loading...' },
        { day: 'MON', time: 'Loading...' },
        { day: 'TUE', time: 'Loading...' },
        { day: 'WED', time: 'Loading...' },
        { day: 'THU', time: 'Loading...' },
        { day: 'FRI', time: 'Loading...' },
        { day: 'SAT', time: 'Loading...' },
    ]);

    // Format time helper (HH:MM -> 12h format)
    const formatTime12h = (time24: string) => {
        const [h, m] = time24.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m);
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const fetchAvailability = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/availability`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();

                // Days mapping
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

                // Initialize default unavailable structure
                const newAvailability = dayNames.map((day, index) => ({
                    day,
                    time: 'Unavailable',
                    dayIndex: index
                }));

                // Process fetched slots
                data.forEach((slot: any) => {
                    if (slot.is_enabled) {
                        const dayIndex = slot.day_of_week;
                        const timeStr = `${formatTime12h(slot.start_time)} - ${formatTime12h(slot.end_time)}`;

                        // Append if multiple slots exist for the same day
                        if (newAvailability[dayIndex].time === 'Unavailable') {
                            newAvailability[dayIndex].time = timeStr;
                        } else {
                            newAvailability[dayIndex].time += `, ${timeStr}`;
                        }
                    }
                });

                setDisplayAvailability(newAvailability);
            } else {
                console.error('Failed to fetch availability');
                setDisplayAvailability(prev => prev.map(d => ({ ...d, time: 'Unavailable' })));
            }
        } catch (error) {
            console.error('Error fetching availability:', error);
            setDisplayAvailability(prev => prev.map(d => ({ ...d, time: 'Unavailable' })));
        }
    };

    useEffect(() => {
        fetchAvailability();
    }, []);

    // Currently supported backend only allows one schedule per user
    const availableSchedules = [
        { id: 'default', name: 'My Current Availability' }
    ];

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        setEventData(prev => ({
            ...prev,
            name,
            url: isSlugEdited ? prev.url : slug
        }));
    };

    const handleLocationFromModal = (locationData: any) => {
        if (locationData.type === 'google_meet') {
            const hasGoogleMeet = eventData.locations.some(loc => loc.type === 'google_meet');
            if (hasGoogleMeet) {
                toast.warning('Google Meet is already selected as a location.');
                return;
            }
        }

        const newLocation: any = { type: locationData.type };

        if (locationData.type === 'in_person' && locationData.details) {
            const { name, address, city, state, country } = locationData.details;
            newLocation.details = locationData.details;
            newLocation.address = `${name}: ${address}, ${city}, ${state}, ${country}`;
        }

        setEventData(prev => ({
            ...prev,
            locations: [...prev.locations, newLocation]
        }));
        setShowAddLocationModal(false);
    };

    const removeLocation = (index: number) => {
        setEventData(prev => ({
            ...prev,
            locations: prev.locations.filter((_, i) => i !== index)
        }));
    };

    const handleConnectGoogle = () => {
        console.log('Connect to Google Calendar');
        // Add actual logic if available
    };

    const handleSave = async () => {
        if (!eventData.name.trim()) {
            toast.error('Event Name is required.');
            setActiveTab('basic');
            return;
        }

        if (!scheduleData.duration) {
            toast.error('Duration is required.');
            setActiveTab('schedule');
            return;
        }

        try {
            // Build the payload
            const payload = {
                title: eventData.name,
                duration: `${scheduleData.duration} ${scheduleData.durationUnit}`, // e.g., '60 Minutes'
                type: initialType, // Use the type from existing calendar or initial type
                description: eventData.description,
                slug: eventData.url,
                is_active: true,
                form_data: formData // Inject the dynamic form builder responses
            };

            const url = isEditMode 
                ? `${API_BASE_URL}/api/calendars/${existingCalendar.id}`
                : `${API_BASE_URL}/api/calendars`;

            const response = await fetch(url, {
                method: isEditMode ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast.success(isEditMode ? 'Calendar updated successfully!' : 'Calendar created successfully!');
                // Success: Redirect back to My Calendars
                navigate('/my-calendar');
            } else {
                const errorData = await response.json();
                toast.error(`Failed to save calendar: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error saving event:', error);
            toast.error('An error occurred while saving.');
        }
    };

    const renderBasicTab = () => (
        <>
            <div className={styles.card}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Event Name</label>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Enter event name"
                        value={eventData.name}
                        onChange={handleNameChange}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Description</label>
                    <div className={styles.editor}>
                        <div className={styles.editorToolbar}>
                            <button className={styles.editorBtn} onClick={() => document.execCommand('bold', false, '')} title="Bold" type="button">B</button>
                            <button className={styles.editorBtn} onClick={() => document.execCommand('italic', false, '')} title="Italic" type="button">I</button>
                            <button className={styles.editorBtn} onClick={() => document.execCommand('insertUnorderedList', false, '')} title="Bullet List" type="button">≡</button>
                            <button className={styles.editorBtn} onClick={() => { const url = prompt('Enter URL:'); if (url) document.execCommand('createLink', false, url); }} title="Link" type="button">🔗</button>
                        </div>
                        <div
                            className={`${styles.input} ${styles.editorContent}`}
                            style={{ border: 'none', resize: 'none', width: '100%', minHeight: '120px', overflowY: 'auto' }}
                            contentEditable
                            onInput={(e) => setEventData({ ...eventData, description: e.currentTarget.innerHTML })}
                            suppressContentEditableWarning={true}
                        >
                        </div>
                    </div>
                </div>

                <div className={styles.row}>
                    <div className={`${styles.formGroup} ${styles.col}`}>
                        <label className={styles.label}>Slug</label>
                        <div className={styles.input} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isSlugEdited ? 'white' : '#f8f9fa' }}>
                            <span style={{ color: '#666' }}>/</span>
                            <input
                                type="text"
                                style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent' }}
                                value={eventData.url}
                                readOnly={!isSlugEdited}
                                onChange={e => {
                                    setIsSlugEdited(true);
                                    setEventData({ ...eventData, url: e.target.value });
                                }}
                            />
                            <button
                                className={styles.actionBtn}
                                style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #ccc' }}
                                onClick={() => setIsSlugEdited(true)}
                                type="button"
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                    <div className={`${styles.formGroup} ${styles.col}`}>
                        <label className={styles.label}>Therapist</label>
                        <div className={styles.input} style={{ background: '#f8f9fa', color: '#666' }}>
                            {eventData.owner}
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Location</label>
                    {eventData.locations.map((loc, index) => (
                        <div key={index} className={styles.locationChip} style={{ marginBottom: '8px' }}>
                            {loc.type === 'google_meet' && (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M23.25 8.625L18 12.375V9C18 7.34315 16.6569 6 15 6H3C1.34315 6 0 7.34315 0 9V17C0 18.6569 1.34315 20 3 20H15C16.6569 20 18 18.6569 18 17V13.625L23.25 17.375C23.6642 17.6511 24 17.3547 24 16.8571V9.14286C24 8.64531 23.6642 8.3489 23.25 8.625Z" fill="#00796B" />
                                        <rect x="5" y="10" width="8" height="6" rx="1" fill="#fff" />
                                    </svg>
                                    Google Meet
                                </>
                            )}
                            {loc.type === 'in_person' && (
                                <>
                                    <span style={{ fontSize: '18px' }}>📍</span>
                                    In-Person: {loc.address}
                                </>
                            )}
                            <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#666' }} onClick={() => removeLocation(index)}>×</span>
                        </div>
                    ))}
                    <div>
                        <button className={styles.actionBtn} style={{ maxWidth: '200px', marginBottom: '8px' }} onClick={() => setShowAddLocationModal(true)}>
                            + Select a Location
                        </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                        Connect with Video conferencing apps to auto create the meeting link when booked: <a href="#" style={{ color: '#3787F8' }}>Go to Connections →</a>
                    </p>
                </div>
            </div>
        </>
    );

    const renderScheduleTab = () => (
        <>
            {/* Durations */}
            <div className={styles.scheduleSection}>
                <h3>Durations</h3>
                <p>Set custom duration options for this event <a href="#" className={styles.link}>Learn more ↗</a></p>
                <div className={styles.rowInputs}>
                    <input
                        type="number"
                        className={styles.smallInput}
                        value={scheduleData.duration}
                        onChange={(e) => setScheduleData({ ...scheduleData, duration: e.target.value })}
                    />
                    <select
                        className={styles.selectInput}
                        value={scheduleData.durationUnit}
                        onChange={(e) => setScheduleData({ ...scheduleData, durationUnit: e.target.value })}
                    >
                        <option value="Minutes">Minutes</option>
                        <option value="Hours">Hours</option>
                    </select>
                </div>
                <button className={styles.addDurationBtn}>+ Add Duration Option</button>
            </div>

            {/* Date Ranges */}
            <div className={styles.scheduleSection}>
                <h3>Date Ranges</h3>
                <p>Set how far in advance people can book this event</p>

                <div className={styles.radioGroup}>
                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="dateRange"
                            checked={scheduleData.dateRangeType === 'calendar_days'}
                            onChange={() => setScheduleData({ ...scheduleData, dateRangeType: 'calendar_days' })}
                        />
                        <span>Calendar days into the future</span>
                    </label>
                    {scheduleData.dateRangeType === 'calendar_days' && (
                        <div className={styles.subInputContainer}>
                            <input
                                type="number"
                                className={styles.smallInput}
                                value={scheduleData.dateRangeValue}
                                onChange={(e) => setScheduleData({ ...scheduleData, dateRangeValue: e.target.value })}
                            />
                        </div>
                    )}

                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="dateRange"
                            checked={scheduleData.dateRangeType === 'business_days'}
                            onChange={() => setScheduleData({ ...scheduleData, dateRangeType: 'business_days' })}
                        />
                        <span>Business days into the future</span>
                    </label>

                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="dateRange"
                            checked={scheduleData.dateRangeType === 'range'}
                            onChange={() => setScheduleData({ ...scheduleData, dateRangeType: 'range' })}
                        />
                        <span>Within a date range</span>
                    </label>

                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="dateRange"
                            checked={scheduleData.dateRangeType === 'indefinitely'}
                            onChange={() => setScheduleData({ ...scheduleData, dateRangeType: 'indefinitely' })}
                        />
                        <span>Any date into the future</span>
                    </label>
                </div>
            </div>

            {/* Schedule */}
            <div className={styles.scheduleSection}>
                <h3>Schedule</h3>
                <p>Select the schedule to determine your availability</p>
                <div className={styles.scheduleActions}>
                    <select
                        className={styles.input}
                        value={scheduleData.selectedSchedule}
                        onChange={(e) => setScheduleData({ ...scheduleData, selectedSchedule: e.target.value })}
                        style={{ flex: 1 }}
                    >
                        {availableSchedules.map(sch => (
                            <option key={sch.id} value={sch.id}>{sch.name}</option>
                        ))}
                    </select>
                    <button className={styles.actionBtn}>Edit Schedule</button>
                    <button className={styles.actionBtn}>+ New Schedule</button>
                </div>

                <p className={styles.sectionLabel}>Available Times</p>
                <div className={styles.scheduleGrid}>
                    {displayAvailability.map((slot, index) => (
                        <div key={index} className={`${styles.scheduleDay} ${slot.time === 'Unavailable' ? styles.unavailable : ''}`}>
                            <span>{slot.day}</span>
                            <span>{slot.time}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Slots Generator */}
            <div className={styles.scheduleSection}>
                <h3>Slots Generator</h3>
                <p>Generate slot times in increments of X minutes instead of using the event duration. <a href="#" className={styles.link}>Learn more ↗</a></p>
                <div className={styles.rowInputs}>
                    <input
                        type="number"
                        className={styles.smallInput}
                        style={{ width: '100px' }}
                        value={scheduleData.slotInterval}
                        onChange={(e) => setScheduleData({ ...scheduleData, slotInterval: e.target.value })}
                    />
                    <select className={styles.selectInput}>
                        <option value="Minutes">Minutes</option>
                    </select>
                </div>
            </div>

            {/* Break Time */}
            <div className={styles.scheduleSection}>
                <h3>Break Time</h3>
                <p>Add buffer time before and after events <a href="#" className={styles.link}>Learn more ↗</a></p>
                <div className={styles.radioGroup} style={{ flexDirection: 'row', gap: '24px', marginBottom: '24px' }}>
                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="bufferTime"
                            checked={scheduleData.bufferType === 'before_event'}
                            onChange={() => setScheduleData({ ...scheduleData, bufferType: 'before_event' })}
                        />
                        <span>Before Event</span>
                    </label>
                    <label className={styles.radioOption}>
                        <input
                            type="radio"
                            name="bufferTime"
                            checked={scheduleData.bufferType === 'after_event'}
                            onChange={() => setScheduleData({ ...scheduleData, bufferType: 'after_event' })}
                        />
                        <span>After Event</span>
                    </label>
                </div>

                <p className={styles.sectionLabel} style={{ marginTop: 0 }}>
                    {scheduleData.bufferType === 'before_event' ? 'Before Event' : 'After Event'} (minutes)
                </p>
                <input
                    type="number"
                    className={styles.smallInput}
                    style={{ width: '100px' }}
                    value={scheduleData.bufferTime}
                    onChange={(e) => setScheduleData({ ...scheduleData, bufferTime: e.target.value })}
                />
            </div>

            {/* Minimum Notice */}
            <div className={styles.scheduleSection}>
                <h3>Minimum Notice</h3>
                <p>Set minimum advance notice required for bookings <a href="#" className={styles.link}>Learn more ↗</a></p>
                <div className={styles.rowInputs}>
                    <input
                        type="number"
                        className={styles.smallInput}
                        style={{ width: '100px' }}
                        value={scheduleData.minNotice}
                        onChange={(e) => setScheduleData({ ...scheduleData, minNotice: e.target.value })}
                    />
                    <select className={styles.selectInput}>
                        <option value="Minutes">Minutes</option>
                        <option value="Hours">Hours</option>
                        <option value="Days">Days</option>
                    </select>
                </div>
            </div>
        </>
    );

    const handleTemplateSelect = (template: string) => {
        let newQuestions = [...formData.questions];
        const baseQuestions = [
            { id: 1, label: 'Name', type: 'text', key: 'name', required: true, persistent: true },
            { id: 2, label: 'Email address', type: 'email', key: 'email', required: true, persistent: true }
        ];

        switch (template) {
            case 'name_email_phone':
                newQuestions = [
                    ...baseQuestions,
                    { id: Date.now(), label: 'Mobile number', type: 'tel', key: 'phone', required: true, persistent: false }
                ];
                break;
            case 'name_phone':
                newQuestions = [
                    { id: 1, label: 'Name', type: 'text', key: 'name', required: true, persistent: true },
                    { id: Date.now(), label: 'Mobile number', type: 'tel', key: 'phone', required: true, persistent: false }
                ];
                break;
            case 'name_email':
                newQuestions = [...baseQuestions];
                break;
            // Add more templates as needed
            default:
                break;
        }
        setFormData({ ...formData, questions: newQuestions });
    };

    const removeQuestion = (id: number) => {
        setFormData({
            ...formData,
            questions: formData.questions.filter(q => q.id !== id)
        });
    };

    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<any>(null);

    const handleAddQuestion = () => {
        setEditingQuestion(null);
        setShowQuestionModal(true);
    };

    const handleEditQuestion = (question: any) => {
        setEditingQuestion(question);
        setShowQuestionModal(true);
    };

    const handleSaveQuestion = (question: any) => {
        if (editingQuestion) {
            setFormData({
                ...formData,
                questions: formData.questions.map(q => q.id === editingQuestion.id ? question : q)
            });
        } else {
            setFormData({
                ...formData,
                questions: [...formData.questions, { ...question, id: Date.now(), persistent: false }]
            });
        }
        setShowQuestionModal(false);
    };

    // Renamed to avoid conflict if any, but logically it replaces the old render function
    const renderQuestionModalComponent = () => (
        <QuestionModal
            isOpen={showQuestionModal}
            onClose={() => setShowQuestionModal(false)}
            onSave={handleSaveQuestion}
            editingQuestion={editingQuestion}
        />
    );

    const renderFormTab = () => (
        <>
            <div className={styles.scheduleSection}>
                <h3>Registration Form</h3>
                <p>Customize the registration form to add and configure fields to collect specific information from invitees. <a href="#" className={styles.link}>Learn more ↗</a></p>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Form Heading</label>
                    <input
                        type="text"
                        className={styles.input}
                        value={formData.heading}
                        onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Quick Form Templates</label>
                    <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>Choose from pre-configured form templates or create your own custom questions below.</p>
                    <div className={styles.templatesContainer}>
                        <button className={styles.templateBtn} onClick={() => handleTemplateSelect('name_email_phone')}>
                            ↻ Name, Email & Phone
                        </button>
                        <button className={styles.templateBtn} onClick={() => handleTemplateSelect('name_email')}>
                            ↻ Name & Email
                        </button>
                        <button className={styles.templateBtn} onClick={() => handleTemplateSelect('name_phone')}>
                            ↻ Name & Phone
                        </button>
                    </div>
                </div>

                <div className={styles.questionsHeader}>
                    <label className={styles.label} style={{ marginBottom: 0 }}>Questions</label>
                    <button className={styles.addQuestionBtn} onClick={handleAddQuestion}>+ Add Question</button>
                </div>

                <div className={styles.questionsList}>
                    {formData.questions.map((q, index) => (
                        <div
                            key={q.id}
                            className={styles.questionItem}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', index.toString());
                                e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => {
                                e.preventDefault(); // Necessary to allow dropping
                                e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                const draggedIndexStr = e.dataTransfer.getData('text/plain');
                                if (draggedIndexStr) {
                                    const draggedIndex = parseInt(draggedIndexStr, 10);
                                    if (draggedIndex !== index) {
                                        const newQuestions = [...formData.questions];
                                        const [removed] = newQuestions.splice(draggedIndex, 1);
                                        newQuestions.splice(index, 0, removed);
                                        setFormData({ ...formData, questions: newQuestions });
                                    }
                                }
                            }}
                            style={{ cursor: 'grab' }}
                        >
                            <div className={styles.questionLeft}>
                                <span className={styles.dragHandle} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                                <div className={styles.questionContent}>
                                    <span className={styles.questionLabel}>{q.label}</span>
                                    <span style={{ fontSize: '12px', color: '#888' }}>{q.key}</span>
                                </div>
                                {q.required && <span className={styles.requiredBadge}>Required</span>}
                            </div>
                            <div className={styles.questionActions}>
                                <button className={styles.iconBtn} onClick={() => handleEditQuestion(q)}>✏️</button>
                                {!q.persistent && (
                                    <button className={styles.iconBtn} onClick={() => removeQuestion(q.id)}>🗑️</button>
                                )}
                                <button className={styles.iconBtn}>⋮</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {renderQuestionModalComponent()}
        </>
    );

    const renderPaymentTab = () => (
        <div className={styles.paymentSection}>
            <div className={styles.paymentHeader}>
                <div>
                    <h3>Accept Payment</h3>
                    <p className={styles.paymentDescription}>
                        Collect payment when someone books an appointment <a href="#" className={styles.link}>Learn more ↗</a>
                    </p>
                </div>
                <label className={styles.toggleSwitch}>
                    <input
                        type="checkbox"
                        className={styles.toggleInput}
                        checked={paymentData.acceptPayment}
                        onChange={(e) => setPaymentData({ ...paymentData, acceptPayment: e.target.checked })}
                    />
                    <span className={styles.toggleSlider}></span>
                </label>
            </div>

            <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', marginBottom: '8px', fontFamily: '"Urbanist", sans-serif' }}>Payment Gateways</h3>
                <div className={styles.multiSelectContainer}>
                    <div
                        className={styles.multiSelectTrigger}
                        onClick={() => setIsGatewayDropdownOpen(!isGatewayDropdownOpen)}
                    >
                        <div className={styles.tagsContainer}>
                            {paymentData.paymentGateways.length > 0 ? (
                                paymentData.paymentGateways.map(gateway => (
                                    <span key={gateway} className={styles.gatewayTag} onClick={(e) => e.stopPropagation()}>
                                        {gateway === 'razorpay' ? 'Razorpay' : gateway === 'cashfree' ? 'Cashfree' : 'UPI/Cash'}
                                        <button
                                            className={styles.tagRemoveBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleGatewayChange(gateway);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))
                            ) : (
                                <span style={{ color: '#aaa' }}>Select payment gateways...</span>
                            )}
                        </div>
                        <span className={styles.chevronDown}>⌄</span>
                    </div>
                    {isGatewayDropdownOpen && (
                        <div className={styles.multiSelectDropdown}>
                            <label className={styles.checkboxOption}>
                                <input
                                    type="checkbox"
                                    checked={paymentData.paymentGateways.includes('razorpay')}
                                    onChange={() => handleGatewayChange('razorpay')}
                                />
                                Razorpay
                            </label>
                            <label className={styles.checkboxOption}>
                                <input
                                    type="checkbox"
                                    checked={paymentData.paymentGateways.includes('cashfree')}
                                    onChange={() => handleGatewayChange('cashfree')}
                                />
                                Cashfree
                            </label>
                            <label className={styles.checkboxOption}>
                                <input
                                    type="checkbox"
                                    checked={paymentData.paymentGateways.includes('upi')}
                                    onChange={() => handleGatewayChange('upi')}
                                />
                                UPI/Cash
                            </label>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', marginBottom: '8px', fontFamily: '"Urbanist", sans-serif' }}>Pricing</h3>
                <div className={styles.pricingContainer}>
                    {paymentData.prices.length === 0 && !showPriceInput && (
                        <p className={styles.noPricesText}>No prices configured</p>
                    )}

                    {paymentData.prices.length > 0 && (
                        <div className={styles.pricingList}>
                            {paymentData.prices.map(price => (
                                <div key={price.id} className={styles.priceItem}>
                                    <div className={styles.priceDetails}>
                                        <span className={styles.priceAmount}>{price.currency} {price.amount}</span>
                                        {price.label && <span className={styles.priceLabel}>{price.label}</span>}
                                    </div>
                                    <button className={styles.iconBtn} onClick={() => removePrice(price.id)}>🗑️</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {showPriceInput ? (
                        <div className={styles.priceInputForm}>
                            <div className={styles.priceInputRow}>
                                <select
                                    className={`${styles.selectInput} ${styles.currencySelect}`}
                                    value={newPrice.currency}
                                    onChange={(e) => setNewPrice({ ...newPrice, currency: e.target.value })}
                                >
                                    <option value="INR">INR</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                </select>
                                <input
                                    type="number"
                                    className={`${styles.input} ${styles.priceAmountInput}`}
                                    placeholder="Amount"
                                    value={newPrice.amount}
                                    onChange={(e) => setNewPrice({ ...newPrice, amount: e.target.value })}
                                />
                            </div>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Label (e.g. Consultation Fee)"
                                value={newPrice.label}
                                onChange={(e) => setNewPrice({ ...newPrice, label: e.target.value })}
                            />
                            <div className={styles.actionButtons}>
                                <button className={styles.cancelBtn} onClick={() => setShowPriceInput(false)}>Cancel</button>
                                <button className={styles.savePriceBtn} onClick={handleAddPrice}>Save Price</button>
                            </div>
                        </div>
                    ) : (
                        <button className={styles.addPriceBtn} onClick={() => setShowPriceInput(true)}>
                            + Add Price
                        </button>
                    )}
                </div>
            </div>

            {/* Cancellation Policy */}
            <div style={{ marginTop: '32px', borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
                <div className={styles.paymentHeader}>
                    <div>
                        <h3>Cancellation Policy</h3>
                        <p className={styles.paymentDescription}>
                            Allow invitees to cancel their booking.
                        </p>
                    </div>
                    <label className={styles.toggleSwitch}>
                        <input
                            type="checkbox"
                            className={styles.toggleInput}
                            checked={paymentData.cancellation.enabled}
                            onChange={(e) => setPaymentData({
                                ...paymentData,
                                cancellation: { ...paymentData.cancellation, enabled: e.target.checked }
                            })}
                        />
                        <span className={styles.toggleSlider}></span>
                    </label>
                </div>

                {paymentData.cancellation.enabled && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label className={styles.label} style={{ marginBottom: 0 }}>Minimum Cancellation Notice</label>
                            <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                                Invitees can cancel until this much time before the event start time.
                            </p>
                            <div className={styles.rowInputs}>
                                <input
                                    type="number"
                                    className={styles.smallInput}
                                    value={paymentData.cancellation.window}
                                    onChange={(e) => setPaymentData({
                                        ...paymentData,
                                        cancellation: { ...paymentData.cancellation, window: e.target.value }
                                    })}
                                />
                                <select
                                    className={styles.selectInput}
                                    style={{ width: '120px' }}
                                    value={paymentData.cancellation.unit}
                                    onChange={(e) => setPaymentData({
                                        ...paymentData,
                                        cancellation: { ...paymentData.cancellation, unit: e.target.value }
                                    })}
                                >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={styles.label}>Refund Policy</label>
                            <div className={styles.radioGroup}>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="refundType"
                                        checked={paymentData.cancellation.refundType === 'full'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            cancellation: { ...paymentData.cancellation, refundType: 'full' }
                                        })}
                                    />
                                    <span>Full Refund</span>
                                </label>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="refundType"
                                        checked={paymentData.cancellation.refundType === 'partial'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            cancellation: { ...paymentData.cancellation, refundType: 'partial' }
                                        })}
                                    />
                                    <span>Partial Refund</span>
                                </label>
                                {paymentData.cancellation.refundType === 'partial' && (
                                    <div className={styles.subInputContainer}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="number"
                                                className={styles.smallInput}
                                                style={{ width: '80px' }}
                                                value={paymentData.cancellation.refundPercentage}
                                                onChange={(e) => setPaymentData({
                                                    ...paymentData,
                                                    cancellation: { ...paymentData.cancellation, refundPercentage: e.target.value }
                                                })}
                                            />
                                            <span style={{ fontSize: '14px', color: '#333' }}>%</span>
                                        </div>
                                    </div>
                                )}
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="refundType"
                                        checked={paymentData.cancellation.refundType === 'none'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            cancellation: { ...paymentData.cancellation, refundType: 'none' }
                                        })}
                                    />
                                    <span>No Refund</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Reschedule Policy */}
            <div style={{ marginTop: '32px', borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
                <div className={styles.paymentHeader}>
                    <div>
                        <h3>Reschedule Policy</h3>
                        <p className={styles.paymentDescription}>
                            Allow invitees to reschedule their booking.
                        </p>
                    </div>
                    <label className={styles.toggleSwitch}>
                        <input
                            type="checkbox"
                            className={styles.toggleInput}
                            checked={paymentData.reschedule.enabled}
                            onChange={(e) => setPaymentData({
                                ...paymentData,
                                reschedule: { ...paymentData.reschedule, enabled: e.target.checked }
                            })}
                        />
                        <span className={styles.toggleSlider}></span>
                    </label>
                </div>

                {paymentData.reschedule.enabled && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label className={styles.label} style={{ marginBottom: 0 }}>Minimum Reschedule Notice</label>
                            <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                                Invitees can reschedule until this much time before the event start time.
                            </p>
                            <div className={styles.rowInputs}>
                                <input
                                    type="number"
                                    className={styles.smallInput}
                                    value={paymentData.reschedule.window}
                                    onChange={(e) => setPaymentData({
                                        ...paymentData,
                                        reschedule: { ...paymentData.reschedule, window: e.target.value }
                                    })}
                                />
                                <select
                                    className={styles.selectInput}
                                    style={{ width: '120px' }}
                                    value={paymentData.reschedule.unit}
                                    onChange={(e) => setPaymentData({
                                        ...paymentData,
                                        reschedule: { ...paymentData.reschedule, unit: e.target.value }
                                    })}
                                >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={styles.label}>Reschedule Fee</label>
                            <div className={styles.radioGroup}>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="rescheduleType"
                                        checked={paymentData.reschedule.type === 'free'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            reschedule: { ...paymentData.reschedule, type: 'free' }
                                        })}
                                    />
                                    <span>Free Rescheduling</span>
                                </label>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="rescheduleType"
                                        checked={paymentData.reschedule.type === 'paid'}
                                        onChange={() => setPaymentData({
                                            ...paymentData,
                                            reschedule: { ...paymentData.reschedule, type: 'paid' }
                                        })}
                                    />
                                    <span>Paid Rescheduling</span>
                                </label>
                                {paymentData.reschedule.type === 'paid' && (
                                    <div className={styles.subInputContainer}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="number"
                                                className={styles.smallInput}
                                                placeholder="Fee Amount"
                                                value={paymentData.reschedule.fee}
                                                onChange={(e) => setPaymentData({
                                                    ...paymentData,
                                                    reschedule: { ...paymentData.reschedule, fee: e.target.value }
                                                })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <p className={styles.connectionsLink}>
                Connect with Payment apps to accept payment for bookings : <a href="#" className={styles.link}>Go to Connections →</a>
            </p>
        </div>
    );

    return (
        <div className={styles.pageContainer} >
            {/* Header */}
            < header className={styles.header} >
                <div className={styles.headerLeft}>
                    <button className={styles.backButton} onClick={() => navigate('/my-calendar')}>
                        ←
                    </button>
                    <div className={styles.titleSection}>
                        <h1>Create Event</h1>
                        <p>Configure your new event</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.actionBtn}>
                        Copy Link
                    </button>
                    <button className={styles.actionBtn}>
                        Preview
                    </button>
                    <button className={styles.actionBtn}>
                        {'< >'} Embed
                    </button>
                    <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={handleSave}>
                        💾 Save Changes
                    </button>
                </div>
            </header >

            <div className={styles.content}>
                {/* Sidebar */}
                <aside className={styles.sidebar}>
                    {navItems.map(item => (
                        <div
                            key={item.id}
                            className={`${styles.navItem} ${activeTab === item.id ? styles.activeNav : ''}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </div>
                    ))}
                </aside>

                {/* Main Content */}
                <main className={styles.mainForm}>
                    {activeTab === 'basic' && renderBasicTab()}
                    {activeTab === 'schedule' && renderScheduleTab()}
                    {activeTab === 'form' && renderFormTab()}
                    {activeTab === 'payment' && renderPaymentTab()}
                </main>
            </div>

            <AddLocationModal
                isOpen={showAddLocationModal}
                onClose={() => setShowAddLocationModal(false)}
                onSelectLocation={handleLocationFromModal}
                isGoogleConnected={isGoogleConnected}
                onConnectGoogle={handleConnectGoogle}
            />
        </div >
    );
};

export default CreateEventPage;
