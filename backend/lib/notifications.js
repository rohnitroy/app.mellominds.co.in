import pool from '../config/database.js';

/**
 * Create a notification for a user.
 * @param {object} opts - { userId, type, title, description, relatedId }
 */
export async function createNotification({ userId, type, title, description = null, relatedId = null }) {
    try {
        await pool.query(
            `INSERT INTO Notifications (user_id, type, title, description, related_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, type, title, description, relatedId]
        );
    } catch (err) {
        // Non-fatal — log but don't crash the request
        console.error('Failed to create notification:', err.message);
    }
}
