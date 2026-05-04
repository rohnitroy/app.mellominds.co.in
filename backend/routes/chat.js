import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

const SARVAM_API_URL = 'https://api.sarvam.ai/v1/chat/completions';
const SARVAM_MODEL = 'sarvam-m';

// System prompt that gives the AI full context about MelloMinds
const SYSTEM_PROMPT = `You are Mello, a friendly and knowledgeable AI assistant built into the MelloMinds platform — a practice management tool for therapists and mental health professionals.

Your role is to help therapists:
1. Navigate the platform and find features
2. Understand how to use features effectively
3. Troubleshoot common issues
4. Get quick answers about their workflow

## Platform Overview
MelloMinds is a comprehensive therapy practice management platform with these main sections:

**Dashboard** — Overview of stats (revenue, sessions, clients), upcoming bookings, and quick actions.

**All Clients** — Manage client profiles. Add clients manually or they're auto-added when they book. View session history, assign activities, and transfer clients.

**Bookings** — View and manage all appointments. Filter by status (scheduled, completed, cancelled, no-show). Reschedule, cancel, send reminders, and mark payments.

**My Calendars** — Create booking service types (e.g., "50-min Individual Session"). Each calendar has a unique booking link. Configure duration, pricing, intake forms, locations, availability, and cancellation policies.

**Payments & Invoice** — Track revenue, payment status, and generate invoices. Integrates with Cashfree payment gateway.

**My Settings** — Configure profile, integrations (Google Calendar, Cashfree), note templates, reminders, and booking link.

**Notifications** — Real-time alerts for new bookings, cancellations, payments, and client transfers.

## Key Features
- **Booking Links**: Each calendar service has a public booking URL clients can use to self-schedule
- **Google Calendar Sync**: Connect Google Calendar to auto-create Meet links and sync appointments
- **Session Notes**: Write structured notes after sessions using custom templates
- **Client Activities**: Assign homework/activities to clients with automated email reminders
- **Client Transfers**: Transfer clients between therapists in an organization
- **Enterprise Plan**: Multi-therapist organizations with team management
- **Cashfree Payments**: Accept online payments for sessions

## Common How-Tos
- **Create a booking service**: My Calendars → "New Calendar" → fill details → save → share the booking link
- **Set availability**: My Calendars → select a calendar → Availability tab → set weekly schedule
- **Connect Google Calendar**: My Settings → Integrations → Connect Google Calendar
- **Write session notes**: Bookings → click a completed session → Add Notes
- **Add a client manually**: All Clients → "Add Client" button
- **Set up payments**: My Settings → Integrations → Cashfree → add API credentials → enable payment on a calendar
- **Create note template**: My Settings → Client Notes Template → customize fields
- **Send booking link to client**: All Clients → select client → Send Booking Link

## Tone & Style
- Be concise, warm, and practical
- Use bullet points for step-by-step instructions
- If unsure, suggest where in the platform to look
- Keep responses focused, don't over-explain
- Avoid em dashes, excessive punctuation, and emojis
- Write like a knowledgeable colleague, not a chatbot
- Use plain language, short sentences`;

// Call Sarvam AI API
async function callSarvamAI(messages) {
  const apiKey = process.env.SARVAM_API_KEY;

  if (!apiKey || apiKey === 'your_sarvam_api_key_here') {
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
        max_tokens: 800,
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

    // Strip internal <think>...</think> reasoning blocks — keep only the final answer
    const answer = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    return answer || getFallbackResponse('');
  } catch (error) {
    console.error('Error calling Sarvam AI:', error.message);
    return getFallbackResponse(messages[messages.length - 1]?.content || '');
  }
}

// Built-in fallback responses when no API key is set
function getFallbackResponse(message) {
  const lower = message.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return "Hi! I'm Mello, your MelloMinds assistant. I can help you navigate the platform, understand features, and troubleshoot issues. What would you like to know?";
  }
  if (lower.includes('booking') && (lower.includes('create') || lower.includes('new') || lower.includes('how'))) {
    return "To create a booking service:\n1. Go to **My Calendars** in the sidebar\n2. Click **New Calendar**\n3. Fill in the service name, duration, and description\n4. Set your pricing and availability\n5. Save and your booking link is ready to share.";
  }
  if (lower.includes('client') && (lower.includes('add') || lower.includes('new'))) {
    return "To add a client manually:\n1. Go to **All Clients** in the sidebar\n2. Click **Add Client** at the top right\n3. Fill in their details\n4. Optionally send them a booking link right away\n\nClients are also added automatically when they book through your booking link.";
  }
  if (lower.includes('google calendar') || lower.includes('google meet') || lower.includes('sync')) {
    return "To connect Google Calendar:\n1. Go to **My Settings** then **Integrations**\n2. Click **Connect Google Calendar**\n3. Sign in and grant calendar permissions\n\nOnce connected, appointments will sync automatically and Google Meet links will be created for each session.";
  }
  if (lower.includes('payment') || lower.includes('cashfree')) {
    return "To set up payments:\n1. Go to **My Settings** then **Integrations** then **Cashfree**\n2. Add your Cashfree App ID and Secret Key\n3. Set the environment to **Production**\n4. Enable payments on any calendar service under **My Calendars**";
  }
  if (lower.includes('note') || lower.includes('session note')) {
    return "To write session notes:\n1. Go to **Bookings**\n2. Find the completed session\n3. Click the actions menu and select **Add Notes**\n\nYou can also create a custom note template in **My Settings** under **Client Notes Template**.";
  }
  if (lower.includes('availability') || lower.includes('schedule') || lower.includes('working hours')) {
    return "To set your availability:\n1. Go to **My Calendars**\n2. Select a calendar service\n3. Open the **Availability** tab\n4. Toggle days on or off and set your working hours\n\nThis controls when clients can book appointments with you.";
  }
  if (lower.includes('notification')) {
    return "Notifications appear in the bell icon at the top right and on the **Notifications** page. You get alerts for new bookings, cancellations, reschedules, payment updates, and client transfer requests.\n\nEmail notification preferences can be configured in **My Settings**.";
  }
  if (lower.includes('help') || lower.includes('what can you do')) {
    return "I can help you with:\n- Creating and managing bookings\n- Managing clients\n- Setting up payments\n- Session notes and templates\n- Google Calendar integration\n- Platform settings\n- Notifications\n\nJust ask me anything about MelloMinds.";
  }

  return "I'm here to help with MelloMinds. You can ask me about navigating the platform, setting up bookings, managing clients, payments, integrations, or session notes. What do you need?";
}

// GET /api/chat/conversation — get or create active conversation
router.get('/conversation', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;

    let result = await pool.query(
      'SELECT * FROM chat_conversations WHERE user_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        'INSERT INTO chat_conversations (user_id, title) VALUES ($1, $2) RETURNING *',
        [userId, 'New Conversation']
      );
    }

    const conversation = result.rows[0];

    const messages = await pool.query(
      'SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 50',
      [conversation.id]
    );

    res.json({ conversation, messages: messages.rows });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// POST /api/chat/message — send a message and get AI response
router.post('/message', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, conversationId, context } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Sanitize input
    const sanitizedMessage = message.trim().substring(0, 1000);

    let conversation;

    if (conversationId) {
      const existing = await pool.query(
        'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      conversation = existing.rows[0];
    } else {
      const newConv = await pool.query(
        'INSERT INTO chat_conversations (user_id, title, context_data) VALUES ($1, $2, $3) RETURNING *',
        [userId, sanitizedMessage.substring(0, 60), JSON.stringify(context || {})]
      );
      conversation = newConv.rows[0];
    }

    // Save user message
    await pool.query(
      'INSERT INTO chat_messages (conversation_id, message_type, content) VALUES ($1, $2, $3)',
      [conversation.id, 'user', sanitizedMessage]
    );

    // Get last 10 messages for context
    const historyResult = await pool.query(
      'SELECT message_type, content FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
      [conversation.id]
    );

    // Build messages array for Sarvam AI (oldest first, exclude the message we just saved)
    const history = historyResult.rows.reverse();
    const aiMessages = history
      .slice(0, -1) // exclude the user message we just added (it's the last one)
      .map(m => ({ role: m.message_type === 'user' ? 'user' : 'assistant', content: m.content }));

    // Add current user message
    aiMessages.push({ role: 'user', content: sanitizedMessage });

    // Get AI response
    const aiText = await callSarvamAI(aiMessages);

    // Save AI response
    const aiMessage = await pool.query(
      'INSERT INTO chat_messages (conversation_id, message_type, content) VALUES ($1, $2, $3) RETURNING *',
      [conversation.id, 'assistant', aiText]
    );

    // Update conversation timestamp
    await pool.query(
      'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversation.id]
    );

    res.json({ conversation, message: aiMessage.rows[0] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/chat/conversations — list all conversations for user
router.get('/conversations', isAuthenticated, async (req, res) => {
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
router.delete('/conversation/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id);

    if (isNaN(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

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
