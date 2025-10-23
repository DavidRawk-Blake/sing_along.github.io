/**
 * Speech Recognition Module - Target Word Detection
 * Handles speech recognition and word matching for karaoke games
 */

// Speech recognition variables
let speechRecognition = null;
let isRecognitionActive = false;
let recognizedWordsLog = []; // Continuous log of all recognized words with timestamps
let permissionDenied = false; // Track if permission was denied to avoid repeated requests

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
        speechRecognition.maxAlternatives = 1;
        speechRecognition.continuous = true;
        


        // Handle speech recognition results
        speechRecognition.addEventListener('result', handleSpeechResult);
        
        // Handle recognition errors
        speechRecognition.addEventListener('error', (event) => {
            // Handle specific error types
            switch(event.error) {
                case 'not-allowed':
                    console.warn('Speech recognition error: Microphone permission denied');
                    permissionDenied = true; // Mark permission as denied
                    isRecognitionActive = false; // Stop trying to restart
                    break;
                case 'network':
                    console.warn('Speech recognition error: Network error');
                    break;
                case 'audio-capture':
                    console.warn('Speech recognition error: Audio capture failed');
                    break;
                case 'no-speech':
                case 'aborted':
                    // Don't show error for no-speech or aborted, it's common and normal
                    break;
                default:
                    console.warn(`Speech recognition error: ${event.error}`);
            }
        });

        // Handle recognition end
        speechRecognition.addEventListener('end', () => {
            if (isRecognitionActive && !permissionDenied) {
                // Only restart if permission wasn't denied and we're supposed to be active
                setTimeout(() => {
                    if (isRecognitionActive && !permissionDenied) {
                        try {
                            speechRecognition.start();
                        } catch (error) {
                            console.warn('Failed to restart speech recognition:', error.message);
                            isRecognitionActive = false;
                        }
                    }
                }, 100);
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
 * Stop speech recognition
 */
function stopRecognition() {
    if (speechRecognition && isRecognitionActive) {
        isRecognitionActive = false;
        speechRecognition.stop();
    }
}

/**
 * Check if microphone permission is available
 * @returns {Promise<boolean>} True if microphone is available, false otherwise
 */
async function checkMicrophonePermission() {
    try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        return permissionStatus.state === 'granted';
    } catch (error) {
        // Fallback for browsers that don't support permissions API
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
            return true;
        } catch (micError) {
            console.warn('Microphone permission check failed:', micError);
            return false;
        }
    }
}

/**
 * Start continuous speech recognition for the entire song
 * @param {boolean} skipPermissionCheck - Skip microphone permission check (when called from karaoke system that already has permission)
 * @returns {Promise<boolean>} True if started successfully, false otherwise
 */
async function startContinuousRecognition(skipPermissionCheck = false) {
    if (!speechRecognition) {
        console.warn('Speech recognition not initialized');
        return false;
    }

    // Don't start if permission was previously denied
    if (permissionDenied) {
        console.warn('Speech recognition permission previously denied, not attempting to start');
        return false;
    }

    // Check microphone permission before starting (only if permission hasn't been granted elsewhere)
    if (!skipPermissionCheck) {
        console.log('Checking microphone permission for speech recognition...');
        const hasMicPermission = await checkMicrophonePermission();
        if (!hasMicPermission) {
            console.warn('Microphone permission not granted, skipping speech recognition');
            permissionDenied = true; // Mark as denied to prevent future attempts
            return false;
        }
    } else {
        console.log('Skipping microphone permission check - permission already verified by caller');
    }

    isRecognitionActive = true;
    recognizedWordsLog = []; // Reset the log when starting

    try {
        speechRecognition.start();
        return true;
    } catch (error) {
        console.warn('Speech recognition start error:', error.message);
        
        if (error.message.includes('not-allowed') || error.message.includes('permission')) {
            permissionDenied = true;
            isRecognitionActive = false;
            return false;
        }
        
        if (error.name === 'InvalidStateError') {
            speechRecognition.stop();
            setTimeout(() => {
                try {
                    if (!permissionDenied) {
                        speechRecognition.start();
                    }
                } catch (retryError) {
                    console.warn('Speech recognition retry failed:', retryError.message);
                    isRecognitionActive = false;
                }
            }, 100);
        } else {
            isRecognitionActive = false;
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

// Export functions for use by other modules
window.SpeechRecognitionModule = {
    initializeSpeechRecognition,
    startContinuousRecognition,
    stopRecognition,
    isRecognitionRunning,
    getRecognizedWordsLog,
    clearRecognizedWordsLog,
    calculateJaroDistance,
    generateTrigrams,
    calculateTrigramSimilarity,
    checkMicrophonePermission
};

// Also expose functions globally
window.startContinuousRecognition = startContinuousRecognition;
window.stopRecognition = stopRecognition;
window.getRecognizedWordsLog = getRecognizedWordsLog;
window.clearRecognizedWordsLog = clearRecognizedWordsLog;
window.calculateJaroDistance = calculateJaroDistance;
window.generateTrigrams = generateTrigrams;
window.calculateTrigramSimilarity = calculateTrigramSimilarity;
window.checkMicrophonePermission = checkMicrophonePermission;