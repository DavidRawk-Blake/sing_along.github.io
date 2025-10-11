/**
 * Lyrics Engine - Handles karaoke-style lyrics display and synchronization
 * Extracted from page2.html for better code organization and reusability
 */

class LyricsEngine {
    constructor() {
        // Sample lyrics data with timestamps
        this.lyricsData = {
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
    }

    /**
     * Initialize the lyrics engine with DOM elements
     * @param {Object} elements - Object containing DOM element references
     */
    initialize(elements) {
        this.sentenceDisplay = elements.sentenceDisplay;
        this.progressFill = elements.progressFill;
        this.audioPlayer = elements.audioPlayer;
    }

    /**
     * Check if spoken word matches the currently highlighted word
     * @param {string} transcript - The recognized speech transcript
     * @param {number} currentTime - Current playback time
     * @returns {boolean} - Whether a word was matched
     */
    checkWordMatch(transcript, currentTime) {
        if (!this.isPlaying || this.currentSentenceIndex >= this.lyricsData.sentences.length) return false;
        
        const sentence = this.lyricsData.sentences[this.currentSentenceIndex];
        
        // Find currently highlighted word
        const currentWord = sentence.words.find(word => {
            const wordStart = word.startTime;
            const wordEnd = word.endTime;
            return currentTime >= wordStart && currentTime <= wordEnd;
        });
        
        if (currentWord && transcript.includes(currentWord.text.toLowerCase())) {
            console.log(`✓ Matched word: ${currentWord.text}`);
            this.flashCorrectWord();
            return true;
        }
        
        return false;
    }

    /**
     * Flash effect for correct word recognition
     */
    flashCorrectWord() {
        const highlightedWord = document.querySelector('.word.highlighted');
        if (highlightedWord) {
            highlightedWord.style.background = 'rgba(46, 213, 115, 0.8)'; // Green flash
            setTimeout(() => {
                highlightedWord.style.background = 'rgba(255, 255, 0, 0.8)'; // Back to yellow
            }, 200);
        }
    }

    /**
     * Display current sentence with word highlighting
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