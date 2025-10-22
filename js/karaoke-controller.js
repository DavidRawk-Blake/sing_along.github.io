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
    
    // Make lyrics engine globally accessible for speech recognition
    window.lyricsEngine = lyricsEngine;
    
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
}



// Target word timing management - supports multiple overlapping listening-windows
let activeTargetWords = new Map(); // Map of word -> {state, startTime}

/**
 * Set target word listening with timing state (supports overlapping listening-windows)
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
        

        
        // Update speech recognition module with all active target words
        const allActiveWords = Array.from(activeTargetWords.keys());
        window.SpeechRecognitionModule.setMultipleTargetWords(allActiveWords);
    }
    
    return true;
}

/**
 * Clear target word listening for a specific word
 * @param {string} targetWord - The word to stop listening for
 */
function clearTargetWordListening(targetWord) {
    if (activeTargetWords.has(targetWord)) {
        activeTargetWords.delete(targetWord);
        
        // Update speech recognition module with remaining active target words
        const allActiveWords = Array.from(activeTargetWords.keys());
        if (window.SpeechRecognitionModule) {
            window.SpeechRecognitionModule.setMultipleTargetWords(allActiveWords);
        }
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
            <td id="match-${index}" class="match-status"></td>
            <td>${targetWord.word} (${targetWord.id})</td>
            <td id="spoken-${index}" class="spoken-words"></td>
            <td id="jaro-${index}" class="jaro-scores"></td>
            <td id="trigram-${index}" class="trigram-scores"></td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * Update the debug table to reflect active words based on listening-windows
 */
function updateDebugTable() {
    if (!lyricsEngine || !lyricsEngine.targetWords) {
        return;
    }

    // Get current time from lyrics engine
    const currentTime = lyricsEngine.getCurrentTime();
    const adjustedTime = currentTime - (lyricsEngine.lyricsData ? lyricsEngine.lyricsData.offset : 0);
    
    let matchedCount = 0;
    const totalCount = lyricsEngine.targetWords.length;

    lyricsEngine.targetWords.forEach((targetWord, index) => {
        const row = document.getElementById(`debug-row-${index}`);
        const matchCell = document.getElementById(`match-${index}`);
        const spokenCell = document.getElementById(`spoken-${index}`);
        const jaroCell = document.getElementById(`jaro-${index}`);
        const trigramCell = document.getElementById(`trigram-${index}`);

        if (row) {
            // Check if current time is within this target word's listening-window
            const isInWindow = adjustedTime >= targetWord.startTime && adjustedTime <= targetWord.endTime;
            
            if (isInWindow) {
                row.classList.add('active-word');
            } else {
                row.classList.remove('active-word');
            }
        }

        // Update match status display
        if (matchCell) {
            let matchStatus = '';
            
            // Check if any Jaro score is over 0.7 (note: user said 0.3 but typical threshold is 0.7)
            const hasJaroMatch = targetWord.jaroScores.some(score => score > 0.7);
            if (hasJaroMatch) {
                matchStatus += '✓';
            }
            
            // Check if any Trigram score is over 0.3 (note: user said 0.7 but typical threshold is 0.3)  
            const hasTrigramMatch = targetWord.trigramScores.some(score => score > 0.3);
            if (hasTrigramMatch) {
                matchStatus += '✓';
            }
            
            matchCell.textContent = matchStatus || '-';
            
            // Apply green background if there's a match
            const hasMatch = hasJaroMatch || hasTrigramMatch;
            if (hasMatch) {
                row.classList.add('match-found');
                matchedCount++;
            } else {
                row.classList.remove('match-found');
            }
        }

        // Update spoken words display
        if (spokenCell) {
            const spokenWordsText = targetWord.spokenWords.length > 0 
                ? targetWord.spokenWords.join(', ') 
                : '-';
            spokenCell.textContent = spokenWordsText;
        }

        // Update Jaro scores display
        if (jaroCell) {
            const jaroScoresText = targetWord.jaroScores.length > 0 
                ? targetWord.jaroScores.map(score => score.toFixed(3)).join(', ')
                : '-';
            jaroCell.textContent = jaroScoresText;
        }

        // Update Trigram scores display
        if (trigramCell) {
            const trigramScoresText = targetWord.trigramScores.length > 0 
                ? targetWord.trigramScores.map(score => score.toFixed(3)).join(', ')
                : '-';
            trigramCell.textContent = trigramScoresText;
        }
    });
    
    // Update debug summary with match count
    const debugSummary = document.getElementById('debugSummary');
    if (debugSummary) {
        debugSummary.textContent = `(${matchedCount}/${totalCount})`;
    }
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