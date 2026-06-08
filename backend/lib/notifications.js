import pool from '../config/database.js';

// User notifications (for in-app use)
export const createNotification = async (notificationData) => {
  try {
    const { userId, type, title, message = '', messageParams = {} } = notificationData;

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, message_params, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, type, title, message, JSON.stringify(messageParams)]
    );
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

// Admin notifications table
export const initializeNotificationsTable = async () => {
  try {
    await pool.query(`DROP TABLE IF EXISTS admin_notifications`);

    await pool.query(`
      CREATE TABLE admin_notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        user_id UUID,
        user_name VARCHAR(255),
        metadata JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_notif_created ON admin_notifications(created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_notif_type ON admin_notifications(type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_notif_read ON admin_notifications(is_read)`);

    console.log('✅ Admin notifications schema verified');
  } catch (err) {
    console.error('❌ Notifications table error:', err.message);
    throw err;
  }
};

export const logNotification = async (type, title, message, userId, userName, metadata = {}) => {
  try {
    await pool.query(
      `INSERT INTO admin_notifications (type, title, message, user_id, user_name, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [type, title, message, userId, userName, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('Failed to log notification:', err);
  }
};
