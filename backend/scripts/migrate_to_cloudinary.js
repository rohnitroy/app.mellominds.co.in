import '../config/env.js';
import cloudinary from '../config/cloudinary.js';
import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateImagesToCloudinary() {
  console.log('🚀 Starting migration to Cloudinary...\n');

  try {
    // Get all users with local profile pictures
    const result = await pool.query(
      "SELECT id, user_name, profile_picture FROM Users WHERE profile_picture LIKE '/uploads/%'"
    );

    const users = result.rows;
    console.log(`📊 Found ${users.length} users with local images\n`);

    if (users.length === 0) {
      console.log('✅ No images to migrate!');
      process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        const localPath = path.join(__dirname, '..', user.profile_picture);
        
        if (!fs.existsSync(localPath)) {
          console.log(`⚠️  File not found for user ${user.user_name}: ${localPath}`);
          errorCount++;
          continue;
        }

        console.log(`📤 Uploading image for: ${user.user_name}`);

        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(localPath, {
          folder: 'mellominds/profile-pictures',
          public_id: `user_${user.id}_${Date.now()}`,
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });

        // Update database with Cloudinary URL
        await pool.query(
          'UPDATE Users SET profile_picture = $1 WHERE id = $2',
          [uploadResult.secure_url, user.id]
        );

        console.log(`✅ Migrated: ${user.user_name} -> ${uploadResult.secure_url}`);
        successCount++;

        // Optional: Delete local file after successful upload
        // fs.unlinkSync(localPath);

      } catch (error) {
        console.error(`❌ Error migrating user ${user.user_name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('='.repeat(50));

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateImagesToCloudinary();
