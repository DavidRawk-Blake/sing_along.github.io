/**
 * Lyrics Engine - Handles karaoke-style lyrics display and synchronization
 * Focused on timing-based display without speech recognition dependency
 */

class LyricsEngine {
    constructor() {
        // Lyrics data - will be loaded from JSON file
        this.lyricsData = null;
        this.isDataLoaded = false;

        // State management
        this.currentSentenceIndex = 0;
        this.isPlaying = false;
        
        // Animation and timing state
        this.startTime = 0;
        this.animationFrame = null;
        this.onStop = null; // Callback for when animation should stop
    }

    /**
     * Load lyrics data from JSON file
     * @param {string} dataFile - Path to the JSON file (default: 'lyrics-data.json')
     * @returns {Promise<boolean>} - True if loaded successfully, false otherwise
     */
    async loadLyricsData(dataFile = 'lyrics-data.json') {
        try {
            const response = await fetch(dataFile);
            if (!response.ok) {
                throw new Error(`Failed to load lyrics data: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Validate data structure
            if (!this.validateLyricsData(data)) {
                throw new Error('Invalid lyrics data structure');
            }
            
            this.lyricsData = data;
            this.isDataLoaded = true;
            console.log('Lyrics data loaded successfully');
            return true;
            
        } catch (error) {
            console.error('Error loading lyrics data:', error);
            
            // Fallback to minimal default data
            this.lyricsData = {
                offset: 17,
                outro: 3,
                song_1_source: "song1.mp3",
                song_2_source: "song2.mp3",
                sentences: [{
                    words: [{ text: "Loading failed...", duration: 1.0, recognise: false }]
                }]
            };
            this.isDataLoaded = false;
            return false;
        }
    }

    /**
     * Validate lyrics data structure
     * @param {Object} data - Data to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    validateLyricsData(data) {
        if (!data || typeof data !== 'object') return false;
        if (typeof data.offset !== 'number') return false;
        if (typeof data.outro !== 'number') return false;
        if (typeof data.song_1_source !== 'string') return false;
        if (typeof data.song_2_source !== 'string') return false;
        if (!Array.isArray(data.sentences)) return false;
        
        return data.sentences.every(sentence => 
            Array.isArray(sentence.words) && 
            sentence.words.every(word => 
                typeof word.text === 'string' && 
                typeof word.duration === 'number' &&
                typeof word.recognise === 'boolean'
            )
        );
    }

    /**
     * Verify that audio sources are accessible
     * @returns {Promise<boolean>} - True if both audio sources are accessible
     */
    async verifyAudioSources() {
        if (!this.lyricsData) {
            console.warn('No lyrics data available for audio verification');
            return false;
        }
        
        try {
            // Check if audio files exist/are accessible using HEAD requests
            const checkAudio = async (src) => {
                try {
                    const response = await fetch(src, { method: 'HEAD' });
                    return response.ok;
                } catch (error) {
                    console.warn(`Audio source ${src} not accessible:`, error.message);
                    return false;
                }
            };
            
            const song1Available = await checkAudio(this.lyricsData.song_1_source);
            const song2Available = await checkAudio(this.lyricsData.song_2_source);
            
            if (song1Available && song2Available) {
                console.log('All audio sources verified successfully');
                return true;
            } else {
                console.warn(`Audio verification failed - Song 1: ${song1Available}, Song 2: ${song2Available}`);
                return false;
            }
            
        } catch (error) {
            console.error('Audio source verification error:', error);
            return false;
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
        
        // Safety check: ensure lyrics data is loaded
        if (!this.lyricsData || !this.isDataLoaded) {
            console.warn('Lyrics data not loaded, stopping animation');
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