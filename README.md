# Real-time Cursor Game

A simple multiplayer game where players can see each other's cursors move in real-time using Supabase for real-time updates.

## Features

- Real-time cursor tracking
- Player names display
- Neon glowing cursors with different colors
- 3-minute game timer
- Player count display
- Simple grid background

## Setup

1. Create a Supabase project at https://supabase.com
2. Create a new table called `players` with the following columns:
   - `id` (uuid, primary key)
   - `name` (text)
   - `color` (text)
   - `x` (float)
   - `y` (float)
   - `last_active` (timestamp with timezone)

3. Get your Supabase URL and anon key from your project settings
4. Update the `script.js` file with your Supabase credentials:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL'
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'
   ```

5. Open `index.html` in a web browser

## How to Play

1. Enter your name and click "Join Game"
2. Move your cursor around the screen
3. Watch other players' cursors move in real-time
4. The game ends after 3 minutes

## Technologies Used

- HTML5
- CSS3 (with TailwindCSS)
- JavaScript
- Supabase for real-time updates 