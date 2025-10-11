/**
 * Lyrics Engine - Handles karaoke-style lyrics display and synchronization
 * Focused on timing-based display without speech recognition dependency
 */

class LyricsEngine {
    constructor() {
        // Sample lyrics data with timestamps
        this.lyricsData = {
            offset: 17, // 17-second delay before lyrics start
            sentences: [
                {
                    text: "Twinkle twinkle little star",
                    startTime: 0,
                    words: [
                        { text: "Twinkle", duration: 1.4 },
                        { text: "twinkle", duration: 1.3 },
                        { text: "little", duration: 1.1 },
                        { text: "star", duration: 2.0 }
                    ]
                },
                {
                    text: "How I wonder what you are",
                    startTime: 4,
                    words: [
                        { text: "How", duration: 0.6 },
                        { text: "I", duration: 0.4 },
                        { text: "wonder", duration: 0.8 },
                        { text: "what", duration: 0.6 },
                        { text: "you", duration: 0.4 },
                        { text: "are", duration: 0.2 }
                    ]
                },
                {
                    text: "Up above the world so high",
                    startTime: 8,
                    words: [
                        { text: "Up", duration: 0.6 },
                        { text: "above", duration: 0.8 },
                        { text: "the", duration: 0.4 },
                        { text: "world", duration: 0.6 },
                        { text: "so", duration: 0.4 },
                        { text: "high", duration: 0.2 }
                    ]
                },
                {
                    text: "Like a diamond in the sky",
                    startTime: 12,
                    words: [
                        { text: "Like", duration: 0.6 },
                        { text: "a", duration: 0.2 },
                        { text: "diamond", duration: 0.8 },
                        { text: "in", duration: 0.4 },
                        { text: "the", duration: 0.4 },
                        { text: "sky", duration: 0.6 }
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
        const relativeTime = currentTime - sentence.startTime;
        
        // Check if this is early preview (1 second before first sentence)
        const isEarlyPreview = sentenceIndex === 0 && currentTime < sentence.startTime;

        let html = '';
        let cumulativeTime = 0; // Track cumulative duration to calculate word start times
        
        sentence.words.forEach(word => {
            // Calculate word start time from cumulative duration of previous words
            const wordStartTime = cumulativeTime;
            
            // Apply 10% slowdown to word timing
            const slowdownFactor = 1.1;
            const wordRelativeStart = wordStartTime * slowdownFactor;
            const wordRelativeEnd = (wordStartTime + word.duration) * slowdownFactor;
            
            let className = 'word';
            
            // Only highlight if not in early preview mode and timing is right
            if (!isEarlyPreview && relativeTime >= wordRelativeStart && relativeTime <= wordRelativeEnd) {
                className += ' highlighted';
            }
            
            html += `<span class="${className}">${word.text}</span>`;
            
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
            ...this.lyricsData.sentences.map(s => this.calculateSentenceEndTime(s)),
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
        const firstSentence = this.lyricsData.sentences[0];
        if (currentTime >= firstSentence.startTime - 1 && currentTime < firstSentence.startTime) {
            return 0; // Show first sentence early
        }
        
        return this.lyricsData.sentences.findIndex(sentence => 
            currentTime >= sentence.startTime && currentTime < this.calculateSentenceEndTime(sentence)
        );
    }

    /**
     * Check if the song has ended
     * @param {number} currentTime - Current playback time
     * @returns {boolean} - Whether the song has finished
     */
    isSongFinished(currentTime) {
        const lastSentence = this.lyricsData.sentences[this.lyricsData.sentences.length - 1];
        return currentTime >= this.calculateSentenceEndTime(lastSentence);
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
     * Calculate the end time of a sentence based on word durations
     * @param {Object} sentence - Sentence object with words array
     * @returns {number} - Calculated end time (startTime + total word duration)
     */
    calculateSentenceEndTime(sentence) {
        const totalDuration = sentence.words.reduce((sum, word) => sum + word.duration, 0);
        return sentence.startTime + totalDuration;
    }

    /**
     * Main animation loop with timing offset and intro messages
     */
    animate() {
        if (!this.isPlaying) return;
        
        const rawTime = this.audioPlayer.currentTime || (Date.now() - this.startTime) / 1000;
        const currentTime = rawTime - this.lyricsData.offset;
        
        // Update timestamp display for debugging
        if (this.timestampDisplay) {
            this.timestampDisplay.textContent = `${rawTime.toFixed(2)}s`;
        }        // Handle intro period (first 3 seconds)
        if (currentTime < 0) {
            const remainingTime = Math.ceil(Math.abs(currentTime));
            
            if (remainingTime > 2) {
                this.sentenceDisplay.innerHTML = '🎵 Get ready to sing along! 🎵<br>Starting in 3...';
            } else if (remainingTime > 1) {
                this.sentenceDisplay.innerHTML = '🎤 Ready? 🎤<br>Starting in 2...';
            } else {
                this.sentenceDisplay.innerHTML = '✨ Here we go! ✨<br>Starting in 1...';
            }
            
            this.animationFrame = requestAnimationFrame(() => this.animate());
            return;
        }
        
        // Find current sentence using lyrics engine (after delay)
        let sentenceIndex = this.findCurrentSentenceIndex(currentTime);
        
        if (sentenceIndex === -1 && this.isSongFinished(currentTime)) {
            // Song finished - call stop callback if provided
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
            this.sentenceDisplay.innerHTML = '🎵 Get ready to sing along! 🎵<br>Starting in 3...';
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