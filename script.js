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

// Socket.io connection
const socket = io();

// Initialize game
function initGame() {
    console.log('Initializing game...')
    
    // Handle player updates
    socket.on('playerJoined', (player) => {
        updatePlayerCount();
        updateCursors();
    });

    socket.on('playerMoved', (data) => {
        updateCursors();
    });

    socket.on('playerLeft', (playerId) => {
        updatePlayerCount();
        updateCursors();
    });

    socket.on('error', (message) => {
        alert(message);
    });

    // Handle cursor movement
    gameArea.addEventListener('mousemove', (e) => {
        if (!currentPlayer) return

        const { clientX, clientY } = e
        socket.emit('move', { x: clientX, y: clientY });
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
        y: 0 
    };

    socket.emit('join', { name, color });
    
    joinScreen.classList.add('hidden')
    gameScreen.classList.remove('hidden')
    startGame()
}

// Update player count
async function updatePlayerCount() {
    const response = await fetch('/players');
    const players = await response.json();
    const count = Object.keys(players).length;
    playerCount.textContent = count;
    gamePlayerCount.textContent = count;
}

// Update cursors
async function updateCursors() {
    const response = await fetch('/players');
    const players = await response.json();

    // Remove old cursors
    const oldCursors = document.querySelectorAll('.cursor-container')
    oldCursors.forEach(cursor => cursor.remove())

    // Add new cursors
    Object.values(players).forEach(player => {
        const cursorContainer = document.createElement('div')
        cursorContainer.className = 'cursor-container'
        cursorContainer.style.position = 'absolute'
        cursorContainer.style.left = `${player.x}px`
        cursorContainer.style.top = `${player.y}px`
        cursorContainer.style.zIndex = player.id === socket.id ? '1000' : '1'

        const cursor = document.createElement('div')
        cursor.className = 'cursor'
        cursor.setAttribute('data-color', player.color)

        const name = document.createElement('div')
        name.className = 'cursor-name'
        name.textContent = player.name

        cursorContainer.appendChild(cursor)
        cursorContainer.appendChild(name)
        gameArea.appendChild(cursorContainer)
    })
}

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
        socket.emit('leave');
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