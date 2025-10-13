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
        
        // Initialize audio sources
        this.songAudio = elements.songAudio;  // Voice/vocal track (can pause during recognition)
        this.musicAudio = elements.musicAudio; // Background music (source of truth for timing)
        
        // Track recognition state to detect changes
        this.previousRecognitionState = false;
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
        let cumulativeTime = 0; // Track cumulative duration to calculate word start times
        
        sentence.words.forEach(word => {
            // Skip empty words - don't display or highlight them
            if (!word.text || word.text.length === 0) {
                // Still update cumulative time for proper timing
                cumulativeTime += word.duration;
                return; // Skip to next word
            }
            
            // Calculate word start time from cumulative duration of previous words
            const wordStartTime = cumulativeTime;
            
            // Apply 10% slowdown to word timing
            const slowdownFactor = 1.1;
            const wordRelativeStart = wordStartTime * slowdownFactor;
            const wordRelativeEnd = (wordStartTime + word.duration) * slowdownFactor;
            
            let className = 'word';
            let fontSize = '';
            
            // Only highlight if not in early preview mode and timing is right
            if (!isEarlyPreview && relativeTime >= wordRelativeStart && relativeTime <= wordRelativeEnd) {
                className += ' highlighted';
                
                // Double font size if recognise is true
                if (word.recognise) {
                    fontSize = 'font-size: 2em; ';
                }
            }
            
            html += `<span class="${className}" style="${fontSize}">${word.text}</span>`;
            
            // Add this word's duration to cumulative time for next word
            cumulativeTime += word.duration;
        });

        this.sentenceDisplay.innerHTML = html;
    }

    /**
     * Update progress bar based on current time
     * @param {number} currentTime - Current playback time
     */
    updateProgress(currentTime) {
        if (!this.progressFill) return;

        const totalDuration = Math.max(
            ...this.lyricsData.sentences.map((s, index) => this.calculateSentenceEndTime(index)),
            (this.musicAudio && this.musicAudio.duration) || 16
        );
        const progress = (currentTime / totalDuration) * 100;
        this.progressFill.style.width = `${Math.min(progress, 100)}%`;
    }

    /**
     * Find the current sentence index based on time
     * @param {number} currentTime - Current playback time
     * @returns {number} - Index of current sentence, or -1 if none found
     */
    findCurrentSentenceIndex(currentTime) {
        // Check if we should show the first sentence early (1 second before start)
        const firstSentenceStartTime = this.calculateSentenceStartTime(0);
        if (currentTime >= firstSentenceStartTime - 1 && currentTime < firstSentenceStartTime) {
            return 0; // Show first sentence early
        }
        
        return this.lyricsData.sentences.findIndex((sentence, index) => {
            const sentenceStartTime = this.calculateSentenceStartTime(index);
            const sentenceEndTime = this.calculateSentenceEndTime(index);
            return currentTime >= sentenceStartTime && currentTime < sentenceEndTime;
        });
    }

    /**
     * Check if the song has ended (including outro period)
     * @param {number} currentTime - Current playback time
     * @returns {boolean} - Whether the song has finished including outro
     */
    isSongFinished(currentTime) {
        const lastSentenceIndex = this.lyricsData.sentences.length - 1;
        const songEndTime = this.calculateSentenceEndTime(lastSentenceIndex);
        return currentTime >= (songEndTime + this.lyricsData.outro);
    }

    /**
     * Check if lyrics have ended but outro is still playing
     * @param {number} currentTime - Current playback time
     * @returns {boolean} - Whether in outro period
     */
    isInOutroPeriod(currentTime) {
        const lastSentenceIndex = this.lyricsData.sentences.length - 1;
        const songEndTime = this.calculateSentenceEndTime(lastSentenceIndex);
        return currentTime >= songEndTime && currentTime < (songEndTime + this.lyricsData.outro);
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
     * Calculate the start time of a sentence based on cumulative duration of previous sentences
     * @param {number} sentenceIndex - Index of the sentence
     * @returns {number} - Calculated start time
     */
    calculateSentenceStartTime(sentenceIndex) {
        if (sentenceIndex === 0) return 0;
        
        let cumulativeTime = 0;
        for (let i = 0; i < sentenceIndex; i++) {
            const sentence = this.lyricsData.sentences[i];
            cumulativeTime += sentence.words.reduce((sum, word) => sum + word.duration, 0);
        }
        return cumulativeTime;
    }

    /**
     * Calculate the duration of a sentence based on word durations
     * @param {Object} sentence - Sentence object with words array
     * @returns {number} - Total duration of the sentence
     */
    calculateSentenceDuration(sentence) {
        return sentence.words.reduce((sum, word) => sum + word.duration, 0);
    }

    /**
     * Calculate the end time of a sentence based on its index
     * @param {number} sentenceIndex - Index of the sentence
     * @returns {number} - Calculated end time (startTime + duration)
     */
    calculateSentenceEndTime(sentenceIndex) {
        const startTime = this.calculateSentenceStartTime(sentenceIndex);
        const sentence = this.lyricsData.sentences[sentenceIndex];
        const duration = this.calculateSentenceDuration(sentence);
        return startTime + duration;
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
        const currentTime = rawTime - this.lyricsData.offset;
        
        // Update timestamp display for debugging
        if (this.timestampDisplay) {
            this.timestampDisplay.textContent = `${rawTime.toFixed(2)}s`;
        }        // Handle intro period (offset duration)
        if (currentTime < 0) {
            const remainingTime = Math.ceil(Math.abs(currentTime));
            
            if (remainingTime > 10) {
                this.sentenceDisplay.innerHTML = `🎵 Get ready to sing along! 🎵<br>Starting in ${remainingTime}...`;
            } else if (remainingTime > 5) {
                this.sentenceDisplay.innerHTML = `🎤 Almost ready! 🎤<br>Starting in ${remainingTime}...`;
            } else if (remainingTime > 2) {
                this.sentenceDisplay.innerHTML = `✨ Get ready! ✨<br>Starting in ${remainingTime}...`;
            } else if (remainingTime > 1) {
                this.sentenceDisplay.innerHTML = `� Ready? �<br>Starting in ${remainingTime}...`;
            } else {
                this.sentenceDisplay.innerHTML = `🌟 Here we go! 🌟<br>Starting in ${remainingTime}...`;
            }
            
            this.animationFrame = requestAnimationFrame(() => this.animate());
            return;
        }
        
        // Check if in outro period (lyrics finished but outro still playing)
        if (this.isInOutroPeriod(currentTime)) {
            const lastSentenceIndex = this.lyricsData.sentences.length - 1;
            const songEndTime = this.calculateSentenceEndTime(lastSentenceIndex);
            const outroRemaining = Math.ceil((songEndTime + this.lyricsData.outro) - currentTime);
            
            // Keep the last sentence visible during outro instead of showing completion message
            this.displaySentence(lastSentenceIndex, currentTime);
            
            // Update timestamp display (no outro countdown shown)
            if (this.timestampDisplay) {
                this.timestampDisplay.textContent = `${rawTime.toFixed(2)}s`;
            }
            
            this.updateProgress(currentTime);
            this.animationFrame = requestAnimationFrame(() => this.animate());
            return;
        }
        
        // Find current sentence using lyrics engine (after delay)
        let sentenceIndex = this.findCurrentSentenceIndex(currentTime);
        
        if (sentenceIndex === -1 && this.isSongFinished(currentTime)) {
            // Song and outro finished - call stop callback if provided
            if (this.onStop) {
                this.onStop();
            }
            return;
        }

        if (sentenceIndex !== -1) {
            this.currentSentenceIndex = sentenceIndex;
            this.displaySentence(sentenceIndex, currentTime);
        }
        
        // Check if any recognition word is currently highlighted
        const isRecognitionActive = this.isRecognitionWordActive(currentTime);
        this.pauseVoicePlayback(isRecognitionActive);
        
        this.updateProgress(currentTime);
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
        
        // Show initial intro message
        if (this.sentenceDisplay) {
            this.sentenceDisplay.innerHTML = `🎵 Get ready to sing along! 🎵<br>Starting in ${this.lyricsData.offset}...`;
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
        if (this.songAudio) {
            this.songAudio.currentTime = time;
        }
        if (this.musicAudio) {
            this.musicAudio.currentTime = time;
        }
        // Update timestamp display when manually setting time
        this.updateTimestampDisplay();
    }

    /**
     * Manually update the timestamp display
     */
    updateTimestampDisplay() {
        if (this.timestampDisplay && this.musicAudio) {
            const currentTime = this.musicAudio.currentTime || 0;
            this.timestampDisplay.textContent = `${currentTime.toFixed(2)}s`;
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
     * Play both audio sources and start lyrics animation
     * Synchronizes song with music before playing
     */
    play() {
        // Synchronize song with music before playing
        if (this.musicAudio && this.songAudio) {
            this.setCurrentTime(this.musicAudio.currentTime);
        }
        
        // Play both audio sources
        if (this.songAudio) {
            this.songAudio.play().catch(e => console.log('Song play error:', e));
        }
        if (this.musicAudio) {
            this.musicAudio.play().catch(e => console.log('Music play error:', e));
        }
        
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
     * Get the duration of the music audio (timing authority)
     * @returns {number} - Duration in seconds, or 0 if no music audio or not loaded
     */
    getDuration() {
        // Music audio is the timing authority for duration
        return this.musicAudio && this.musicAudio.duration ? this.musicAudio.duration : 0;
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
        const sentenceStartTime = this.calculateSentenceStartTime(sentenceIndex);
        const relativeTime = currentTime - sentenceStartTime;
        
        let cumulativeTime = 0;
        
        for (const word of sentence.words) {
            if (!word.text || word.text.length === 0) {
                cumulativeTime += word.duration;
                continue;
            }
            
            const slowdownFactor = 1.1;
            const wordRelativeStart = cumulativeTime * slowdownFactor;
            const wordRelativeEnd = (cumulativeTime + word.duration) * slowdownFactor;
            
            // Check if this word is currently highlighted and has recognise flag
            if (relativeTime >= wordRelativeStart && relativeTime <= wordRelativeEnd && word.recognise) {
                return true;
            }
            
            cumulativeTime += word.duration;
        }
        
        return false;
    }

    /**
     * Pause voice playback based on recognition state
     * @param {boolean} isRecognitionActive - Whether a recognition word is currently highlighted
     */
    pauseVoicePlayback(isRecognitionActive) {
        // Only change playback state when recognition state actually changes
        if (isRecognitionActive !== this.previousRecognitionState) {
            if (this.songAudio) {
                if (isRecognitionActive) {
                    // Pause song during recognition words
                    if (!this.songAudio.paused) {
                        this.songAudio.pause();
                        console.log('Song paused for recognition word');
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
                            console.log(`Song resumed after recognition word, synchronized to music timestamp: ${musicTime.toFixed(2)}s`);
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
        if (this.sentenceDisplay) {
            this.sentenceDisplay.innerHTML = 'Click "Start" to begin your sing-along experience!';
        }
        if (this.progressFill) {
            this.progressFill.style.width = '0%';
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LyricsEngine;
} else {
    window.LyricsEngine = LyricsEngine;
}