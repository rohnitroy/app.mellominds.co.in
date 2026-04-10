import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './ClientView.module.css';
import { Call, Message, Calendar, ArrowLeft, ChevronDown, Delete } from 'react-iconly';
import { useToast } from './context/ToastContext';
import { useAuth } from './context/AuthContext';
import API_BASE_URL from './config/api';
import DataTable from './components/DataTable';
import CreateBooking from './components/CreateBooking';
import ConfirmModal from './components/ConfirmModal';
import InlineCalendar from './components/InlineCalendar';
import TimeSlotList from './components/TimeSlotList';
import { ColumnDef } from '@tanstack/react-table';

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  sessions: string;
  revenue: string;
  age?: string;
  occupation?: string;
  gender?: string;
  maritalStatus?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  manually_added?: boolean;
}

interface ClientViewProps {
  client: Client;
  onBack: () => void;
  initialTab?: string;
  propCutoffDate?: Date;
  onTabChange?: (tab: string) => void;
}

const ClientView: React.FC<ClientViewProps> = ({ client, onBack, initialTab, propCutoffDate, onTabChange }) => {
  const toast = useToast();
  const { user } = useAuth();
  const isEnterprise = user?.plan_name === 'enterprise';
  const [uploadingNoteFile, setUploadingNoteFile] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'Overview');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [showDateDropdown, setShowDateDropdown] = useState<boolean>(false);
  const [showAddNotesModal, setShowAddNotesModal] = useState<boolean>(false);
  const [showAddActivitiesModal, setShowAddActivitiesModal] = useState<boolean>(false);
  const [showActionMenu, setShowActionMenu] = useState<boolean>(false);
  const actionMenuRef = React.useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showCreateBookingModal, setShowCreateBookingModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferOptions, setTransferOptions] = useState({
    notes: false,
    activities: false,
  });
  const [transferring, setTransferring] = useState(false);
  const [emailLookup, setEmailLookup] = useState<{ status: 'idle' | 'checking' | 'found' | 'notfound'; name?: string }>({ status: 'idle' });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    };
    if (showActionMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showActionMenu]);

  // Real data state
  const [appointments, setAppointments] = useState<any[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState(false);
  const [stats, setStats] = useState({
    sessions: '0',
    revenue: '₹0',
    nextSession: '-',
    cancellations: '0',
    noShow: '0'
  });

  // Track saved state separately so cancel always resets to last saved
  const clean = (v?: string) => (!v || v === '-' ? '' : v);
  const [savedData, setSavedData] = useState({
    name: clean(client.name),
    phone: clean(client.phone),
    email: clean(client.email),
    emergencyName: clean(client.emergencyName),
    emergencyRelation: clean(client.emergencyRelation),
    emergencyPhone: clean(client.emergencyPhone),
    age: clean(client.age),
    occupation: clean(client.occupation),
    gender: clean(client.gender),
    maritalStatus: clean(client.maritalStatus),
  });

  const [editData, setEditData] = useState({ ...savedData });

  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingNote, setDeletingNote] = useState<number | null>(null);
  const [activityForm, setActivityForm] = useState({ name: '', description: '', notify_client: false, reminder_count: 2, reminder_interval_days: 1 });
  const [transferInfo, setTransferInfo] = useState<{ transferred: boolean; from_therapist_email?: string; created_at?: string } | null>(null);
  const [isTransferredClient, setIsTransferredClient] = useState(!!propCutoffDate);
  const [transferCutoffDate, setTransferCutoffDate] = useState<Date | null>(propCutoffDate || null);
  const [pendingTransfer, setPendingTransfer] = useState<{ id: number } | null>(null);
  const [showCancelTransferModal, setShowCancelTransferModal] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<number | null>(null);

  // Note template state
  const [noteTemplate, setNoteTemplate] = useState<any[]>([]);
  const [noteFormData, setNoteFormData] = useState<Record<string, any>>({});
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<{ url: string; original_name: string }[]>([]);
  const [uploadingNoteAttachment, setUploadingNoteAttachment] = useState(false);

  const fetchActivities = async () => {
    setActivitiesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/${client.id}`, { credentials: 'include' });
      if (res.ok) setActivities(await res.json());
    } catch (e) { console.error('Failed to fetch activities:', e); }
    finally { setActivitiesLoading(false); }
  };

  useEffect(() => { fetchActivities(); }, [client.id]);

  // Fetch fresh client data from backend to ensure no stale/placeholder values
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/clients/${client.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const fresh = {
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          emergencyName: data.emergencyName || '',
          emergencyRelation: data.emergencyRelation || '',
          emergencyPhone: data.emergencyPhone || '',
          age: data.age || '',
          occupation: data.occupation || '',
          gender: clean(data.gender),
          maritalStatus: clean(data.maritalStatus),
        };
        setSavedData(fresh);
        setEditData(fresh);
      })
      .catch(() => {});
  }, [client.id]);

  // Fetch note template
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/notes/template/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { fields: [] })
      .then(data => {
        const fields = data.fields || [];
        setNoteTemplate(fields);
        // Init form data
        const init: Record<string, any> = {};
        fields.forEach((f: any) => { init[f.key] = f.type === 'checkbox' ? [] : ''; });
        setNoteFormData(init);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/clients/${client.id}/transfer-info`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { transferred: false })
      .then(data => {
        setTransferInfo(data);
        if (data.transferred) setIsTransferredClient(true);
      })
      .catch(() => setTransferInfo({ transferred: false }));

    // Also check if this client was transferred out by current therapist
    fetch(`${API_BASE_URL}/api/clients/transfers/outgoing`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const approved = data.find(t => t.client_email === client.email && t.status === 'approved');
        if (approved) {
          setIsTransferredClient(true);
          setTransferCutoffDate(new Date(approved.updated_at));
        }
        const pending = data.find(t => t.client_email === client.email && t.status === 'pending');
        if (pending) setPendingTransfer({ id: pending.id });
        else setPendingTransfer(null);
      })
      .catch(() => {});
  }, [client.id, client.email]);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [bookingStatusUpdating, setBookingStatusUpdating] = useState<number | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reschedule modal state
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Confirm modal state (cancel / noshow)
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: string } | null>(null);

  useEffect(() => {
    if (openActionMenu === null) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenActionMenu(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openActionMenu]);

  const handleActivitySubmit = async () => {
    if (!activityForm.name.trim()) { toast.warning('Activity name is required.'); return; }
    setActivitySubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, name: activityForm.name, description: activityForm.description, notify_client: activityForm.notify_client, reminder_count: activityForm.reminder_count, reminder_interval_days: activityForm.reminder_interval_days }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Activity added!');
        setShowAddActivitiesModal(false);
        setActivityForm({ name: '', description: '', notify_client: false, reminder_count: 2, reminder_interval_days: 1 });
        fetchActivities();
      } else { toast.error('Failed to add activity.'); }
    } catch (e) { toast.error('Error adding activity.'); }
    finally { setActivitySubmitting(false); }
  };

  const handleDeleteActivity = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Activity removed.'); setActivityToDelete(null); fetchActivities(); }
      else toast.error('Failed to delete activity.');
    } catch (e) { toast.error('Error deleting activity.'); }
  };

  const fetchClientData = async () => {
    if (!client.email) return;
    setAppointmentsLoading(true);
    setAppointmentsError(false);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings?email=${encodeURIComponent(client.email)}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();

        // Apply date filter client-side
        // If Therapist A (transferred out), only show data up to transfer cutoff date
        const cutoff = transferCutoffDate;
        let filtered = selectedDate === 'all' ? data : data.filter((app: any) => {
          const d = new Date(app.start_time);
          const [mon, yr] = selectedDate.split(' ');
          const monthIndex = new Date(`${mon} 1, 2000`).getMonth();
          return d.getMonth() === monthIndex && d.getFullYear() === parseInt(yr);
        });

        if (cutoff) {
          filtered = filtered.filter((app: any) => new Date(app.start_time) <= cutoff);
          // Also filter notes within each appointment to only show notes before cutoff
          filtered = filtered.map((app: any) => ({
            ...app,
            notes: (app.notes || []).filter((n: any) => new Date(n.created_at) <= cutoff)
          }));
        }

        setAppointments(filtered);

        const totalSessions = filtered.length;
        // Only count Paid revenue on non-cancelled bookings
        const totalRevenue = filtered.reduce((sum: number, app: any) =>
          (app.payment_status === 'Paid' || app.payment_status === 'Partial Refund') && app.status !== 'cancelled' ? sum + (parseFloat(app.payment_amount) || 0) : sum, 0);
        const cancelled = filtered.filter((app: any) => app.status === 'cancelled').length;
        const noShow = filtered.filter((app: any) => app.status === 'noshow').length;

        const now = new Date();
        const upcoming = (selectedDate === 'all' ? data : filtered)
          .filter((app: any) => new Date(app.start_time) > now && app.status !== 'cancelled')
          .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

        const nextSessionDate = upcoming
          ? new Date(upcoming.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '-';

        setStats({
          sessions: totalSessions.toString().padStart(2, '0'),
          revenue: `₹${totalRevenue.toLocaleString()}`,
          nextSession: nextSessionDate,
          cancellations: cancelled.toString().padStart(2, '0'),
          noShow: noShow.toString().padStart(2, '0')
        });
      }
    } catch (error) {
      console.error('Failed to fetch client appointments:', error);
      setAppointmentsError(true);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [client.email, refreshTrigger, selectedDate, transferCutoffDate]);

  const handleNoteSubmit = async () => {
    if (!selectedAppointmentId && !editingNote) {
      toast.warning('Please select a booking.');
      return;
    }

    // Validate required fields
    for (const field of noteTemplate) {
      if (field.required) {
        const val = noteFormData[field.key];
        if (!val || (Array.isArray(val) && val.length === 0)) {
          toast.warning(`"${field.label}" is required.`);
          return;
        }
      }
    }

    const content = noteTemplate.length > 0 ? noteFormData : { text: noteContent };

    try {
      const isEdit = !!editingNote;
      const url = isEdit ? `${API_BASE_URL}/api/notes/${editingNote.id}` : `${API_BASE_URL}/api/notes`;
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit
        ? JSON.stringify({ content, attachments: [...(editingNote.attachments || []), ...pendingAttachments] })
        : JSON.stringify({ appointment_id: selectedAppointmentId, content, attachments: pendingAttachments });

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'include'
      });

      if (response.ok) {
        toast.success(isEdit ? 'Note updated!' : 'Note added successfully!');
        setShowAddNotesModal(false);
        setNoteContent('');
        setSelectedAppointmentId('');
        setEditingNote(null);
        setPendingAttachments([]);
        const init: Record<string, any> = {};
        noteTemplate.forEach((f: any) => { init[f.key] = f.type === 'checkbox' ? [] : ''; });
        setNoteFormData(init);
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast.error('Failed to save note.');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Error saving note.');
    }
  };

  const handleEditNote = (note: any, appointmentId: string) => {
    setEditingNote(note);
    setSelectedAppointmentId(appointmentId);
    setPendingAttachments([]);
    if (noteTemplate.length > 0 && note.content && typeof note.content === 'object' && !note.content.text) {
      setNoteFormData(note.content);
    } else {
      setNoteContent(typeof note.content === 'object' ? note.content?.text || '' : note.content || '');
    }
    setShowAddNotesModal(true);
  };

  const handleDeleteNote = async (noteId: number) => {
    setDeletingNote(noteId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/${noteId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Note deleted.'); setRefreshTrigger(prev => prev + 1); }
      else toast.error('Failed to delete note.');
    } catch { toast.error('Error deleting note.'); }
    finally { setDeletingNote(null); }
  };

  const handleEditClient = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditData({ ...savedData });
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    // Sanitize: replace '-' placeholder with empty string so DB gets null via COALESCE
    const sanitized = Object.fromEntries(
      Object.entries(editData).map(([k, v]) => [k, v === '-' ? '' : v])
    );
    setSavingEdit(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
        credentials: 'include'
      });

      if (response.ok) {
        const updated = await response.json();
        // Update savedData so cancel resets to the newly saved values
        const newSaved = {
          name: updated.name || '',
          phone: updated.phone || '',
          email: updated.email || '',
          emergencyName: updated.emergencyName || '',
          emergencyRelation: updated.emergencyRelation || '',
          emergencyPhone: updated.emergencyPhone || '',
          age: updated.age || '',
          occupation: updated.occupation || '',
          gender: clean(updated.gender),
          maritalStatus: clean(updated.maritalStatus),
        };
        setSavedData(newSaved);
        setEditData(newSaved);
        setIsEditing(false);
        toast.success('Client information updated successfully!');
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast.error('Failed to update client information.');
      }
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Error updating client information.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/clients/${client.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Client deleted successfully');
        setShowDeleteModal(false);
        onBack();
      } else {
        const err = await response.json();
        if (err.error === 'transferred_client') {
          setShowDeleteModal(false);
          toast.error('Transferred clients cannot be deleted. Please contact support@mellominds.co.in');
        } else {
          toast.error(err.error || 'Failed to delete client');
        }
      }
    } catch {
      toast.error('Error deleting client');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!pendingTransfer) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients/transfers/${pendingTransfer.id}/cancel`, {
        method: 'DELETE', credentials: 'include'
      });
      if (res.ok) {
        toast.success('Transfer cancelled. Notifications sent.');
        setPendingTransfer(null);
        setShowCancelTransferModal(false);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to cancel transfer');
      }
    } catch { toast.error('Network error'); }
  };

  const handleTransferEmailChange = (email: string) => {
    setTransferEmail(email);
    if (!email.trim() || !email.includes('@')) {
      setEmailLookup({ status: 'idle' });
    } else {
      setEmailLookup({ status: 'checking' });
    }
  };

  useEffect(() => {
    if (!transferEmail.trim() || !transferEmail.includes('@')) return;
    setEmailLookup({ status: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/clients/lookup-therapist?email=${encodeURIComponent(transferEmail)}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.exists) {
          setEmailLookup({ status: 'found', name: data.name });
        } else {
          setEmailLookup({ status: 'notfound' });
        }
      } catch {
        setEmailLookup({ status: 'notfound' });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [transferEmail]);

  const handleUploadNoteFile = (appointmentId: string) => {
    if (!isEnterprise) { toast.error('File attachments are available on Enterprise plan only.'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast.error('File size must be less than 10MB'); return; }
      setUploadingNoteFile(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('appointment_id', appointmentId);
        const res = await fetch(`${API_BASE_URL}/api/notes/upload-attachment`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          // Add to pending attachments and open the note modal so it gets saved with a note
          setPendingAttachments(prev => [...prev, { url: data.url, original_name: data.original_name }]);
          setSelectedAppointmentId(appointmentId);
          setShowAddNotesModal(true);
          toast.success(`File "${data.original_name}" ready — add a note and save to attach it.`);
        } else {
          const err = await res.json();
          toast.error(err.error || 'Failed to upload file');
        }
      } catch {
        toast.error('Error uploading file');
      } finally {
        setUploadingNoteFile(false);
      }
    };
    input.click();
  };

  const tabs: string[] = ['Overview', 'Session Notes', 'Activity Suggestion'];

  const handleTransferClient = async () => {
    if (!transferEmail.trim()) { toast.warning('Please enter the therapist email.'); return; }
    if (emailLookup.status !== 'found') { toast.warning('Please enter a valid registered therapist email.'); return; }
    setTransferring(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients/${client.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ target_email: transferEmail.trim(), transfer_options: transferOptions }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setShowTransferModal(false);
        onBack();
      } else {
        toast.error(data.error || 'Transfer failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: number, status: string) => {
    setBookingStatusUpdating(bookingId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success(`Booking marked as ${status}`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update status');
      }
    } catch { toast.error('Error updating booking status'); }
    finally { setBookingStatusUpdating(null); }
  };

  const sendReminder = async (bookingId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/reminder`, {
        method: 'POST', credentials: 'include'
      });
      if (res.ok) toast.success('Reminder sent!');
      else toast.error('Failed to send reminder');
    } catch { toast.error('Error sending reminder'); }
  };

  const handleReschedule = async () => {
    if (!rescheduleAppt || !rescheduleSlot) return;
    setRescheduling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${rescheduleAppt.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_start_time: rescheduleSlot }),
      });
      if (res.ok) {
        toast.success('Booking rescheduled!');
        setRescheduleAppt(null);
        setRescheduleSlot(null);
        setRefreshTrigger(prev => prev + 1);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to reschedule');
      }
    } catch { toast.error('Network error'); }
    finally { setRescheduling(false); }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const bookingColumns: ColumnDef<any, any>[] = useMemo(() => [
    {
      accessorKey: 'start_time',
      header: 'Session Timings',
      cell: ({ getValue }) => formatDateTime(getValue()),
    },
    {
      accessorKey: 'title',
      header: 'Session Type',
    },
    {
      id: 'mode',
      header: 'Mode',
      enableSorting: false,
      cell: ({ row }) => row.original.meet_link ? 'Google Meet' : (row.original.location_type === 'in_person' ? 'In-person' : 'Google Meet'),
    },
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original.status || 'scheduled';
        const colors: Record<string, { bg: string; color: string }> = {
          scheduled: { bg: '#e8f5e9', color: '#2e7d32' },
          completed: { bg: '#e3f2fd', color: '#1565c0' },
          cancelled: { bg: '#fdecea', color: '#c62828' },
          noshow: { bg: '#fff3e0', color: '#e65100' },
        };
        const c = colors[s] || colors.scheduled;
        return (
          <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', background: c.bg, color: c.color, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
            {s === 'noshow' ? 'No Show' : s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        );
      },
    },
    ...(!(isTransferredClient && transferCutoffDate) ? [{
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }: any) => {
        const appt = row.original;
        const isUpdating = bookingStatusUpdating === appt.id;
        const isCancelledOrNoshow = appt.status === 'cancelled' || appt.status === 'noshow';
        if (isCancelledOrNoshow) return <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>;

        const isPast = new Date(appt.start_time) < new Date();
        const isScheduled = appt.status === 'scheduled';
        const isOpen = openActionMenu === appt.id;

        return (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              disabled={isUpdating}
              onClick={(e) => {
                e.stopPropagation();
                if (isOpen) { setOpenActionMenu(null); setMenuPos(null); return; }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
                setOpenActionMenu(appt.id);
              }}
              style={{
                width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #e0e0e0',
                background: isOpen ? '#f5f5f5' : '#fff', cursor: 'pointer',
                fontSize: '16px', fontWeight: 700, color: '#555', lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: isUpdating ? 0.5 : 1,
              }}
            >
              {isUpdating ? '…' : '···'}
            </button>
          </div>
        );
      },
    }] as ColumnDef<any, any>[] : []),
  ], [isTransferredClient, transferCutoffDate, bookingStatusUpdating, openActionMenu]);

  return (
    <div className={styles.clientView}>
      <div className={styles.clientLayout}>
        <div className={styles.leftPanel}>
          {/* Read-only banner for Therapist A after transfer */}
          {isTransferredClient && transferCutoffDate && (
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'Urbanist', fontSize: '13px', color: '#795548' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f57f17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>
                <strong>Read-only.</strong> This client was transferred on {transferCutoffDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. You can only view data up to that date.
              </span>
            </div>
          )}
          <div className={styles.clientTitleSection}>
            <button className={styles.backButton} onClick={onBack}>
              <ArrowLeft size="medium" primaryColor="#000000" />
            </button>
            <div className={styles.clientInfo}>
              <h1>{editData.name}</h1>
              <p>Client ID: {client.id}</p>
            </div>
            {/* Hide action menu entirely for Therapist A after transfer */}
            {isEditing ? null : !( isTransferredClient && transferCutoffDate) && (
              <div className={styles.actionMenuWrapper} ref={actionMenuRef}>
                <button className={styles.actionMenuBtn} onClick={() => setShowActionMenu(!showActionMenu)}>···</button>
                {showActionMenu && (
                  <div className={styles.actionMenuDropdown}>
                    <div className={styles.actionMenuItem} onClick={() => { handleEditClient(); setShowActionMenu(false); }}>Edit</div>
                    <div className={styles.actionMenuItem} onClick={() => { setShowActionMenu(false); setShowTransferModal(true); }}>Transfer</div>
                    {pendingTransfer && (
                      <div className={styles.actionMenuItem} onClick={() => { setShowActionMenu(false); setShowCancelTransferModal(true); }} style={{ color: '#e65100' }}>
                        Cancel Transfer
                      </div>
                    )}
                    {client.manually_added && !isTransferredClient && (
                      <div className={styles.actionMenuItem} onClick={() => { setShowActionMenu(false); setShowDeleteModal(true); }} style={{ color: '#e53935' }}>Delete</div>
                    )}
                    {isTransferredClient && (
                      <div className={styles.actionMenuItem} style={{ color: '#9CA3AF', fontSize: '12px', cursor: 'default' }}
                        onClick={() => { setShowActionMenu(false); toast.info('Transferred clients cannot be deleted. Contact support@mellominds.co.in'); }}>
                        Cannot Delete (Transferred)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.infoSection}>
            <h3>Contact Info:</h3>
            <div className={styles.contactItem}>
              <Call size="small" primaryColor="#000000" />
              <span>{editData.phone || '-'}</span>
            </div>
            <div className={styles.contactItem}>
              <Message size="small" primaryColor="#000000" />
              <span>{editData.email || '-'}</span>
            </div>
          </div>

          <div className={styles.infoSection}>
            <h3>Emergency Contact:</h3>
            <div className={styles.emergencyContactCard}>
              <div className={styles.emergencyName}>
                {editData.emergencyName || '—'}
                <span className={styles.relationship}> ({editData.emergencyRelation || '—'})</span>
              </div>
              <div className={styles.emergencyPhone}>{editData.emergencyPhone || '—'}</div>
            </div>
          </div>

          <div className={styles.infoSection}>
            <h3>Demographics:</h3>
            {transferInfo?.transferred && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: '#e8f4fd', border: '1px solid #90caf9',
                borderRadius: '8px', padding: '6px 12px', marginBottom: '12px',
                fontSize: '12px', fontFamily: 'Urbanist', fontWeight: 600, color: '#1565c0'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                Transferred from {transferInfo.from_therapist_email}
                {transferInfo.created_at && (
                  <span style={{ fontWeight: 400, color: '#5c8fc7' }}>
                    · {new Date(transferInfo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            )}
            <div className={styles.demographicsGrid}>
              <div className={styles.demoRow}>
                <span className={styles.demoLabel}>Age</span>
                <span className={styles.demoValue}>{editData.age || '—'}</span>
                <span className={styles.demoLabel}>Occupation</span>
                <span className={styles.demoValue}>{editData.occupation || '—'}</span>
              </div>
              <div className={styles.demoRow}>
                <span className={styles.demoLabel}>Gender</span>
                <span className={styles.demoValue}>{editData.gender || '—'}</span>
                <span className={styles.demoLabel}>Marital Status</span>
                <span className={styles.demoValue}>{editData.maritalStatus || '—'}</span>
              </div>
            </div>
          </div>

        </div>

        <div className={styles.rightPanel}>
          <div className={styles.tabNavigation}>
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`${styles.tabButton} ${activeTab === tab ? styles.active : ''}`}
                onClick={() => { setActiveTab(tab); onTabChange?.(tab); }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'Overview' && (
              <div className={styles.overviewContent}>
                <div className={styles.sessionsHeader}>
                  <div className={styles.dateSelector} onClick={() => setShowDateDropdown(!showDateDropdown)}>
                    <div className={styles.dateIcon}>
                      <Calendar size="small" primaryColor="#6E6E6E" />
                    </div>
                    <span>{selectedDate === 'all' ? 'All Time' : selectedDate}</span>
                    <div className={styles.dropdownArrow}>
                      <ChevronDown size="small" primaryColor="#6E6E6E" />
                    </div>
                    {showDateDropdown && (
                      <div className={styles.dateDropdown} onClick={e => e.stopPropagation()}>
                        <div className={styles.dropdownItem} onClick={() => { setSelectedDate('all'); setShowDateDropdown(false); }}>All Time</div>
                        {(() => {
                          const now = new Date();
                          const months = [];
                          for (let i = 0; i < 6; i++) {
                            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                            const label = d.toLocaleString('en-US', { month: 'short' }) + ' ' + d.getFullYear();
                            months.push(<div key={label} className={styles.dropdownItem} onClick={() => { setSelectedDate(label); setShowDateDropdown(false); }}>{label}</div>);
                          }
                          return months;
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Sessions</div>
                    <div className={styles.statValue}>{stats.sessions}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Revenue</div>
                    <div className={styles.statValue}>{stats.revenue}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Next Session</div>
                    <div className={styles.statValue}>{stats.nextSession}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Cancellation</div>
                    <div className={styles.statValue}>{stats.cancellations}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>No Show</div>
                    <div className={styles.statValue}>{stats.noShow}</div>
                  </div>
                </div>

                <div className={styles.appointmentsSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0 }}>Bookings</h3>
                    {!(isTransferredClient && transferCutoffDate) && (
                      <button
                        onClick={() => setShowCreateBookingModal(true)}
                        style={{ padding: '7px 16px', background: '#082421', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                      >
                        + Create Booking
                      </button>
                    )}
                  </div>
                  {appointmentsLoading ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#6E6E6E', fontSize: '14px', fontFamily: 'Urbanist' }}>Loading bookings...</div>
                  ) : appointmentsError ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#c62828', fontSize: '14px', fontFamily: 'Urbanist' }}>
                      Failed to load bookings.{' '}
                      <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setRefreshTrigger(p => p + 1)}>Retry</span>
                    </div>
                  ) : (
                    <DataTable
                      data={appointments}
                      columns={bookingColumns}
                      pageSize={5}
                      emptyMessage="No bookings found"
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Session Notes' && (
              <>
                <div className={styles.sessionList}>
                  {appointmentsLoading ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#6E6E6E', fontSize: '14px', fontFamily: 'Urbanist' }}>Loading...</div>
                  ) : appointments.length === 0 && (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#6E6E6E', fontSize: '14px', fontFamily: 'Urbanist' }}>No bookings found for this client.</div>
                  )}
                  {appointments.map((app, i) => {
                    if (app.status === 'cancelled') return null;
                    return (
                    <div className={styles.sessionItem} key={i}>
                      <div className={styles.sessionHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className={styles.sessionTime}>{formatDateTime(app.start_time)}</span>
                          <span className={styles.sessionMode}>{app.meet_link ? 'Google Meet' : (app.location_type === 'in_person' ? 'In-person' : 'Google Meet')}</span>
                          <span className={styles.sessionType}>{app.title}</span>
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                            background: app.status === 'cancelled' ? '#fdecea' : app.status === 'noshow' ? '#fff3e0' : app.status === 'completed' ? '#e3f2fd' : '#e8f5e9',
                            color: app.status === 'cancelled' ? '#c62828' : app.status === 'noshow' ? '#e65100' : app.status === 'completed' ? '#1565c0' : '#2e7d32',
                            fontFamily: 'Urbanist',
                          }}>
                            {app.status === 'noshow' ? 'No Show' : app.status ? (app.status.charAt(0).toUpperCase() + app.status.slice(1)) : 'Scheduled'}
                          </span>
                        </div>
                        {!(isTransferredClient && transferCutoffDate) && !(app.notes?.length > 0) && (
                          <button
                            className={styles.noteEditBtn}
                            onClick={() => { setSelectedAppointmentId(app.id.toString()); setShowAddNotesModal(true); }}>
                            + Add Note
                          </button>
                        )}
                        {!(isTransferredClient && transferCutoffDate) && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <button
                              className={styles.noteEditBtn}
                              style={{ marginLeft: '4px' }}
                              disabled={uploadingNoteFile}
                              onClick={() => handleUploadNoteFile(app.id.toString())}>
                              {uploadingNoteFile ? 'Uploading...' : '↑ Upload File'}
                            </button>
                            <span style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'Urbanist' }}>5–10MB · PDF, DOC, TXT, Image</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.sessionNotes}>
                        {app.notes && app.notes.length > 0 ? (
                          app.notes.map((note: any, idx: number) => (
                            <div key={idx} className={styles.noteCard}>
                              <div className={styles.noteCardHeader}>
                                <span className={styles.noteDate}>
                                  {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {!(isTransferredClient && transferCutoffDate) && (
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className={styles.noteEditBtn} onClick={() => handleEditNote(note, app.id.toString())}>
                                      Edit
                                    </button>
                                    <button className={styles.noteEditBtn} style={{ color: '#c62828', borderColor: '#c62828' }} onClick={() => handleDeleteNote(note.id)} disabled={deletingNote === note.id}>
                                      {deletingNote === note.id ? 'Deleting...' : 'Delete'}
                                    </button>
                                  </div>
                                )}
                              </div>
                              {noteTemplate.length > 0 && note.content && typeof note.content === 'object' && !note.content.text ? (
                                noteTemplate.map((field: any) => {
                                  const val = note.content[field.key];
                                  if (!val || (Array.isArray(val) && val.length === 0)) return null;
                                  return (
                                    <div key={field.key}>
                                      <div className={styles.noteFieldLabel}>{field.label}</div>
                                      <div className={styles.noteFieldValue}>{Array.isArray(val) ? val.join(', ') : val}</div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className={styles.notePlainText}>
                                  {typeof note.content === 'object' ? note.content?.text : note.content}
                                </div>
                              )}
                              {/* Attachments */}
                              {note.attachments?.length > 0 && (
                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {note.attachments.map((a: any, ai: number) => (
                                      <a key={ai} href={`${API_BASE_URL}/api/clients/clinical-profile/view?url=${encodeURIComponent(a.url)}`}
                                        target="_blank" rel="noopener noreferrer"
                                        style={{ fontSize: '12px', color: '#2D7579', textDecoration: 'underline', fontFamily: 'Urbanist' }}>
                                        📎 {a.original_name}
                                      </a>
                                    ))}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className={styles.noNotesText}>No notes for this session.</span>
                        )}
                      </div>
                    </div>
                  ); })}
                </div>

                {!(isTransferredClient && transferCutoffDate) && (
                  <div className={styles.addNotesSection}>
                    <button className={styles.addNotesButton} onClick={() => { setSelectedAppointmentId(''); setShowAddNotesModal(true); }}>+ Add Note</button>
                  </div>
                )}
              </>
            )}


            {activeTab === 'Activity Suggestion' && (
              <div className={styles.activityContent}>
                <div className={styles.sessionsHeader}>
                  <div className={styles.dateSelector} onClick={() => setShowDateDropdown(!showDateDropdown)}>
                    <div className={styles.dateIcon}>
                      <Calendar size="small" primaryColor="#6E6E6E" />
                    </div>
                    <span>{selectedDate === 'all' ? 'All Time' : selectedDate}</span>
                    <div className={styles.dropdownArrow}>
                      <ChevronDown size="small" primaryColor="#6E6E6E" />
                    </div>
                    {showDateDropdown && (
                      <div className={styles.dateDropdown} onClick={e => e.stopPropagation()}>
                        <div className={styles.dropdownItem} onClick={() => { setSelectedDate('all'); setShowDateDropdown(false); }}>All Time</div>
                        {(() => {
                          const now = new Date();
                          return Array.from({ length: 6 }, (_, i) => {
                            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                            const label = d.toLocaleString('en-US', { month: 'short' }) + ' ' + d.getFullYear();
                            return (
                              <div key={label} className={styles.dropdownItem}
                                onClick={() => { setSelectedDate(label); setShowDateDropdown(false); }}>
                                {label}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.activityList}>
                  {activitiesLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#6E6E6E', fontSize: '14px' }}>Loading activities...</div>
                  ) : (() => {
                    const filtered = selectedDate === 'all' ? activities : activities.filter((act: any) => {
                      const d = new Date(act.created_at);
                      const [mon, yr] = selectedDate.split(' ');
                      const monthIndex = new Date(`${mon} 1, 2000`).getMonth();
                      return d.getMonth() === monthIndex && d.getFullYear() === parseInt(yr);
                    });
                    // Therapist A: only show activities up to transfer cutoff
                    const cutoffFiltered = transferCutoffDate
                      ? filtered.filter((act: any) => new Date(act.created_at) <= transferCutoffDate)
                      : filtered;
                    if (cutoffFiltered.length === 0) return (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#6E6E6E', fontSize: '14px' }}>
                        {activities.length === 0 ? 'No activities added yet.' : 'No activities for this period.'}
                      </div>
                    );
                    return cutoffFiltered.map((act: any) => (
                      <div className={styles.activityItem} key={act.id}>
                        <div className={styles.activityInfo}>
                          <div className={styles.activityName}>{act.name}</div>
                          <div className={styles.activityDescription}>{act.description || '—'}</div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', fontFamily: 'Urbanist' }}>
                            {new Date(act.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <button className={styles.deleteBtn} onClick={() => setActivityToDelete(act.id)}>
                          <Delete size="small" primaryColor="#dc3545" />
                        </button>
                      </div>
                    ));
                  })()}
                </div>

                {!(isTransferredClient && transferCutoffDate) && (
                  <button className={styles.addActivitiesBtn} onClick={() => setShowAddActivitiesModal(true)}>+ Add Activities</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Client Modal */}
      {isEditing && (
        <div className={styles.modalOverlay} onClick={handleCancelEdit}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '20px', margin: 0 }}>Edit Client Details</h2>
              <button onClick={handleCancelEdit} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 24px 0' }}>Update client information below</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input className={styles.formInput} type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Phone</label>
                <input className={styles.formInput} type="text" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label>Email</label>
                <input className={styles.formInput} type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Age</label>
                <input className={styles.formInput} type="text" value={editData.age} onChange={(e) => setEditData({ ...editData, age: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Occupation</label>
                <input className={styles.formInput} type="text" value={editData.occupation} onChange={(e) => setEditData({ ...editData, occupation: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Gender</label>
                <select className={styles.formSelect} value={editData.gender} onChange={(e) => setEditData({ ...editData, gender: e.target.value })}>
                  <option value="">Not specified</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Marital Status</label>
                <select className={styles.formSelect} value={editData.maritalStatus} onChange={(e) => setEditData({ ...editData, maritalStatus: e.target.value })}>
                  <option value="">Not specified</option>
                  <option>Single</option>
                  <option>Married</option>
                  <option>Divorced</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Emergency Contact Name</label>
                <input className={styles.formInput} type="text" value={editData.emergencyName} onChange={(e) => setEditData({ ...editData, emergencyName: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Relation</label>
                <input className={styles.formInput} type="text" value={editData.emergencyRelation} onChange={(e) => setEditData({ ...editData, emergencyRelation: e.target.value })} />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label>Emergency Phone</label>
                <input className={styles.formInput} type="text" value={editData.emergencyPhone} onChange={(e) => setEditData({ ...editData, emergencyPhone: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className={styles.editButton} style={{ background: '#f1f3f4', color: '#082421' }} onClick={handleCancelEdit}>Cancel</button>
              <button className={styles.editButton} onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Notes Modal */}
      {showAddNotesModal && (
        <div className={styles.modalOverlay} onClick={() => { setShowAddNotesModal(false); setEditingNote(null); setSelectedAppointmentId(''); setPendingAttachments([]); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h2 style={{ margin: 0 }}>{editingNote ? 'Edit Note' : '+ Add Notes'}</h2>
              <button onClick={() => { setShowAddNotesModal(false); setEditingNote(null); setSelectedAppointmentId(''); setPendingAttachments([]); }} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p>{editingNote ? 'Update the note for this session.' : 'Add notes to a dedicated client booking.'}</p>

            {!editingNote && (
              <div className={styles.formGroup}>
                <label>Select Booking</label>
                <select
                  className={styles.formSelect}
                  value={selectedAppointmentId}
                  onChange={(e) => setSelectedAppointmentId(e.target.value)}
                >
                  <option value="">Select booking</option>
                  {appointments
                    .filter(app => app.status !== 'cancelled' && !(app.notes?.length > 0))
                    .map(app => (
                      <option key={app.id} value={app.id}>
                        {formatDateTime(app.start_time)} - {app.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Custom template fields */}
            {noteTemplate.length > 0 ? (
              noteTemplate.map((field: any) => (
                <div className={styles.formGroup} key={field.key}>
                  <label>{field.label}{field.required && <span style={{ color: '#e53935' }}> *</span>}</label>
                  {field.type === 'textarea' && (
                    <textarea className={styles.formInput} rows={3} style={{ padding: '8px' }}
                      value={noteFormData[field.key] || ''}
                      onChange={e => setNoteFormData(p => ({ ...p, [field.key]: e.target.value }))} />
                  )}
                  {field.type === 'text' && (
                    <input type="text" className={styles.formInput}
                      value={noteFormData[field.key] || ''}
                      onChange={e => setNoteFormData(p => ({ ...p, [field.key]: e.target.value }))} />
                  )}
                  {field.type === 'number' && (
                    <input type="number" className={styles.formInput}
                      value={noteFormData[field.key] || ''}
                      onChange={e => setNoteFormData(p => ({ ...p, [field.key]: e.target.value }))} />
                  )}
                  {field.type === 'date' && (
                    <input type="date" className={styles.formInput}
                      value={noteFormData[field.key] || ''}
                      onChange={e => setNoteFormData(p => ({ ...p, [field.key]: e.target.value }))} />
                  )}
                  {field.type === 'select' && (
                    <select className={styles.formSelect}
                      value={noteFormData[field.key] || ''}
                      onChange={e => setNoteFormData(p => ({ ...p, [field.key]: e.target.value }))}>
                      <option value="">Select...</option>
                      {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  )}
                  {field.type === 'radio' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                      {(field.options || []).map((opt: string) => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                          <input type="radio" name={field.key} value={opt}
                            checked={noteFormData[field.key] === opt}
                            onChange={() => setNoteFormData(p => ({ ...p, [field.key]: opt }))} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {field.type === 'checkbox' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                      {(field.options || []).map((opt: string) => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                          <input type="checkbox"
                            checked={(noteFormData[field.key] || []).includes(opt)}
                            onChange={e => {
                              const cur = noteFormData[field.key] || [];
                              setNoteFormData(p => ({ ...p, [field.key]: e.target.checked ? [...cur, opt] : cur.filter((v: string) => v !== opt) }));
                            }} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              // Fallback: plain text if no template configured
              <div className={styles.formGroup}>
                <label>Note Content</label>
                <textarea
                  placeholder="Enter session notes here..."
                  className={styles.formInput}
                  style={{ height: '100px', padding: '8px' }}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </div>
            )}

            {/* Attachments — enterprise only */}
            {isEnterprise && (
              <div className={styles.formGroup}>
                <label>Attachments</label>
                {/* Existing attachments on edit */}
                {editingNote?.attachments?.length > 0 && (
                  <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {editingNote.attachments.map((a: any, i: number) => (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '13px', color: '#2D7579', textDecoration: 'underline', fontFamily: 'Urbanist' }}>
                        📎 {a.original_name}
                      </a>
                    ))}
                  </div>
                )}
                {/* Newly added attachments */}
                {pendingAttachments.length > 0 && (
                  <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {pendingAttachments.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#2D7579', fontFamily: 'Urbanist' }}>📎 {a.original_name}</span>
                        <button onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '13px', padding: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  disabled={uploadingNoteAttachment}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) { toast.error('File size must be less than 10MB'); return; }
                      setUploadingNoteAttachment(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('appointment_id', selectedAppointmentId || editingNote?.appointment_id?.toString() || '');
                        const res = await fetch(`${API_BASE_URL}/api/notes/upload-attachment`, {
                          method: 'POST', credentials: 'include', body: formData,
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setPendingAttachments(prev => [...prev, { url: data.url, original_name: data.original_name }]);
                        } else {
                          const err = await res.json();
                          toast.error(err.error || 'Failed to upload file');
                        }
                      } catch { toast.error('Error uploading file'); }
                      finally { setUploadingNoteAttachment(false); }
                    };
                    input.click();
                  }}
                  style={{ fontSize: '13px', color: '#2D7579', background: 'none', border: '1px dashed #2D7579', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontFamily: 'Urbanist' }}
                >
                  {uploadingNoteAttachment ? 'Uploading...' : '+ Attach File'}
                </button>
              </div>
            )}

            <button className={styles.modalSubmitBtn} onClick={handleNoteSubmit}>{editingNote ? 'Update Note' : 'Add Note'}</button>
          </div>
        </div>
      )}


      {/* Add Activities Modal */}
      {showAddActivitiesModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddActivitiesModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h2 style={{ margin: 0 }}>+ Add Activity</h2>
              <button onClick={() => setShowAddActivitiesModal(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p>Add an activity suggestion for this client.</p>

            <div className={styles.formGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>Notify Client</label>
                <div
                  onClick={() => setActivityForm({ ...activityForm, notify_client: !activityForm.notify_client })}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                    background: activityForm.notify_client ? '#2D7579' : '#ccc',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: activityForm.notify_client ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>
              {activityForm.notify_client && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>
                      Number of reminders
                    </label>
                    <input
                      type="number" min={1} max={20}
                      className={styles.formInput}
                      value={activityForm.reminder_count}
                      onChange={(e) => setActivityForm({ ...activityForm, reminder_count: Math.max(1, parseInt(e.target.value) || 1) })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>
                      Remind every (days)
                    </label>
                    <input
                      type="number" min={1} max={90}
                      className={styles.formInput}
                      value={activityForm.reminder_interval_days}
                      onChange={(e) => setActivityForm({ ...activityForm, reminder_interval_days: Math.max(1, parseInt(e.target.value) || 1) })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Activity Name</label>
              <input type="text" placeholder="Enter activity name" className={styles.formInput}
                value={activityForm.name} onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })} />
            </div>

            <div className={styles.formGroup}>
              <label>Activity Description</label>
              <textarea placeholder="Enter activity description" className={styles.formTextarea} rows={4}
                value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}></textarea>
            </div>

            <button className={styles.modalSubmitBtn} onClick={handleActivitySubmit} disabled={activitySubmitting}>{activitySubmitting ? 'Adding...' : 'Add Activity'}</button>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => !deleting && setShowDeleteModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 28px', width: '100%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fdecea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <h3 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '18px', color: '#1a1a1a', margin: 0 }}>Delete Client?</h3>
              <button onClick={() => setShowDeleteModal(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#6E6E6E', marginBottom: '24px', lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>{client.name}</strong>? This will remove their profile. Their booking history will be preserved.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#333', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDeleteClient} disabled={deleting}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#e53935', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Client Modal */}
      {showTransferModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => { if (!transferring) { setShowTransferModal(false); setTransferEmail(''); setEmailLookup({ status: 'idle' }); } }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 28px', width: '100%', maxWidth: '460px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '18px', color: '#1a1a1a', margin: '0 0 6px 0' }}>Transfer Client</h3>
                <p style={{ fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E', margin: '0 0 24px 0' }}>
                  Transfer <strong>{client.name}</strong> to another therapist using their registered email.
                </p>
              </div>
              <button onClick={() => { setShowTransferModal(false); setTransferEmail(''); setEmailLookup({ status: 'idle' }); }} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#333', display: 'block', marginBottom: '6px' }}>
                Therapist Email *
              </label>
              <input
                type="email"
                placeholder="therapist@example.com"
                value={transferEmail}
                onChange={e => handleTransferEmailChange(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${emailLookup.status === 'found' ? '#4caf50' : emailLookup.status === 'notfound' ? '#e53935' : '#e0e0e0'}`, fontFamily: 'Urbanist', fontSize: '14px', boxSizing: 'border-box' }}
              />
              {emailLookup.status === 'checking' && (
                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '4px 0 0', fontFamily: 'Urbanist' }}>Checking...</p>
              )}
              {emailLookup.status === 'found' && (
                <p style={{ fontSize: '12px', color: '#4caf50', margin: '4px 0 0', fontFamily: 'Urbanist' }}>✓ Found: {emailLookup.name}</p>
              )}
              {emailLookup.status === 'notfound' && (
                <p style={{ fontSize: '12px', color: '#e53935', margin: '4px 0 0', fontFamily: 'Urbanist' }}>✗ No therapist found with this email</p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '13px', color: '#333', display: 'block', marginBottom: '12px' }}>
                What to transfer?
              </label>
              <p style={{ fontFamily: 'Urbanist', fontSize: '12px', color: '#9CA3AF', margin: '0 0 12px 0' }}>
                Client profile is always transferred. Select additional data below.
              </p>

              {[
                { key: 'notes', label: 'Session Notes', desc: 'All session notes for this client', disabled: false },
                { key: 'activities', label: 'Activity Suggestions', desc: 'All activity suggestions for this client', disabled: false },
              ].map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', cursor: opt.disabled ? 'not-allowed' : 'pointer', opacity: opt.disabled ? 0.45 : 1 }}>
                  <input
                    type="checkbox"
                    disabled={opt.disabled}
                    checked={transferOptions[opt.key as keyof typeof transferOptions]}
                    onChange={e => setTransferOptions(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                    style={{ marginTop: '3px', accentColor: '#082421', width: '16px', height: '16px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>
                      {opt.label}
                      {opt.disabled && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#f1f3f4', color: '#9CA3AF', padding: '2px 6px', borderRadius: '4px' }}>Coming soon</span>}
                    </div>
                    <div style={{ fontFamily: 'Urbanist', fontSize: '12px', color: '#9CA3AF' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowTransferModal(false); setTransferEmail(''); setEmailLookup({ status: 'idle' }); }} disabled={transferring}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', color: '#333', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleTransferClient} disabled={transferring}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: transferring ? 'not-allowed' : 'pointer', opacity: transferring ? 0.7 : 1 }}>
                {transferring ? 'Sending Request...' : 'Send Transfer Request'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Create Booking Modal */}
      {showCreateBookingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setShowCreateBookingModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCreateBookingModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666', zIndex: 1 }}>×</button>
            <CreateBooking
              onBack={() => { setShowCreateBookingModal(false); setRefreshTrigger(prev => prev + 1); }}
              prefillClient={{ name: editData.name, email: editData.email, phone: editData.phone }}
            />
          </div>
        </div>
      )}

      {/* Activity Delete Confirmation Modal */}
      {activityToDelete !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setActivityToDelete(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px', fontFamily: 'Urbanist' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 700, color: '#1a1a1a' }}>Delete Activity?</h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6E6E6E', lineHeight: 1.6 }}>
              This activity suggestion will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setActivityToDelete(null)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleDeleteActivity(activityToDelete)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#e53935', color: '#fff', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Transfer Confirmation Modal */}
      {showCancelTransferModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setShowCancelTransferModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '420px', fontFamily: 'Urbanist' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e65100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#082421' }}>Cancel Transfer?</h3>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#555', lineHeight: 1.6 }}>
              Are you sure you want to cancel the pending transfer request for <strong>{client.name}</strong>?
            </p>
            <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#9CA3AF' }}>
              The receiving therapist and the client will be notified via email and dashboard notification.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCancelTransferModal(false)}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
                Keep Transfer
              </button>
              <button onClick={handleCancelTransfer}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#e65100', color: '#fff', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                Yes, Cancel Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal action dropdown for booking rows */}
      {openActionMenu !== null && menuPos && (() => {
        const appt = appointments.find(a => a.id === openActionMenu);
        if (!appt) return null;
        const isPast = new Date(appt.start_time) < new Date();
        const isScheduled = appt.status === 'scheduled';
        const menuItemStyle: React.CSSProperties = {
          display: 'block', width: '100%', padding: '10px 16px', border: 'none',
          background: 'none', textAlign: 'left', fontFamily: 'Urbanist', fontWeight: 500,
          fontSize: '13px', color: '#082421', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
        };
        return createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'absolute', top: menuPos.top, right: menuPos.right,
              background: '#fff', border: '1px solid #e9ecef', borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999,
              minWidth: '180px', overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Send Reminder — only for upcoming scheduled sessions */}
            {isScheduled && !isPast && (
              <button style={menuItemStyle} onClick={() => { sendReminder(appt.id); setOpenActionMenu(null); setMenuPos(null); }}>
                Send Reminder
              </button>
            )}
            {/* Reschedule — only for upcoming scheduled sessions */}
            {isScheduled && !isPast && (
              <button style={menuItemStyle} onClick={() => { setRescheduleAppt(appt); setRescheduleDate(new Date().toISOString().split('T')[0]); setRescheduleSlot(null); setOpenActionMenu(null); setMenuPos(null); }}>
                Reschedule
              </button>
            )}
            {/* Mark as Complete — past scheduled or any non-completed/non-cancelled */}
            {appt.status !== 'completed' && (
              <button style={{ ...menuItemStyle, color: '#1565c0' }} onClick={() => { handleUpdateBookingStatus(appt.id, 'completed'); setOpenActionMenu(null); setMenuPos(null); }}>
                Mark as Completed
              </button>
            )}
            {/* Mark No Show — past sessions */}
            {isScheduled && isPast && (
              <button style={{ ...menuItemStyle, color: '#e65100' }} onClick={() => { setConfirmModal({ id: appt.id, action: 'noshow' }); setOpenActionMenu(null); setMenuPos(null); }}>
                Mark as No Show
              </button>
            )}
            {/* Cancel */}
            {isScheduled && (
              <button style={{ ...menuItemStyle, color: '#c62828', borderBottom: 'none' }} onClick={() => { setConfirmModal({ id: appt.id, action: 'cancel' }); setOpenActionMenu(null); setMenuPos(null); }}>
                Cancel Booking
              </button>
            )}
          </div>,
          document.body
        );
      })()}

      {/* Reschedule Modal */}
      {rescheduleAppt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}
          onClick={() => setRescheduleAppt(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '760px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: 'Urbanist', fontWeight: 700, fontSize: '20px' }}>Reschedule Session</h2>
                <p style={{ margin: '4px 0 0', fontFamily: 'Urbanist', fontSize: '14px', color: '#6E6E6E' }}>{rescheduleAppt.title} — {client.name}</p>
              </div>
              <button onClick={() => setRescheduleAppt(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <InlineCalendar selectedDate={rescheduleDate} onDateSelect={setRescheduleDate} />
              <TimeSlotList
                calendarId={rescheduleAppt.calendar_id}
                selectedDate={rescheduleDate}
                selectedSlot={rescheduleSlot}
                onSlotSelect={setRescheduleSlot}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setRescheduleAppt(null)}
                style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', fontFamily: 'Urbanist', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleReschedule} disabled={!rescheduleSlot || rescheduling}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#082421', fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#fff', cursor: (!rescheduleSlot || rescheduling) ? 'not-allowed' : 'pointer', opacity: (!rescheduleSlot || rescheduling) ? 0.6 : 1 }}>
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal for Cancel / No Show */}
      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.action === 'noshow' ? 'Mark as No Show' : 'Cancel Booking'}
        message={
          confirmModal?.action === 'noshow'
            ? 'Mark this session as a no show? The client did not attend.'
            : 'Are you sure you want to cancel this booking? This action cannot be undone.'
        }
        confirmLabel={confirmModal?.action === 'noshow' ? 'Yes, Mark No Show' : 'Yes, Cancel Booking'}
        cancelLabel={confirmModal?.action === 'noshow' ? 'Go Back' : 'Keep Booking'}
        danger
        onConfirm={() => {
          if (confirmModal) {
            handleUpdateBookingStatus(confirmModal.id, confirmModal.action === 'noshow' ? 'noshow' : 'cancelled');
            setConfirmModal(null);
          }
        }}
        onCancel={() => setConfirmModal(null)}
      />

    </div>
  );
};

export default ClientView;