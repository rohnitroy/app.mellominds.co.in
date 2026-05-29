import React, { useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '../config/api';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import Loader from './Loader';
import styles from './ClientNotesTemplate.module.css';

interface NoteField {
    id: number;
    label: string;
    type: string;
    key: string;
    required: boolean;
    options?: string[];
}

const FIELD_TYPES = [
    { value: 'text', label: 'Short Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'select', label: 'Dropdown' },
    { value: 'radio', label: 'Radio Buttons' },
    { value: 'checkbox', label: 'Checkboxes' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
];


const ClientNotesTemplate: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const toast = useToast();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const handleBack = () => onBack ? onBack() : navigate('/settings');
    const [fields, setFields] = useState<NoteField[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchTemplate = useCallback(async () => {
        try {
            const r = await fetch(`${API_BASE_URL}/api/notes/template/me`, { credentials: 'include' });
            const data = r.ok ? await r.json() : { fields: [] };
            setFields(data.fields || []);
        } catch {
            setFields([]);
        }
    }, []);

    useEffect(() => {
        fetchTemplate().finally(() => setLoading(false));
    }, [fetchTemplate]);

    useEffect(() => {
        if (!socket) return;
        socket.on('notes_template_updated', fetchTemplate);
        return () => { socket.off('notes_template_updated', fetchTemplate); };
    }, [socket, fetchTemplate]);

    const addField = useCallback(() => {
        setFields(prev => [...prev, {
            id: Date.now(),
            label: '',
            type: 'text',
            key: '',
            required: false,
            options: [],
        }]);
    }, []);

    const updateField = useCallback((id: number, updates: Partial<NoteField>) => {
        setFields(prev => prev.map(f => {
            if (f.id !== id) return f;
            const updated = { ...f, ...updates };
            if (updates.label !== undefined) {
                updated.key = updates.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
            }
            return updated;
        }));
    }, []);

    const removeField = useCallback((id: number) => {
        setFields(prev => prev.filter(f => f.id !== id));
    }, []);

    const moveField = useCallback((index: number, dir: 'up' | 'down') => {
        setFields(prev => {
            const newFields = [...prev];
            const target = dir === 'up' ? index - 1 : index + 1;
            if (target < 0 || target >= newFields.length) return prev;
            [newFields[index], newFields[target]] = [newFields[target], newFields[index]];
            return newFields;
        });
    }, []);

    const addOption = useCallback((fieldId: number) => {
        setFields(prev => prev.map(f => f.id === fieldId
            ? { ...f, options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] }
            : f
        ));
    }, []);

    const updateOption = useCallback((fieldId: number, idx: number, val: string) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            const opts = [...(f.options || [])];
            opts[idx] = val;
            return { ...f, options: opts };
        }));
    }, []);

    const removeOption = useCallback((fieldId: number, idx: number) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            return { ...f, options: (f.options || []).filter((_, i) => i !== idx) };
        }));
    }, []);

    const handleSave = useCallback(async () => {
        for (const f of fields) {
            if (!f.label.trim()) { toast.error('All fields must have a label.'); return; }
        }
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/notes/template/me`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ fields }),
            });
            if (res.ok) {
                toast.success('Note template saved!');
                handleBack();
            } else {
                toast.error('Failed to save template.');
            }
        } catch {
            toast.error('Network error.');
        } finally {
            setSaving(false);
        }
    }, [fields, toast, handleBack]);

    if (loading) return <Loader />;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={handleBack}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 5l-7 7 7 7" />
                    </svg>
                </button>
                <div>
                    <h1>Client Notes Template</h1>
                    <p>Build a custom form that therapists fill after each session. These fields will appear in the Session Notes tab.</p>
                </div>
            </div>

            <div className={styles.fieldsContainer}>
                {fields.map((field, index) => (
                    <div key={field.id} className={styles.fieldCard}>
                        <div className={styles.fieldHeader}>
                            <span className={styles.fieldNumber}>Field {index + 1}</span>
                            <div className={styles.fieldControls}>
                                <button onClick={() => moveField(index, 'up')} disabled={index === 0} className={styles.controlBtn} title="Move up">↑</button>
                                <button onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className={styles.controlBtn} title="Move down">↓</button>
                                <button onClick={() => removeField(field.id)} className={`${styles.controlBtn} ${styles.removeBtn}`}>Remove</button>
                            </div>
                        </div>

                        <div className={styles.fieldGrid}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>Label *</label>
                                <input className={styles.input} type="text" placeholder="e.g. Session Summary"
                                    value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>Type</label>
                                <select className={styles.select} value={field.type} onChange={e => updateField(field.id, { type: e.target.value })}>
                                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <label className={styles.checkboxLabel}>
                            <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} />
                            Required field
                        </label>

                        {['select', 'radio', 'checkbox'].includes(field.type) && (
                            <div className={styles.optionsSection}>
                                <label className={styles.label}>Options</label>
                                <div className={styles.optionsList}>
                                    {(field.options || []).map((opt, oi) => (
                                        <div key={oi} className={styles.optionRow}>
                                            <input className={styles.input} type="text" value={opt}
                                                onChange={e => updateOption(field.id, oi, e.target.value)} placeholder={`Option ${oi + 1}`} />
                                            <button onClick={() => removeOption(field.id, oi)} className={`${styles.controlBtn} ${styles.removeBtn}`} title="Remove option">×</button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => addOption(field.id)} className={styles.addOptionBtn}>
                                    + Add Option
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <button onClick={addField} className={styles.addFieldBtn}>
                + Add Field
            </button>

            <div className={styles.actions}>
                <button onClick={handleBack} className={styles.cancelBtn}>
                    Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className={styles.saveBtn}>
                    {saving ? 'Saving...' : 'Save Template'}
                </button>
            </div>
        </div>
    );
};

export default ClientNotesTemplate;
