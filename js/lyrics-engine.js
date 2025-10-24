/**
 * Lyrics Engine - Handles karaoke-style lyrics display and synchronization
 * Focused on timing-based display without speech recognition dependency
 */

class LyricsEngine {
    constructor(lyricsData) {
        // Accept lyrics data from external source
        this.lyricsData = lyricsData || window.lyricsData || null;

        if (!this.lyricsData) {
            throw new Error('LyricsEngine: No lyrics data provided. Please load lyrics data before initializing.');
        }

        // State management
        this.currentSentenceIndex = 0;
        this.isPlaying = false;

        // Animation and timing state
        this.startTime = 0;
        this.animationFrame = null;
        this.onStop = null; // Callback for when animation should stop

        // Target word tracking
        this.targetWords = [];
        this.initializeTargetWords();
    }

    /**
     * Get the offset based on the first word's start time
     * @returns {number} - Offset in seconds
     */
    getOffset() {
        // Simply return the start time of the first word in the first sentence
        if (this.lyricsData.sentences && this.lyricsData.sentences.length > 0) {
            const firstSentence = this.lyricsData.sentences[0];
            if (firstSentence.words && firstSentence.words.length > 0) {
                const firstWord = firstSentence.words[0];
                if (firstWord.start_time !== undefined) {
                    return firstWord.start_time;
                }
            }
        }

        return 0; // Default fallback
    }

    /**
     * Initialize target words array from lyrics data
     */
    initializeTargetWords() {
        this.targetWords = [];

        if (this.lyricsData && this.lyricsData.sentences) {
            this.lyricsData.sentences.forEach((sentence, sentenceIndex) => {
                sentence.words.forEach((word, wordIndex) => {
                    if (word.target_word === true) {
                        // Get word timing from absolute timestamps
                        const wordStartTime = word.start_time || 0;
                        const wordEndTime = word.end_time || 0;

                        // Calculate sentence boundaries to constrain listening window
                        const sentenceStartTime = this.calculateSentenceStartTime(sentenceIndex);
                        const sentenceEndTime = this.calculateSentenceEndTime(sentenceIndex);

                        // Calculate listening window: 8 seconds before and 3 seconds after the word (extended for 15-word capture)
                        const desiredStartTime = wordStartTime - 8.0;
                        const desiredEndTime = wordEndTime + 3.0;

                        // Constrain to sentence boundaries
                        const constrainedStartTime = Math.max(sentenceStartTime, desiredStartTime);
                        const constrainedEndTime = Math.min(sentenceEndTime, desiredEndTime);

                        this.targetWords.push({
                            word: word.text,
                            sentenceIndex: sentenceIndex,
                            wordIndex: wordIndex,
                            startTime: constrainedStartTime,
                            endTime: constrainedEndTime,
                            id: `${sentenceIndex}-${wordIndex}`, // Unique identifier
                            spokenWords: [], // Store last 15 words spoken during this listening-window
                            jaroScores: [], // Store Jaro distances for each of the 15 spoken words
                            trigramScores: [], // Store trigram similarity scores for each of the 15 spoken words
                            listeningActive: false, // Track if listening window is active
                            match_found: false // Boolean flag to indicate if target word passed thresholds
                        });
                    }
                });
            });
        }
    }



    /**
     * Initialize the lyrics engine with DOM elements
     * @param {Object} elements - Object containing DOM element references
     */
    initialize(elements) {
        this.sentenceDisplay = elements.sentenceDisplay;
        this.progressFill = elements.progressFill;
        this.audioPlayer = elements.audioPlayer;
        this.timestampDisplay = elements.timestampDisplay;
        this.imageContainer = elements.imageContainer;
        
        // Initialize audio sources
        this.songAudio = elements.songAudio;  // Voice/vocal track (can pause during recognition)
        this.musicAudio = elements.musicAudio; // Background music (source of truth for timing)
        
        // Track recognition state to detect changes
        this.previousRecognitionState = false;
        this.currentImageIndex = -1; // Track which image is currently active
    }

    /**
     * Display current sentence with word highlighting based on timing
     * @param {number} sentenceIndex - Index of the current sentence
     * @param {number} currentTime - Current playback time
     */
    displaySentence(sentenceIndex, currentTime) {
        if (!this.sentenceDisplay) return;

        if (sentenceIndex >= this.lyricsData.sentences.length) {
            this.sentenceDisplay.innerHTML = 'Song completed! 🎉';
            return;
        }

        const sentence = this.lyricsData.sentences[sentenceIndex];
        const sentenceStartTime = this.calculateSentenceStartTime(sentenceIndex);
        const relativeTime = currentTime - sentenceStartTime;
        
        // Check if this is early preview (1 second before first sentence)
        const isEarlyPreview = sentenceIndex === 0 && currentTime < sentenceStartTime;

        let html = '';
        
        // First pass: find the current word that should be highlighted (only one at a time)
        let currentHighlightedWordIndex = -1;
        if (!isEarlyPreview) {
            for (let i = 0; i < sentence.words.length; i++) {
                const word = sentence.words[i];
                if (!word.text || word.text.length === 0) continue;
                
                const wordAbsoluteStart = word.start_time || 0;
                const wordAbsoluteEnd = word.end_time || 0;
                const wordRelativeStart = wordAbsoluteStart - sentenceStartTime;
                const wordRelativeEnd = wordAbsoluteEnd - sentenceStartTime;
                const highlightStartTime = wordRelativeStart - 0.2;
                
                // Check if this word should be highlighted
                if (relativeTime >= highlightStartTime && relativeTime <= wordRelativeEnd) {
                    currentHighlightedWordIndex = i;
                    break; // Only highlight one word at a time
                }
            }
        }
        
        // Second pass: render all words, highlighting only the current one
        sentence.words.forEach((word, wordIndex) => {
            // Skip empty words - don't display or highlight them
            if (!word.text || word.text.length === 0) {
                return; // Skip to next word
            }
            
            let className = 'word';
            let fontSize = '';
            
            // Add target-word class if this is a target word
            if (word.target_word) {
                className += ' target-word';
            }
            
            // Only highlight if this is the current word (ensures only one word highlighted at a time)
            if (wordIndex === currentHighlightedWordIndex) {
                className += ' highlighted';
                
                // Set this as the current target word for speech recognition (if target word)
                if (word.target_word && window.setCurrentTargetWord) {
                    window.setCurrentTargetWord(word.text);
                }
            }
            
            html += `<span class="${className}" style="${fontSize}">${word.text}</span>`;
        });

        this.sentenceDisplay.innerHTML = html;
        
        // Check for target word timing (prediction and active periods)
        this.checkTargetWordTiming(sentenceIndex, currentTime);
        
        // Update debug table to reflect active words
        if (window.updateDebugTable) {
            window.updateDebugTable();
        }
    }

    /**
     * Check target word timing for visual highlighting
     * @param {number} sentenceIndex - Current sentence index
     * @param {number} currentTime - Current playback time
     */
    checkTargetWordTiming(sentenceIndex, currentTime) {
        // Check all target words across all sentences for their timing windows
        this.targetWords.forEach(targetWord => {
            const wordStartTime = this.lyricsData.sentences[targetWord.sentenceIndex].words[targetWord.wordIndex].start_time || 0;
            const wordEndTime = this.lyricsData.sentences[targetWord.sentenceIndex].words[targetWord.wordIndex].end_time || 0;
            
            // Calculate timing window: 3 seconds before and 2 seconds after word
            const windowStart = wordStartTime - 3.0;
            const windowEnd = wordEndTime + 2.0;
            
            // Check if we're entering the timing window
            if (currentTime >= windowStart && currentTime <= windowEnd) {
                if (!targetWord.listeningActive) {
                    // Start timing window for this target word
                    targetWord.listeningActive = true;
                }
                
                // Update debug table highlighting
                if (window.highlightTargetWordInTable) {
                    window.highlightTargetWordInTable(targetWord.id, true);
                }
                
            } else if (targetWord.listeningActive && currentTime > windowEnd) {
                // End of timing window
                targetWord.listeningActive = false;
                
                // Grab the last 15 spoken words from the recognition log
                if (window.getRecognizedWordsLog) {
                    const recognizedWordsLog = window.getRecognizedWordsLog();
                    // Get the last 15 words from the log
                    const lastFifteenWords = recognizedWordsLog.slice(-15).map(entry => entry.word);
                    // Store them in the target word's spokenWords array
                    targetWord.spokenWords = lastFifteenWords;
                    
                    // Calculate Jaro and trigram scores for each spoken word against the target word
                    const targetWordText = targetWord.word.toLowerCase();
                    targetWord.jaroScores = [];
                    targetWord.trigramScores = [];
                    
                    lastFifteenWords.forEach(spokenWord => {
                        const spokenWordLower = spokenWord.toLowerCase();
                        
                        // Calculate Jaro distance
                        const jaroScore = window.calculateJaroDistance ? 
                            window.calculateJaroDistance(targetWordText, spokenWordLower) : 0;
                        targetWord.jaroScores.push(jaroScore);
                        
                        // Calculate trigram similarity
                        const trigramScore = window.calculateTrigramSimilarity ?
                            window.calculateTrigramSimilarity(targetWordText, spokenWordLower) : 0;
                        targetWord.trigramScores.push(trigramScore);
                    });
                    
                    // Check if any scores pass the thresholds and set match_found flag
                    // With 15 words captured (vs previous 5), we use stricter thresholds:
                    // - Jaro threshold: 0.8 (was 0.7) - requires closer phonetic match
                    // - Trigram threshold: 0.4 (was 0.3) - requires better character sequence match
                    // This compensates for the increased chance of false positives with more words
                    const hasJaroMatch = targetWord.jaroScores.some(score => score > 0.8);
                    const hasTrigramMatch = targetWord.trigramScores.some(score => score > 0.4);
                    targetWord.match_found = hasJaroMatch || hasTrigramMatch;
                    
                    // Update the debug table with these words and scores
                    const targetWordIndex = this.targetWords.findIndex(tw => tw.id === targetWord.id);
                    if (targetWordIndex !== -1) {
                        // Update spoken words cell
                        const spokenCell = document.getElementById(`spoken-${targetWordIndex}`);
                        if (spokenCell) {
                            const spokenWordsText = lastFifteenWords.join(', ');
                            spokenCell.textContent = spokenWordsText || '-';
                        }
                        
                        // Update Jaro scores cell
                        const jaroCell = document.getElementById(`jaro-${targetWordIndex}`);
                        if (jaroCell && targetWord.jaroScores.length > 0) {
                            const jaroScoresText = targetWord.jaroScores.map(score => score.toFixed(2)).join(', ');
                            jaroCell.textContent = jaroScoresText;
                        }
                        
                        // Update trigram scores cell
                        const trigramCell = document.getElementById(`trigram-${targetWordIndex}`);
                        if (trigramCell && targetWord.trigramScores.length > 0) {
                            const trigramScoresText = targetWord.trigramScores.map(score => score.toFixed(2)).join(', ');
                            trigramCell.textContent = trigramScoresText;
                        }
                    }
                }
                
                // Remove debug table highlighting
                if (window.highlightTargetWordInTable) {
                    window.highlightTargetWordInTable(targetWord.id, false);
                }
                
                // Check if this was the last target word to complete its timing window
                this.checkForRatificationTrigger();
            }
        });
    }

    /**
     * Check if all target words have completed their timing windows and trigger ratification
     */
    checkForRatificationTrigger() {
        // Check if all target words have finished their listening windows
        const allFinished = this.targetWords.every(targetWord => !targetWord.listeningActive);
        
        if (allFinished && this.targetWords.length > 0) {
            // All target words have completed - trigger ratification if recognition is enabled
            if (window.isSpeechRecognitionEnabled && typeof this.score_ratification === 'function') {
                console.log('🎯 All target words completed - triggering score ratification');
                this.score_ratification();
            }
        }
    }

    /**
     * Calculate the start time of a sentence
     * @param {number} sentenceIndex - Index of the sentence
     * @returns {number} Start time of the sentence
     */
    calculateSentenceStartTime(sentenceIndex) {
        const sentence = this.lyricsData.sentences[sentenceIndex];
        if (!sentence || !sentence.words || sentence.words.length === 0) {
            return 0;
        }
        
        // First word's start time is the sentence start time
        return sentence.words[0].start_time || 0;
    }

    /**
     * Calculate the end time of a sentence
     * @param {number} sentenceIndex - Index of the sentence
     * @returns {number} End time of the sentence
     */
    calculateSentenceEndTime(sentenceIndex) {
        const sentence = this.lyricsData.sentences[sentenceIndex];
        if (!sentence || !sentence.words || sentence.words.length === 0) {
            return 0;
        }
        
        // Last word's end time is the sentence end time
        return sentence.words[sentence.words.length - 1].end_time || 0;
    }

    /**
     * Update progress bar based on current time (uses total song duration)
     * @param {number} currentTime - Current playback time
     */
    updateProgress(currentTime) {
        if (!this.progressFill) return;

        // Use total_song_length from lyrics data as the primary source, fallback to music audio duration
        const totalSongDuration = this.getTotalEndTime() || 
                                 (this.musicAudio && this.musicAudio.duration) || 
                                 16;
        
        const progress = (currentTime / totalSongDuration) * 100;
        this.progressFill.style.width = `${Math.min(progress, 100)}%`;
    }

    /**
     * Find the current sentence index based on time
     * @param {number} currentTime - Current playback time
     * @returns {number} - Index of current sentence, or -1 if none found
     */
    findCurrentSentenceIndex(currentTime) {
        // Find sentence based on timing, with early preview for first sentence
        return this.lyricsData.sentences.findIndex((sentence, index) => {
            const sentenceStartTime = this.calculateSentenceStartTime(index);
            const sentenceEndTime = this.calculateSentenceEndTime(index);
            
            // Show first sentence 2 seconds early
            if (index === 0) {
                const earlyStartTime = Math.max(0, sentenceStartTime - 2.0);
                return currentTime >= earlyStartTime && currentTime < sentenceEndTime;
            }
            
            // Normal timing for all other sentences
            return currentTime >= sentenceStartTime && currentTime < sentenceEndTime;
        });
    }

    /**
     * Check if the song has ended (uses total_song_length from lyrics data)
     * @param {number} currentTime - Current playback time
     * @returns {boolean} - Whether the song has finished
     */
    isSongFinished(currentTime) {
        // Use total_song_length as the authoritative end time
        const totalSongDuration = this.getTotalEndTime();
        return currentTime >= totalSongDuration;
    }

    /**
     * Check if lyrics have ended but song is still playing (outro/instrumental period)
     * @param {number} currentTime - Current playback time
     * @returns {boolean} - Whether in outro period
     */
    isInOutroPeriod(currentTime) {
        const lastSentenceIndex = this.lyricsData.sentences.length - 1;
        const lyricsEndTime = this.calculateSentenceEndTime(lastSentenceIndex);
        const totalSongDuration = this.getTotalEndTime();
        
        // We're in outro if lyrics have ended but song is still playing
        return currentTime >= lyricsEndTime && currentTime < totalSongDuration;
    }

    /**
     * Update the engine state
     * @param {Object} state - State object with isPlaying and currentSentenceIndex
     */
    updateState(state) {
        if (state.hasOwnProperty('isPlaying')) {
            this.isPlaying = state.isPlaying;
        }
        if (state.hasOwnProperty('currentSentenceIndex')) {
            this.currentSentenceIndex = state.currentSentenceIndex;
        }
    }

    /**
     * Get the total number of sentences
     * @returns {number} - Number of sentences in lyrics data
     */
    getSentenceCount() {
        return this.lyricsData.sentences.length;
    }

    /**
     * Generate sentence text from words array
     * @param {Object} sentence - Sentence object with words array
     * @returns {string} - Generated text from words
     */
    generateSentenceText(sentence) {
        return sentence.words.map(word => word.text).join(' ');
    }

    /**
     * Calculate the start time of a sentence based on the first word's start_time
     * @param {number} sentenceIndex - Index of the sentence
     * @returns {number} - Start time of the sentence
     */
    calculateSentenceStartTime(sentenceIndex) {
        const sentence = this.lyricsData.sentences[sentenceIndex];
        if (!sentence || !sentence.words || sentence.words.length === 0) {
            return 0;
        }
        
        // Find the first word with timing data
        for (const word of sentence.words) {
            if (word.start_time !== undefined) {
                return word.start_time;
            }
        }
        
        return 0; // Fallback if no timing data found
    }


    /**
     * Calculate the end time of a sentence based on the last word's end_time
     * @param {number} sentenceIndex - Index of the sentence
     * @returns {number} - End time of the sentence
     */
    calculateSentenceEndTime(sentenceIndex) {
        const sentence = this.lyricsData.sentences[sentenceIndex];
        if (!sentence || !sentence.words || sentence.words.length === 0) {
            return 0;
        }
        
        // Find the last word with timing data and return its end time
        for (let i = sentence.words.length - 1; i >= 0; i--) {
            const word = sentence.words[i];
            if (word.end_time !== undefined) {
                return word.end_time;
            }
        }
        
        return 0; // Fallback if no timing data found
    }

    /**
     * Main animation loop with timing offset and intro messages
     */
    animate() {
        if (!this.isPlaying) return;
        
        // Safety check: ensure lyrics data exists (should always be true now)
        if (!this.lyricsData) {
            console.error('Critical error: lyrics data missing');
            return;
        }
        
        const rawTime = (this.musicAudio && this.musicAudio.currentTime) || (Date.now() - this.startTime) / 1000;
        const offset = this.getOffset();
        const currentTime = rawTime - offset;
        
        // Update timestamp display for debugging (show current time / total song duration)
        if (this.timestampDisplay) {
            const totalDuration = this.getTotalEndTime() || (this.musicAudio && this.musicAudio.duration) || 0;
            this.timestampDisplay.textContent = `${rawTime.toFixed(2)}s / ${totalDuration.toFixed(2)}s`;
        }
        
        // Handle intro period (countdown using offset, but show first sentence 2 seconds early)
        if (rawTime < offset) {
            const remainingTime = Math.ceil(offset - rawTime);
            
            // Stop countdown at 2 seconds and show first sentence for preparation
            if (remainingTime <= 2) {
                // Show first sentence 2 seconds early for user preparation
                this.displaySentence(0, rawTime);
            } else if (remainingTime > 10) {
                this.sentenceDisplay.innerHTML = `🎵 Get ready to sing along! 🎵<br>Starting in ${remainingTime}...`;
            } else if (remainingTime > 5) {
                this.sentenceDisplay.innerHTML = `🎤 Almost ready! 🎤<br>Starting in ${remainingTime}...`;
            } else if (remainingTime > 2) {
                this.sentenceDisplay.innerHTML = `✨ Get ready! ✨<br>Starting in ${remainingTime}...`;
            }
            
            this.animationFrame = requestAnimationFrame(() => this.animate());
            return;
        }
        
        // Check if in outro period (lyrics finished but song still playing)
        if (this.isInOutroPeriod(rawTime)) {
            const lastSentenceIndex = this.lyricsData.sentences.length - 1;
            
            // Keep the last sentence visible during outro instead of showing completion message
            this.displaySentence(lastSentenceIndex, rawTime);
            
            // Update timestamp display (show current time / total song duration during outro)
            if (this.timestampDisplay) {
                const totalDuration = this.getTotalEndTime() || (this.musicAudio && this.musicAudio.duration) || 0;
                this.timestampDisplay.textContent = `${rawTime.toFixed(2)}s / ${totalDuration.toFixed(2)}s`;
            }
            
            this.updateProgress(rawTime);
            this.animationFrame = requestAnimationFrame(() => this.animate());
            return;
        }
        
        // Find current sentence using raw time (no offset adjustment for sentence detection)
        let sentenceIndex = this.findCurrentSentenceIndex(rawTime);
        
        if (sentenceIndex === -1 && this.isSongFinished(currentTime)) {
            // Song and outro finished - stop speech recognition and call stop callback
            if (window.SpeechRecognitionModule && window.SpeechRecognitionModule.isRecognitionRunning()) {
                console.log('Song animation finished - stopping speech recognition');
                window.SpeechRecognitionModule.stopRecognition();
            }
            
            if (this.onStop) {
                this.onStop();
            }
            return;
        }

        if (sentenceIndex !== -1) {
            this.currentSentenceIndex = sentenceIndex;
            this.displaySentence(sentenceIndex, rawTime);
            this.activateSentenceImage(sentenceIndex);
        }
        
        // Check if any recognition word is currently highlighted
        const isRecognitionActive = this.isRecognitionWordActive(rawTime);
        this.pauseVoicePlayback(isRecognitionActive);
        
        this.updateProgress(rawTime);
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    /**
     * Start the lyrics animation
     * @param {Function} onStopCallback - Callback function to call when animation should stop
     */
    startAnimation(onStopCallback = null) {
        this.isPlaying = true;
        this.startTime = Date.now();
        this.currentSentenceIndex = 0;
        this.onStop = onStopCallback;
        
        // Speech recognition is now managed by the karaoke controller
        // This prevents duplicate starts and ensures proper lifecycle management
        
        // Show initial intro message
        if (this.sentenceDisplay) {
            this.sentenceDisplay.innerHTML = `🎵 Get ready to sing along! 🎵<br>Starting in ${this.getOffset()}...`;
        }
        
        this.animate();
    }

    /**
     * Pause the lyrics animation
     */
    pauseAnimation() {
        this.isPlaying = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    /**
     * Stop and reset the lyrics animation
     */
    stopAnimation() {
        this.isPlaying = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        // Reset audio sources to beginning
        this.setCurrentTime(0);
        this.reset();
    }

    /**
     * Set current time for both audio sources (song and music)
     * @param {number} time - Time in seconds to set
     */
    setCurrentTime(time) {
        // Ensure both audio tracks are synchronized to the exact same time
        const targetTime = Math.max(0, time); // Prevent negative time
        
        if (this.songAudio) {
            this.songAudio.currentTime = targetTime;
        }
        if (this.musicAudio) {
            this.musicAudio.currentTime = targetTime;
        }
        
        // Wait for audio seek operations to complete before synchronizing state
        setTimeout(() => {
            this.ensureAudioSync(targetTime);
            // SYNC FIX: Update internal state to match the new position
            this.synchronizeStateToTime(targetTime);
            // Update timestamp display when manually setting time
            this.updateTimestampDisplay();
        }, 50); // Small delay to ensure audio seek completes
    }

    /**
     * Ensure both audio tracks are perfectly synchronized
     * @param {number} targetTime - The target time both tracks should be at
     */
    ensureAudioSync(targetTime) {
        if (!this.songAudio || !this.musicAudio) return;
        
        const songTime = this.songAudio.currentTime;
        const musicTime = this.musicAudio.currentTime;
        const tolerance = 0.1; // 100ms tolerance
        
        // Check if audio tracks are out of sync
        const songDiff = Math.abs(songTime - targetTime);
        const musicDiff = Math.abs(musicTime - targetTime);
        const trackDiff = Math.abs(songTime - musicTime);
        
        console.log(`🎵 Audio sync check: Song=${songTime.toFixed(2)}s, Music=${musicTime.toFixed(2)}s, Target=${targetTime.toFixed(2)}s`);
        
        // Re-sync if any track is significantly off
        if (songDiff > tolerance) {
            console.log(`🔄 Re-syncing song audio: ${songTime.toFixed(2)}s → ${targetTime.toFixed(2)}s`);
            this.songAudio.currentTime = targetTime;
        }
        
        if (musicDiff > tolerance) {
            console.log(`🔄 Re-syncing music audio: ${musicTime.toFixed(2)}s → ${targetTime.toFixed(2)}s`);
            this.musicAudio.currentTime = targetTime;
        }
        
        if (trackDiff > tolerance) {
            console.log(`⚠️  Audio tracks out of sync by ${trackDiff.toFixed(2)}s - forcing re-sync`);
            this.songAudio.currentTime = targetTime;
            this.musicAudio.currentTime = targetTime;
        }
    }

    /**
     * Verify that both audio tracks are still synchronized during playback
     */
    verifyPlaybackSync() {
        if (!this.songAudio || !this.musicAudio) return;
        
        const songTime = this.songAudio.currentTime;
        const musicTime = this.musicAudio.currentTime;
        const timeDiff = Math.abs(songTime - musicTime);
        const tolerance = 0.1; // 100ms tolerance
        
        if (timeDiff > tolerance) {
            console.log(`⚠️  Playback sync drift detected: ${timeDiff.toFixed(2)}s difference`);
            console.log(`🔄 Re-syncing: Song=${songTime.toFixed(2)}s → Music=${musicTime.toFixed(2)}s`);
            
            // Use music audio as the source of truth and sync song to it
            this.songAudio.currentTime = musicTime;
        }
    }

    /**
     * Synchronize the lyrics engine's internal state to match a specific time
     * This ensures lyrics display correctly after seeking/skipping
     * @param {number} time - The time to synchronize to
     */
    synchronizeStateToTime(time) {
        // Find which sentence should be active at this time
        const newSentenceIndex = this.findCurrentSentenceIndex(time);
        
        // Update current sentence index
        if (newSentenceIndex >= 0) {
            this.currentSentenceIndex = newSentenceIndex;
        } else {
            // If no sentence is active, set to -1 or 0 depending on time
            const offset = this.getOffset();
            this.currentSentenceIndex = time < offset ? 0 : this.lyricsData.sentences.length - 1;
        }
        
        // Update sentence display immediately to show correct lyrics
        if (time >= this.getOffset()) {
            // We're in the main song content
            if (newSentenceIndex >= 0) {
                this.displaySentence(newSentenceIndex, time);
            }
        } else {
            // We're in the intro/countdown period
            const remainingTime = Math.ceil(this.getOffset() - time);
            if (remainingTime <= 2) {
                // Show first sentence if within 2 seconds of start
                this.displaySentence(0, time);
            } else {
                // Show appropriate countdown message
                if (remainingTime > 10) {
                    this.sentenceDisplay.innerHTML = `🎵 Get ready to sing along! 🎵<br>Starting in ${remainingTime}...`;
                } else if (remainingTime > 5) {
                    this.sentenceDisplay.innerHTML = `🎤 Almost ready! 🎤<br>Starting in ${remainingTime}...`;
                } else {
                    this.sentenceDisplay.innerHTML = `✨ Get ready! ✨<br>Starting in ${remainingTime}...`;
                }
            }
        }
        
        // Update progress bar
        this.updateProgress(time);
        
        console.log(`🔄 State synchronized to time ${time.toFixed(2)}s, sentence index: ${this.currentSentenceIndex}`);
    }

    /**
     * Manually update the timestamp display (shows current time / total song duration)
     */
    updateTimestampDisplay() {
        if (this.timestampDisplay && this.musicAudio) {
            const currentTime = this.musicAudio.currentTime || 0;
            const totalDuration = this.getTotalEndTime() || this.musicAudio.duration || 0;
            this.timestampDisplay.textContent = `${currentTime.toFixed(2)}s / ${totalDuration.toFixed(2)}s`;
        }
    }

    /**
     * Pause both audio sources and lyrics animation
     */
    pause() {
        if (this.songAudio) {
            this.songAudio.pause();
        }
        if (this.musicAudio) {
            this.musicAudio.pause();
        }
        this.pauseAnimation();
    }

    /**
     * Play both audio sources and start animation
     * Synchronizes song with music before playing
     */
    play() {
        // Ensure both audio tracks are synchronized before playing
        if (this.musicAudio && this.songAudio) {
            const musicTime = this.musicAudio.currentTime;
            const songTime = this.songAudio.currentTime;
            const timeDiff = Math.abs(musicTime - songTime);
            
            // If tracks are out of sync, synchronize them
            if (timeDiff > 0.05) { // 50ms tolerance
                console.log(`🔄 Syncing audio before play: Music=${musicTime.toFixed(2)}s, Song=${songTime.toFixed(2)}s`);
                this.songAudio.currentTime = musicTime; // Use music as the source of truth
            }
        }
        
        // Play both audio sources simultaneously
        const playPromises = [];
        
        if (this.songAudio) {
            playPromises.push(this.songAudio.play().catch(e => console.log('Song play error:', e)));
        }
        if (this.musicAudio) {
            playPromises.push(this.musicAudio.play().catch(e => console.log('Music play error:', e)));
        }
        
        // Wait for both to start playing, then verify sync
        Promise.all(playPromises).then(() => {
            setTimeout(() => {
                this.verifyPlaybackSync();
            }, 100); // Check sync after 100ms of playback
        });
        
        // Start lyrics animation
        this.startAnimation();
    }

    /**
     * Toggle between play and pause states
     * Uses music audio paused state to determine current state (music is timing authority)
     */
    togglePlayback() {
        // Check if currently paused by examining music audio state
        // Music audio is the timing authority and source of truth
        if (this.musicAudio && this.musicAudio.paused) {
            // Currently paused, so play
            this.play();
        } else {
            // Currently playing, so pause
            this.pause();
        }
    }

    /**
     * Check if the music audio is currently paused
     * @returns {boolean} - True if music is paused, false if playing or if no music audio
     */
    isPaused() {
        // Music audio is the timing authority and source of truth for playback state
        return this.musicAudio ? this.musicAudio.paused : true;
    }

    /**
     * Get the current playback time from the music audio (timing authority)
     * @returns {number} - Current time in seconds, or 0 if no music audio
     */
    getCurrentTime() {
        // Music audio is the timing authority and source of truth for current time
        return this.musicAudio ? this.musicAudio.currentTime : 0;
    }

    /**
     * Get the total song duration (timing authority)
     * @returns {number} - Total song duration in seconds
     */
    getTotalEndTime() {
        // Use total_song_length from lyrics data if available, otherwise fall back to music audio duration
        return this.lyricsData.total_song_length || 
               (this.musicAudio && this.musicAudio.duration) || 
               0;
    }

    /**
     * Check if any recognition word is currently being highlighted
     * @param {number} currentTime - Current playback time
     * @returns {boolean} - True if a recognition word is active
     */
    isRecognitionWordActive(currentTime) {
        const sentenceIndex = this.findCurrentSentenceIndex(currentTime);
        if (sentenceIndex === -1) return false;
        
        const sentence = this.lyricsData.sentences[sentenceIndex];
        
        for (const word of sentence.words) {
            if (!word.text || word.text.length === 0) {
                continue;
            }
            
            const wordAbsoluteStart = word.start_time || 0;
            const wordAbsoluteEnd = word.end_time || 0;
            
            // Apply the same 200ms early offset used for highlighting to audio switching
            const earlyStartTime = wordAbsoluteStart - 0.2;
            
            // Check if this word is currently highlighted and has target_word flag
            // Use the same timing as word highlighting (200ms early)
            if (currentTime >= earlyStartTime && currentTime <= wordAbsoluteEnd && word.target_word) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Pause voice playback based on recognition state
     * @param {boolean} isRecognitionActive - Whether a recognition word is currently highlighted
     */
    pauseVoicePlayback(isRecognitionActive) {
        // Check if vocal muting is enabled (default to true if not specified)
        const muteVocalsEnabled = this.lyricsData.mute_vocals_during_target !== false;
        
        // Only proceed with muting logic if mute_vocals_during_target is true
        if (!muteVocalsEnabled) {
            // If muting is disabled, just track the state but don't pause/resume vocals
            this.previousRecognitionState = isRecognitionActive;
            return;
        }
        
        // Only change playback state when recognition state actually changes
        if (isRecognitionActive !== this.previousRecognitionState) {
            if (this.songAudio) {
                if (isRecognitionActive) {
                    // Pause song during recognition words
                    if (!this.songAudio.paused) {
                        this.songAudio.pause();
                    }
                } else {
                    // Resume song when recognition word ends
                    if (this.songAudio.paused && this.musicAudio && !this.musicAudio.paused) {
                        try {
                            // Synchronize song timestamp with music before resuming
                            const musicTime = this.musicAudio.currentTime;
                            this.setCurrentTime(musicTime); // Synchronize both audio sources
                            // Only resume if music is still playing (main playback is active)
                            this.songAudio.play().catch(e => console.log('Song resume error:', e));
                            this.musicAudio.play().catch(e => console.log('Music resume error:', e));
                        } catch (e) {
                            console.error('Error synchronizing song with music:', e);
                            // Still try to resume even if sync fails
                            this.songAudio.play().catch(e => console.log('Song resume error:', e));
                        }
                    }
                }
            }
            
            // Update previous state
            this.previousRecognitionState = isRecognitionActive;
        }
    }

    /**
     * Reset the lyrics engine to initial state
     */
    reset() {
        this.currentSentenceIndex = 0;
        this.isPlaying = false;
        this.previousRecognitionState = false; // Reset recognition state
        this.currentImageIndex = -1; // Reset image state
        
        // Stop speech recognition when resetting
        if (window.SpeechRecognitionModule && window.SpeechRecognitionModule.isRecognitionRunning()) {
            console.log('Lyrics reset - stopping speech recognition');
            window.SpeechRecognitionModule.stopRecognition();
        }
        
        // Clear recognition log when resetting
        if (window.clearRecognizedWordsLog) {
            window.clearRecognizedWordsLog();
        }
        
        // Reset target word timing windows
        if (this.targetWords) {
            this.targetWords.forEach(targetWord => {
                targetWord.listeningActive = false;
            });
        }
        
        // Reset audio time to beginning
        this.setCurrentTime(0);
        
        // Clear all recorded spoken words and scores
        if (this.targetWords) {
            this.targetWords.forEach(targetWord => {
                targetWord.spokenWords = [];
                targetWord.jaroScores = [];
                targetWord.trigramScores = [];
                targetWord.match_found = false;
            });
        }
        
        if (this.sentenceDisplay) {
            this.sentenceDisplay.innerHTML = 'Click "Start" to begin your sing-along experience!';
        }
        if (this.progressFill) {
            this.progressFill.style.width = '0%';
        }
        // Hide all sentence images
        this.hideAllSentenceImages();
        
        // Update debug table to reflect reset state
        if (window.updateDebugTable) {
            window.updateDebugTable();
        }
    }

    /**
     * Activate the image for the current sentence
     * @param {number} sentenceIndex - Index of the sentence to activate image for
     */
    activateSentenceImage(sentenceIndex) {
        if (!this.imageContainer || sentenceIndex === this.currentImageIndex) {
            return; // No image container or same image already active
        }

        // Check if this sentence has an image
        const sentence = this.lyricsData.sentences[sentenceIndex];
        if (!sentence || !sentence.image) {
            return; // No image for this sentence
        }

        // Hide current image if any
        if (this.currentImageIndex >= 0) {
            const currentImg = document.getElementById(`sentence-image-${this.currentImageIndex}`);
            if (currentImg) {
                currentImg.classList.remove('active');
                currentImg.style.opacity = '0';
            }
        }

        // Show new image with fade-in
        const newImg = document.getElementById(`sentence-image-${sentenceIndex}`);
        if (newImg) {
            newImg.classList.add('active');
            newImg.style.opacity = '1';
            this.currentImageIndex = sentenceIndex;

        }
    }

    /**
     * Hide all sentence images
     */
    hideAllSentenceImages() {
        if (!this.imageContainer) return;

        const images = this.imageContainer.querySelectorAll('.sentence-image');
        images.forEach(img => {
            img.classList.remove('active');
            img.style.opacity = '0';
        });
        this.currentImageIndex = -1;
    }

    /**
     * Score ratification - comprehensive rescoring of all target words using closest spoken words
     * Goes through each target word and finds the 15 closest spoken words by timestamp proximity
     */
    score_ratification() {
        if (!window.getRecognizedWordsLog) {
            console.log('No recognized words log available for score ratification');
            return;
        }
        
        const recognizedWordsLog = window.getRecognizedWordsLog();
        if (recognizedWordsLog.length === 0) {
            console.log('No recognized words in log for score ratification');
            return;
        }
        
        console.log('🔍 Starting score ratification for all target words...');
        let ratificationChanges = 0;
        
        this.targetWords.forEach((targetWord, index) => {
            // Get the target word's timing from lyrics data
            const sentence = this.lyricsData.sentences[targetWord.sentenceIndex];
            const word = sentence.words[targetWord.wordIndex];
            const wordStartTime = word.start_time || 0;
            const wordEndTime = word.end_time || wordStartTime;
            const wordMidTime = (wordStartTime + wordEndTime) / 2;
            
            // Find the 15 words that surround the target word's timing
            // Sort all recognized words by their distance from the target word time
            const wordsWithDistance = recognizedWordsLog.map(entry => ({
                word: entry.word,
                timestamp: entry.timestamp,
                distance: Math.abs(entry.timestamp - wordMidTime)
            }));
            
            // Sort by distance and take the closest 15 words
            wordsWithDistance.sort((a, b) => a.distance - b.distance);
            const wordsInWindow = wordsWithDistance.slice(0, 15).map(entry => entry.word);
            
            // Store original values for comparison
            const originalSpokenWords = [...targetWord.spokenWords];
            const originalMatchFound = targetWord.match_found;
            
            // Replace spoken words with words found in the precise timing window
            targetWord.spokenWords = wordsInWindow;
            
            // Recalculate scores with the new words
            const targetWordText = targetWord.word.toLowerCase();
            targetWord.jaroScores = [];
            targetWord.trigramScores = [];
            
            wordsInWindow.forEach(spokenWord => {
                const spokenWordLower = spokenWord.toLowerCase();
                
                // Calculate Jaro distance
                const jaroScore = window.calculateJaroDistance ? 
                    window.calculateJaroDistance(targetWordText, spokenWordLower) : 0;
                targetWord.jaroScores.push(jaroScore);
                
                // Calculate trigram similarity
                const trigramScore = window.calculateTrigramSimilarity ?
                    window.calculateTrigramSimilarity(targetWordText, spokenWordLower) : 0;
                targetWord.trigramScores.push(trigramScore);
            });
            
            // Recalculate match_found flag using same thresholds
            const hasJaroMatch = targetWord.jaroScores.some(score => score > 0.8);
            const hasTrigramMatch = targetWord.trigramScores.some(score => score > 0.4);
            targetWord.match_found = hasJaroMatch || hasTrigramMatch;
            
            // Log changes for debugging
            const statusChange = originalMatchFound !== targetWord.match_found;
            const wordsChange = originalSpokenWords.length !== wordsInWindow.length || 
                               !originalSpokenWords.every((word, i) => word === wordsInWindow[i]);
            
            if (statusChange || wordsChange) {
                ratificationChanges++;
                const closestWords = wordsWithDistance.slice(0, 15);
                const timeRange = closestWords.length > 0 ? 
                    `${Math.min(...closestWords.map(w => w.timestamp)).toFixed(1)}s - ${Math.max(...closestWords.map(w => w.timestamp)).toFixed(1)}s` : 
                    'no words';
                console.log(`🔄 Ratification for "${targetWord.word}" (${wordMidTime.toFixed(1)}s):`, {
                    closest15Words: timeRange,
                    originalWords: originalSpokenWords.length,
                    newWords: wordsInWindow.length,
                    originalMatch: originalMatchFound,
                    newMatch: targetWord.match_found,
                    statusChanged: statusChange ? '✅' : '➖'
                });
            }
        });
        
        console.log(`✅ Score ratification complete: ${ratificationChanges} target words updated`);
        
        // Update debug table to reflect ratification results
        if (window.updateDebugTable) {
            window.updateDebugTable();
        }
    }

    /**
     * Process final words when song ends - check if last target words need final scoring
     */
    processFinalWords() {
        if (!window.getRecognizedWordsLog) {
            console.log('No recognized words log available for final processing');
            return;
        }
        
        const recognizedWordsLog = window.getRecognizedWordsLog();
        if (recognizedWordsLog.length === 0) {
            console.log('No recognized words in log for final processing');
            return;
        }
        
        // Find target words that have no spoken words recorded (didn't capture during normal listening)
        const unprocessedTargetWords = this.targetWords.filter(targetWord => 
            targetWord.spokenWords.length === 0 && !targetWord.match_found
        );
        
        if (unprocessedTargetWords.length === 0) {
            console.log('All target words were already processed during normal playback');
            return;
        }
        
        console.log(`Processing final words for ${unprocessedTargetWords.length} unprocessed target words`);
        
        // Get the last 15 words from the recognition log for final processing
        const lastFifteenWords = recognizedWordsLog.slice(-15).map(entry => entry.word);
        
        unprocessedTargetWords.forEach(targetWord => {
            // Store the final words
            targetWord.spokenWords = lastFifteenWords;
            
            // Calculate Jaro and trigram scores
            const targetWordText = targetWord.word.toLowerCase();
            targetWord.jaroScores = [];
            targetWord.trigramScores = [];
            
            lastFifteenWords.forEach(spokenWord => {
                const spokenWordLower = spokenWord.toLowerCase();
                
                // Calculate Jaro distance
                const jaroScore = window.calculateJaroDistance ? 
                    window.calculateJaroDistance(targetWordText, spokenWordLower) : 0;
                targetWord.jaroScores.push(jaroScore);
                
                // Calculate trigram similarity
                const trigramScore = window.calculateTrigramSimilarity ?
                    window.calculateTrigramSimilarity(targetWordText, spokenWordLower) : 0;
                targetWord.trigramScores.push(trigramScore);
            });
            
            // Check if any scores pass the thresholds and set match_found flag
            const hasJaroMatch = targetWord.jaroScores.some(score => score > 0.8);
            const hasTrigramMatch = targetWord.trigramScores.some(score => score > 0.4);
            targetWord.match_found = hasJaroMatch || hasTrigramMatch;
            
            console.log(`Final processing for "${targetWord.word}": ${targetWord.match_found ? 'MATCH' : 'NO MATCH'}`);
        });
        
        // Update debug table to reflect final processing
        if (window.updateDebugTable) {
            window.updateDebugTable();
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LyricsEngine;
} else {
    window.LyricsEngine = LyricsEngine;
}