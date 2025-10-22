/**
 * Karaoke Controller - Shared functionality for karaoke games
 * Handles audio control, lyrics management, and user interactions
 */

// Global variables for audio elements and lyrics
let song, music;
let lyricsEngine;

// Audio MIME type constant (all songs are MP3)
const AUDIO_MIME_TYPE = 'audio/mpeg';

// Speech recognition integration
let isSpeechRecognitionEnabled = false;
let isMicrophoneActive = false;

// Function to update target words display (now handled by lyrics engine)
function updateTargetWordCounter() {
    // The lyrics engine now handles the counter update with matched words
    if (lyricsEngine && typeof lyricsEngine.updateTargetWordCounter === 'function') {
        lyricsEngine.updateTargetWordCounter();
    } else {
        // Fallback to old behavior if lyrics engine not available
        let targetWordCount = 0;
        
        if (window.lyricsData && window.lyricsData.sentences) {
            window.lyricsData.sentences.forEach(sentence => {
                sentence.words.forEach(word => {
                    if (word.target_word === true) {
                        targetWordCount++;
                    }
                });
            });
        }
        
        const counterElement = document.getElementById('targetWordCounter');
        if (counterElement) {
            counterElement.textContent = `0/${targetWordCount}`;
        }
    }
}

// Initialize sentence images in the image container
function initializeSentenceImages() {
    const imageContainer = document.getElementById('imageContainer');
    if (!imageContainer || !window.lyricsData || !window.lyricsData.sentences) {
        return;
    }

    // Clear existing images
    imageContainer.innerHTML = '';

    // Create an image element for each sentence that has an image
    window.lyricsData.sentences.forEach((sentence, index) => {
        if (sentence.image) {
            const img = document.createElement('img');
            img.src = sentence.image;
            img.className = 'sentence-image';
            img.id = `sentence-image-${index}`;
            img.style.zIndex = index + 2; // Each image has higher z-index than the previous
            img.alt = `Image for sentence ${index + 1}`;
            
            // Start with opacity 0
            img.style.opacity = '0';
            
            imageContainer.appendChild(img);
        }
    });

    console.log(`Initialized ${imageContainer.children.length} sentence images`);
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
        musicAudio: music,
        imageContainer: document.getElementById('imageContainer')
    });

    // Initialize sentence images
    initializeSentenceImages();

    // Initialize target word tracking
    if (lyricsEngine && typeof lyricsEngine.initializeTargetWords === 'function') {
        lyricsEngine.initializeTargetWords();
    }

    // Initialize debug table
    initializeDebugTable();

    // Update recognition counter display
    updateTargetWordCounter();

    // Handle audio ending events - stop playback when either audio track ends
    song.addEventListener('ended', () => {
        console.log('Song ended - stopping playback');
        lyricsEngine.pause(); // Use engine's pause method to stop both audio sources
        lyricsEngine.pauseAnimation(); // Stop animation but preserve current time position
        updatePlayButtonAppearance();
        updateRestartButtonAppearance();
    });
    
    music.addEventListener('ended', () => {
        console.log('Music ended - stopping playback');
        lyricsEngine.pause(); // Use engine's pause method to stop both audio sources
        lyricsEngine.pauseAnimation(); // Stop animation but preserve current time position
        updatePlayButtonAppearance();
        updateRestartButtonAppearance();
    });

    // Add audio loading state listeners for debugging
    song.addEventListener('loadstart', () => console.log('Loading song...'));
    song.addEventListener('canplay', () => console.log('Song ready to play'));
    song.addEventListener('error', (e) => console.error('Error loading song:', e));

    music.addEventListener('loadstart', () => console.log('Loading music...'));
    music.addEventListener('canplay', () => console.log('Music ready to play'));
    music.addEventListener('error', (e) => console.error('Error loading music:', e));

    // Add pressed effect to buttons on mouse/touch events
    const buttons = [document.getElementById('playBtn'), document.getElementById('restartBtn')];
    buttons.forEach(button => {
        if (button) { // Check if button exists before adding event listeners
            // Handle mouse events
            button.addEventListener('mousedown', () => addPressedEffect(button));
            // Handle touch events for mobile devices
            button.addEventListener('touchstart', () => addPressedEffect(button), { passive: true });
        }
    });

    // Add keyboard support for spacebar only
    document.addEventListener('keydown', (event) => {
        if (lyricsEngine && event.code === 'Space') {
            event.preventDefault(); // Prevent page scroll
            togglePlayPause();
            console.log('Spacebar pressed - toggling play/pause');
        }
    });

    // Initialize button appearances
    updatePlayButtonAppearance();
    updateRestartButtonAppearance();

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
    if (!lyricsEngine) {
        console.error('LyricsEngine not initialized');
        return;
    }
    
    console.log('Rewinding 5 seconds');
    
    const wasPlaying = !lyricsEngine.isPaused();
    const newTime = Math.max(0, lyricsEngine.getCurrentTime() - 5);
    
    lyricsEngine.setCurrentTime(newTime);
    
    if (wasPlaying) {
        setTimeout(() => {
            lyricsEngine.play();
        }, 100); // 100ms pause for smooth transition
    } 
}

// Skip forward function for 5-second ahead functionality
function skipForwardFiveSeconds() {
    if (!lyricsEngine) {
        console.error('LyricsEngine not initialized');
        return;
    }
    
    console.log('Skipping forward 5 seconds');
    
    // Remember if we were playing before seeking
    const wasPlaying = !lyricsEngine.isPaused();
    
    const maxTime = lyricsEngine.getDuration() || Infinity;
    const newTime = Math.min(maxTime, lyricsEngine.getCurrentTime() + 5);
    
    lyricsEngine.setCurrentTime(newTime);
    if (wasPlaying) {
        setTimeout(() => {
            lyricsEngine.play();
        }, 100); // 100ms pause for smooth transition
    }
}

// Global functions for onclick handlers
function togglePlayPause() {
    console.log('Toggling playback');
    // Use engine's built-in toggle functionality
    lyricsEngine.togglePlayback();
    
    // Update button appearances and provide visual feedback
    updatePlayButtonAppearance();
    updateRestartButtonAppearance();
    addPressedEffect(document.getElementById('playBtn'));
}

function updatePlayButtonAppearance() {
    const playBtn = document.getElementById('playBtn');
    if (!playBtn) return; // Guard against missing button
    
    if (lyricsEngine.isPaused()) {
        // Show play state
        playBtn.classList.remove('playing');
        playBtn.innerHTML = '▶';
        playBtn.title = 'Play';
    } else {
        // Show playing/pause state
        playBtn.classList.add('playing');
        playBtn.innerHTML = '⏸';
        playBtn.title = 'Pause';
    }
}

function updateRestartButtonAppearance() {
    const restartBtn = document.getElementById('restartBtn');
    if (!restartBtn) return; // Guard against missing button
    
    if (lyricsEngine.isPaused()) {
        // Show reset functionality
        restartBtn.title = 'Reset to Beginning';
    } else {
        // Show rewind functionality
        restartBtn.title = 'Rewind 5 Seconds';
    }
}

function restartAction() {
    if (lyricsEngine.isPaused()) {
        // If paused, reset to beginning
        console.log('Resetting to beginning');
        lyricsEngine.reset(); // Encapsulated reset functionality
    } else {
        // If playing, rewind 5 seconds
        console.log('Rewinding 5 seconds');
        rewindFiveSeconds();
    }
    
    updateRestartButtonAppearance();
    addPressedEffect(document.getElementById('restartBtn'));
}

// Add pressed effect functionality for better visual feedback
function addPressedEffect(button) {
    if (!button) return; // Guard against null buttons
    
    button.classList.add('pressed');

    // Remove pressed class after short delay
    setTimeout(() => {
        if (button) { // Additional check in case button is removed from DOM
            button.classList.remove('pressed');
        }
    }, 150);
}

// Microphone functionality
let audioContext;
let mediaStream;
let analyser;
let microphone;
let dataArray;
let peakVolume = 0;

function initializeMicrophoneModal() {
    const permissionModal = document.getElementById('micPermissionModal');
    const volumeModal = document.getElementById('micVolumeModal');
    const enableBtn = document.getElementById('enableMicBtn');
    const skipBtn = document.getElementById('skipMicBtn');
    const cancelBtn = document.getElementById('cancelMicBtn');

    if (!permissionModal) return; // Not all pages have microphone functionality

    // Show permission modal on page load
    permissionModal.style.display = 'flex';

    // Enable microphone button - "Yes, Enable!"
    enableBtn?.addEventListener('click', async () => {
        try {
            await requestMicrophonePermission();
            // Mark microphone as active
            isMicrophoneActive = true;
            // Hide the permission modal
            permissionModal.style.display = 'none';
            // Show the volume monitoring modal
            volumeModal.style.display = 'flex';
            startVolumeMonitoring();
            // Enable speech recognition for target word detection
            enableSpeechRecognition();
        } catch (error) {
            console.error('Microphone access denied:', error);
            alert('Microphone access was denied. You can still enjoy karaoke without microphone feedback!');
            // Hide the permission modal even if access denied
            permissionModal.style.display = 'none';
        }
    });

    // Skip microphone button - "Skip for now"
    skipBtn?.addEventListener('click', () => {
        // Hide the permission modal
        permissionModal.style.display = 'none';
        // Do NOT show the volume modal (user skipped microphone setup)
        console.log('User skipped microphone setup');
    });

    // Cancel microphone button - turns off microphone and hides modal
    cancelBtn?.addEventListener('click', () => {
        stopMicrophone();
        volumeModal.style.display = 'none';
        console.log('User cancelled microphone monitoring');
    });
}

async function requestMicrophonePermission() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(mediaStream);
        
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        microphone.connect(analyser);
        
        console.log('Microphone access granted');
        return true;
    } catch (error) {
        console.error('Error accessing microphone:', error);
        throw error;
    }
}

function startVolumeMonitoring() {
    const volumeBar = document.getElementById('volumeBar');
    const volumeModal = document.getElementById('micVolumeModal');
    
    if (!volumeBar || !analyser) return;

    function updateVolume() {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const averageVolume = sum / dataArray.length;
        const rawVolumePercentage = Math.round((averageVolume / 255) * 100);
        
        // Map volume to 0-40% range for better visibility of small sounds
        const volumePercentage = Math.round((rawVolumePercentage / 100) * 40);
        
        // Update volume bar
        volumeBar.style.width = volumePercentage + '%';
        
        // Automatically fade out modal when volume reaches 10% (of raw volume)
        if (volumeModal && rawVolumePercentage >= 10) {
            // Start fade out transition
            volumeModal.style.transition = 'opacity 3s ease-out';
            volumeModal.style.opacity = '0';
            
            // Hide modal completely after fade out completes
            setTimeout(() => {
                volumeModal.style.display = 'none';
                volumeModal.style.opacity = '1'; // Reset for next time
                volumeModal.style.transition = ''; // Reset transition
            }, 3000);
            
            return; // Stop monitoring since fade out has started
        }
        
        // Continue monitoring
        requestAnimationFrame(updateVolume);
    }
    
    updateVolume();
}

function stopMicrophone() {
    try {
        // Stop all media stream tracks
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
                track.stop();
            });
            mediaStream = null;
        }
        
        // Close audio context
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
            audioContext = null;
        }
        
        // Clear references
        analyser = null;
        microphone = null;
        dataArray = null;
        peakVolume = 0;
        
        console.log('Microphone stopped and resources cleaned up');
        
        // Mark microphone as inactive and disable speech recognition
        isMicrophoneActive = false;
        if (isSpeechRecognitionEnabled) {
            disableSpeechRecognition();
        }
    } catch (error) {
        console.error('Error stopping microphone:', error);
    }
}

/**
 * Enable speech recognition for continuous listening throughout the song
 */
function enableSpeechRecognition() {
    if (!window.SpeechRecognitionModule) {
        console.warn('Speech recognition module not loaded');
        return false;
    }
    
    if (!isMicrophoneActive) {
        console.warn('Cannot enable speech recognition: microphone not active');
        return false;
    }
    
    isSpeechRecognitionEnabled = true;
    console.log('🎤 Speech recognition enabled for continuous listening');
    
    // Set up event listener for target word detection
    document.addEventListener('targetWordDetected', handleTargetWordDetected);
    
    // Start continuous recognition immediately
    window.SpeechRecognitionModule.startContinuousRecognition();
    
    return true;
}

/**
 * Disable speech recognition
 */
function disableSpeechRecognition() {
    if (window.SpeechRecognitionModule) {
        window.SpeechRecognitionModule.stopTargetWordRecognition();
    }
    
    isSpeechRecognitionEnabled = false;
    document.removeEventListener('targetWordDetected', handleTargetWordDetected);
    console.log('Speech recognition disabled');
}

/**
 * Handle target word detection from speech recognition
 * @param {CustomEvent} event - Event containing detection details
 */
function handleTargetWordDetected(event) {
    const { targetWord, spokenWord, scores } = event.detail;
    
    console.log(`🎤 Target word detected in karaoke:`, {
        target: targetWord,
        spoken: spokenWord,
        trigramSimilarity: scores.trigramSimilarity.toFixed(3),
        jaroScore: scores.jaroScore.toFixed(3),
        confidence: scores.confidence?.toFixed(3) || 'N/A'
    });
    
    // Mark the target word as matched in the lyrics engine
    if (lyricsEngine && typeof lyricsEngine.markWordAsMatched === 'function') {
        lyricsEngine.markWordAsMatched(targetWord);
    }
    
    // Trigger any custom callbacks for word detection
    if (window.onKaraokeWordDetected && typeof window.onKaraokeWordDetected === 'function') {
        window.onKaraokeWordDetected(targetWord, spokenWord, scores);
    }
}

// Target word timing management - supports multiple overlapping windows
let activeTargetWords = new Map(); // Map of word -> {state, startTime}

/**
 * Set target word listening with timing state (supports overlapping windows)
 * @param {string} targetWord - The word to detect
 * @param {string} state - The listening state ('pre-listening', 'active', 'post-listening')
 */
function setTargetWordListening(targetWord, state) {
    if (!isMicrophoneActive || !isSpeechRecognitionEnabled || !window.SpeechRecognitionModule) {
        return false;
    }
    
    const currentState = activeTargetWords.get(targetWord);
    
    // Only log when state changes for this specific word
    if (!currentState || currentState.state !== state) {
        activeTargetWords.set(targetWord, {
            state: state,
            startTime: Date.now()
        });
        
        if (state === 'pre-listening') {
            console.log(`🎯 Listening for target word: "${targetWord}" (starting in 2 seconds)`);
        } else if (state === 'active') {
            console.log(`🎯 TARGET WORD ACTIVE: "${targetWord}" - comparing all speech now`);
        } else if (state === 'post-listening') {
            console.log(`🎯 Post-listening for: "${targetWord}" (5 seconds remaining)`);
        }
        
        // Update speech recognition module with all active target words
        const allActiveWords = Array.from(activeTargetWords.keys());
        window.SpeechRecognitionModule.setMultipleTargetWords(allActiveWords);
        
        // Log current active state for debugging
        const activeCount = Array.from(activeTargetWords.values()).filter(state => state.state === 'active').length;
        const allCount = activeTargetWords.size;
        console.log(`📊 Active words: ${activeCount}/${allCount} total tracked words`);
    }
    
    return true;
}

/**
 * Clear target word listening for a specific word
 * @param {string} targetWord - The word to stop listening for
 */
function clearTargetWordListening(targetWord) {
    if (activeTargetWords.has(targetWord)) {
        console.log(`🎯 Stopped listening for: "${targetWord}"`);
        activeTargetWords.delete(targetWord);
        
        // Update speech recognition module with remaining active target words
        const allActiveWords = Array.from(activeTargetWords.keys());
        if (window.SpeechRecognitionModule) {
            window.SpeechRecognitionModule.setMultipleTargetWords(allActiveWords);
        }
        
        // Log current active state for debugging
        const activeCount = Array.from(activeTargetWords.values()).filter(state => state.state === 'active').length;
        const allCount = activeTargetWords.size;
        console.log(`📊 Active words after removal: ${activeCount}/${allCount} total tracked words`);
    }
}

/**
 * Get all current target word listening states
 * @returns {Map} Map of active target words and their states
 */
function getActiveTargetWords() {
    return new Map(activeTargetWords);
}

/**
 * Stop current target word recognition
 */
function stopTargetWordRecognition() {
    if (window.SpeechRecognitionModule) {
        window.SpeechRecognitionModule.stopTargetWordRecognition();
    }
}

/**
 * Initialize the debug table with target words
 */
function initializeDebugTable() {
    const tableBody = document.getElementById('targetWordsTableBody');
    if (!tableBody || !lyricsEngine || !lyricsEngine.targetWords) {
        return;
    }

    // Clear existing rows
    tableBody.innerHTML = '';

    // Add a row for each target word occurrence
    lyricsEngine.targetWords.forEach((targetWord, index) => {
        const row = document.createElement('tr');
        row.id = `debug-row-${index}`;
        row.innerHTML = `
            <td>${targetWord.word} (${targetWord.id})</td>
            <td class="matched" id="match-${index}">-</td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * Update the debug table to reflect matched status and active words
 */
function updateDebugTable() {
    if (!lyricsEngine || !lyricsEngine.targetWords) {
        return;
    }

    // Get active target words
    const activeWords = window.getActiveTargetWords ? window.getActiveTargetWords() : new Map();

    lyricsEngine.targetWords.forEach((targetWord, index) => {
        const row = document.getElementById(`debug-row-${index}`);
        const matchCell = document.getElementById(`match-${index}`);
        
        if (matchCell) {
            matchCell.textContent = targetWord.matched === true ? '✓' : '-';
        }

        if (row) {
            // Check if this target word is currently active
            const targetState = activeWords.get(targetWord.word);
            if (targetState && targetState.state === 'active') {
                row.classList.add('active-word');
            } else {
                row.classList.remove('active-word');
            }
        }
    });
}

// Make functions available globally for lyrics engine integration
window.setTargetWordListening = setTargetWordListening;
window.clearTargetWordListening = clearTargetWordListening;
window.getActiveTargetWords = getActiveTargetWords;
window.updateDebugTable = updateDebugTable;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeKaraoke();
    initializeMicrophoneModal();
});