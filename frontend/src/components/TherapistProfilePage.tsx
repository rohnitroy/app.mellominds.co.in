import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './TherapistProfilePage.css';
import API_BASE_URL from '../config/api';
import Loader from './Loader';

interface CalendarItem {
    id: number;
    title: string;
    slug: string;
    description?: string;
    duration: string;
    type?: string;
    payment_enabled?: boolean;
    prices?: { amount: number; currency: string; label?: string }[];
    locations?: { type: string; address?: string }[];
}

interface TherapistProfile {
    id: number;
    name: string;
    profile_picture: string | null;
    specialization: string | null;
    language_spoken: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    calendars: CalendarItem[];
}

const TherapistProfilePage: React.FC = () => {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<TherapistProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Allow page scroll — dashboard layout sets overflow:hidden on html/body
    useEffect(() => {
        document.body.classList.add('tpp-page');
        document.documentElement.classList.add('tpp-page');
        return () => {
            document.body.classList.remove('tpp-page');
            document.documentElement.classList.remove('tpp-page');
        };
    }, []);

    useEffect(() => {
        if (!userId) return;
        const fetchProfile = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/public/profile/${userId}`);
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                    document.title = `${data.name} – Book a Session | MelloMinds`;
                } else {
                    const errData = await res.json().catch(() => ({}));
                    console.error('Profile fetch failed:', res.status, errData);
                    setError('Therapist not found.');
                }
            } catch (err) {
                console.error('Profile fetch error:', err);
                setError('Failed to load profile.');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [userId]);

    if (loading) return <Loader fullScreen />;
    if (error || !profile) return <div className="tpp-error">{error || 'Not found'}</div>;

    const locationLabel = [profile.city, profile.state, profile.country]
        .filter(Boolean)
        .join(', ');

    const resolveImageUrl = (url: string | null): string | null => {
        if (!url) return null;
        // Already a full URL (Cloudinary, Google, etc.)
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        // Local upload path — prepend backend URL
        return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const profileImageUrl = resolveImageUrl(profile.profile_picture);

    const getTypeLabel = (type?: string) => {
        switch (type) {
            case 'group': return 'Group';
            case 'couples': return 'Couples';
            default: return 'One-on-One';
        }
    };

    const getPriceDisplay = (cal: CalendarItem) => {
        if (!cal.payment_enabled || !cal.prices?.length) return null;
        return `₹${cal.prices[0].amount}`;
    };

    const hasOnline = (cal: CalendarItem) =>
        !cal.locations?.length ||
        cal.locations.some(l => l.type === 'google_meet' || l.type === 'zoom' || l.type === 'online');

    return (
        <div className="tpp-page-wrapper">
            {/* Navbar */}
            <div className="tpp-navbar">
                <img src="/mellominds logo 2 1.png" alt="MelloMinds" />
            </div>

            {/* Profile card */}
            <div className="tpp-profile-card">
                {profileImageUrl ? (
                    <img
                        src={profileImageUrl}
                        alt={profile.name}
                        className="tpp-avatar"
                        onError={(e) => {
                            // If image fails to load, swap to placeholder
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                            if (placeholder) placeholder.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div
                    className="tpp-avatar-placeholder"
                    style={{ display: profileImageUrl ? 'none' : 'flex' }}
                >
                        <svg width="48" height="48" viewBox="0 0 28 24" fill="none">
                            <circle cx="12" cy="7" r="4" stroke="#2D7579" strokeWidth="2" fill="none" />
                            <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" stroke="#2D7579" strokeWidth="2" fill="none" />
                        </svg>
                    </div>

                <div className="tpp-info">
                    <h1 className="tpp-name">{profile.name}</h1>
                    {profile.specialization && (
                        <p className="tpp-specialization">{profile.specialization}</p>
                    )}
                    <div className="tpp-meta-row">
                        {locationLabel && (
                            <div className="tpp-meta-item">
                                {/* Map pin icon */}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span>{locationLabel}</span>
                            </div>
                        )}
                        {profile.language_spoken && (
                            <div className="tpp-meta-item">
                                {/* Globe icon */}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="2" y1="12" x2="22" y2="12" />
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                </svg>
                                <span>{profile.language_spoken}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Calendars section */}
            <h2 className="tpp-section-heading">Available Sessions</h2>

            {profile.calendars.length === 0 ? (
                <div className="tpp-empty">No sessions available at the moment.</div>
            ) : (
                <div className="tpp-calendars-grid">
                    {profile.calendars.map(cal => {
                        const price = getPriceDisplay(cal);
                        const bookUrl = `/book/${userId}/${cal.slug.replace(/^\//, '')}`;

                        return (
                            <div
                                key={cal.id}
                                className="tpp-cal-card"
                                onClick={() => navigate(bookUrl)}
                            >
                                <div className="tpp-cal-type-badge">
                                    {/* Calendar icon */}
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    {getTypeLabel(cal.type)}
                                </div>

                                <h3 className="tpp-cal-title">{cal.title}</h3>

                                {cal.description && (
                                    <p className="tpp-cal-desc">{cal.description}</p>
                                )}

                                <div className="tpp-cal-meta">
                                    {/* Duration */}
                                    <div className="tpp-cal-meta-item">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        <span>{cal.duration}</span>
                                    </div>
                                    {/* Location */}
                                    {hasOnline(cal) && (
                                        <div className="tpp-cal-meta-item">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polygon points="23 7 16 12 23 17 23 7" />
                                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                            </svg>
                                            <span>Google Meet</span>
                                        </div>
                                    )}
                                </div>

                                <div className="tpp-cal-footer">
                                    {price ? (
                                        <span className="tpp-cal-price">{price}</span>
                                    ) : (
                                        <span className="tpp-cal-price-free">Free</span>
                                    )}
                                    <button className="tpp-book-btn">
                                        Book Now
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TherapistProfilePage;
