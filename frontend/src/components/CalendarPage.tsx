import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './CalendarPage.css';
import AvailabilityModal from './AvailabilityModal';
import ConfirmModal from './ConfirmModal';
import API_BASE_URL from '../config/api';
import Loader from './Loader';

interface Calendar {
  id: number;
  title: string;
  duration: string;
  description: string;
  slug: string;
  is_active: boolean;
  max_attendees?: number;
}

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  // 3-dot menu
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Toggle loading guard (prevents race conditions on rapid clicks)
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Slug edit modal
  const [showSlugModal, setShowSlugModal] = useState(false);
  const [slugFormData, setSlugFormData] = useState({ id: 0, slug: '' });
  const [slugSaving, setSlugSaving] = useState(false);


  // Handle ?openModal=true — just navigate, no redundant setSearchParams
  useEffect(() => {
    if (searchParams.get('openModal') === 'true') {
      navigate('/my-calendar/new');
    }
  }, []);

  const fetchCalendars = async () => {
    setFetchError(false);
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendars`, { credentials: 'include' });
      if (response.ok) {
        setCalendars(await response.json());
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCalendars(); }, []);

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!activeMenuId) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.menu-container')) setActiveMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeMenuId]);

  const toggleMenu = (id: number) => setActiveMenuId(prev => prev === id ? null : id);

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    if (togglingId === id) return;
    setTogglingId(id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendars/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      if (response.ok) {
        toast.success(`Calendar ${!currentStatus ? 'activated' : 'deactivated'}.`);
        fetchCalendars();
      } else {
        toast.error('Failed to update calendar status.');
      }
    } catch {
      toast.error('Error updating calendar status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteCalendar = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendars/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        toast.success('Calendar deleted.');
        setDeleteConfirmId(null);
        fetchCalendars();
      } else {
        const err = await response.json();
        toast.error(`Failed to delete: ${err.error}`);
      }
    } catch {
      toast.error('Error deleting calendar.');
    }
  };

  const openSlugModal = (calendar: Calendar) => {
    setSlugFormData({
      id: calendar.id,
      slug: calendar.slug.startsWith('/') ? calendar.slug.slice(1) : calendar.slug,
    });
    setShowSlugModal(true);
    setActiveMenuId(null);
  };

  const handleSlugUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlugSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendars/${slugFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: slugFormData.slug }),
      });
      if (response.ok) {
        toast.success('Slug updated.');
        setShowSlugModal(false);
        fetchCalendars();
      } else {
        const err = await response.json();
        toast.error(`Error: ${err.error}`);
      }
    } catch {
      toast.error('Error updating slug.');
    } finally {
      setSlugSaving(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    if (!user) return;
    const cleanSlug = slug.startsWith('/') ? slug.slice(1) : slug;
    navigator.clipboard.writeText(`${window.location.origin}/book/${user.id}/${cleanSlug}`);
    toast.success('Link copied!');
  };

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">My Calendars</h1>
          <p className="page-subtitle">Manage your booking calendar across all pages</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="create-calendar-btn"
            onClick={() => setShowAvailabilityModal(true)}
            style={{ backgroundColor: '#fff', color: '#333', border: '1px solid #ccc' }}
          >
            Available Hours
          </button>
          <button className="create-calendar-btn" onClick={() => navigate('/my-calendar/new')}>
            + Create Calendar
          </button>
        </div>
      </div>

      <div className="calendar-content">
        {loading ? (
          <Loader />
        ) : fetchError ? (
          <div style={{ textAlign: 'center', marginTop: '40px', color: '#c62828', fontFamily: 'Urbanist', fontSize: '14px' }}>
            Failed to load calendars.{' '}
            <span
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => { setLoading(true); fetchCalendars(); }}
            >
              Retry
            </span>
          </div>
        ) : calendars.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px', color: '#666' }}>
            No calendars found. Create one to get started!
          </div>
        ) : (
          <div className="calendar-grid">
            {calendars.map((resource) => (
              <div key={resource.id} className="calendar-card">
                <div className="card-header">
                  <h3 className="card-title">{resource.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {/* Active toggle */}
                    <div
                      className="toggle-switch"
                      onClick={() => handleToggleActive(resource.id, resource.is_active)}
                      style={{ marginRight: '8px', opacity: togglingId === resource.id ? 0.5 : 1, pointerEvents: togglingId === resource.id ? 'none' : 'auto' }}
                    >
                      <input type="checkbox" id={`toggle-${resource.id}`} checked={resource.is_active} readOnly />
                      <label htmlFor={`toggle-${resource.id}`} className="switch"></label>
                    </div>

                    {/* 3-dot menu */}
                    <div className="menu-container">
                      <button className="menu-btn" onClick={() => toggleMenu(resource.id)}>
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                        </svg>
                      </button>
                      {activeMenuId === resource.id && (
                        <div className="calendar-dropdown-menu">
                          <button
                            onClick={() => { navigate('/my-calendar/edit', { state: { calendar: resource, isEditing: true } }); setActiveMenuId(null); }}
                            className="calendar-dropdown-item"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '8px' }}>
                              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                            </svg>
                            Edit Details
                          </button>
                          <button
                            onClick={() => openSlugModal(resource)}
                            className="calendar-dropdown-item"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                            </svg>
                            Edit Slug
                          </button>
                          <button
                            onClick={() => { setDeleteConfirmId(resource.id); setActiveMenuId(null); }}
                            className="calendar-dropdown-item delete-item"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '8px' }}>
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card-meta">
                  <div className="duration tag">
                    <img src="/Calendar.svg" alt="" style={{ width: '14px', marginRight: '5px' }} />
                    <span>{resource.duration}</span>
                  </div>
                </div>

                <div className="card-description" style={{ flex: 1 }}>
                  <p style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {resource.description}
                  </p>
                </div>

                <div className="card-footer">
                  <div className="card-link-row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    <span>{`${window.location.origin}/book/${user?.id}/${resource.slug.replace(/^\//, '')}`}</span>
                    <button className="card-link-copy-btn" onClick={() => handleCopyLink(resource.slug)} title="Copy link">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slug Edit Modal */}
      {showSlugModal && (
        <div className="modal-overlay" onClick={() => !slugSaving && setShowSlugModal(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Slug</h2>
              <button className="close-btn" onClick={() => setShowSlugModal(false)}>×</button>
            </div>
            <form onSubmit={handleSlugUpdate}>
              <div className="form-group">
                <label className="form-label">Slug URL</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#666', marginRight: '5px', fontSize: '14px' }}>/</span>
                  <input
                    type="text"
                    className="form-input"
                    value={slugFormData.slug}
                    onChange={e => setSlugFormData({ ...slugFormData, slug: e.target.value })}
                    placeholder="my-calendar-slug"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setShowSlugModal(false)} disabled={slugSaving}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={slugSaving}>{slugSaving ? 'Saving...' : 'Update Slug'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AvailabilityModal isOpen={showAvailabilityModal} onClose={() => setShowAvailabilityModal(false)} />

      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Calendar"
        message="Are you sure you want to delete this calendar? All associated data will be lost. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep Calendar"
        danger
        onConfirm={() => { if (deleteConfirmId) handleDeleteCalendar(deleteConfirmId); }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};

export default CalendarPage;
