/**
 * Speech Recognition Module - Target Word Detection
 * Handles speech recognition and word matching for karaoke games
 */

// Speech recognition variables
let speechRecognition = null;
let isRecognitionActive = false;
let recognizedWordsLog = []; // Continuous log of all recognized words with timestamps
let permissionDenied = false; // Track if permission was denied to avoid repeated requests

// Keep-alive ping system to prevent timeouts
let keepAliveInterval = null;

// Check for browser compatibility and use prefixed versions if necessary
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

/**
 * Calculate the Jaro distance between two strings
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Jaro distance (0-1, where 1 is identical)
 */
function calculateJaroDistance(s1, s2) {
    if (s1 === s2) return 1.0;

    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0 || len2 === 0) return 0.0;

    const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
    let matches = 0;
    let transpositions = 0;

    const m1 = new Array(len1).fill(false);
    const m2 = new Array(len2).fill(false);

    for (let i = 0; i < len1; i++) {
        for (let j = Math.max(0, i - maxDist); j < Math.min(len2, i + maxDist + 1); j++) {
            if (!m1[i] && !m2[j] && s1[i] === s2[j]) {
                matches++;
                m1[i] = true;
                m2[j] = true;
                break;
            }
        }
    }

    if (matches === 0) return 0.0;

    let k = 0;
    for (let i = 0; i < len1; i++) {
        if (m1[i]) {
            while (!m2[k]) k++;
            if (s1[i] !== s2[k]) {
                transpositions++;
            }
            k++;
        }
    }

    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
    return jaro;
}

/**
 * Generate trigrams from a string
 * @param {string} str - Input string
 * @returns {Set} Set of trigrams
 */
function generateTrigrams(str) {
    const trigrams = new Set();
    // Pad the string with spaces to capture leading/trailing trigrams
    const paddedStr = " " + str + " ";
    for (let i = 0; i < paddedStr.length - 2; i++) {
        trigrams.add(paddedStr.substring(i, i + 3));
    }
    return trigrams;
}

/**
 * Calculate trigram similarity between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Trigram similarity (0-1, where 1 is identical)
 */
function calculateTrigramSimilarity(str1, str2) {
    if (str1 === str2) return 1.0; // Identical strings have 100% similarity

    const trigrams1 = generateTrigrams(str1);
    const trigrams2 = generateTrigrams(str2);

    let commonTrigramsCount = 0;
    for (const trigram of trigrams1) {
        if (trigrams2.has(trigram)) {
            commonTrigramsCount++;
        }
    }

    const totalUniqueTrigrams = trigrams1.size + trigrams2.size - commonTrigramsCount;

    if (totalUniqueTrigrams === 0) return 0.0; // Avoid division by zero

    return commonTrigramsCount / totalUniqueTrigrams;
}

/**
 * Send a keep-alive ping to prevent speech recognition timeouts
 */
function sendKeepAlivePing() {
    if (!isRecognitionActive || !speechRecognition) return;
    
    const currentTime = window.lyricsEngine ? window.lyricsEngine.getCurrentTime() : 0;
    
    try {
        // Try to create a fake speech result event to keep recognition alive
        const fakeResults = {
            results: [{
                0: { transcript: 'BLARG', confidence: 1.0 },
                isFinal: false, // Make it interim so it doesn't interfere with real results
                length: 1
            }],
            resultIndex: 0,
            results: {
                length: 1,
                0: {
                    0: { transcript: 'BLARG', confidence: 1.0 },
                    isFinal: false,
                    length: 1
                }
            }
        };
        
        // Call our result handler directly to simulate speech input
        handleSpeechResult(fakeResults);
        
        console.log(`🏓 Keep-alive ping sent: BLARG at ${currentTime.toFixed(2)}s`);
        
    } catch (error) {
        console.warn('⚠️ Keep-alive ping failed:', error.message);
        
        // Fallback: just add to log
        recognizedWordsLog.push({
            word: 'BLARG',
            timestamp: currentTime,
            confidence: 1.0,
            keepAlive: true
        });
    }
}

/**
 * Start the keep-alive ping system
 */
function startKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }
    
    keepAliveInterval = setInterval(sendKeepAlivePing, 3000); // Every 3 seconds
    console.log('🏓 Keep-alive ping system started (every 3 seconds)');
}

/**
 * Stop the keep-alive ping system
 */
function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        console.log('🏓 Keep-alive ping system stopped');
    }
}

/**
 * Initialize speech recognition
 * @returns {boolean} True if initialization successful, false otherwise
 */
function initializeSpeechRecognition() {
    if (!SpeechRecognition) {
        console.error('❌ Speech recognition not supported in this browser');
        console.log('Available APIs:', {
            SpeechRecognition: !!window.SpeechRecognition,
            webkitSpeechRecognition: !!window.webkitSpeechRecognition
        });
        return false;
    }

    try {
        speechRecognition = new SpeechRecognition();
        speechRecognition.lang = 'en-US';
        speechRecognition.interimResults = true;
        speechRecognition.maxAlternatives = 3; // Increased from 1 to get more options
        speechRecognition.continuous = true;
        
        // Extended timeout settings to be more tolerant of pauses
        if ('speechTimeoutType' in speechRecognition) {
            speechRecognition.speechTimeoutType = 'extended';
        }
        
        // Try to extend various timeout properties if they exist
        try {
            // Set all timeouts to 5 minutes - covers most songs and prevents premature timeouts
            const fiveMinutesMs = 300000; // 5 minutes in milliseconds
            
            // Some browsers support these extended properties - set them to 5 minutes
            if ('speechTimeout' in speechRecognition) {
                speechRecognition.speechTimeout = fiveMinutesMs; // 5 minutes
            }
            if ('endSilenceTimeout' in speechRecognition) {
                speechRecognition.endSilenceTimeout = fiveMinutesMs; // 5 minutes of silence allowed
            }
            if ('startSilenceTimeout' in speechRecognition) {
                speechRecognition.startSilenceTimeout = fiveMinutesMs; // 5 minutes to start speaking
            }
        } catch (error) {
            console.log('⚠️ Some extended speech recognition properties not supported:', error.message);
        }
        
        // Try to make it more tolerant of silence periods
        if (speechRecognition.serviceURI) {
            // Some browsers support additional configuration
            speechRecognition.serviceURI = 'wss://www.google.com/speech-api/v2/recognize';
        }
        


        // Handle speech recognition results
        speechRecognition.addEventListener('result', handleSpeechResult);
        
        // Handle recognition errors
        speechRecognition.addEventListener('error', (event) => {
            // Handle specific error types
            switch(event.error) {
                case 'not-allowed':
                    console.warn('❌ Speech recognition error: Microphone permission denied');
                    permissionDenied = true; // Mark permission as denied
                    isRecognitionActive = false; // Stop trying to restart
                    break;
                case 'network':
                    console.warn('🌐 Speech recognition error: Network error');
                    // Don't stop recognition for network errors, they might be temporary
                    break;
                case 'audio-capture':
                    console.warn('🎤 Speech recognition error: Audio capture failed - microphone might be in use');
                    // This could indicate microphone conflict - stop completely to avoid permission loops
                    isRecognitionActive = false;
                    permissionDenied = true; // Treat audio capture failure as permission issue to prevent loops
                    console.warn('⚠️ Marking permission as denied due to audio capture failure to prevent loops');
                    break;
                case 'no-speech':
                    console.log('🔇 Speech recognition: no speech detected - this is normal during musical intros');
                    console.log('📊 Recognition state:', { isActive: isRecognitionActive, permissionDenied });
                    // For no-speech, restart more quickly since it's just a timeout, not a permission issue
                    if (isRecognitionActive && !permissionDenied) {
                        console.log('� Restarting speech recognition immediately after no-speech timeout...');
                        setTimeout(() => {
                            if (isRecognitionActive && !permissionDenied) {
                                try {
                                    speechRecognition.start();
                                    console.log('✅ Speech recognition restarted after no-speech timeout');
                                } catch (error) {
                                    console.warn('❌ Failed to restart after no-speech:', error.message);
                                }
                            }
                        }, 500); // Quick restart for no-speech timeouts
                    }
                    break;
                case 'aborted':
                    console.log('🔇 Speech recognition: aborted (normal)');
                    // Don't restart immediately for aborted - let the end event handle it
                    break;
                case 'service-not-allowed':
                    console.warn('🚫 Speech recognition service not allowed');
                    permissionDenied = true;
                    isRecognitionActive = false;
                    break;
                default:
                    console.log('🔍 Speech recognition error details:', event.error, event.message);
                    console.warn(`⚠️ Speech recognition error: ${event.error}`);
                    // For unknown errors, don't immediately disable, but add some delay
                    break;
            }
        });

        // Handle recognition end
        speechRecognition.addEventListener('end', () => {
            const currentSongTime = window.lyricsEngine ? window.lyricsEngine.getCurrentTime() : 0;
            console.log(`🔄 Speech recognition ended event fired at song time: ${currentSongTime.toFixed(2)}s`);
            console.log('📊 Current state:', { 
                isActive: isRecognitionActive, 
                permissionDenied, 
                songTime: currentSongTime.toFixed(2) + 's',
                timestamp: new Date().toLocaleTimeString() 
            });
            
            if (isRecognitionActive && !permissionDenied) {
                // Use longer delay to reduce permission prompt frequency
                console.log('🔄 Speech recognition ended - will restart after delay...');
                setTimeout(() => {
                    if (isRecognitionActive && !permissionDenied) {
                        try {
                            console.log('🔄 Auto-restarting speech recognition...');
                            speechRecognition.start();
                            console.log('✅ Speech recognition restarted successfully');
                        } catch (error) {
                            console.warn('Failed to restart speech recognition:', error.message);
                            if (error.name === 'InvalidStateError' || 
                                error.name === 'NotAllowedError' ||
                                error.message.includes('not-allowed') ||
                                error.message.includes('permission')) {
                                console.warn('⚠️ Stopping auto-restart due to permission or state error');
                                isRecognitionActive = false;
                                permissionDenied = true;
                            }
                        }
                    } else {
                        console.log('🛑 Skipping restart - state changed during delay');
                    }
                }, 500); // Very fast restart - 500ms delay
            } else {
                console.log('🛑 Not restarting speech recognition - isActive:', isRecognitionActive, 'permissionDenied:', permissionDenied);
            }
        });

        return true;
    } catch (error) {
        console.error('❌ Error initializing speech recognition:', error);
        return false;
    }
}

/**
 * Handle speech recognition results
 * @param {SpeechRecognitionEvent} event - Speech recognition event
 */
function handleSpeechResult(event) {
    const last = event.results.length - 1;
    const spokenText = event.results[last][0].transcript.trim().toLowerCase();
    const confidence = event.results[last][0].confidence || 0;
    const isFinal = event.results[last].isFinal;

    // Skip processing empty or whitespace-only results
    if (!spokenText || spokenText.length === 0) {
        return;
    }

    // Get current playback time
    const currentTime = window.lyricsEngine ? window.lyricsEngine.getCurrentTime() : 0;

    // For final results, log all recognized words with timestamps
    if (isFinal) {
        const spokenWords = spokenText.split(/\s+/).filter(word => word.length > 0);
        
        spokenWords.forEach(word => {
            recognizedWordsLog.push({
                word: word,
                timestamp: currentTime,
                confidence: confidence
            });
        });
        
        // Output the current recognized words log
        console.log('Recognized Words Log:', recognizedWordsLog);
    }


}



/**
 * Check if speech recognition is currently active
 * @returns {boolean} True if recognition is active
 */
function isRecognitionRunning() {
    return isRecognitionActive;
}

/**
 * Reset permission denied state (useful when user grants permission later)
 */
function resetPermissionState() {
    console.log('🔄 Resetting speech recognition permission state');
    permissionDenied = false;
}

/**
 * Stop speech recognition
 */
function stopRecognition() {
    console.log('🛑 Stopping speech recognition...');
    if (speechRecognition) {
        isRecognitionActive = false;
        stopKeepAlive(); // Stop the keep-alive ping system
        try {
            speechRecognition.stop();
            console.log('✅ Speech recognition stopped successfully');
        } catch (error) {
            console.warn('⚠️ Error stopping speech recognition:', error.message);
        }
    } else {
        console.log('⚠️ Speech recognition was not initialized');
    }
}



/**
 * Start continuous speech recognition for the entire song
 * Note: This function starts recognition but does NOT auto-restart on end.
 * This prevents browser permission prompts during natural speech pauses.
 * Use restartRecognition() or manually call this function again if needed.
 * @returns {Promise<boolean>} True if started successfully, false otherwise
 */
async function startContinuousRecognition() {
    if (!speechRecognition) {
        console.warn('Speech recognition not initialized');
        return false;
    }

    // Don't start if permission was previously denied
    if (permissionDenied) {
        console.warn('Speech recognition permission previously denied, not attempting to start');
        return false;
    }

    console.log('🎤 Starting continuous speech recognition...');
    recognizedWordsLog = []; // Reset the log when starting

    try {
        // Make sure we're not already running
        if (isRecognitionActive) {
            console.log('⚠️ Speech recognition already active - not starting again');
            return true; // Return success since it's already running
        }

        isRecognitionActive = true;
        speechRecognition.start();
        startKeepAlive(); // Start the keep-alive ping system
        console.log('✅ Speech recognition started successfully');
        return true;
    } catch (error) {
        console.warn('❌ Speech recognition start error:', error.name, error.message);
        isRecognitionActive = false;
        
        // For karaoke integration, don't retry on errors to avoid permission loops
        if (skipPermissionCheck) {
            console.warn('⚠️ Speech recognition failed in karaoke mode - not retrying to avoid permission loops');
            return false;
        }
        
        // Only for standalone usage, handle specific error types
        if (error.message.includes('not-allowed') || error.message.includes('permission') || error.name === 'NotAllowedError') {
            console.error('🚫 Microphone permission denied - marking as denied');
            permissionDenied = true;
        }
        
        return false;
    }
}





// Initialize speech recognition when the module loads
document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
});



/**
 * Get the current recognized words log
 * @returns {Array} Array of recognized words with timestamps
 */
function getRecognizedWordsLog() {
    return [...recognizedWordsLog];
}

/**
 * Clear the recognized words log
 */
function clearRecognizedWordsLog() {
    recognizedWordsLog = [];
}

/**
 * Restart speech recognition manually (useful when auto-restart is disabled)
 */
function restartRecognition() {
    console.log('🔄 Manual restart requested...');
    if (isRecognitionActive) {
        console.log('⏹️ Stopping current recognition first...');
        stopRecognition();
        // Give it a moment to stop before restarting
        setTimeout(() => {
            console.log('▶️ Starting recognition after stop...');
            startContinuousRecognition();
        }, 500);
    } else {
        console.log('▶️ Starting recognition (was not running)...');
        startContinuousRecognition();
    }
}

// Export functions for use by other modules
window.SpeechRecognitionModule = {
    initializeSpeechRecognition,
    startContinuousRecognition,
    stopRecognition,
    isRecognitionRunning,
    resetPermissionState,
    getRecognizedWordsLog,
    clearRecognizedWordsLog,
    restartRecognition,
    calculateJaroDistance,
    generateTrigrams,
    calculateTrigramSimilarity
};

// Expose commonly used functions globally for backward compatibility
window.getRecognizedWordsLog = getRecognizedWordsLog;
window.clearRecognizedWordsLog = clearRecognizedWordsLog;
window.calculateJaroDistance = calculateJaroDistance;
window.calculateTrigramSimilarity = calculateTrigramSimilarity;