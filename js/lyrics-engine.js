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
     * Initialize target words array from lyrics data
     */
    initializeTargetWords() {
        this.targetWords = [];
        
        if (this.lyricsData && this.lyricsData.sentences) {
            this.lyricsData.sentences.forEach((sentence, sentenceIndex) => {
                sentence.words.forEach((word, wordIndex) => {
                    if (word.target_word === true) {
                        // Calculate the start time using the same logic as the lyrics engine
                        const wordTiming = this.calculateWordTiming(sentenceIndex, wordIndex);
                        
                        // Calculate sentence boundaries to constrain listening window
                        const sentenceStartTime = this.calculateSentenceStartTime(sentenceIndex);
                        const sentenceEndTime = this.calculateSentenceEndTime(sentenceIndex);
                        
                        // Constrain listening window to not extend beyond sentence boundaries
                        const earliestStart = Math.max(0, sentenceStartTime); // Can't start before sentence
                        const latestEnd = sentenceEndTime; // Can't extend beyond sentence end
                        
                        // Calculate desired listening window with 3-second buffer
                        const desiredStartTime = Math.max(0, wordTiming.start - 3.0);
                        const desiredEndTime = wordTiming.end + 3.0;
                        
                        // Apply sentence boundary constraints
                        const constrainedStartTime = Math.max(earliestStart, desiredStartTime);
                        const constrainedEndTime = Math.min(latestEnd, desiredEndTime);
                        
                        this.targetWords.push({
                            word: word.text,
                            sentenceIndex: sentenceIndex,
                            wordIndex: wordIndex,
                            startTime: constrainedStartTime,
                            endTime: constrainedEndTime,
                            id: `${sentenceIndex}-${wordIndex}`, // Unique identifier
                            spokenWords: [], // Store all final words spoken during this listening-window
                            jaroScores: [], // Store Jaro distances for each spoken word
                            trigramScores: [] // Store trigram similarity scores for each spoken word
                        });
                    }
                });
            });
        }
    }

    /**
     * Calculate the Jaro distance between two strings
     * @param {string} s1 - First string
     * @param {string} s2 - Second string
     * @returns {number} Jaro distance (0-1, where 1 is identical)
     */
    calculateJaroDistance(s1, s2) {
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
    generateTrigrams(str) {
        const trigrams = new Set();
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
    calculateTrigramSimilarity(str1, str2) {
        if (str1 === str2) return 1.0;

        const trigrams1 = this.generateTrigrams(str1);
        const trigrams2 = this.generateTrigrams(str2);

        let commonTrigramsCount = 0;
        for (const trigram of trigrams1) {
            if (trigrams2.has(trigram)) {
                commonTrigramsCount++;
            }
        }

        const totalUniqueTrigrams = trigrams1.size + trigrams2.size - commonTrigramsCount;

        if (totalUniqueTrigrams === 0) return 0.0;

        return commonTrigramsCount / totalUniqueTrigrams;
    }

    /**
     * Record spoken words during listening-windows with similarity scores
     * @param {string} spokenText - The final spoken text to record
     * @param {number} currentTime - Current playback time when spoken
     */
    recordSpokenWords(spokenText, currentTime) {
        if (!spokenText || spokenText.trim().length === 0) return;
        
        const adjustedTime = currentTime - (this.lyricsData ? this.lyricsData.offset : 0);
        
        // Find all target words whose listening-windows are currently active
        this.targetWords.forEach(targetWord => {
            if (adjustedTime >= targetWord.startTime && adjustedTime <= targetWord.endTime) {
                // Parse individual words and calculate similarity scores
                const individualWords = spokenText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
                const targetLower = targetWord.word.toLowerCase();
                
                individualWords.forEach(spokenWord => {
                    // Always append new spoken words (even duplicates from multiple utterances)
                    targetWord.spokenWords.push(spokenWord);
                    
                    // Calculate similarity scores for this utterance
                    const jaroScore = this.calculateJaroDistance(spokenWord, targetLower);
                    const trigramScore = this.calculateTrigramSimilarity(spokenWord, targetLower);
                    
                    // Append scores for this utterance
                    targetWord.jaroScores.push(jaroScore);
                    targetWord.trigramScores.push(trigramScore);
                });
            }
        });
        
        // Update debug table if available
        if (window.updateDebugTable) {
            window.updateDebugTable();
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
            
            // Add target-word class if this is a target word
            if (word.target_word) {
                className += ' target-word';
            }
            
            // Only highlight if not in early preview mode and timing is right
            if (!isEarlyPreview && relativeTime >= wordRelativeStart && relativeTime <= wordRelativeEnd) {
                className += ' highlighted';
                
                // Increase font size moderately if target_word is true
                if (word.target_word) {
                    fontSize = 'font-size: 1.5em; ';
                    
                    // Set this as the current target word for speech recognition
                    if (window.setCurrentTargetWord) {
                        window.setCurrentTargetWord(word.text);
                    }
                }
            }
            
            html += `<span class="${className}" style="${fontSize}">${word.text}</span>`;
            
            // Add this word's duration to cumulative time for next word
            cumulativeTime += word.duration;
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
     * Check for upcoming and active target words to manage speech recognition timing
     * @param {number} sentenceIndex - Current sentence index
     * @param {number} currentTime - Current playback time
     */
    checkTargetWordTiming(sentenceIndex, currentTime) {
        if (!window.setTargetWordListening || !window.clearTargetWordListening) return;

        const currentSentence = this.lyricsData.sentences[sentenceIndex];
        if (!currentSentence) return;

        const sentenceStartTime = this.calculateSentenceStartTime(sentenceIndex);
        const relativeTime = currentTime - sentenceStartTime;
        
        let cumulativeTime = 0;
        const slowdownFactor = 1.1;
        
        // Check current sentence for target words
        currentSentence.words.forEach(word => {
            if (!word.text || word.text.length === 0) {
                cumulativeTime += word.duration;
                return;
            }
            
            if (word.target_word) {
                const wordRelativeStart = cumulativeTime * slowdownFactor;
                const wordRelativeEnd = (cumulativeTime + word.duration) * slowdownFactor;
                
                // Check if we're 2 seconds before the target word
                const preListenTime = wordRelativeStart - 2.0;
                const postListenTime = wordRelativeEnd + 5.0;
                
                if (relativeTime >= preListenTime && relativeTime < wordRelativeStart) {
                    // 2 seconds before target word - start listening
                    window.setTargetWordListening(word.text, 'pre-listening');
                } else if (relativeTime >= wordRelativeStart && relativeTime <= wordRelativeEnd) {
                    // Target word is active - active listening
                    window.setTargetWordListening(word.text, 'active');
                } else if (relativeTime > wordRelativeEnd && relativeTime <= postListenTime) {
                    // Up to 5 seconds after target word - post listening
                    window.setTargetWordListening(word.text, 'post-listening');
                } else if (relativeTime > postListenTime) {
                    // Clear listening if we're past the listening-window
                    window.clearTargetWordListening(word.text);
                }
            }
            
            cumulativeTime += word.duration;
        });
        
        // Also check next sentence for upcoming target words
        if (sentenceIndex + 1 < this.lyricsData.sentences.length) {
            const nextSentence = this.lyricsData.sentences[sentenceIndex + 1];
            const nextSentenceStartTime = this.calculateSentenceStartTime(sentenceIndex + 1);
            const nextRelativeTime = currentTime - nextSentenceStartTime;
            
            let nextCumulativeTime = 0;
            
            nextSentence.words.forEach(word => {
                if (!word.text || word.text.length === 0) {
                    nextCumulativeTime += word.duration;
                    return;
                }
                
                if (word.target_word) {
                    const wordRelativeStart = nextCumulativeTime * slowdownFactor;
                    const preListenTime = wordRelativeStart - 2.0;
                    
                    // Check if we're approaching a target word in the next sentence
                    if (nextRelativeTime >= preListenTime && nextRelativeTime < wordRelativeStart) {
                        window.setTargetWordListening(word.text, 'pre-listening');
                    }
                }
                
                nextCumulativeTime += word.duration;
            });
        }
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
     * Calculate the start and end time of a specific word
     * @param {number} sentenceIndex - Index of the sentence
     * @param {number} wordIndex - Index of the word within the sentence
     * @returns {Object} - Object with start and end times
     */
    calculateWordTiming(sentenceIndex, wordIndex) {
        const sentenceStartTime = this.calculateSentenceStartTime(sentenceIndex);
        const sentence = this.lyricsData.sentences[sentenceIndex];
        
        // Calculate word start time by adding durations of previous words in this sentence
        let wordStartTime = sentenceStartTime;
        for (let i = 0; i < wordIndex; i++) {
            wordStartTime += sentence.words[i].duration || 0;
        }
        
        const wordDuration = sentence.words[wordIndex].duration || 0;
        
        return {
            start: wordStartTime,
            end: wordStartTime + wordDuration
        };
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
            this.activateSentenceImage(sentenceIndex);
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
            
            // Check if this word is currently highlighted and has target_word flag
            if (relativeTime >= wordRelativeStart && relativeTime <= wordRelativeEnd && word.target_word) {
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
        
        // Reset audio time to beginning
        this.setCurrentTime(0);
        
        // Clear all recorded spoken words and scores
        if (this.targetWords) {
            this.targetWords.forEach(targetWord => {
                targetWord.spokenWords = [];
                targetWord.jaroScores = [];
                targetWord.trigramScores = [];
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
            console.log(`Activated image for sentence ${sentenceIndex}`);
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
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LyricsEngine;
} else {
    window.LyricsEngine = LyricsEngine;
}