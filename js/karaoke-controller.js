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

// Fade-out management
let fadeOutTimer = null;
let isFadedOut = false;

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


}

// Initialize the karaoke system when DOM is loaded
function initializeKaraoke() {
    // Get references to audio elements
    song = document.getElementById('song');
    music = document.getElementById('music');

    // Initialize lyrics engine (data is now hardcoded, so this always succeeds)
    lyricsEngine = new LyricsEngine();
    
    // DEBUG: Log all sentences when song loads
    console.log('🎵 KOOKABURRA SONG LOADED - DEBUGGING SENTENCES:');
    console.log('='.repeat(60));
    
    if (window.lyricsData && window.lyricsData.sentences) {
        console.log(`📊 Total sentences found: ${window.lyricsData.sentences.length}`);
        console.log(`🎵 Song source: ${window.lyricsData.song_source}`);
        console.log(`🎶 Music source: ${window.lyricsData.music_source}`);
        console.log(`⏰ Generated: ${window.lyricsData.generated_timestamp}`);
        console.log(`🎵 Total song length: ${window.lyricsData.total_song_length}s`);
        console.log('');
        
        window.lyricsData.sentences.forEach((sentence, index) => {
            const words = sentence.words.map(word => word.text).join(' ');
            const startTime = sentence.words[0]?.start_time || 0;
            const endTime = sentence.words[sentence.words.length - 1]?.end_time || 0;
            console.log(`📝 Sentence ${index + 1} [${startTime}s - ${endTime}s]: "${words}"`);
            console.log(`   Words count: ${sentence.words.length}`);
            
            // Log individual words for first few sentences
            if (index < 3) {
                sentence.words.forEach((word, wordIndex) => {
                    console.log(`     Word ${wordIndex + 1}: "${word.text}" (${word.start_time}s - ${word.end_time}s)`);
                });
            }
            console.log('');
        });
    } else {
        console.error('❌ No lyrics data found! window.lyricsData is:', window.lyricsData);
    }
    
    console.log('='.repeat(60));
    
    // Make lyrics engine globally accessible for speech recognition
    window.lyricsEngine = lyricsEngine;
    
    // Set audio sources directly from lyrics data (no loading needed)
    if (lyricsEngine.lyricsData.song_source) {
        song.src = lyricsEngine.lyricsData.song_source;
        song.type = AUDIO_MIME_TYPE;

    }
    
    if (lyricsEngine.lyricsData.music_source) {
        music.src = lyricsEngine.lyricsData.music_source;
        music.type = AUDIO_MIME_TYPE;

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

        lyricsEngine.pause(); // Use engine's pause method to stop both audio sources
        lyricsEngine.pauseAnimation(); // Stop animation but preserve current time position
        
        // Stop speech recognition when song ends
        if (isSpeechRecognitionEnabled && window.SpeechRecognitionModule) {
            console.log('Song ended - stopping speech recognition');
            window.SpeechRecognitionModule.stopRecognition();
        }
        
        updatePlayButtonAppearance();
        updateRestartButtonAppearance();
    });
    
    music.addEventListener('ended', () => {

        lyricsEngine.pause(); // Use engine's pause method to stop both audio sources
        lyricsEngine.pauseAnimation(); // Stop animation but preserve current time position
        
        // Stop speech recognition when music ends
        if (isSpeechRecognitionEnabled && window.SpeechRecognitionModule) {
            console.log('Music ended - stopping speech recognition');
            window.SpeechRecognitionModule.stopRecognition();
        }
        
        updatePlayButtonAppearance();
        updateRestartButtonAppearance();
    });

    // Add audio loading state listeners for debugging

    song.addEventListener('error', (e) => console.error('Error loading song:', e));


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

        }
    });

    // Initialize button appearances
    updatePlayButtonAppearance();
    updateRestartButtonAppearance();


}

// Start lyrics display
function startLyrics() {
    fadeInLyrics(); // Restore opacity when starting
    
    // Restart speech recognition when starting lyrics (if microphone is enabled)
    if (isSpeechRecognitionEnabled && isMicrophoneActive && window.SpeechRecognitionModule) {
        // Check if speech recognition is already running to avoid multiple starts
        if (!window.SpeechRecognitionModule.isRecognitionRunning()) {
            console.log('🎵 Starting lyrics - starting speech recognition');
            console.log('📊 Speech recognition status:', {
                enabled: isSpeechRecognitionEnabled,
                micActive: isMicrophoneActive,
                moduleAvailable: !!window.SpeechRecognitionModule,
                isRunning: window.SpeechRecognitionModule.isRecognitionRunning()
            });
            
            window.SpeechRecognitionModule.startContinuousRecognition(true).catch(error => {
                console.warn('❌ Failed to start speech recognition:', error);
                // If we get permission errors, disable it to prevent repeated attempts
                if (error.name === 'NotAllowedError' || error.message.includes('not-allowed')) {
                    console.warn('⚠️ Disabling speech recognition due to permission error');
                    isSpeechRecognitionEnabled = false;
                }
            });
        } else {
            console.log('✅ Speech recognition already running - no need to restart');
        }
    } else {
        console.log('⏸️ Not starting speech recognition:', {
            enabled: isSpeechRecognitionEnabled,
            micActive: isMicrophoneActive,
            moduleAvailable: !!window.SpeechRecognitionModule
        });
    }
    
    lyricsEngine.startAnimation(() => stopLyrics());
}

// Pause lyrics display
function pauseLyrics() {
    lyricsEngine.pauseAnimation();
}

// Stop and reset lyrics display
function stopLyrics() {
    lyricsEngine.stopAnimation();
    
    // Stop speech recognition when lyrics are stopped
    if (isSpeechRecognitionEnabled && window.SpeechRecognitionModule) {
        console.log('🛑 Lyrics stopped - stopping speech recognition');
        window.SpeechRecognitionModule.stopRecognition();
    } else {
        console.log('📝 Lyrics stopped - speech recognition was not active');
    }
    
    // Schedule fade-out 5 seconds after lyrics end
    scheduleFadeOut();
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
    
    // Pause first to prevent audio desync during seek
    if (wasPlaying) {
        lyricsEngine.pause();
    }
    
    lyricsEngine.setCurrentTime(newTime);
    
    if (wasPlaying) {
        setTimeout(() => {
            lyricsEngine.play();
            // Verify sync after resuming playback
            setTimeout(() => {
                if (lyricsEngine.verifyPlaybackSync) {
                    lyricsEngine.verifyPlaybackSync();
                }
            }, 200);
        }, 150); // Longer pause to ensure seek completes
    } 
}

// Schedule fade-out 5 seconds after lyrics end
function scheduleFadeOut() {
    // Clear any existing fade-out timer
    if (fadeOutTimer) {
        clearTimeout(fadeOutTimer);
        fadeOutTimer = null;
    }
    
    // Schedule fade-out for 5 seconds after lyrics end
    fadeOutTimer = setTimeout(() => {
        fadeOutLyrics();
    }, 5000);
}

// Fade out the lyrics display slowly
function fadeOutLyrics() {
    const sentenceDisplay = document.getElementById('sentenceDisplay');
    if (!sentenceDisplay || isFadedOut) return;
    
    console.log('Fading out lyrics display');
    
    // Apply smooth transition and fade to opacity 0
    sentenceDisplay.style.transition = 'opacity 3s ease-out';
    sentenceDisplay.style.opacity = '0';
    isFadedOut = true;
}

// Restore lyrics display opacity when song restarts
function fadeInLyrics() {
    const sentenceDisplay = document.getElementById('sentenceDisplay');
    if (!sentenceDisplay || !isFadedOut) return;
    
    console.log('Fading in lyrics display');
    
    // Clear any pending fade-out
    if (fadeOutTimer) {
        clearTimeout(fadeOutTimer);
        fadeOutTimer = null;
    }
    
    // Restore opacity smoothly
    sentenceDisplay.style.transition = 'opacity 1s ease-in';
    sentenceDisplay.style.opacity = '1';
    isFadedOut = false;
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
    
    const maxTime = lyricsEngine.getTotalEndTime() || Infinity;
    const newTime = Math.min(maxTime, lyricsEngine.getCurrentTime() + 5);
    
    // Pause first to prevent audio desync during seek
    if (wasPlaying) {
        lyricsEngine.pause();
    }
    
    lyricsEngine.setCurrentTime(newTime);
    
    if (wasPlaying) {
        setTimeout(() => {
            lyricsEngine.play();
            // Verify sync after resuming playback
            setTimeout(() => {
                if (lyricsEngine.verifyPlaybackSync) {
                    lyricsEngine.verifyPlaybackSync();
                }
            }, 200);
        }, 150); // Longer pause to ensure seek completes
    }
}

// Global functions for onclick handlers
function togglePlayPause() {
    console.log('Toggling playback');
    
    // Check if we're starting from paused state
    const wasPlayingBeforeToggle = !lyricsEngine.isPaused();
    
    // Use engine's built-in toggle functionality
    lyricsEngine.togglePlayback();
    
    // If we just started playing from pause, restore opacity
    if (wasPlayingBeforeToggle === false && !lyricsEngine.isPaused()) {
        fadeInLyrics();
    }
    
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
        fadeInLyrics(); // Restore opacity when resetting
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
            // Reset any previous permission denial state since user just granted permission
            if (window.SpeechRecognitionModule && window.SpeechRecognitionModule.resetPermissionState) {
                window.SpeechRecognitionModule.resetPermissionState();
            }
            
            // Enable speech recognition for target word detection (permission already granted)
            enableSpeechRecognition().catch(error => {
                console.warn('Failed to enable speech recognition:', error);
            });
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
        // Start playing music since mic setup is fully done
        startMusicAfterMicSetup();
    });

    // Cancel microphone button - turns off microphone and hides modal
    cancelBtn?.addEventListener('click', () => {
        stopMicrophone();
        volumeModal.style.display = 'none';
        console.log('User cancelled microphone monitoring');
        // Start playing music since mic setup is fully done
        startMusicAfterMicSetup();
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
                // Start playing music since mic setup is fully done
                startMusicAfterMicSetup();
            }, 3000);
            
            return; // Stop monitoring since fade out has started
        }
        
        // Continue monitoring
        requestAnimationFrame(updateVolume);
    }
    
    updateVolume();
}

function startMusicAfterMicSetup() {
    console.log('Starting music after microphone setup completion');
    if (lyricsEngine) {
        // Small delay to ensure UI is fully updated
        setTimeout(() => {
            lyricsEngine.play();
            updatePlayButtonAppearance();
        }, 100);
    }
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
 * @returns {Promise<boolean>} True if enabled successfully
 */
async function enableSpeechRecognition() {
    console.log('🎤 Enabling speech recognition (microphone permission already granted)...');
    
    if (!window.SpeechRecognitionModule) {
        console.warn('⚠️ Speech recognition module not loaded');
        return false;
    }
    
    if (!isMicrophoneActive) {
        console.warn('⚠️ Cannot enable speech recognition: microphone not active');
        return false;
    }
    
    console.log('✅ Using existing microphone permission for speech recognition...');
    
    // Reset speech recognition permission state since we have verified microphone access
    if (window.SpeechRecognitionModule && window.SpeechRecognitionModule.resetPermissionState) {
        window.SpeechRecognitionModule.resetPermissionState();
    }
    
    isSpeechRecognitionEnabled = true;
    
    // Start continuous recognition immediately - no need for permission check since microphone is already active
    try {
        const success = await window.SpeechRecognitionModule.startContinuousRecognition(true);
        
        if (success) {
            console.log('🎵 Speech recognition enabled successfully!');
        } else {
            console.error('❌ Failed to start speech recognition');
            isSpeechRecognitionEnabled = false;
        }
        
        return success;
    } catch (error) {
        console.error('❌ Error starting speech recognition:', error);
        isSpeechRecognitionEnabled = false;
        return false;
    }
}

/**
 * Disable speech recognition
 */
function disableSpeechRecognition() {
    if (window.SpeechRecognitionModule) {
        window.SpeechRecognitionModule.stopRecognition();
    }
    
    isSpeechRecognitionEnabled = false;
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

    // Initialize the debug summary counter with total target words count
    const debugSummary = document.getElementById('debugSummary');
    if (debugSummary) {
        const totalCount = lyricsEngine.targetWords.length;
        debugSummary.textContent = `0 : ${totalCount}`;
    }
}

// Debounce timer for table scrolling
let scrollDebugTableTimer = null;

/**
 * Smoothly scroll the debug table to show the current sentence
 */
function scrollDebugTableToCurrentSentence() {
    const tableContainer = document.querySelector('.debug-table-container');
    if (!tableContainer) return;
    
    // Prioritize listening-active rows, then fall back to active-word rows
    let activeRows = tableContainer.querySelectorAll('.listening-active');
    if (activeRows.length === 0) {
        activeRows = tableContainer.querySelectorAll('.active-word');
    }
    if (activeRows.length === 0) return;
    
    // Convert NodeList to Array for easier manipulation
    activeRows = Array.from(activeRows);
    
    // Get the first and last active rows to determine the sentence span
    const firstActiveRow = activeRows[0];
    const lastActiveRow = activeRows[activeRows.length - 1];
    
    // Calculate the bounding box that includes the entire active sentence
    const containerRect = tableContainer.getBoundingClientRect();
    const firstRowRect = firstActiveRow.getBoundingClientRect();
    const lastRowRect = lastActiveRow.getBoundingClientRect();
    
    // Calculate the sentence block bounds
    const containerTop = containerRect.top;
    const containerHeight = containerRect.height;
    const sentenceTop = firstRowRect.top;
    const sentenceBottom = lastRowRect.bottom;
    const sentenceHeight = sentenceBottom - sentenceTop;
    
    // Calculate relative position of the sentence block within the container
    const relativeTop = sentenceTop - containerTop;
    
    // Try to center the sentence block, but ensure it's fully visible
    const centerOffset = (containerHeight - sentenceHeight) / 2;
    
    // Calculate the scroll amount needed
    const currentScrollTop = tableContainer.scrollTop;
    let targetScrollTop = currentScrollTop + relativeTop - centerOffset;
    
    // Ensure the entire sentence is visible (adjust if too large for container)
    const maxScroll = tableContainer.scrollHeight - containerHeight;
    if (targetScrollTop < 0) {
        targetScrollTop = 0;
    } else if (targetScrollTop > maxScroll) {
        targetScrollTop = maxScroll;
    }
    
    // Only scroll if the sentence is not already fully visible
    const sentenceVisibleTop = relativeTop;
    const sentenceVisibleBottom = relativeTop + sentenceHeight;
    const isFullyVisible = sentenceVisibleTop >= 0 && sentenceVisibleBottom <= containerHeight;
    
    if (!isFullyVisible) {
        tableContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
    }
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
    
    const totalCount = lyricsEngine.targetWords.length;
    let hasActiveWords = false;

    lyricsEngine.targetWords.forEach((targetWord, index) => {
        const row = document.getElementById(`debug-row-${index}`);
        const matchCell = document.getElementById(`match-${index}`);
        const spokenCell = document.getElementById(`spoken-${index}`);
        const jaroCell = document.getElementById(`jaro-${index}`);
        const trigramCell = document.getElementById(`trigram-${index}`);

        if (row) {
            // Use the same dynamic window calculation as lyrics engine
            const wordStartTime = lyricsEngine.lyricsData.sentences[targetWord.sentenceIndex].words[targetWord.wordIndex].start_time || 0;
            const wordEndTime = lyricsEngine.lyricsData.sentences[targetWord.sentenceIndex].words[targetWord.wordIndex].end_time || 0;
            
            // Calculate sentence boundaries
            const sentence = lyricsEngine.lyricsData.sentences[targetWord.sentenceIndex];
            const sentenceStartTime = sentence.words[0].start_time || 0;
            const sentenceEndTime = sentence.words[sentence.words.length - 1].end_time || 0;
            
            // Calculate listening window: 5 seconds before and 2 seconds after word, constrained by sentence
            const windowStart = Math.max(sentenceStartTime, wordStartTime - 5.0);
            const windowEnd = Math.min(sentenceEndTime, wordEndTime + 2.0);
            
            // Check if current time (without offset adjustment) is within this target word's listening-window
            const isInWindow = currentTime >= windowStart && currentTime <= windowEnd;
            
            if (isInWindow) {
                row.classList.add('active-word');
                hasActiveWords = true;
            } else {
                row.classList.remove('active-word');
            }
        }

        // Update match status display
        if (matchCell) {
            let matchStatus = '';
            
            // Use the match_found flag set by the lyrics engine
            if (targetWord.match_found) {
                // Check individual thresholds for detailed display
                const hasJaroMatch = targetWord.jaroScores.some(score => score > 0.8);
                const hasTrigramMatch = targetWord.trigramScores.some(score => score > 0.4);
                
                if (hasJaroMatch) {
                    matchStatus += '✓';
                }
                if (hasTrigramMatch) {
                    matchStatus += '✓';
                }
            }
            
            matchCell.textContent = matchStatus || '-';
            
            // Apply green background if there's a match
            if (targetWord.match_found) {
                row.classList.add('match-found');
            } else {
                row.classList.remove('match-found');
            }
        }

        // Update spoken words display
        if (spokenCell) {
            if (targetWord.spokenWords.length > 0) {
                const spokenWordsText = targetWord.spokenWords.join(', ');
                spokenCell.textContent = spokenWordsText;
            } else {
                spokenCell.textContent = '-';
            }
        }

        // Update Jaro scores display
        if (jaroCell) {
            if (targetWord.jaroScores.length > 0) {
                const jaroScoresText = targetWord.jaroScores.map(score => score.toFixed(2)).join(', ');
                jaroCell.textContent = jaroScoresText;
            } else {
                jaroCell.textContent = '-';
            }
        }

        // Update Trigram scores display
        if (trigramCell) {
            if (targetWord.trigramScores.length > 0) {
                const trigramScoresText = targetWord.trigramScores.map(score => score.toFixed(2)).join(', ');
                trigramCell.textContent = trigramScoresText;
            } else {
                trigramCell.textContent = '-';
            }
        }
    });
    
    // Count all matches found using the match_found flags
    const matchedCount = lyricsEngine.targetWords.filter(targetWord => targetWord.match_found).length;
    
    // Update debug summary with match count
    const debugSummary = document.getElementById('debugSummary');
    if (debugSummary) {
        debugSummary.textContent = `${matchedCount} : ${totalCount}`;
    }
    
    // Scroll to current sentence if there are active words (with debouncing)
    if (hasActiveWords) {
        // Clear any existing timer
        if (scrollDebugTableTimer) {
            clearTimeout(scrollDebugTableTimer);
        }
        
        // Set a small delay to debounce rapid updates
        scrollDebugTableTimer = setTimeout(() => {
            scrollDebugTableToCurrentSentence();
            scrollDebugTableTimer = null;
        }, 100);
    }
}

function highlightTargetWordInTable(targetWordId, highlight) {
    // targetWordId format is "sentenceIndex-wordIndex"
    const [sentenceIndex, wordIndex] = targetWordId.split('-').map(Number);
    
    // Find the target word index in the targetWords array
    if (!lyricsEngine || !lyricsEngine.targetWords) return;
    
    const targetWordIndex = lyricsEngine.targetWords.findIndex(tw => 
        tw.sentenceIndex === sentenceIndex && tw.wordIndex === wordIndex
    );
    
    if (targetWordIndex === -1) return;
    
    const row = document.getElementById(`debug-row-${targetWordIndex}`);
    if (row) {
        if (highlight) {
            row.classList.add('listening-active');
        } else {
            row.classList.remove('listening-active');
        }
    }
}



// Make functions available globally for lyrics engine integration
window.updateDebugTable = updateDebugTable;
window.highlightTargetWordInTable = highlightTargetWordInTable;
window.scrollDebugTableToCurrentSentence = scrollDebugTableToCurrentSentence;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeKaraoke();
    initializeMicrophoneModal();
});