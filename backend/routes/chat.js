import express from 'express';
import rateLimit from 'express-rate-limit';
import { isAuthenticated } from '../middleware/auth.js';
import pool from '../config/database.js';
import { encryptSensitiveData, decryptSensitiveData } from '../lib/encryption.js';

const router = express.Router();

// Middleware to ensure user is on enterprise plan
const ensureEnterprise = (req, res, next) => {
  if (req.user?.plan_name === 'enterprise') {
    return next();
  }
  res.status(403).json({ error: 'AI Chatbot is available on Enterprise plan only. Please upgrade to access this feature.' });
};

// Dedicated rate limiter for the AI message endpoint — 30 messages per 15 min per user
const chatMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // Remove custom keyGenerator to use default IP-based limiting with proper IPv6 support
  message: (req, res) => {
    const resetTime = new Date(Date.now() + res.getHeader('RateLimit-Reset') * 1000);
    const minutesLeft = Math.ceil((resetTime - Date.now()) / (1000 * 60));
    return {
      error: 'Chat limit reached',
      message: `You've reached the limit of 30 messages per 15 minutes. Please wait ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} before sending more messages.`,
      resetTime: resetTime.toISOString(),
      minutesLeft
    };
  },
});

// Allowed keys for context_data — prevents arbitrary data being stored
const ALLOWED_CONTEXT_KEYS = ['page', 'section', 'clientId', 'calendarId', 'bookingId'];

function sanitizeContext(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const safe = {};
  for (const key of ALLOWED_CONTEXT_KEYS) {
    if (raw[key] !== undefined) {
      // Only allow string/number primitives, max 100 chars each
      const val = raw[key];
      if (typeof val === 'string') safe[key] = val.substring(0, 100);
      else if (typeof val === 'number' && isFinite(val)) safe[key] = val;
    }
  }
  return safe;
}

const SARVAM_API_URL = 'https://api.sarvam.ai/v1/chat/completions';
const SARVAM_MODEL = 'sarvam-m';

// System prompt that gives the AI full context about MelloMinds
const SYSTEM_PROMPT = `You are Mello, an AI assistant for MelloMinds — a therapy practice management platform.

Help therapists with:
- Platform navigation and features
- Workflow questions
- Troubleshooting
- Profile setup and completion

## Key Sections:
- **Dashboard**: Stats, upcoming bookings, quick actions
- **My Profile**: Complete profile with all required information (phone, DOB, gender, specialization, languages, location, address)
- **All Clients**: Manage client profiles, session history, client transfers
- **Bookings**: View/manage appointments, reschedule, payments, session notes
- **My Calendars**: Create booking services with unique links, set availability
- **My Settings**: Profile, integrations (Google Calendar, Cashfree, Razorpay), email preferences, templates
- **Notifications**: Real-time alerts for bookings, cancellations, payments
- **Therapists** (Enterprise): Manage team members, view analytics

## Profile Completion:
Users MUST complete their profile 100% before accessing features like Calendar Setup or Bookings. Required fields:
- Phone Number (10 digits)
- Date of Birth
- Gender (Female, Male, Other)
- Specialization (Counselling Therapist, Clinical Psychologist, Psychiatrist)
- Languages Spoken
- Country
- State
- City
- Pincode (6 digits - auto-fills city/state)
- Clinic Address

When profile is incomplete, a modal appears asking to complete it first.

## Common Tasks:
- **Complete Profile**: My Profile → Fill all required fields → Save Changes
- **New booking service**: My Calendars → New Calendar → configure → share link
- **Google Calendar**: My Settings → Integrations → Connect Google Calendar
- **Session notes**: Bookings → completed session → Add Notes
- **Add client**: All Clients → Add Client
- **Payments**: My Settings → Integrations → Cashfree/Razorpay → enable on calendar
- **Availability**: My Calendars → Select calendar → Availability tab → Set hours
- **Pincode lookup**: Enter 6-digit pincode in profile → auto-fills city and state

## Enterprise Features:
- Multi-therapist organization management
- Team member invitations with email
- Aggregated analytics and reporting
- Organization billing details (GST, company info)
- Client transfer between therapists
- Dashboard customization

## AI Chatbot Features:
- Encrypted message storage for privacy
- Rate limited (30 messages per 15 minutes)
- Conversation history maintained
- Quick action suggestions
- Context-aware responses

Be concise, practical, and use step-by-step instructions. Always mention profile completion requirement when relevant.`;


// Call Sarvam AI API
async function callSarvamAI(messages) {
  const apiKey = process.env.SARVAM_API_KEY;

  console.log('Calling Sarvam AI with API key:', apiKey ? 'Present' : 'Missing');

  if (!apiKey || apiKey === 'your_sarvam_api_key_here') {
    console.log('Using fallback response - no API key');
    // Fallback to built-in responses if no API key configured
    return getFallbackResponse(messages[messages.length - 1]?.content || '');
  }

  try {
    const response = await fetch(SARVAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model: SARVAM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 0.4,
        max_tokens: 1500, // Increased from 800 to allow longer responses
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Sarvam AI error:', response.status, errText);
      return getFallbackResponse(messages[messages.length - 1]?.content || '');
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;
    const raw = choice?.content || choice?.reasoning_content || '';

    // Log for debugging incomplete responses
    console.log('Sarvam AI raw response:', { raw: raw.substring(0, 200) + '...', length: raw.length });
    
    if (!raw || raw.length < 10) {
      console.warn('Sarvam AI returned short/empty response:', { raw, choice, data });
    }

    // Strip internal <think>...</think> reasoning blocks — keep only the final answer
    const answer = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    console.log('Processed answer:', { answer: answer.substring(0, 200) + '...', length: answer.length });
    
    // If answer is too short, log the issue and use fallback
    if (!answer || answer.length < 10) {
      console.warn('Processed answer too short, using fallback:', { answer, raw: raw.substring(0, 100) });
      return getFallbackResponse(messages[messages.length - 1]?.content || '');
    }
    
    return answer;
  } catch (error) {
    console.error('Error calling Sarvam AI:', error.message);
    console.error('Full error details:', error);
    return getFallbackResponse(messages[messages.length - 1]?.content || '');
  }
}

// Built-in fallback responses when no API key is set
function getFallbackResponse(message) {
  const lower = message.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return "Hi! I'm Mello, your MelloMinds assistant. I can help you navigate the platform, complete your profile, understand features, and troubleshoot issues. What would you like to know?";
  }
  if (lower.includes('profile') && (lower.includes('complete') || lower.includes('setup') || lower.includes('required'))) {
    return "To complete your profile:\n1. Go to **My Profile** in the sidebar\n2. Fill in all required fields:\n   - Phone Number (10 digits)\n   - Date of Birth\n   - Gender\n   - Specialization\n   - Languages Spoken\n   - Country, State, City\n   - Pincode (6 digits - auto-fills city/state)\n   - Clinic Address\n3. Click **Save Changes**\n\n**Note:** Profile must be 100% complete to access Calendar Setup and Bookings.";
  }
  if (lower.includes('booking') && (lower.includes('create') || lower.includes('new') || lower.includes('how'))) {
    return "To create a booking service:\n1. Go to **My Calendars** in the sidebar\n2. Click **New Calendar**\n3. Fill in the service name, duration, and description\n4. Set your pricing and availability\n5. Save and your booking link is ready to share\n\n**Note:** Your profile must be complete first.";
  }
  if (lower.includes('client') && (lower.includes('add') || lower.includes('new'))) {
    return "To add a client manually:\n1. Go to **All Clients** in the sidebar\n2. Click **Add Client** at the top right\n3. Fill in their details\n4. Optionally send them a booking link right away\n\nClients are also added automatically when they book through your booking link.";
  }
  if (lower.includes('google calendar') || lower.includes('google meet') || lower.includes('sync')) {
    return "To connect Google Calendar:\n1. Go to **My Settings** in the left sidebar\n2. Click **Integrations**\n3. Find Google Calendar and click **Connect Google Calendar**\n4. Sign in with your Google account and grant calendar permissions\n5. Once connected, your appointments will sync automatically\n6. Google Meet links will be created for each session\n\n**Tip:** Ensure your Google Calendar has available slots matching your MelloMinds availability settings.";
  }
  if (lower.includes('payment') || lower.includes('cashfree') || lower.includes('razorpay')) {
    return "To set up payments:\n1. Go to **My Settings** then **Integrations**\n2. Choose **Cashfree** or **Razorpay**\n3. Add your API credentials\n4. Set the environment to **Production**\n5. Enable payments on any calendar service under **My Calendars**\n\nClients can then pay directly through your booking link.";
  }
  if (lower.includes('note') || lower.includes('session note')) {
    return "To write session notes:\n1. Go to **Bookings**\n2. Find the completed session\n3. Click the actions menu and select **Add Notes**\n\nYou can also create a custom note template in **My Settings** under **Client Notes Template**.";
  }
  if (lower.includes('availability') || lower.includes('schedule') || lower.includes('working hours')) {
    return "To set your availability:\n1. Go to **My Calendars**\n2. Select a calendar service\n3. Open the **Availability** tab\n4. Toggle days on or off and set your working hours\n\nThis controls when clients can book appointments with you.";
  }
  if (lower.includes('notification')) {
    return "Notifications appear in the bell icon at the top right and on the **Notifications** page. You get alerts for:\n- New bookings\n- Cancellations and reschedules\n- Payment updates\n- Client transfer requests\n- Session reminders\n\nEmail notification preferences can be configured in **My Settings**.";
  }
  if (lower.includes('pincode') || lower.includes('auto-fill') || lower.includes('city') || lower.includes('state')) {
    return "Pincode auto-fill feature:\n1. In your profile, enter a valid 6-digit Indian pincode\n2. The system automatically fetches and fills:\n   - City (District)\n   - State\n3. You can still edit these fields manually if needed\n\nThis saves time when completing your profile.";
  }
  if (lower.includes('enterprise') || lower.includes('team') || lower.includes('therapist')) {
    return "Enterprise features include:\n- **Team Management**: Invite therapists to your organization\n- **Analytics**: View aggregated stats across all team members\n- **Organization Details**: Add company info, GST, billing address\n- **Client Transfers**: Move clients between therapists\n- **Dashboard Customization**: Choose which widgets to display\n\nContact support to upgrade to Enterprise plan.";
  }
  if (lower.includes('help') || lower.includes('what can you do')) {
    return "I can help you with:\n- Completing your profile\n- Creating and managing bookings\n- Managing clients\n- Setting up payments\n- Session notes and templates\n- Google Calendar integration\n- Platform settings and features\n- Notifications and preferences\n- Enterprise team management\n\nJust ask me anything about MelloMinds!";
  }

  return "I'm here to help with MelloMinds. You can ask me about completing your profile, navigating the platform, setting up bookings, managing clients, payments, integrations, or session notes. What do you need?";
}

// GET /api/chat/conversation — get or create active conversation
router.get('/conversation', isAuthenticated, ensureEnterprise, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create a conversation for this user
    let result = await pool.query(
      'SELECT * FROM chat_conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Create new conversation
      result = await pool.query(
        'INSERT INTO chat_conversations (user_id, title) VALUES ($1, $2) RETURNING *',
        [userId, 'New Conversation']
      );
    } else {
      // Update last activity
      await pool.query(
        'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [result.rows[0].id]
      );
    }

    const conversation = result.rows[0];

    const messages = await pool.query(
      'SELECT id, conversation_id, message_type, content, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 50',
      [conversation.id]
    );

    // Decrypt message content before sending to client
    const decryptedMessages = messages.rows.map(msg => {
      try {
        return { ...msg, content: decryptSensitiveData(msg.content, userId) ?? msg.content };
      } catch {
        // If decryption fails the message was stored as plaintext (legacy row) — return as-is
        return msg;
      }
    });

    res.json({ conversation, messages: decryptedMessages });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// POST /api/chat/message — send a message and get AI response
router.post('/message', isAuthenticated, ensureEnterprise, chatMessageLimiter, async (req, res) => {
  const requestId = Date.now();
  console.log(`\n=== CHAT REQUEST ${requestId} ===`);
  
  try {
    const userId = req.user.id;
    const { message, conversationId, context } = req.body;
    
    console.log(`[${requestId}] User ID: ${userId}`);
    console.log(`[${requestId}] Message: "${message}"`);
    console.log(`[${requestId}] Conversation ID: ${conversationId}`);

    if (!message || !message.trim()) {
      console.log(`[${requestId}] ❌ Empty message`);
      return res.status(400).json({ error: 'Message is required' });
    }

    // Sanitize input
    const sanitizedMessage = message.trim().substring(0, 1000);
    console.log(`[${requestId}] Sanitized message length: ${sanitizedMessage.length}`);

    // Validate and sanitize context — only allow known safe keys
    const safeContext = sanitizeContext(context);

    let conversation;

    if (conversationId) {
      const existing = await pool.query(
        'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId]
      );
      if (existing.rows.length === 0) {
        console.log(`[${requestId}] ❌ Conversation not found`);
        return res.status(404).json({ error: 'Conversation not found' });
      }
      conversation = existing.rows[0];
      console.log(`[${requestId}] Using existing conversation: ${conversation.id}`);
    } else {
      const newConv = await pool.query(
        'INSERT INTO chat_conversations (user_id, title) VALUES ($1, $2) RETURNING *',
        ['New Conversation', userId]
      );
      conversation = newConv.rows[0];
      console.log(`[${requestId}] Created new conversation: ${conversation.id}`);
    }

    // Encrypt and save user message
    console.log(`[${requestId}] Encrypting user message...`);
    const encryptedUserMessage = encryptSensitiveData(sanitizedMessage, userId);
    console.log(`[${requestId}] Encrypted length: ${encryptedUserMessage.length}`);
    
    await pool.query(
      'INSERT INTO chat_messages (conversation_id, message_type, content) VALUES ($1, $2, $3)',
      [conversation.id, 'user', encryptedUserMessage]
    );
    console.log(`[${requestId}] User message saved to DB`);

    // Get last 10 messages for context (decrypt for AI)
    const historyResult = await pool.query(
      'SELECT message_type, content FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
      [conversation.id]
    );

    // Build messages array for Sarvam AI (oldest first, exclude the message we just saved)
    const history = historyResult.rows.reverse();
    const aiMessages = history
      .slice(0, -1) // exclude the user message we just added (it's the last one)
      .map(m => {
        let content = m.content;
        try { content = decryptSensitiveData(m.content, userId) ?? m.content; } catch { /* legacy plaintext */ }
        return { role: m.message_type === 'user' ? 'user' : 'assistant', content };
      });

    // Add current user message (plaintext for AI)
    aiMessages.push({ role: 'user', content: sanitizedMessage });
    console.log(`[${requestId}] AI messages array length: ${aiMessages.length}`);

    // Get AI response
    console.log(`[${requestId}] Calling Sarvam AI...`);
    const aiText = await callSarvamAI(aiMessages);
    console.log(`[${requestId}] AI response length: ${aiText.length}`);
    console.log(`[${requestId}] AI response preview: "${aiText.substring(0, 100)}..."`);

    // Encrypt and save AI response
    console.log(`[${requestId}] Encrypting AI response...`);
    const encryptedAiText = encryptSensitiveData(aiText, userId);
    console.log(`[${requestId}] AI encrypted length: ${encryptedAiText.length}`);
    
    const aiMessage = await pool.query(
      'INSERT INTO chat_messages (conversation_id, message_type, content) VALUES ($1, $2, $3) RETURNING id, conversation_id, message_type, content, created_at',
      [conversation.id, 'assistant', encryptedAiText]
    );
    console.log(`[${requestId}] AI message saved to DB with ID: ${aiMessage.rows[0].id}`);

    // Update conversation last activity
    await pool.query(
      'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversation.id]
    );

    // Return decrypted AI message to client
    const responseMessage = { ...aiMessage.rows[0], content: aiText };
    console.log(`[${requestId}] ✅ Sending response to client, content length: ${responseMessage.content.length}`);
    
    res.json({ conversation, message: responseMessage });
  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/chat/conversations — list all conversations for user
router.get('/conversations', isAuthenticated, ensureEnterprise, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT c.*, COUNT(m.id) as message_count
       FROM chat_conversations c
       LEFT JOIN chat_messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.updated_at DESC
       LIMIT 20`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// DELETE /api/chat/conversation/:id
router.delete('/conversation/:id', isAuthenticated, ensureEnterprise, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id);

    if (isNaN(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Delete all messages in this conversation first
    await pool.query(
      'DELETE FROM chat_messages WHERE conversation_id = $1',
      [conversationId]
    );

    // Then delete the conversation
    const result = await pool.query(
      'DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2 RETURNING *',
      [conversationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
