import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const SUPABASE_URL = 'https://szagacvfzrelvfrdvmoa.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6YWdhY3ZmenJlbHZmcmR2bW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MjI0NjEsImV4cCI6MjA1OTA5ODQ2MX0.tapRXzOCOUBRxLuQsaOlYSQ5P_Lhknm0suAXDgij2C0'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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

// Initialize game
async function initGame() {
    console.log('Initializing game...')
    
    // Subscribe to player updates
    const { data: players, error } = await supabase
        .from('players')
        .select('*')

    if (error) {
        console.error('Error fetching initial players:', error)
        return
    }

    console.log('Initial players:', players)

    // Update UI with initial players
    updatePlayerCount(players)
    updateCursors(players)

    // Set up real-time subscription
    supabase
        .channel('players')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'players' 
            }, 
            async (payload) => {
                console.log('Received real-time update:', payload)
                
                // Get all players to update the UI
                const { data: allPlayers, error } = await supabase
                    .from('players')
                    .select('*')
                
                if (error) {
                    console.error('Error fetching players after update:', error)
                    return
                }

                console.log('All players after update:', allPlayers)
                updatePlayerCount(allPlayers)
                updateCursors(allPlayers)
            }
        )
        .subscribe()

    // Handle cursor movement
    gameArea.addEventListener('mousemove', (e) => {
        if (!currentPlayer) return

        const { clientX, clientY } = e
        console.log('Mouse moved:', { clientX, clientY })
        updatePlayerPosition(clientX, clientY)
    })

    // Set up interval to update cursors periodically at 20 FPS
    setInterval(async () => {
        const { data: allPlayers, error } = await supabase
            .from('players')
            .select('*')
        
        if (!error && allPlayers) {
            updateCursors(allPlayers)
        }
    }, 50) // Update every 50ms (20 FPS)
}

// Join game
async function joinGame() {
    const name = playerNameInput.value.trim()
    if (!name) {
        alert('Please enter your name')
        return
    }

    // Check if name already exists
    const { data: existingPlayers, error: checkError } = await supabase
        .from('players')
        .select('name')
        .eq('name', name)

    if (checkError) {
        console.error('Error checking name:', checkError)
        return
    }

    if (existingPlayers && existingPlayers.length > 0) {
        alert('This name is already taken. Please choose another name.')
        return
    }

    const color = colors[Math.floor(Math.random() * colors.length)]
    const { data, error } = await supabase
        .from('players')
        .insert([
            {
                name,
                color,
                x: 0,
                y: 0,
                last_active: new Date().toISOString()
            }
        ])
        .select()
        .single()

    if (error) {
        console.error('Error:', error)
        return
    }

    currentPlayer = data
    joinScreen.classList.add('hidden')
    gameScreen.classList.remove('hidden')
    startGame()
}

// Update player position
async function updatePlayerPosition(x, y) {
    if (!currentPlayer) return

    console.log('Updating position:', { x, y, playerId: currentPlayer.id })
    
    const { error } = await supabase
        .from('players')
        .update({
            x,
            y,
            last_active: new Date().toISOString()
        })
        .eq('id', currentPlayer.id)

    if (error) {
        console.error('Error updating position:', error)
    }
}

// Update player count
function updatePlayerCount(players) {
    // Count all players, not just active ones
    const allPlayers = players.filter(p => p.last_active)
    playerCount.textContent = allPlayers.length
    gamePlayerCount.textContent = allPlayers.length
}

// Update cursors
function updateCursors(players) {
    if (!Array.isArray(players)) {
        console.error('Players is not an array:', players)
        return
    }

    console.log('Updating cursors with players:', players)

    // Get all players, not just active ones
    const allPlayers = players.filter(p => p.last_active) // Only filter out players without last_active

    console.log('All players:', allPlayers)

    // Remove old cursors
    const oldCursors = document.querySelectorAll('.cursor-container')
    oldCursors.forEach(cursor => cursor.remove())

    // Add new cursors for all players, including current player
    allPlayers.forEach(player => {
        console.log('Creating cursor for player:', player)

        const cursorContainer = document.createElement('div')
        cursorContainer.className = 'cursor-container'
        cursorContainer.style.position = 'absolute'
        cursorContainer.style.left = `${player.x}px`
        cursorContainer.style.top = `${player.y}px`
        cursorContainer.style.zIndex = player.id === currentPlayer?.id ? '1000' : '1'

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
async function endGame() {
    clearInterval(gameInterval)
    
    // Remove current player
    if (currentPlayer) {
        await supabase
            .from('players')
            .delete()
            .eq('id', currentPlayer.id)
    }

    // Reset game state
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