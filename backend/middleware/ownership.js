/**
 * Ownership verification middleware
 * Ensures users can only access their own data
 */

import pool from '../config/database.js';

// Verify client ownership
export const verifyClientOwnership = async (req, res, next) => {
  try {
    const clientId = req.params.id || req.params.clientId || req.body.client_id;
    const userId = req.user.id;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }
    
    const result = await pool.query(
      'SELECT id FROM Clients WHERE id = $1 AND therapist_id = $2',
      [clientId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Client not found or access denied' });
    }
    
    req.verifiedClientId = clientId;
    next();
  } catch (error) {
    console.error('Client ownership verification error:', error);
    res.status(500).json({ error: 'Ownership verification failed' });
  }
};

// Verify appointment ownership
export const verifyAppointmentOwnership = async (req, res, next) => {
  try {
    const appointmentId = req.params.id || req.params.appointmentId || req.body.appointment_id;
    const userId = req.user.id;
    
    if (!appointmentId) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }
    
    const result = await pool.query(
      'SELECT id FROM Appointments WHERE id = $1 AND therapist_id = $2',
      [appointmentId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Appointment not found or access denied' });
    }
    
    req.verifiedAppointmentId = appointmentId;
    next();
  } catch (error) {
    console.error('Appointment ownership verification error:', error);
    res.status(500).json({ error: 'Ownership verification failed' });
  }
};

// Verify calendar ownership
export const verifyCalendarOwnership = async (req, res, next) => {
  try {
    const calendarId = req.params.id || req.params.calendarId || req.body.calendar_id;
    const userId = req.user.id;
    
    if (!calendarId) {
      return res.status(400).json({ error: 'Calendar ID is required' });
    }
    
    const result = await pool.query(
      'SELECT id FROM Calendars WHERE id = $1 AND user_id = $2',
      [calendarId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Calendar not found or access denied' });
    }
    
    req.verifiedCalendarId = calendarId;
    next();
  } catch (error) {
    console.error('Calendar ownership verification error:', error);
    res.status(500).json({ error: 'Ownership verification failed' });
  }
};

// Verify organization membership (for org features)
export const verifyOrgAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Check if user is an owner or member
    const result = await pool.query(`
      SELECT org_role, org_owner_id FROM Users WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    req.userOrgRole = user.org_role;
    req.userOrgOwnerId = user.org_owner_id;
    
    next();
  } catch (error) {
    console.error('Organization access verification error:', error);
    res.status(500).json({ error: 'Organization access verification failed' });
  }
};