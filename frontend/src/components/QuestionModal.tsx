
import React, { useState, useEffect, useMemo } from 'react';
import styles from './QuestionModal.module.css';

interface Question {
    id?: number;
    label: string;
    key: string;
    type: string;
    required: boolean;
    options?: string[]; // For select, radio, checkbox
    persistent?: boolean;
}

interface QuestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (question: Question) => void;
    editingQuestion: Question | null;
}

const QuestionModal: React.FC<QuestionModalProps> = ({ isOpen, onClose, onSave, editingQuestion }) => {
    const defaultQuestion: Question = useMemo(() => ({
        label: '',
        key: '',
        type: 'text',
        required: false,
        options: []
    }), []);

    const [formData, setFormData] = useState<Question>(defaultQuestion);

    useEffect(() => {
        if (isOpen) {
            if (editingQuestion) {
                setFormData({ ...editingQuestion, options: editingQuestion.options || [] });
            } else {
                setFormData(defaultQuestion);
            }
        }
    }, [isOpen, editingQuestion, defaultQuestion]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const handleAddOption = () => {
        setFormData(prev => ({
            ...prev,
            options: [...(prev.options || []), `Option ${(prev.options?.length || 0) + 1}`]
        }));
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...(formData.options || [])];
        newOptions[index] = value;
        setFormData(prev => ({ ...prev, options: newOptions }));
    };

    const handleRemoveOption = (index: number) => {
        const newOptions = [...(formData.options || [])];
        newOptions.splice(index, 1);
        setFormData(prev => ({ ...prev, options: newOptions }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Auto-generate key if empty or if it was auto-generated before (simple logic for now)
        let key = formData.key;
        if (!key || (editingQuestion && editingQuestion.key === key)) {
            key = formData.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
        }

        onSave({ ...formData, key });
    };

    const showOptions = ['select', 'radio', 'checkbox'].includes(formData.type);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>{editingQuestion ? 'Edit Question' : 'Add Question'}</h3>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className={styles.modalBody}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Question Type</label>
                            <select
                                name="type"
                                className={styles.selectInput}
                                value={formData.type}
                                onChange={handleChange}
                            >
                                <option value="text">Text (One Line)</option>
                                <option value="textarea">Text (Multimedia)</option>
                                <option value="email">Email</option>
                                <option value="tel">Phone</option>
                                <option value="number">Number</option>
                                <option value="date">Date</option>
                                <option value="checkbox">Checkbox</option>
                                <option value="radio">Radio Buttons</option>
                                <option value="select">Dropdown</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Question</label>
                            <input
                                name="label"
                                type="text"
                                className={styles.input}
                                value={formData.label}
                                onChange={handleChange}
                                placeholder="Enter question label"
                                required
                            />
                        </div>

                        {showOptions && (
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Options</label>
                                <div className={styles.optionsList}>
                                    {formData.options?.map((option, index) => (
                                        <div key={index} className={styles.optionRow}>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                value={option}
                                                onChange={(e) => handleOptionChange(index, e.target.value)}
                                                placeholder={`Option ${index + 1}`}
                                                required
                                            />
                                            <button
                                                type="button"
                                                className={styles.removeOptionBtn}
                                                onClick={() => handleRemoveOption(index)}
                                                title="Remove option"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className={styles.addOptionBtn}
                                    onClick={handleAddOption}
                                >
                                    + Add Option
                                </button>
                            </div>
                        )}

                        <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                            <label className={styles.toggleSwitch}>
                                <input
                                    name="required"
                                    type="checkbox"
                                    className={styles.toggleInput}
                                    checked={formData.required}
                                    onChange={handleToggleChange}
                                />
                                <span className={styles.toggleSlider}></span>
                                <span className={styles.toggleLabel}>Required field</span>
                            </label>
                        </div>
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.actionBtn} onClick={onClose}>Cancel</button>
                        <button type="submit" className={`${styles.actionBtn} ${styles.saveBtn}`}>Save Question</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuestionModal;
