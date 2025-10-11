// Audio control functionality for the musical picture frame

// Get references to audio elements and buttons
const song1 = document.getElementById('song1');
const song2 = document.getElementById('song2');
const playButton = document.getElementById('playBtn');
const pauseButton = document.getElementById('pauseBtn');
const restartButton = document.getElementById('restartBtn');

// Play song1 only
playButton.addEventListener('click', () => {
    song1.play().catch(e => console.log('Song1 play error:', e));
    console.log('Playing song1.mp3');
});

// Pause song1
pauseButton.addEventListener('click', () => {
    song1.pause();
    console.log('Paused song1');
});

// Stop song1 (reset to beginning)
restartButton.addEventListener('click', () => {
    song1.pause();
    song1.currentTime = 0;
    console.log('Stopped and reset song1');
});

// Reset when song1 ends
song1.addEventListener('ended', () => {
    song1.currentTime = 0;
    console.log('Song1 ended and reset to beginning');
});

// Add pressed effect functionality for better visual feedback
function addPressedEffect(button) {
    button.classList.add('pressed');
    
    // Remove pressed class after short delay
    setTimeout(() => {
        button.classList.remove('pressed');
    }, 150);
}

// Add pressed effect to all buttons
[playButton, pauseButton, restartButton].forEach(button => {
    // Handle mouse events
    button.addEventListener('mousedown', () => addPressedEffect(button));
    
    // Handle touch events for mobile devices
    button.addEventListener('touchstart', () => addPressedEffect(button), { passive: true });
});