import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

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

const iStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: '7px',
    border: '1px solid #e0e0e0', fontFamily: 'Urbanist', fontSize: '13px',
    color: '#333', outline: 'none', boxSizing: 'border-box',
};

const ClientNotesTemplate: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const toast = useToast();
    const navigate = useNavigate();
    const handleBack = () => onBack ? onBack() : navigate('/settings');
    const [fields, setFields] = useState<NoteField[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/notes/template/me`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { fields: [] })
            .then(data => setFields(data.fields || []))
            .catch(() => setFields([]))
            .finally(() => setLoading(false));
    }, []);

    const addField = () => {
        setFields(prev => [...prev, {
            id: Date.now(),
            label: '',
            type: 'text',
            key: '',
            required: false,
            options: [],
        }]);
    };

    const updateField = (id: number, updates: Partial<NoteField>) => {
        setFields(prev => prev.map(f => {
            if (f.id !== id) return f;
            const updated = { ...f, ...updates };
            // Auto-generate key from label
            if (updates.label !== undefined) {
                updated.key = updates.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
            }
            return updated;
        }));
    };

    const removeField = (id: number) => {
        setFields(prev => prev.filter(f => f.id !== id));
    };

    const moveField = (index: number, dir: 'up' | 'down') => {
        const newFields = [...fields];
        const target = dir === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= newFields.length) return;
        [newFields[index], newFields[target]] = [newFields[target], newFields[index]];
        setFields(newFields);
    };

    const addOption = (fieldId: number) => {
        setFields(prev => prev.map(f => f.id === fieldId
            ? { ...f, options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] }
            : f
        ));
    };

    const updateOption = (fieldId: number, idx: number, val: string) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            const opts = [...(f.options || [])];
            opts[idx] = val;
            return { ...f, options: opts };
        }));
    };

    const removeOption = (fieldId: number, idx: number) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            return { ...f, options: (f.options || []).filter((_, i) => i !== idx) };
        }));
    };

    const handleSave = async () => {
        // Validate
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
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Urbanist', color: '#6E6E6E' }}>Loading...</div>;

    return (
        <div style={{ padding: '32px', maxWidth: '700px', margin: '0 auto', fontFamily: 'Urbanist', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>←</button>
                <h2 style={{ margin: 0, fontWeight: 700, fontSize: '22px', color: '#082421' }}>Client Notes Template</h2>
            </div>
            <p style={{ color: '#6E6E6E', fontSize: '14px', marginBottom: '28px', marginLeft: '36px' }}>
                Build a custom form that therapists fill after each session. These fields will appear in the Session Notes tab.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {fields.map((field, index) => (
                    <div key={field.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#082421' }}>Field {index + 1}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => moveField(index, 'up')} disabled={index === 0}
                                    style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#666' }}>↑</button>
                                <button onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1}
                                    style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#666' }}>↓</button>
                                <button onClick={() => removeField(field.id)}
                                    style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#e53935' }}>Remove</button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>Label *</label>
                                <input style={iStyle} type="text" placeholder="e.g. Session Summary"
                                    value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>Type</label>
                                <select style={iStyle} value={field.type} onChange={e => updateField(field.id, { type: e.target.value })}>
                                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#555', cursor: 'pointer' }}>
                            <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })}
                                style={{ accentColor: '#082421' }} />
                            Required field
                        </label>

                        {['select', 'radio', 'checkbox'].includes(field.type) && (
                            <div style={{ marginTop: '12px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>Options</label>
                                {(field.options || []).map((opt, oi) => (
                                    <div key={oi} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                                        <input style={{ ...iStyle, flex: 1 }} type="text" value={opt}
                                            onChange={e => updateOption(field.id, oi, e.target.value)} placeholder={`Option ${oi + 1}`} />
                                        <button onClick={() => removeOption(field.id, oi)}
                                            style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#e53935', fontSize: '12px' }}>×</button>
                                    </div>
                                ))}
                                <button onClick={() => addOption(field.id)}
                                    style={{ background: 'none', border: 'none', color: '#082421', fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: 0 }}>
                                    + Add Option
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <button onClick={addField}
                style={{ marginTop: '16px', width: '100%', padding: '12px', border: '2px dashed #e0e0e0', borderRadius: '10px', background: 'none', cursor: 'pointer', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#6E6E6E' }}>
                + Add Field
            </button>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button onClick={handleBack}
                    style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#333', cursor: 'pointer' }}>
                    Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                    style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Saving...' : 'Save Template'}
                </button>
            </div>
        </div>
    );
};

export default ClientNotesTemplate;
