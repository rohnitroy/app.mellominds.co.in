import { google } from 'googleapis';
import pool from '../config/database.js';

/**
 * Returns a configured, token-refreshed OAuth2 client for a given therapist.
 * - If the stored access_token is expired (or within 5 min of expiry), it
 *   uses the refresh_token to get a new one and persists it to the DB.
 * - If no Google integration exists, returns null.
 * - If refresh fails (e.g. user revoked access), deletes the stale record
 *   and returns null so callers can degrade gracefully.
 *
 * @param {number} userId - therapist's user ID
 * @returns {Promise<import('googleapis').Auth.OAuth2Client|null>}
 */
export async function getGoogleAuthClient(userId) {
    const result = await pool.query(
        "SELECT access_token, refresh_token, expiry_date FROM UserIntegrations WHERE user_id = $1 AND provider = 'google'",
        [userId]
    );

    if (result.rows.length === 0) return null;

    const { access_token, refresh_token, expiry_date } = result.rows[0];

    if (!refresh_token) {
        // No refresh token — can't recover, treat as disconnected
        console.warn(`[googleAuth] No refresh_token for user ${userId}. User must reconnect Google Calendar.`);
        return null;
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.CONNECT_CALENDAR_CALLBACK_URL || process.env.GOOGLE_CALLBACK_URL
    );

    oauth2Client.setCredentials({ access_token, refresh_token, expiry_date });

    // Check if token is expired or within 5 minutes of expiry
    const fiveMinMs = 5 * 60 * 1000;
    const isExpired = !expiry_date || Date.now() >= (Number(expiry_date) - fiveMinMs);

    if (isExpired) {
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();

            // Persist the new tokens back to DB
            await pool.query(
                `UPDATE UserIntegrations
                 SET access_token = $1,
                     expiry_date  = $2,
                     updated_at   = NOW()
                 WHERE user_id = $3 AND provider = 'google'`,
                [credentials.access_token, credentials.expiry_date, userId]
            );

            // Also update refresh_token if Google rotated it
            if (credentials.refresh_token) {
                await pool.query(
                    `UPDATE UserIntegrations SET refresh_token = $1 WHERE user_id = $2 AND provider = 'google'`,
                    [credentials.refresh_token, userId]
                );
            }

            oauth2Client.setCredentials(credentials);
            console.log(`[googleAuth] Token refreshed for user ${userId}`);
        } catch (err) {
            console.error(`[googleAuth] Token refresh failed for user ${userId}:`, err.message);

            // If refresh fails with invalid_grant, the user has revoked access.
            // Remove the stale record so the UI shows "disconnected".
            if (err.message?.includes('invalid_grant') || err.response?.data?.error === 'invalid_grant') {
                await pool.query(
                    "DELETE FROM UserIntegrations WHERE user_id = $1 AND provider = 'google'",
                    [userId]
                ).catch(() => {});
                console.warn(`[googleAuth] Removed stale Google integration for user ${userId} (invalid_grant).`);
            }

            return null;
        }
    }

    return oauth2Client;
}
