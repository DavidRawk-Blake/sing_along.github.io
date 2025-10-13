/**
 * Karaoke Controller - Shared functionality for karaoke games
 * Handles audio control, lyrics management, and user interactions
 */

// Global variables for audio elements and lyrics
let song, music;
let lyricsEngine;

// Audio MIME type constant (all songs are MP3)
const AUDIO_MIME_TYPE = 'audio/mpeg';

// Function to count and update recognition words display
function updateRecogniseCounter() {
    let recogniseCount = 0;
    
    // Count all words with recognise: true in the lyrics data
    if (window.lyricsData && window.lyricsData.sentences) {
        window.lyricsData.sentences.forEach(sentence => {
            sentence.words.forEach(word => {
                if (word.recognise === true) {
                    recogniseCount++;
                }
            });
        });
    }
    
    // Update the counter display
    const counterElement = document.getElementById('recogniseCounter');
    if (counterElement) {
        counterElement.textContent = `0/${recogniseCount}`;
    }
}

// Initialize the karaoke system when DOM is loaded
function initializeKaraoke() {
    // Get references to audio elements
    song = document.getElementById('song');
    music = document.getElementById('music');

    // Initialize lyrics engine (data is now hardcoded, so this always succeeds)
    lyricsEngine = new LyricsEngine();
    
    // Set audio sources directly from lyrics data (no loading needed)
    if (lyricsEngine.lyricsData.song_source) {
        song.src = lyricsEngine.lyricsData.song_source;
        song.type = AUDIO_MIME_TYPE;
        console.log(`Song source set to: ${song.src} (${AUDIO_MIME_TYPE})`);
    }
    
    if (lyricsEngine.lyricsData.music_source) {
        music.src = lyricsEngine.lyricsData.music_source;
        music.type = AUDIO_MIME_TYPE;
        console.log(`Music source set to: ${music.src} (${AUDIO_MIME_TYPE})`);
    }
    
    // Initialize with DOM elements after data is loaded
    lyricsEngine.initialize({
        sentenceDisplay: document.getElementById('sentenceDisplay'),
        progressFill: document.getElementById('progressFill'),
        audioPlayer: music, // Use music as primary for timing (source of truth)
        timestampDisplay: document.getElementById('timestampDisplay'),
        songAudio: song,
        musicAudio: music
    });

    // Update recognition counter display
    updateRecogniseCounter();

    // Handle audio ending events
    song.addEventListener('ended', () => {
        console.log('Song ended (no reset - music is timing authority)');
    });
    
    music.addEventListener('ended', () => {
        // Music is timing authority - reset entire system when it ends
        lyricsEngine.stopAnimation(); // Reset lyrics engine state (handles all audio reset)
        console.log('Music ended - resetting entire karaoke system');
    });

    // Add audio loading state listeners for debugging
    song.addEventListener('loadstart', () => console.log('Loading song...'));
    song.addEventListener('canplay', () => console.log('Song ready to play'));
    song.addEventListener('error', (e) => console.error('Error loading song:', e));

    music.addEventListener('loadstart', () => console.log('Loading music...'));
    music.addEventListener('canplay', () => console.log('Music ready to play'));
    music.addEventListener('error', (e) => console.error('Error loading music:', e));

    // Add pressed effect to buttons on mouse/touch events
    const buttons = [document.getElementById('playBtn'), document.getElementById('pauseBtn'), document.getElementById('restartBtn')];
    buttons.forEach(button => {
        // Handle mouse events
        button.addEventListener('mousedown', () => addPressedEffect(button));
        // Handle touch events for mobile devices
        button.addEventListener('touchstart', () => addPressedEffect(button), { passive: true });
    });

    // Add keyboard support for rewind and skip functionality
    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault(); // Prevent browser default behavior
            rewindFiveSeconds();
            addPressedEffect(document.getElementById('restartBtn')); // Visual feedback
            console.log('Left arrow key pressed - rewinding 5 seconds');
        } else if (event.key === 'ArrowRight') {
            event.preventDefault(); // Prevent browser default behavior
            skipForwardFiveSeconds();
            addPressedEffect(document.getElementById('playBtn')); // Visual feedback on play button
            console.log('Right arrow key pressed - skipping forward 5 seconds');
        } else if (event.code === 'Space') {
            event.preventDefault(); // Prevent page scroll
            togglePlayPause();
            console.log('Spacebar pressed - toggling play/pause');
        }
    });

    console.log('Audio controls initialized after DOM loaded');
}

// Start lyrics display
function startLyrics() {
    lyricsEngine.startAnimation(() => stopLyrics());
}

// Pause lyrics display
function pauseLyrics() {
    lyricsEngine.pauseAnimation();
}

// Stop and reset lyrics display
function stopLyrics() {
    lyricsEngine.stopAnimation();
}

// Rewind function for 5-second back functionality
function rewindFiveSeconds() {
    console.log('Rewinding 5 seconds');
    
    // Pause both songs first
    lyricsEngine.pause();
    
    // Calculate new time (minimum 0 seconds)
    const newTime = Math.max(0, lyricsEngine.getCurrentTime() - 5);
    
    // Set both audio tracks to new time
    lyricsEngine.setCurrentTime(newTime);
    
    // Brief pause before resuming (smoother transition)
    setTimeout(() => {
        // Resume playback
        lyricsEngine.play();
    }, 100); // 100ms pause for smooth transition
}

// Skip forward function for 5-second ahead functionality
function skipForwardFiveSeconds() {
    console.log('Skipping forward 5 seconds');
    
    // Pause both songs first
    lyricsEngine.pause();
    
    // Calculate new time (with upper bounds checking)
    const maxTime = lyricsEngine.getDuration() || Infinity;
    const newTime = Math.min(maxTime, lyricsEngine.getCurrentTime() + 5);
    
    // Set both audio tracks to new time
    lyricsEngine.setCurrentTime(newTime);
    
    // Brief pause before resuming (smoother transition)
    setTimeout(() => {
        // Resume playback
        lyricsEngine.play();
    }, 100); // 100ms pause for smooth transition
}

// Global functions for onclick handlers
function playAction() {
    console.log('Playing both songs simultaneously with lyrics');
    lyricsEngine.play();
    addPressedEffect(document.getElementById('playBtn'));
}

function pauseAction() {
    console.log('Paused both songs and lyrics');
    lyricsEngine.pause();
    addPressedEffect(document.getElementById('pauseBtn'));
}

function togglePlayPause() {
    // Use engine's built-in toggle functionality
    lyricsEngine.togglePlayback();
    
    // Provide visual feedback on the appropriate button
    // Use engine's isPaused() function as source of truth for playback state
    if (lyricsEngine.isPaused()) {
        // Just paused, so highlight pause button
        addPressedEffect(document.getElementById('pauseBtn'));
    } else {
        // Just started playing, so highlight play button
        addPressedEffect(document.getElementById('playBtn'));
    }
}

function restartAction() {
    rewindFiveSeconds();
    addPressedEffect(document.getElementById('restartBtn'));
}

// Add pressed effect functionality for better visual feedback
function addPressedEffect(button) {
    button.classList.add('pressed');

    // Remove pressed class after short delay
    setTimeout(() => {
        button.classList.remove('pressed');
    }, 150);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeKaraoke);