# Demo Data Summary

This document provides an overview of the demo data populated in the P2P Music Platform database.

## Database Configuration

- **Database Name**: musicapp
- **User**: musicuser
- **Connection String**: `postgresql://musicuser:yourpassword@localhost:5432/musicapp`

## Demo Users

The following demo users have been created with the password `password123`:

| Username | Email | Badge | Trust Score | Can Upload | Artist Genres |
|----------|-------|-------|-------------|------------|---------------|
| alice_music | alice@example.com | Rising Artist | 150 | Yes | Lo-fi, Ambient, Electronic |
| bob_dj | bob@example.com | Verified Artist | 300 | Yes | House, Techno, EDM |
| charlie_vibes | charlie@example.com | Music Explorer | 75 | Yes | Jazz, Experimental, Fusion |
| diana_beats | diana@example.com | Beat Maker | 200 | Yes | Hip-hop, Rap, Trap |
| eva_melodies | eva@example.com | Newbie | 25 | Yes | Folk, Pop, Singer-Songwriter |

**Note**: The `superadmin` user also exists with credentials:
- Username: `superadmin`
- Email: `admin@platform.local`
- Badge: Platform Administrator

## Demo Tracks

8 demo tracks have been created across various genres:

| Title | Artist | Album | Genre | Duration | Year |
|-------|--------|-------|-------|----------|------|
| Midnight Dreams | alice_music | Late Night Sessions | Lo-fi | 4:05 | 2024 |
| Summer House Party | bob_dj | Beach Vibes | House | 6:18 | 2024 |
| Jazz Fusion Experiment | charlie_vibes | Improvisations | Jazz | 9:27 | 2023 |
| Urban Streets | diana_beats | City Life | Hip-hop | 3:18 | 2024 |
| Acoustic Sunrise | eva_melodies | Morning Songs | Folk | 4:27 | 2024 |
| Digital Rain | alice_music | Cyber Dreams | Electronic | 6:52 | 2024 |
| Techno Underground | bob_dj | Dark Nights | Techno | 8:09 | 2023 |
| Folk Tales | eva_melodies | Storyteller | Singer-Songwriter | 5:12 | 2024 |

## Social Interactions

### Follows
- **Total Follows**: 8
- Each user follows 1-3 other users, creating a social graph

### Likes
- **Total Likes**: 25
- Tracks have varying numbers of likes from different users

### Comments
- **Total Comments**: 23
- Each track has 1-4 comments with timestamps

## Music Preferences

- **Total Preferences**: 25
- Each user has 3-6 music preferences covering genres and moods
- Available preferences include:
  - **Genres**: Lo-fi, House, Techno, Jazz, Hip-hop, Folk, Electronic, Ambient, EDM, Experimental
  - **Moods**: Chill, Energetic, Focus, Party, Relaxing

## User Statistics

Each user has statistics populated for trust score calculation:

| User ID | Total Uploaded (bytes) | Upload Ratio |
|---------|------------------------|--------------|
| alice_music | 26,310,400 | ~2.06 |
| bob_dj | 34,715,200 | ~2.33 |
| charlie_vibes | 7,920,000 | ~2.09 |
| diana_beats | 26,310,400 | ~1.57 |
| eva_melodies | 23,160,000 | ~2.06 |

## IPFS Data

All tracks include mock IPFS data:
- **IPFS CID**: Mock CIDs in format `QmXyz123<name>`
- **IPFS Metadata CID**: Mock CIDs in format `QmMeta123<name>`
- **Cover Art URLs**: Using picsum.photos for placeholder images

## Running the Seed Script

To re-populate the database with demo data:

```bash
# Using npm script
npm run db:seed

# Or directly with node
DATABASE_URL="postgresql://musicuser:yourpassword@localhost:5432/musicapp" node scripts/seed.js
```

## Testing the Application

With the demo data populated, you can:

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Test API endpoints**:
   - `GET /api/tracks` - List all tracks
   - `GET /api/tracks?genre=Lo-fi` - Filter by genre
   - `GET /api/tracks?artist=alice_music` - Filter by artist

3. **Login with demo users**:
   - Use any of the demo user credentials
   - Password: `password123`

4. **Test social features**:
   - Follow/unfollow users
   - Like tracks
   - Comment on tracks

## Component Integration Verification

The demo data is designed to test integration across:

- **Authentication**: Login with demo users
- **Feed**: Display tracks with likes and comments
- **Player**: Play tracks with mock IPFS data
- **Social**: Follow relationships and interactions
- **Profile**: User profiles with badges and stats
- **Upload**: Upload permissions and quotas
- **Trust Score**: User statistics for trust calculation

## Notes

- All passwords are hashed using bcrypt
- All timestamps are set to current time
- The seed script clears existing demo data before inserting new data
- The superadmin user is preserved during re-seeding