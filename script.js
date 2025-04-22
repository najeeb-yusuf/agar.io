// Game state
let currentPlayer = null
let gameInterval = null
let timeLeft = 180 // 3 minutes in seconds
const colors = ['blue', 'red', 'green', 'purple']

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
    apiKey: "AIzaSyA9XwCw3MtIJdgAO17rj1MO4MzV_Q5X7Vk",
    authDomain: "winsolquest.firebaseapp.com",
    projectId: "winsolquest",
    storageBucket: "winsolquest.appspot.com",
    messagingSenderId: "861549112332",
    appId: "1:861549112332:web:9a9cb8de59d69a4a7d8f73",
    databaseURL: "https://win-sol-quest-default-rtdb.europe-west1.firebasedatabase.app"
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
            const cursorContainer = document.createElement('div')
            cursorContainer.className = 'cursor-container'
            cursorContainer.style.position = 'absolute'
            cursorContainer.style.left = `${player.x}px`
            cursorContainer.style.top = `${player.y}px`
            cursorContainer.style.zIndex = player.name === currentPlayer.name ? '1000' : '1'

            const cursor = document.createElement('div')
            cursor.className = 'cursor'
            cursor.setAttribute('data-color', player.color)

            const nameElement = document.createElement('div')
            nameElement.className = 'cursor-name'
            nameElement.textContent = player.name

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
    const playerRef = database.ref(`players/${currentPlayer.name}`);
    playerRef.set({
        ...currentPlayer,
        x: clientX,
        y: clientY,
        last_active: Date.now()
    });
});

// Start game timer
function startGame() {
    gameInterval = setInterval(() => {
        timeLeft--
        const minutes = Math.floor(timeLeft / 60)
        const seconds = timeLeft % 60
        timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`

        if (timeLeft <= 0) {
            endGame()
        }
    }, 1000)
}

// End game
function endGame() {
    clearInterval(gameInterval)
    
    if (currentPlayer) {
        const playerRef = database.ref(`players/${currentPlayer.name}`);
        playerRef.remove();
    }

    currentPlayer = null
    timeLeft = 180
    gameScreen.classList.add('hidden')
    joinScreen.classList.remove('hidden')
    playerNameInput.value = ''
}

// Event listeners
joinButton.addEventListener('click', joinGame)
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame()
})

// Initialize game when page loads
initGame() 