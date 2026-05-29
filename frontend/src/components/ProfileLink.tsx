import React, { useEffect, useState, useRef, useCallback } from 'react';
import API_BASE_URL from '../config/api';
import styles from './ProfileLink.module.css';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Loader from './Loader';

const BASE_URL = 'https://app.mellominds.co.in';

interface ProfileLinkProps {
    onBack: () => void;
}

const ProfileLink: React.FC<ProfileLinkProps> = ({ onBack }) => {
    const { user } = useAuth();
    const { socket } = useSocket();
    const [currentSlug, setCurrentSlug] = useState<string | null>(null);
    const [aboutMe, setAboutMe] = useState('');
    const [nextEditAt, setNextEditAt] = useState<Date | null>(null);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchProfileLink = useCallback(async () => {
        try {
            const r = await fetch(`${API_BASE_URL}/api/profile-link`, { credentials: 'include' });
            const d = await r.json();
            setCurrentSlug(d.profile_slug || null);
            setInput(d.profile_slug || '');
            setAboutMe(d.about_me || '');
            setNextEditAt(d.next_edit_at ? new Date(d.next_edit_at) : null);
        } catch {
            setError('Failed to load profile link');
        }
    }, []);

    useEffect(() => {
        fetchProfileLink().finally(() => setLoading(false));
    }, [fetchProfileLink]);

    useEffect(() => {
        if (!socket) return;
        socket.on('profile_link_updated', fetchProfileLink);
        return () => { socket.off('profile_link_updated', fetchProfileLink); };
    }, [socket, fetchProfileLink]);

    const canEdit = true; // Always allow editing

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEdit) return;
        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setInput(val);
        setSaved(false);
        setError(null);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!val || val === currentSlug) { setStatus('idle'); return; }
        if (val.length < 4) { setStatus('invalid'); return; }

        setStatus('checking');
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/profile-link/check/${val}`, { credentials: 'include' });
                const data = await res.json();
                setStatus(data.available ? 'available' : 'taken');
            } catch {
                setStatus('idle');
            }
        }, 500);
    }, [currentSlug]);

    const handleSave = useCallback(async () => {
        if (!input || status === 'taken' || status === 'invalid' || saving || !canEdit) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/profile-link`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ profile_slug: input, about_me: aboutMe }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to save');
                if (data.next_edit_at) setNextEditAt(new Date(data.next_edit_at));
            } else {
                setCurrentSlug(data.profile_slug);
                setAboutMe(data.about_me || '');
                setNextEditAt(data.next_edit_at ? new Date(data.next_edit_at) : null);
                setStatus('idle');
                setSaved(true);
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [input, status, saving, aboutMe]);

    const handleSaveAboutMe = useCallback(async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/profile-link/about-me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ about_me: aboutMe }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to save');
            } else {
                setAboutMe(data.about_me || '');
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [aboutMe]);

    // Current live URL
    const currentUrl = currentSlug
        ? `${BASE_URL}/book/${currentSlug}`
        : `${BASE_URL}/book/${user?.id}`;

    // Preview of what the URL will look like after saving
    const previewUrl = input && input !== currentSlug && status === 'available'
        ? `${BASE_URL}/book/${input}`
        : null;

    const statusInfo = () => {
        if (status === 'checking') return { text: 'Checking availability...', color: '#6b7280' };
        if (status === 'available') return { text: '✓ Available', color: '#16a34a' };
        if (status === 'taken') return { text: '✗ Already taken', color: '#dc2626' };
        if (status === 'invalid') return { text: 'Min 4 characters — letters, numbers and hyphens only', color: '#d97706' };
        return null;
    };

    const info = statusInfo();
    const canSave = input.length >= 4 && input !== currentSlug && status === 'available' && canEdit;

    if (loading) return <div className={styles.page}><Loader /></div>;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={onBack}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 5l-7 7 7 7" />
                    </svg>
                </button>
                <div>
                    <h1>Profile Link & Description</h1>
                    <p>Set a custom URL and add your professional description</p>
                </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.card}>
                <div className={styles.twoColumnLayout}>
                    {/* Left column - URL section */}
                    <div className={styles.column}>
                        {/* Current link */}
                        <div className={styles.section}>
                            <label className={styles.label}>Your booking link</label>
                            <div className={styles.currentLink}>
                                <span className={styles.linkText}>{currentUrl}</span>
                                <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(currentUrl)}>
                                    Copy
                                </button>
                            </div>
                            {!currentSlug && (
                                <p className={styles.hint} style={{ marginTop: 8 }}>
                                    You're using your default ID-based link. Set a custom name below to get a clean URL.
                                </p>
                            )}
                        </div>

                        <div className={styles.divider} />

                        {/* Edit section */}
                        <div className={styles.section}>
                            <label className={styles.label}>Custom profile name</label>

                            <p className={styles.hint}>
                                Choose a unique name. Only lowercase letters, numbers, and hyphens. Changes are saved when you click Save.
                            </p>
                            <div className={styles.inputRow}>
                                <span className={styles.prefix}>{BASE_URL}/book/</span>
                                <input
                                    className={styles.input}
                                    type="text"
                                    value={input}
                                    onChange={handleChange}
                                    placeholder="your-name"
                                    maxLength={50}
                                    spellCheck={false}
                                />
                            </div>
                            {info && <p className={styles.statusText} style={{ color: info.color }}>{info.text}</p>}
                            {previewUrl && (
                                <p className={styles.preview}>Preview: <span>{previewUrl}</span></p>
                            )}
                        </div>

                        {canEdit && (
                            <div className={styles.actions}>
                                {saved && <span className={styles.savedMsg}>✓ Saved successfully</span>}
                                <button className={styles.saveBtn} onClick={handleSave} disabled={!canSave || saving}>
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right column - About Me section */}
                    <div className={styles.column}>
                        <div className={styles.section}>
                            <label className={styles.label}>About Me</label>
                            <p className={styles.hint}>
                                Write a brief professional description about yourself. This will be displayed on your public profile.
                            </p>
                            <textarea
                                className={styles.textarea}
                                value={aboutMe}
                                onChange={(e) => {
                                    setAboutMe(e.target.value);
                                }}
                                placeholder="Tell clients about your expertise, experience, and approach..."
                                maxLength={500}
                                rows={8}
                            />
                            <p className={styles.charCount}>{aboutMe.length}/500 characters</p>
                        </div>

                        <div className={styles.actions}>
                            {saved && <span className={styles.savedMsg}>✓ Saved successfully</span>}
                            <button className={styles.saveBtn} onClick={handleSaveAboutMe} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileLink;
