/**
 * Lyrics Engine - Handles karaoke-style lyrics display and synchronization
 * Focused on timing-based display without speech recognition dependency
 */

class LyricsEngine {
    constructor() {
        // Lyrics data - now hardcoded to prevent loading failures
        this.lyricsData = {
            offset: 17,
            outro: 3,
            song_1_source: "song1.mp3",
            song_2_source: "song2.mp3",
            sentences: [
                {
                    words: [
                        { text: "Twinkle", duration: 1.4, recognise: false },
                        { text: "twinkle", duration: 1.4, recognise: false },
                        { text: "little", duration: 1.3, recognise: true },
                        { text: "star", duration: 2.0, recognise: false }
                    ]
                },
                {
                    words: [
                        { text: "How", duration: 0.49, recognise: false },
                        { text: "I", duration: 0.46, recognise: false },
                        { text: "wonder", duration: 1.32, recognise: false },
                        { text: "what", duration: 0.69, recognise: false },
                        { text: "you", duration: 0.46, recognise: false },
                        { text: "are", duration: 1.5, recognise: true }
                    ]
                },
                {
                    words: [
                        { text: "", duration: 0.5, recognise: false },
                        { text: "Up", duration: 0.75, recognise: false },
                        { text: "above", duration: 1.2, recognise: false },
                        { text: "the", duration: 0.6, recognise: true },
                        { text: "world", duration: 0.6, recognise: false },
                        { text: "so", duration: 0.7, recognise: false },
                        { text: "high", duration: 1.8, recognise: false }
                    ]
                },
                {
                    words: [
                        { text: "Like", duration: 0.6, recognise: false },
                        { text: "a", duration: 0.7, recognise: false },
                        { text: "diamond", duration: 1.3, recognise: true },
                        { text: "in", duration: 0.4, recognise: false },
                        { text: "the", duration: 0.8, recognise: true },
                        { text: "sky", duration: 2.0, recognise: false }
                    ]
                },
                {
                    words: [
                        { text: "Twinkle", duration: 1.2, recognise: false },
                        { text: "twinkle", duration: 1.1, recognise: false },
                        { text: "little", duration: 1.5, recognise: false },
                        { text: "star", duration: 2.0, recognise: false }
                    ]
                },
                {
                    words: [
                        { text: "How", duration: 0.49, recognise: false },
                        { text: "I", duration: 0.46, recognise: false },
                        { text: "wonder", duration: 1.32, recognise: true },
                        { text: "what", duration: 0.69, recognise: false },
                        { text: "you", duration: 0.46, recognise: false },
                        { text: "are", duration: 3.0, recognise: false }
                    ]
                }
            ]
        };

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
            (this.audioPlayer && this.audioPlayer.duration) || 16
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
        
        const rawTime = this.audioPlayer.currentTime || (Date.now() - this.startTime) / 1000;
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
            
            // Update timestamp to show outro countdown for debugging
            if (this.timestampDisplay) {
                this.timestampDisplay.textContent = `${rawTime.toFixed(2)}s (Outro: ${outroRemaining}s)`;
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
        this.reset();
    }

    /**
     * Reset the lyrics engine to initial state
     */
    reset() {
        this.currentSentenceIndex = 0;
        this.isPlaying = false;
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