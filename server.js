import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, remove, serverTimestamp } from 'firebase/database';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA9XwCw3MtIJdgAO17rj1MO4MzV_Q5X7Vk",
    authDomain: "winsolquest.firebaseapp.com",
    projectId: "winsolquest",
    storageBucket: "winsolquest.appspot.com",
    messagingSenderId: "861549112332",
    appId: "1:861549112332:web:9a9cb8de59d69a4a7d8f73",
    databaseURL: "https://winsolquest-default-rtdb.firebaseio.com"
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

app.use(cors());
app.use(express.static(__dirname));

// Add /players endpoint
app.get('/players', async (req, res) => {
    try {
        const playersRef = ref(database, 'players');
        onValue(playersRef, (snapshot) => {
            const data = snapshot.val();
            res.json(data || {});
        }, {
            onlyOnce: true
        });
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
});

// Cleanup inactive players every 10 seconds
setInterval(async () => {
    try {
        const playersRef = ref(database, 'players');
        onValue(playersRef, (snapshot) => {
            const players = snapshot.val() || {};
            const now = Date.now();
            const inactiveThreshold = 30000; // 30 seconds

            Object.entries(players).forEach(([name, player]) => {
                if (now - player.last_active > inactiveThreshold) {
                    remove(ref(database, `players/${name}`));
                }
            });
        }, {
            onlyOnce: true
        });
    } catch (error) {
        console.error('Error in cleanup interval:', error);
    }
}, 10000);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 