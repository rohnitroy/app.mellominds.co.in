import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './CalendarPage.css';
import AvailabilityModal from './AvailabilityModal';
import CreateCalendarModal from './CreateCalendarModal';
import CustomDropdown from './CustomDropdown';
import CreateBooking from './CreateBooking';
import ConfirmModal from './ConfirmModal';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../config/api';
import Loader from './Loader';

interface Calendar {
  id: number;
  title: string;
  duration: string;
  type: string;
  description: string;
  slug: string;
  is_active: boolean;
  max_attendees?: number;
}

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    duration: '60 m',
    type: 'one_on_one',
    description: '',
    slug: ''
  });

  // State for Create Booking Modal (full CreateBooking component)
  const [showCreateBookingModal, setShowCreateBookingModal] = useState(false);
  const [createBookingCalendarId, setCreateBookingCalendarId] = useState<string>('');

  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  // Check for openModal query parameter and open resource type modal
  useEffect(() => {
    if (searchParams.get('openModal') === 'true') {
      setShowResourceTypeModal(true);
      // Remove the query parameter
      searchParams.delete('openModal');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchCalendars = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendars`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCalendars(data);
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchCalendars();
  }, []);

  // Slug Modal State
  const [showSlugModal, setShowSlugModal] = useState(false);
  const [slugFormData, setSlugFormData] = useState({ id: 0, slug: '' });

  // Menu State
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openSlugModal = (calendar: Calendar) => {
    setSlugFormData({
      id: calendar.id,
      slug: calendar.slug.startsWith('/') ? calendar.slug.slice(1) : calendar.slug
    });
    setShowSlugModal(true);
  };

  const handleSlugUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendars/${slugFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: slugFormData.slug })
      });

      if (response.ok) {
        setShowSlugModal(false);
        fetchCalendars();
      } else {
        const err = await response.json();
        toast.error(`Error: ${err.error}`);
      }
    } catch (error) {
      console.error('Error updating slug:', error);
      toast.error('Error updating slug');
    }
  };

  const toggleMenu = (id: number) => {
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuId && !(event.target as Element).closest('.menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuId]);

  const [editingId, setEditingId] = useState<number | null>(null);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId
      ? `${API_BASE_URL}/api/calendars/${editingId}`
      : `${API_BASE_URL}/api/calendars`;

    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowModal(false);
        fetchCalendars();
        resetForm();
      } else {
        const err = await response.json();
        toast.error(`Error: ${err.error}`);
      }
    } catch (error) {
      console.error('Error saving calendar:', error);
      toast.error('Error saving calendar');
    }
  };

  const resetForm = () => {
    setFormData({ title: '', duration: '60 m', type: 'one_on_one', description: '', slug: '' });
    setEditingId(null);
  };

  const [showResourceTypeModal, setShowResourceTypeModal] = useState(false);

  // ...
  const openCreateModal = () => {
    resetForm();
    setShowResourceTypeModal(true);
  };

  const handleTypeSelect = (type: string) => {
    setShowResourceTypeModal(false);
    navigate('/my-calendar/new', { state: { type } });
  };



  const openEditModal = (calendar: Calendar) => {
    // Navigate to CreateEventPage with calendar data for editing
    navigate('/my-calendar/edit', { state: { calendar, isEditing: true } });
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendars/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (response.ok) {
        fetchCalendars();
      }
    } catch (error) {
      console.error('Error updating calendar:', error);
    }
  };

  const handleDeleteCalendar = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendars/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setDeleteConfirmId(null);
        fetchCalendars();
      } else {
        const err = await response.json();
        toast.error(`Failed to delete: ${err.error}`);
      }
    } catch (error) {
      console.error('Error deleting calendar:', error);
      toast.error('Error deleting calendar');
    }
  };

  const handleCreateBookingForCalendar = (calendarId: number) => {
    setCreateBookingCalendarId(calendarId.toString());
    setShowCreateBookingModal(true);
  };

  const handleCopyLink = (slug: string) => {
    if (!user) return;
    const cleanSlug = slug.startsWith('/') ? slug.slice(1) : slug;
    const link = `${window.location.origin}/book/${user.id}/${cleanSlug}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied!');
  };

  const formatType = (type: string) => {
    // Basic formatting, could be improved
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">My Calendars</h1>
          <p className="page-subtitle">Manage your booking calendar across all pages</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="create-calendar-btn" onClick={() => setShowAvailabilityModal(true)} style={{ backgroundColor: '#fff', color: '#333', border: '1px solid #ccc' }}>
            Available Hours
          </button>
          <button className="create-calendar-btn" onClick={openCreateModal}>+ Create Calendar</button>
        </div>
      </div>


      <div className="calendar-content">
        {loading ? (
          <Loader />
        ) : calendars.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px', color: '#666' }}>No calendars found. Create one to get started!</div>
        ) : (
          <div className="calendar-grid">
            {calendars.map((resource) => (
              <div key={resource.id} className="calendar-card">
                <div className="card-header">
                  <h3 className="card-title">{resource.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div className="toggle-switch" onClick={() => handleToggleActive(resource.id, resource.is_active)} style={{ marginRight: '8px' }}>
                      <input
                        type="checkbox"
                        id={`toggle-${resource.id}`}
                        checked={resource.is_active}
                        readOnly
                      />
                      <label htmlFor={`toggle-${resource.id}`} className="switch"></label>
                    </div>

                    <div className="menu-container">
                      <button className="menu-btn" onClick={() => toggleMenu(resource.id)}>
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                        </svg>
                      </button>
                      {activeMenuId === resource.id && (
                        <div className="calendar-dropdown-menu">
                          <button
                            onClick={() => { openEditModal(resource); setActiveMenuId(null); }}
                            className="calendar-dropdown-item"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '8px' }}>
                              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                            </svg>
                            Edit Details
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
                  <div className="session-type tag">
                    <span>{formatType(resource.type)}</span>
                  </div>
                  {resource.type === 'group' && resource.max_attendees && (
                    <div className="session-type tag">
                      <span>Max {resource.max_attendees} attendees</span>
                    </div>
                  )}
                </div>

                <div className="card-description" style={{ flex: 1 }}>
                  <p style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{resource.description}</p>
                </div>

                <div className="card-footer">
                  {/* Booking link row */}
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
                  {/* Create Booking button */}
                  <div className="card-footer-actions">
                    <button
                      className="book-btn"
                      onClick={() => handleCreateBookingForCalendar(resource.id)}
                    >
                      + Create Booking
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Calendar' : 'Create New Calendar'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateOrUpdate}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Individual Therapy Session"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <CustomDropdown
                  options={[
                    { value: '15 m', label: '15 minutes' },
                    { value: '30 m', label: '30 minutes' },
                    { value: '45 m', label: '45 minutes' },
                    { value: '50 m', label: '50 minutes' },
                    { value: '60 m', label: '60 minutes' },
                    { value: '90 m', label: '90 minutes' }
                  ]}
                  value={formData.duration}
                  onChange={(value) => setFormData({ ...formData, duration: value })}
                  placeholder="Select duration"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <CustomDropdown
                  options={[
                    { value: 'one_on_one', label: 'One on One' },
                    { value: 'group', label: 'Group' },
                    { value: 'couples', label: 'Couples' }
                  ]}
                  value={formData.type}
                  onChange={(value) => setFormData({ ...formData, type: value })}
                  placeholder="Select type"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your session..."
                ></textarea>
              </div>
              <div className="form-group">
                <label className="form-label">Custom Slug (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g. discovery-call"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="submit-btn">{editingId ? 'Save Changes' : 'Create Calendar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSlugModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
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
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setShowSlugModal(false)}>Cancel</button>
                <button type="submit" className="submit-btn">Update Slug</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateBookingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setShowCreateBookingModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '860px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCreateBookingModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', zIndex: 1 }}>×</button>
            <CreateBooking
              prefillCalendarId={createBookingCalendarId}
              onBack={() => setShowCreateBookingModal(false)}
            />
          </div>
        </div>
      )}
      <AvailabilityModal isOpen={showAvailabilityModal} onClose={() => setShowAvailabilityModal(false)} />
      <CreateCalendarModal
        isOpen={showResourceTypeModal}
        onClose={() => setShowResourceTypeModal(false)}
        onSelectType={handleTypeSelect}
      />
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