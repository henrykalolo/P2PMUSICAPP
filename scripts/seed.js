const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Demo data
const demoUsers = [
  {
    username: 'alice_music',
    email: 'alice@example.com',
    password: 'password123',
    artist_bio: 'Indie artist creating lo-fi beats and ambient sounds',
    artist_genres: ['Lo-fi', 'Ambient', 'Electronic'],
    badge: 'Rising Artist',
    trust_score: 150,
    can_upload: true,
    onboarding_completed: true
  },
  {
    username: 'bob_dj',
    email: 'bob@example.com',
    password: 'password123',
    artist_bio: 'DJ and producer specializing in house and techno',
    artist_genres: ['House', 'Techno', 'EDM'],
    badge: 'Verified Artist',
    trust_score: 300,
    can_upload: true,
    onboarding_completed: true,
    artist_verified: true
  },
  {
    username: 'charlie_vibes',
    email: 'charlie@example.com',
    password: 'password123',
    artist_bio: 'Jazz enthusiast and experimental musician',
    artist_genres: ['Jazz', 'Experimental', 'Fusion'],
    badge: 'Music Explorer',
    trust_score: 75,
    can_upload: true,
    onboarding_completed: true
  },
  {
    username: 'diana_beats',
    email: 'diana@example.com',
    password: 'password123',
    artist_bio: 'Hip-hop producer and rapper',
    artist_genres: ['Hip-hop', 'Rap', 'Trap'],
    badge: 'Beat Maker',
    trust_score: 200,
    can_upload: true,
    onboarding_completed: true
  },
  {
    username: 'eva_melodies',
    email: 'eva@example.com',
    password: 'password123',
    artist_bio: 'Singer-songwriter crafting folk and pop melodies',
    artist_genres: ['Folk', 'Pop', 'Singer-Songwriter'],
    badge: 'Newbie',
    trust_score: 25,
    can_upload: true,
    onboarding_completed: true
  }
];

const demoTracks = [
  {
    title: 'Midnight Dreams',
    artist: 'alice_music',
    album: 'Late Night Sessions',
    genre: 'Lo-fi',
    year: 2024,
    duration_seconds: 245,
    bitrate: 320,
    file_size: 9830400,
    mime_type: 'audio/mpeg',
    ipfs_cid: 'QmXyz123midnight',
    ipfs_metadata_cid: 'QmMeta123midnight',
    cover_art_url: 'https://picsum.photos/seed/midnight/300/300.jpg'
  },
  {
    title: 'Summer House Party',
    artist: 'bob_dj',
    album: 'Beach Vibes',
    genre: 'House',
    year: 2024,
    duration_seconds: 378,
    bitrate: 320,
    file_size: 15155200,
    mime_type: 'audio/mpeg',
    ipfs_cid: 'QmXyz123summer',
    ipfs_metadata_cid: 'QmMeta123summer',
    cover_art_url: 'https://picsum.photos/seed/summer/300/300.jpg'
  },
  {
    title: 'Jazz Fusion Experiment',
    artist: 'charlie_vibes',
    album: 'Improvisations',
    genre: 'Jazz',
    year: 2023,
    duration_seconds: 567,
    bitrate: 256,
    file_size: 22680000,
    mime_type: 'audio/mpeg',
    ipfs_cid: 'QmXyz123jazz',
    ipfs_metadata_cid: 'QmMeta123jazz',
    cover_art_url: 'https://picsum.photos/seed/jazz/300/300.jpg'
  },
  {
    title: 'Urban Streets',
    artist: 'diana_beats',
    album: 'City Life',
    genre: 'Hip-hop',
    year: 2024,
    duration_seconds: 198,
    bitrate: 320,
    file_size: 7920000,
    mime_type: 'audio/mpeg',
    ipfs_cid: 'QmXyz123urban',
    ipfs_metadata_cid: 'QmMeta123urban',
    cover_art_url: 'https://picsum.photos/seed/urban/300/300.jpg'
  },
  {
    title: 'Acoustic Sunrise',
    artist: 'eva_melodies',
    album: 'Morning Songs',
    genre: 'Folk',
    year: 2024,
    duration_seconds: 267,
    bitrate: 256,
    file_size: 10680000,
    mime_type: 'audio/mpeg',
    ipfs_cid: 'QmXyz123acoustic',
    ipfs_metadata_cid: 'QmMeta123acoustic',
    cover_art_url: 'https://picsum.photos/seed/acoustic/300/300.jpg'
  },
  {
    title: 'Digital Rain',
    artist: 'alice_music',
    album: 'Cyber Dreams',
    genre: 'Electronic',
    year: 2024,
    duration_seconds: 412,
    bitrate: 320,
    file_size: 16480000,
    mime_type: 'audio/mpeg',
    ipfs_cid: 'QmXyz123digital',
    ipfs_metadata_cid: 'QmMeta123digital',
    cover_art_url: 'https://picsum.photos/seed/digital/300/300.jpg'
  },
  {
    title: 'Techno Underground',
    artist: 'bob_dj',
    album: 'Dark Nights',
    genre: 'Techno',
    year: 2023,
    duration_seconds: 489,
    bitrate: 320,
    file_size: 19560000,
    mime_type: 'audio/mpeg',
    ipfs_cid: 'QmXyz123techno',
    ipfs_metadata_cid: 'QmMeta123techno',
    cover_art_url: 'https://picsum.photos/seed/techno/300/300.jpg'
  },
  {
    title: 'Folk Tales',
    artist: 'eva_melodies',
    album: 'Storyteller',
    genre: 'Singer-Songwriter',
    year: 2024,
    duration_seconds: 312,
    bitrate: 256,
    file_size: 12480000,
    mime_type: 'audio/mpeg',
    ipfs_cid: 'QmXyz123folk',
    ipfs_metadata_cid: 'QmMeta123folk',
    cover_art_url: 'https://picsum.photos/seed/folk/300/300.jpg'
  }
];

const demoComments = [
  { content: 'This track is amazing! Love the vibes 🎵', timestamp_seconds: 30 },
  { content: 'Great production quality! What DAW did you use?', timestamp_seconds: 120 },
  { content: 'This reminds me of summer days. Perfect mood!', timestamp_seconds: 180 },
  { content: 'The bassline is incredible 🔥', timestamp_seconds: 60 },
  { content: 'Can\'t stop listening to this on repeat', timestamp_seconds: 240 },
  { content: 'Masterpiece! Would love to collaborate', timestamp_seconds: 90 },
  { content: 'The mixing is professional level', timestamp_seconds: 150 },
  { content: 'This deserves way more plays!', timestamp_seconds: 200 }
];

const musicPreferences = [
  { type: 'genre', value: 'Lo-fi' },
  { type: 'genre', value: 'House' },
  { type: 'genre', value: 'Techno' },
  { type: 'genre', value: 'Jazz' },
  { type: 'genre', value: 'Hip-hop' },
  { type: 'genre', value: 'Folk' },
  { type: 'genre', value: 'Electronic' },
  { type: 'genre', value: 'Ambient' },
  { type: 'genre', value: 'EDM' },
  { type: 'genre', value: 'Experimental' },
  { type: 'mood', value: 'Chill' },
  { type: 'mood', value: 'Energetic' },
  { type: 'mood', value: 'Focus' },
  { type: 'mood', value: 'Party' },
  { type: 'mood', value: 'Relaxing' }
];

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    // Clear existing demo data (except superadmin)
    await pool.query('DELETE FROM comments');
    await pool.query('DELETE FROM likes');
    await pool.query('DELETE FROM follows');
    await pool.query('DELETE FROM music_preferences');
    await pool.query('DELETE FROM posts');
    await pool.query('DELETE FROM user_stats');
    await pool.query('DELETE FROM users WHERE username != \'superadmin\'');
    
    console.log('Cleared existing demo data');
    
    // Insert demo users
    const insertedUsers = [];
    for (const user of demoUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const result = await pool.query(`
        INSERT INTO users (
          username, email, password, artist_bio, artist_genres, badge,
          trust_score, can_upload, onboarding_completed, artist_verified,
          music_preferences_selected, users_followed_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        user.username, user.email, hashedPassword, user.artist_bio,
        user.artist_genres, user.badge, user.trust_score, user.can_upload,
        user.onboarding_completed, user.artist_verified || false,
        Math.floor(Math.random() * 5) + 3, // 3-7 preferences selected
        Math.floor(Math.random() * 10) + 5 // 5-14 users followed
      ]);
      
      insertedUsers.push({ ...user, id: result.rows[0].id });
    }
    
    console.log(`Inserted ${insertedUsers.length} demo users`);
    
    // Insert music preferences for each user
    for (const user of insertedUsers) {
      const userPreferences = musicPreferences
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 4) + 3); // 3-6 preferences per user
      
      for (const pref of userPreferences) {
        await pool.query(`
          INSERT INTO music_preferences (user_id, preference_type, preference_value)
          VALUES ($1, $2, $3)
        `, [user.id, pref.type, pref.value]);
      }
    }
    
    console.log('Inserted music preferences');
    
    // Insert demo tracks
    const insertedTracks = [];
    for (const track of demoTracks) {
      const author = insertedUsers.find(u => u.username === track.artist);
      const result = await pool.query(`
        INSERT INTO posts (
          author_id, title, artist, album, genre, year, duration_seconds,
          bitrate, file_size, mime_type, ipfs_cid, ipfs_metadata_cid,
          cover_art_url, storage_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `, [
        author.id, track.title, track.artist, track.album, track.genre,
        track.year, track.duration_seconds, track.bitrate, track.file_size,
        track.mime_type, track.ipfs_cid, track.ipfs_metadata_cid,
        track.cover_art_url, track.storage_type || 'ipfs'
      ]);
      
      insertedTracks.push({ ...track, id: result.rows[0].id });
    }
    
    console.log(`Inserted ${insertedTracks.length} demo tracks`);
    
    // Create follows between users
    for (let i = 0; i < insertedUsers.length; i++) {
      const follower = insertedUsers[i];
      const numFollows = Math.floor(Math.random() * 3) + 1; // 1-3 follows per user
      
      for (let j = 0; j < numFollows; j++) {
        const followingIndex = (i + j + 1) % insertedUsers.length;
        if (followingIndex !== i) {
          await pool.query(`
            INSERT INTO follows (follower_id, following_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [follower.id, insertedUsers[followingIndex].id]);
        }
      }
    }
    
    console.log('Created follow relationships');
    
    // Add likes to tracks
    for (const track of insertedTracks) {
      const numLikes = Math.floor(Math.random() * insertedUsers.length) + 1;
      const likers = insertedUsers.sort(() => Math.random() - 0.5).slice(0, numLikes);
      
      for (const liker of likers) {
        await pool.query(`
          INSERT INTO likes (user_id, post_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [liker.id, track.id]);
      }
    }
    
    console.log('Added likes to tracks');
    
    // Add comments to tracks
    for (const track of insertedTracks) {
      const numComments = Math.floor(Math.random() * 4) + 1; // 1-4 comments per track
      const commenters = insertedUsers.sort(() => Math.random() - 0.5).slice(0, numComments);
      const shuffledComments = demoComments.sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < numComments && i < commenters.length; i++) {
        const comment = shuffledComments[i % shuffledComments.length];
        await pool.query(`
          INSERT INTO comments (post_id, user_id, content, timestamp_seconds)
          VALUES ($1, $2, $3, $4)
        `, [track.id, commenters[i].id, comment.content, comment.timestamp_seconds]);
      }
    }
    
    console.log('Added comments to tracks');
    
    // Update user stats
    for (const user of insertedUsers) {
      const userTracks = insertedTracks.filter(t => t.artist === user.username);
      const totalUploaded = userTracks.reduce((sum, track) => sum + track.file_size, 0);
      
      await pool.query(`
        INSERT INTO user_stats (
          user_id, total_uploaded, total_downloaded, upload_ratio,
          session_count, total_session_duration, avg_session_duration,
          successful_verifications, total_verifications, hash_verification_rate,
          mutual_connections
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        user.id,
        totalUploaded,
        Math.floor(Math.random() * 50000000), // Random downloaded amount
        1.5 + Math.random(), // Upload ratio between 1.5-2.5
        Math.floor(Math.random() * 50) + 10, // 10-60 sessions
        Math.floor(Math.random() * 10000) + 2000, // Session duration
        200 + Math.floor(Math.random() * 100), // Avg session duration
        Math.floor(Math.random() * 100) + 50, // Successful verifications
        Math.floor(Math.random() * 20) + 5, // Total verifications
        0.8 + Math.random() * 0.2, // Verification rate
        Math.floor(Math.random() * 20) + 5 // Mutual connections
      ]);
    }
    
    console.log('Updated user stats');
    
    // Update users_followed_count in users table
    for (const user of insertedUsers) {
      const followCount = await pool.query(
        'SELECT COUNT(*) FROM follows WHERE follower_id = $1',
        [user.id]
      );
      
      await pool.query(
        'UPDATE users SET users_followed_count = $1 WHERE id = $2',
        [parseInt(followCount.rows[0].count), user.id]
      );
    }
    
    console.log('Database seeding completed successfully!');
    console.log('\nDemo users created:');
    insertedUsers.forEach(user => {
      console.log(`- ${user.username} (${user.email}) - Password: password123`);
    });
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase();
