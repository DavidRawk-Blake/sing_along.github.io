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
                    endTime: 4,
                    words: [
                        { text: "Twinkle", startTime: 0, endTime: 0.8 },
                        { text: "twinkle", startTime: 1, endTime: 1.8 },
                        { text: "little", startTime: 2, endTime: 2.6 },
                        { text: "star", startTime: 3, endTime: 4 }
                    ]
                },
                {
                    text: "How I wonder what you are",
                    startTime: 4,
                    endTime: 8,
                    words: [
                        { text: "How", startTime: 4, endTime: 4.6 },
                        { text: "I", startTime: 4.8, endTime: 5.2 },
                        { text: "wonder", startTime: 5.4, endTime: 6.2 },
                        { text: "what", startTime: 6.4, endTime: 7 },
                        { text: "you", startTime: 7.2, endTime: 7.6 },
                        { text: "are", startTime: 7.8, endTime: 8 }
                    ]
                },
                {
                    text: "Up above the world so high",
                    startTime: 8,
                    endTime: 12,
                    words: [
                        { text: "Up", startTime: 8, endTime: 8.6 },
                        { text: "above", startTime: 8.8, endTime: 9.6 },
                        { text: "the", startTime: 9.8, endTime: 10.2 },
                        { text: "world", startTime: 10.4, endTime: 11 },
                        { text: "so", startTime: 11.2, endTime: 11.6 },
                        { text: "high", startTime: 11.8, endTime: 12 }
                    ]
                },
                {
                    text: "Like a diamond in the sky",
                    startTime: 12,
                    endTime: 16,
                    words: [
                        { text: "Like", startTime: 12, endTime: 12.6 },
                        { text: "a", startTime: 12.8, endTime: 13 },
                        { text: "diamond", startTime: 13.2, endTime: 14 },
                        { text: "in", startTime: 14.2, endTime: 14.6 },
                        { text: "the", startTime: 14.8, endTime: 15.2 },
                        { text: "sky", startTime: 15.4, endTime: 16 }
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

        let html = '';
        sentence.words.forEach(word => {
            const wordRelativeStart = word.startTime - sentence.startTime;
            const wordRelativeEnd = word.endTime - sentence.startTime;
            
            let className = 'word';
            if (relativeTime >= wordRelativeStart && relativeTime <= wordRelativeEnd) {
                className += ' highlighted';
            }
            
            html += `<span class="${className}">${word.text}</span>`;
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
            ...this.lyricsData.sentences.map(s => s.endTime),
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
        return this.lyricsData.sentences.findIndex(sentence => 
            currentTime >= sentence.startTime && currentTime < sentence.endTime
        );
    }

    /**
     * Check if the song has ended
     * @param {number} currentTime - Current playback time
     * @returns {boolean} - Whether the song has finished
     */
    isSongFinished(currentTime) {
        const lastSentence = this.lyricsData.sentences[this.lyricsData.sentences.length - 1];
        return currentTime >= lastSentence.endTime;
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