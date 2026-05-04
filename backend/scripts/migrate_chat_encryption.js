/**
 * Migration: Encrypt existing plaintext chat messages
 *
 * Run once after deploying the chat encryption changes:
 *   node backend/scripts/migrate_chat_encryption.js
 *
 * Safe to re-run — already-encrypted rows are detected and skipped.
 */

import '../config/env.js';
import pool from '../config/database.js';
import { encryptSensitiveData } from '../lib/encryption.js';

// AES-256-GCM encrypted hex strings are always longer than 64 chars
// (16-byte IV + 16-byte tag + ciphertext, all hex = min 64 chars for empty string)
// Plaintext messages are typically much shorter or don't match this pattern.
// We detect already-encrypted rows by checking if content looks like a hex string of the right length.
function looksEncrypted(content) {
  // IV (32 hex) + tag (32 hex) + at least some ciphertext = min 64 hex chars
  return typeof content === 'string' && content.length >= 64 && /^[0-9a-f]+$/i.test(content);
}

async function migrate() {
  console.log('🔐 Starting chat message encryption migration...\n');

  // Fetch all conversations grouped by user so we can use per-user keys
  const convsResult = await pool.query(
    'SELECT id, user_id FROM chat_conversations ORDER BY id'
  );

  let total = 0;
  let encrypted = 0;
  let skipped = 0;
  let errors = 0;

  for (const conv of convsResult.rows) {
    const { id: convId, user_id: userId } = conv;

    const msgResult = await pool.query(
      'SELECT id, content FROM chat_messages WHERE conversation_id = $1',
      [convId]
    );

    for (const msg of msgResult.rows) {
      total++;

      if (looksEncrypted(msg.content)) {
        skipped++;
        continue;
      }

      try {
        const encryptedContent = encryptSensitiveData(msg.content, userId);
        await pool.query(
          'UPDATE chat_messages SET content = $1 WHERE id = $2',
          [encryptedContent, msg.id]
        );
        encrypted++;
      } catch (err) {
        console.error(`  ❌ Failed to encrypt message id=${msg.id}:`, err.message);
        errors++;
      }
    }
  }

  console.log(`\n✅ Migration complete`);
  console.log(`   Total messages : ${total}`);
  console.log(`   Encrypted now  : ${encrypted}`);
  console.log(`   Already done   : ${skipped}`);
  console.log(`   Errors         : ${errors}`);

  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
