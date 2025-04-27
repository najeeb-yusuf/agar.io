// Game state
let currentPlayer = null
let gameInterval = null
let timeLeft = 180 // 3 minutes in seconds
const colors = ['blue', 'red', 'green', 'purple']

// Food constants
const FOOD_SIZE = 10 // Doubled from 5 to 10
const FOOD_VALUE = 5
const FOOD_OVERLAP_THRESHOLD = 10 // Reduced from 30 to 10 for tighter collision
const FOOD_GENERATION_INTERVAL = 30000 // 30 seconds
const FOOD_PER_PLAYER = 8
const MAX_FOOD_ITEMS = 10 // Reduced further
let foodGenerationInterval = null

// DOM elements
const joinScreen = document.getElementById('joinScreen')
const gameScreen = document.getElementById('gameScreen')
const playerNameInput = document.getElementById('playerName')
const joinButton = document.getElementById('joinButton')
const playerCount = document.getElementById('playerCount')
const gamePlayerCount = document.getElementById('gamePlayerCount')
const timer = document.getElementById('timer')
const gameArea = document.getElementById('gameArea')

// Initialize Firebase
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Initialize game
function initGame() {
    console.log('Initializing game...')
    
    // Listen for player updates
    const playersRef = database.ref('players');
    playersRef.on('value', (snapshot) => {
        updatePlayerCount();
        updateCursors();
    });

    // Start food updates
    updateFood();
}

// Join game
async function joinGame() {
    const name = playerNameInput.value.trim()
    if (!name) {
        alert('Please enter your name')
        return
    }

    const color = colors[Math.floor(Math.random() * colors.length)]
    currentPlayer = { 
        name, 
        color, 
        x: 0, 
        y: 0,
        last_active: Date.now()
    };

    // Check if name exists
    const playerRef = database.ref(`players/${name}`);
    playerRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            alert('Name already taken');
            return;
        }
        
        // Add player to Firebase
        playerRef.set(currentPlayer);
        
        joinScreen.classList.add('hidden')
        gameScreen.classList.remove('hidden')
        startGame()
    });
}

// Update player count
async function updatePlayerCount() {
    const playersRef = database.ref('players');
    playersRef.once('value', (snapshot) => {
        const players = snapshot.val() || {};
        const count = Object.keys(players).length;
        playerCount.textContent = count;
        gamePlayerCount.textContent = count;
    });
}

// Update cursors
async function updateCursors() {
    const playersRef = database.ref('players');
    playersRef.once('value', (snapshot) => {
        const players = snapshot.val() || {};

        // Remove old cursors
        const oldCursors = document.querySelectorAll('.cursor-container')
        oldCursors.forEach(cursor => cursor.remove())

        // Add new cursors
        Object.entries(players).forEach(([name, player]) => {
            // Skip eaten players
            if (player.eaten) return;
            
            const cursorContainer = document.createElement('div')
            cursorContainer.className = 'cursor-container'
            cursorContainer.style.position = 'absolute'
            cursorContainer.style.left = `${player.x}px`
            cursorContainer.style.top = `${player.y}px`
            
            // Only set z-index if currentPlayer exists
            if (currentPlayer && currentPlayer.name === name) {
                cursorContainer.style.zIndex = '1000'
            } else {
                cursorContainer.style.zIndex = '1'
            }

            const cursor = document.createElement('div')
            cursor.className = 'cursor'
            cursor.setAttribute('data-color', player.color)
            
            // Set cursor size based on player size from database
            const size = player.size || 20
            cursor.style.width = `${size}px`
            cursor.style.height = `${size}px`

            const nameElement = document.createElement('div')
            nameElement.className = 'cursor-name'
            nameElement.textContent = `${name} (${size})`

            cursorContainer.appendChild(cursor)
            cursorContainer.appendChild(nameElement)
            gameArea.appendChild(cursorContainer)
        })
    });
}

// Handle cursor movement
gameArea.addEventListener('mousemove', (e) => {
    if (!currentPlayer) return

    const { clientX, clientY } = e
    
    // Update local player state
    currentPlayer.x = clientX;
    currentPlayer.y = clientY;
    currentPlayer.last_active = Date.now();
    
    // Update Firebase
    const playerRef = database.ref(`players/${currentPlayer.name}`);
    playerRef.set(currentPlayer);
});

// Start game timer
function startGame() {
    // Initialize timer display
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    gameInterval = setInterval(() => {
        timeLeft--
        const minutes = Math.floor(timeLeft / 60)
        const seconds = timeLeft % 60
        timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`

        if (timeLeft <= 0) {
            endGame()
        }
    }, 1000)

    // Start food generation
    startFoodGeneration();
    
    // Start collision checking more frequently
    setInterval(checkFoodCollisions, 50); // Check every 50ms instead of 100ms
    setInterval(checkPlayerCollisions, 50);
}

// End game
function endGame() {
    clearInterval(gameInterval)
    clearInterval(foodGenerationInterval)
    
    if (currentPlayer) {
        const playerRef = database.ref(`players/${currentPlayer.name}`);
        playerRef.update({ gameOver: true });
        
        // Show game over message
        alert('Game Over! You were eaten by another player.');
        
        // Remove player from game
        playerRef.remove();
    }

    // Clear all food
    const foodRef = database.ref('food');
    foodRef.remove();

    currentPlayer = null
    timeLeft = 180
    gameScreen.classList.add('hidden')
    joinScreen.classList.remove('hidden')
    playerNameInput.value = ''
}

// Generate food
function generateFood() {
    const playersRef = database.ref('players');
    const foodRef = database.ref('food');
    
    playersRef.once('value', (snapshot) => {
        const players = snapshot.val() || {};
        const playerCount = Object.keys(players).length;
        const totalFoodToGenerate = playerCount * FOOD_PER_PLAYER;
        
        // Check current food count
        foodRef.once('value', (foodSnapshot) => {
            const currentFood = foodSnapshot.val() || {};
            const currentFoodCount = Object.keys(currentFood).length;
            
            // Calculate how many new food items we can generate
            const availableSlots = MAX_FOOD_ITEMS - currentFoodCount;
            const foodToGenerate = Math.min(totalFoodToGenerate, availableSlots);
            
            if (foodToGenerate <= 0) return;
            
            // Generate food gradually
            let foodGenerated = 0;
            const foodGenerationRate = 1000; // Generate one food item per second
            
            const generateFoodItem = () => {
                if (foodGenerated >= foodToGenerate) return;
                
                const x = Math.random() * window.innerWidth;
                const y = Math.random() * window.innerHeight;
                
                // Use transaction to ensure atomic updates
                foodRef.transaction((currentFood) => {
                    if (!currentFood) currentFood = {};
                    
                    // Check if we've reached the limit during generation
                    if (Object.keys(currentFood).length >= MAX_FOOD_ITEMS) {
                        return currentFood; // Abort if limit reached
                    }
                    
                    const newFoodId = foodRef.push().key;
                    currentFood[newFoodId] = {
                        x,
                        y,
                        color: 'red', // Changed from yellow to red
                        value: FOOD_VALUE,
                        eaten: false,
                        timestamp: Date.now()
                    };
                    
                    return currentFood;
                });
                
                foodGenerated++;
                if (foodGenerated < foodToGenerate) {
                    setTimeout(generateFoodItem, foodGenerationRate);
                }
            };
            
            generateFoodItem();
        });
    });
}

// Clean up eaten food periodically
function cleanupEatenFood() {
    const foodRef = database.ref('food');
    foodRef.once('value', (snapshot) => {
        const food = snapshot.val() || {};
        const now = Date.now();
        const oneMinuteAgo = now - 60000; // Clean up food older than 1 minute
        
        Object.entries(food).forEach(([id, foodItem]) => {
            if (foodItem.eaten || foodItem.timestamp < oneMinuteAgo) {
                foodRef.child(id).remove();
            }
        });
    });
}

// Update food display
function updateFood() {
    const foodRef = database.ref('food');
    foodRef.on('value', (snapshot) => {
        const food = snapshot.val() || {};
        
        // Remove old food elements
        const oldFood = document.querySelectorAll('.food');
        oldFood.forEach(food => food.remove());
        
        // Add new food elements
        Object.entries(food).forEach(([id, foodItem]) => {
            if (foodItem.eaten) return;
            
            const foodElement = document.createElement('div');
            foodElement.className = 'food';
            foodElement.style.left = `${foodItem.x}px`;
            foodElement.style.top = `${foodItem.y}px`;
            foodElement.style.width = `${FOOD_SIZE}px`;
            foodElement.style.height = `${FOOD_SIZE}px`;
            foodElement.setAttribute('data-color', 'red');
            foodElement.setAttribute('data-id', id);
            
            gameArea.appendChild(foodElement);
        });
    });
}

// Check for food collisions
function checkFoodCollisions() {
    if (!currentPlayer) return;
    
    const foodRef = database.ref('food');
    foodRef.once('value', (snapshot) => {
        const food = snapshot.val() || {};
        
        Object.entries(food).forEach(([id, foodItem]) => {
            if (foodItem.eaten) return;
            
            // Get player and food positions
            const playerX = currentPlayer.x;
            const playerY = currentPlayer.y;
            const playerSize = currentPlayer.size || 20;
            
            // Simple rectangle collision check with tighter bounds
            const isColliding = 
                playerX < foodItem.x + FOOD_SIZE &&
                playerX + playerSize > foodItem.x &&
                playerY < foodItem.y + FOOD_SIZE &&
                playerY + playerSize > foodItem.y;
            
            if (isColliding) {
                console.log('Collision detected at:', {
                    player: { x: playerX, y: playerY, size: playerSize },
                    food: { x: foodItem.x, y: foodItem.y, size: FOOD_SIZE }
                });
                
                // Mark food as eaten immediately
                foodRef.child(id).update({ eaten: true });
                
                // Update player size
                const playerRef = database.ref(`players/${currentPlayer.name}`);
                const newSize = playerSize + FOOD_VALUE;
                
                // Update both Firebase and local player state immediately
                playerRef.update({ size: newSize });
                currentPlayer.size = newSize;
                
                // Animate food being eaten
                const foodElement = document.querySelector(`.food[data-id="${id}"]`);
                if (foodElement) {
                    foodElement.style.transition = 'all 0.2s ease'; // Faster animation
                    foodElement.style.transform = 'scale(0)';
                    foodElement.style.opacity = '0';
                    setTimeout(() => foodElement.remove(), 200); // Faster removal
                }
            }
        });
    });
}

// Check for player collisions
function checkPlayerCollisions() {
    if (!currentPlayer) return;
    
    const playersRef = database.ref('players');
    playersRef.once('value', (snapshot) => {
        const players = snapshot.val() || {};
        
        Object.entries(players).forEach(([name, otherPlayer]) => {
            // Skip self and already eaten players
            if (name === currentPlayer.name || otherPlayer.eaten) return;
            
            // Get player sizes
            const currentSize = currentPlayer.size || 20;
            const otherSize = otherPlayer.size || 20;
            
            // Calculate distance between players
            const dx = currentPlayer.x - otherPlayer.x;
            const dy = currentPlayer.y - otherPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if players overlap (using their sizes)
            const minDistance = (currentSize + otherSize) / 2;
            
            if (distance < minDistance) {
                // Determine who eats whom based on size
                if (currentSize > otherSize) {
                    // Current player eats other player
                    console.log(`🍽️ Player ${currentPlayer.name} ate ${name}!`);
                    
                    // Update current player size
                    const newSize = currentSize + otherSize;
                    currentPlayer.size = newSize;
                    
                    // Update in Firebase
                    const playerRef = database.ref(`players/${currentPlayer.name}`);
                    playerRef.update({ size: newSize });
                    
                    // Mark other player as eaten
                    const otherPlayerRef = database.ref(`players/${name}`);
                    otherPlayerRef.update({ 
                        eaten: true,
                        gameOver: true
                    });
                    
                    // Show game over for eaten player
                    if (name === currentPlayer.name) {
                        endGame();
                    }
                } else if (currentSize < otherSize) {
                    // Other player eats current player
                    console.log(`💀 Player ${name} ate ${currentPlayer.name}!`);
                    
                    // Mark current player as eaten
                    currentPlayer.eaten = true;
                    const playerRef = database.ref(`players/${currentPlayer.name}`);
                    playerRef.update({ 
                        eaten: true,
                        gameOver: true
                    });
                    
                    // End game for current player
                    endGame();
                }
            }
        });
    });
}

// Start food generation
function startFoodGeneration() {
    generateFood(); // Initial generation
    foodGenerationInterval = setInterval(generateFood, FOOD_GENERATION_INTERVAL);
    
    // Clean up eaten food every minute
    setInterval(cleanupEatenFood, 60000);
}

// Event listeners
joinButton.addEventListener('click', joinGame)
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame()
})

// Initialize game when page loads
initGame() 