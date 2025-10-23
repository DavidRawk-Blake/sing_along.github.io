/**
 * Speech Recognition Module - Target Word Detection
 * Handles speech recognition and word matching for karaoke games
 */

// Speech recognition variables
let speechRecognition = null;
let isRecognitionActive = false;
let currentTargetWords = []; // Array to support multiple overlapping target words

// Check for browser compatibility and use prefixed versions if necessary
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

/**
 * Calculate the Jaro distance between two strings
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Jaro distance (0-1, where 1 is identical)
 */
function jaroDistance(s1, s2) {
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

    // Jaro distance formula
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
        
        console.log('✅ Speech recognition initialized successfully');
        console.log('Speech recognition settings:', {
            lang: speechRecognition.lang,
            interimResults: speechRecognition.interimResults,
            continuous: speechRecognition.continuous,
            maxAlternatives: speechRecognition.maxAlternatives
        });

        // Handle speech recognition results
        speechRecognition.addEventListener('result', handleSpeechResult);
        
        // Handle recognition errors
        speechRecognition.addEventListener('error', (event) => {
            console.error('Speech recognition error:', event.error);
            
            // Handle specific error types
            switch(event.error) {
                case 'not-allowed':
                    console.error('Microphone permission denied');
                    updateMicrophoneStatus('error', 'Microphone permission denied');
                    break;
                case 'network':
                    console.error('Network error during speech recognition');
                    updateMicrophoneStatus('error', 'Network error');
                    break;
                case 'audio-capture':
                    console.error('Audio capture failed - check microphone');
                    updateMicrophoneStatus('error', 'Audio capture failed');
                    break;
                case 'no-speech':
                    console.warn('No speech detected - this is usually normal');
                    // Don't show error for no-speech, it's common and normal
                    break;
                case 'aborted':
                    console.warn('Speech recognition aborted - usually due to restart');
                    // Don't show error for aborted, happens during restarts
                    break;
                default:
                    console.error(`Unknown speech recognition error: ${event.error}`);
                    updateMicrophoneStatus('error', `Error: ${event.error}`);
            }
        });

        // Handle recognition end
        speechRecognition.addEventListener('end', () => {
            if (isRecognitionActive && currentTargetWords.length > 0) {
                // Restart recognition if it's supposed to be active
                setTimeout(() => {
                    if (isRecognitionActive) {
                        speechRecognition.start();
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

    console.log(`🎙️ Speech detected: "${spokenText}" (${isFinal ? 'FINAL' : 'interim'}, confidence: ${confidence.toFixed(2)})`);

    // Skip processing empty or whitespace-only results
    if (!spokenText || spokenText.length === 0) {
        console.log('⚠️ Skipping empty speech result');
        return;
    }

    // If no target words are set, just log the recognition and return
    if (!currentTargetWords || currentTargetWords.length === 0) {
        console.log('⚠️ No target words set, ignoring speech result');
        return;
    }
    
    console.log(`🎯 Current target words: [${currentTargetWords.join(', ')}]`);

    // Get active target word states from karaoke controller
    const activeWords = window.getActiveTargetWords ? window.getActiveTargetWords() : new Map();

    if (isFinal) {
        console.log(`🎤 Speech recognition detected: "${spokenText}" (confidence: ${confidence.toFixed(2)})`);
        
        // Record all final spoken words for active listening-windows
        if (window.lyricsEngine && typeof window.lyricsEngine.recordSpokenWords === 'function') {
            const currentTime = window.lyricsEngine.getCurrentTime();
            window.lyricsEngine.recordSpokenWords(spokenText, currentTime);
        } else {
            console.warn('⚠️ Could not record spoken words - lyricsEngine not available');
        }
        
        // For final results, parse individual words and compare each against currently active target words only
        const spokenWords = spokenText.split(/\s+/).filter(word => word.length > 0);
        
        // Filter to only active target words (those in their listening-window)
        const activeTargetWords = currentTargetWords.filter(targetWord => {
            const targetState = activeWords.get(targetWord);
            return targetState && targetState.state === 'active';
        });
        
        if (activeTargetWords.length === 0) {
            // No active target words in current listening-window, skip comparison
            return;
        }
        
        spokenWords.forEach(spokenWord => {
            activeTargetWords.forEach(targetWord => {
                const targetLower = targetWord.toLowerCase();

                // Calculate similarity scores for individual word comparison
                const trigramSimilarity = calculateTrigramSimilarity(spokenWord, targetLower);
                const jaroScore = jaroDistance(spokenWord, targetLower);

                // Check if word matches (using thresholds from original code)
                const isMatch = trigramSimilarity > 0.3 || jaroScore > 0.7;
                
                if (isMatch) {
                    // Trigger word detection event for matched word
                    triggerWordDetection(targetWord, spokenWord, {
                        trigramSimilarity,
                        jaroScore,
                        confidence
                    });
                }
            });
        });
    } else {
        // For interim results, still compare the full phrase (for real-time feedback)
        currentTargetWords.forEach(targetWord => {
            const targetLower = targetWord.toLowerCase();

            // Calculate similarity scores for target word comparison
            const trigramSimilarity = calculateTrigramSimilarity(spokenText, targetLower);
            const jaroScore = jaroDistance(spokenText, targetLower);

            // Check if word matches (using thresholds from original code)
            const isMatch = trigramSimilarity > 0.3 || jaroScore > 0.7;
        });
    }
}

/**
 * Start speech recognition for a target word
 * @param {string} targetWord - The word to detect
 * @returns {boolean} True if started successfully, false otherwise
 */
function startTargetWordRecognition(targetWord) {
    if (!speechRecognition) {
        console.warn('Speech recognition not initialized');
        return false;
    }

    if (!targetWord) {
        console.warn('No target word provided');
        return false;
    }

    currentTargetWords = [targetWord];
    isRecognitionActive = true;

    try {
        speechRecognition.start();
        console.log(`Started speech recognition for target word: "${targetWord}"`);
        return true;
    } catch (error) {
        console.error('Error starting speech recognition:', error);
        isRecognitionActive = false;
        return false;
    }
}

/**
 * Stop speech recognition
 */
function stopTargetWordRecognition() {
    if (speechRecognition && isRecognitionActive) {
        isRecognitionActive = false;
        currentTargetWords = [];
        speechRecognition.stop();
        console.log('Stopped speech recognition');
    }
}

/**
 * Check if speech recognition is currently active
 * @returns {boolean} True if recognition is active
 */
function isRecognitionRunning() {
    return isRecognitionActive && currentTargetWords.length > 0;
}

/**
 * Trigger word detection event (can be overridden by other modules)
 * @param {string} targetWord - The target word that was matched
 * @param {string} spokenWord - The actual spoken word
 * @param {Object} scores - Object containing similarity scores and confidence
 */
function triggerWordDetection(targetWord, spokenWord, scores) {
    // Create custom event for word detection
    const event = new CustomEvent('targetWordDetected', {
        detail: {
            targetWord,
            spokenWord,
            scores
        }
    });
    
    document.dispatchEvent(event);
    
    // Also call global callback if it exists
    if (window.onTargetWordDetected && typeof window.onTargetWordDetected === 'function') {
        window.onTargetWordDetected(targetWord, spokenWord, scores);
    }
}

/**
 * Start continuous speech recognition for the entire song
 * @returns {boolean} True if started successfully, false otherwise
 */
function startContinuousRecognition() {
    if (!speechRecognition) {
        console.warn('⚠️ Speech recognition not initialized');
        return false;
    }

    console.log('🎤 Starting continuous speech recognition...');
    
    isRecognitionActive = true;
    currentTargetWords = []; // No specific target words initially, just listen to everything

    try {
        speechRecognition.start();
        console.log('✅ Started continuous speech recognition for entire song');
        console.log('🔊 Recognition is now actively listening...');
        return true;
    } catch (error) {
        console.error('❌ Error starting continuous speech recognition:', error);
        if (error.name === 'InvalidStateError') {
            console.log('💡 Recognition might already be running. Stopping and restarting...');
            speechRecognition.stop();
            setTimeout(() => {
                try {
                    speechRecognition.start();
                    console.log('✅ Successfully restarted speech recognition');
                } catch (retryError) {
                    console.error('❌ Failed to restart speech recognition:', retryError);
                    isRecognitionActive = false;
                }
            }, 100);
        } else {
            isRecognitionActive = false;
        }
        return false;
    }
}

/**
 * Set multiple target words for overlapping listening-windows
 * @param {Array<string>} targetWords - Array of words to detect
 */
function setMultipleTargetWords(targetWords) {
    currentTargetWords = targetWords || [];
}

/**
 * Set a single target word without starting recognition (legacy function)
 * @param {string} targetWord - The word to set as target
 */
function setTargetWord(targetWord) {
    if (targetWord) {
        currentTargetWords = [targetWord];
    } else {
        currentTargetWords = [];
    }
}

/**
 * Get the current target words
 * @returns {Array<string>} Array of current target words
 */
function getCurrentTargetWords() {
    return [...currentTargetWords];
}

/**
 * Get the first current target word (legacy function)
 * @returns {string|null} First target word or null
 */
function getCurrentTargetWord() {
    return currentTargetWords.length > 0 ? currentTargetWords[0] : null;
}

// Initialize speech recognition when the module loads
document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
});

// Export functions for use by other modules
window.SpeechRecognitionModule = {
    jaroDistance,
    calculateTrigramSimilarity,
    generateTrigrams,
    initializeSpeechRecognition,
    startTargetWordRecognition,
    startContinuousRecognition,
    stopTargetWordRecognition,
    isRecognitionRunning,
    setTargetWord,
    setMultipleTargetWords,
    getCurrentTargetWord,
    getCurrentTargetWords
};