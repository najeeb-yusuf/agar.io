import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configure Redis with error handling
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('error', (error) => {
    console.error('Redis connection error:', error);
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

app.use(cors());
app.use(express.static(__dirname));

// Store active players
const players = new Map();

// Add /players endpoint
app.get('/players', async (req, res) => {
    try {
        const allPlayers = await redis.hgetall('players');
        // Parse the JSON strings in the Redis hash
        const parsedPlayers = {};
        for (const [name, playerStr] of Object.entries(allPlayers || {})) {
            try {
                parsedPlayers[name] = JSON.parse(playerStr);
            } catch (e) {
                console.error(`Error parsing player ${name}:`, e);
            }
        }
        res.json(parsedPlayers);
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle player joining
    socket.on('join', async (playerData) => {
        const { name, color } = playerData;
        
        try {
            // Check if name exists
            const existingPlayer = await redis.hget('players', name);
            if (existingPlayer) {
                socket.emit('error', 'Name already taken');
                return;
            }

            // Add player to Redis
            const player = {
                id: socket.id,
                name,
                color,
                x: 0,
                y: 0,
                last_active: Date.now()
            };

            await redis.hset('players', name, JSON.stringify(player));
            players.set(socket.id, player);

            // Broadcast to all clients
            io.emit('playerJoined', player);
        } catch (error) {
            console.error('Error in join handler:', error);
            socket.emit('error', 'Failed to join game');
        }
    });

    // Handle player movement
    socket.on('move', async (position) => {
        const player = players.get(socket.id);
        if (!player) return;

        try {
            player.x = position.x;
            player.y = position.y;
            player.last_active = Date.now();

            await redis.hset('players', player.name, JSON.stringify(player));
            io.emit('playerMoved', { id: socket.id, ...position });
        } catch (error) {
            console.error('Error in move handler:', error);
        }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        const player = players.get(socket.id);
        if (player) {
            try {
                await redis.hdel('players', player.name);
                players.delete(socket.id);
                io.emit('playerLeft', socket.id);
            } catch (error) {
                console.error('Error in disconnect handler:', error);
            }
        }
    });
});

// Cleanup inactive players every 10 seconds
setInterval(async () => {
    try {
        const allPlayers = await redis.hgetall('players');
        const now = Date.now();
        const inactiveThreshold = 30000; // 30 seconds

        for (const [name, playerStr] of Object.entries(allPlayers || {})) {
            try {
                const player = JSON.parse(playerStr);
                if (now - player.last_active > inactiveThreshold) {
                    await redis.hdel('players', name);
                    players.delete(player.id);
                    io.emit('playerLeft', player.id);
                }
            } catch (e) {
                console.error(`Error processing player ${name} in cleanup:`, e);
            }
        }
    } catch (error) {
        console.error('Error in cleanup interval:', error);
    }
}, 10000);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 