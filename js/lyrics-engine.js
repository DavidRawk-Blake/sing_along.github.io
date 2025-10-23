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

                        // Calculate listening window: 5 seconds before and 2 seconds after the word
                        const desiredStartTime = wordStartTime - 5.0;
                        const desiredEndTime = wordEndTime + 2.0;

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
                            spokenWords: [], // Store all final words spoken during this listening-window
                            jaroScores: [], // Store Jaro distances for each spoken word
                            trigramScores: [], // Store trigram similarity scores for each spoken word
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
                
                // Grab the last 5 spoken words from the recognition log
                if (window.getRecognizedWordsLog) {
                    const recognizedWordsLog = window.getRecognizedWordsLog();
                    // Get the last 5 words from the log
                    const lastFiveWords = recognizedWordsLog.slice(-5).map(entry => entry.word);
                    // Store them in the target word's spokenWords array
                    targetWord.spokenWords = lastFiveWords;
                    
                    // Calculate Jaro and trigram scores for each spoken word against the target word
                    const targetWordText = targetWord.word.toLowerCase();
                    targetWord.jaroScores = [];
                    targetWord.trigramScores = [];
                    
                    lastFiveWords.forEach(spokenWord => {
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
                    const hasJaroMatch = targetWord.jaroScores.some(score => score > 0.7);
                    const hasTrigramMatch = targetWord.trigramScores.some(score => score > 0.3);
                    targetWord.match_found = hasJaroMatch || hasTrigramMatch;
                    
                    // Update the debug table with these words and scores
                    const targetWordIndex = this.targetWords.findIndex(tw => tw.id === targetWord.id);
                    if (targetWordIndex !== -1) {
                        // Update spoken words cell
                        const spokenCell = document.getElementById(`spoken-${targetWordIndex}`);
                        if (spokenCell) {
                            const spokenWordsText = lastFiveWords.join(', ');
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
            }
        });
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
     * Update progress bar based on current time
     * @param {number} currentTime - Current playback time
     */
    updateProgress(currentTime) {
        if (!this.progressFill) return;

        const totalEndTime = Math.max(
            ...this.lyricsData.sentences.map((s, index) => this.calculateSentenceEndTime(index)),
            (this.musicAudio && this.musicAudio.duration) || 16
        );
        const progress = (currentTime / totalEndTime) * 100;
        this.progressFill.style.width = `${Math.min(progress, 100)}%`;
    }

    /**
     * Find the current sentence index based on time
     * @param {number} currentTime - Current playback time
     * @returns {number} - Index of current sentence, or -1 if none found
     */
    findCurrentSentenceIndex(currentTime) {
        // Find sentence based on exact timing - no early showing
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
        
        // Update timestamp display for debugging
        if (this.timestampDisplay) {
            this.timestampDisplay.textContent = `${rawTime.toFixed(2)}s`;
        }
        
        // Handle intro period (countdown using offset, but don't show lyrics until first word time)
        if (rawTime < offset) {
            const remainingTime = Math.ceil(offset - rawTime);
            
            if (remainingTime > 10) {
                this.sentenceDisplay.innerHTML = `🎵 Get ready to sing along! 🎵<br>Starting in ${remainingTime}...`;
            } else if (remainingTime > 5) {
                this.sentenceDisplay.innerHTML = `🎤 Almost ready! 🎤<br>Starting in ${remainingTime}...`;
            } else if (remainingTime > 2) {
                this.sentenceDisplay.innerHTML = `✨ Get ready! ✨<br>Starting in ${remainingTime}...`;
            } else if (remainingTime > 1) {
                this.sentenceDisplay.innerHTML = `🎤 Ready? 🎤<br>Starting in ${remainingTime}...`;
            } else {
                this.sentenceDisplay.innerHTML = `🌟 Here we go! 🌟<br>Starting in ${remainingTime}...`;
            }
            
            this.animationFrame = requestAnimationFrame(() => this.animate());
            return;
        }
        
        // Check if in outro period (lyrics finished but outro still playing)
        if (this.isInOutroPeriod(rawTime)) {
            const lastSentenceIndex = this.lyricsData.sentences.length - 1;
            const songEndTime = this.calculateSentenceEndTime(lastSentenceIndex);
            const outroRemaining = Math.ceil((songEndTime + this.lyricsData.outro) - rawTime);
            
            // Keep the last sentence visible during outro instead of showing completion message
            this.displaySentence(lastSentenceIndex, rawTime);
            
            // Update timestamp display (no outro countdown shown)
            if (this.timestampDisplay) {
                this.timestampDisplay.textContent = `${rawTime.toFixed(2)}s`;
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
     * Get the total end time including outro (timing authority)
     * @returns {number} - Total end time in seconds, or 0 if no music audio or not loaded
     */
    getTotalEndTime() {
        // Calculate the last sentence end time plus outro
        const lastSentenceIndex = this.lyricsData.sentences.length - 1;
        const lastSentenceEndTime = this.calculateSentenceEndTime(lastSentenceIndex);
        const outro = this.lyricsData.outro || 3;
        
        return Math.max(
            lastSentenceEndTime + outro,
            (this.musicAudio && this.musicAudio.duration) || 0
        );
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
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LyricsEngine;
} else {
    window.LyricsEngine = LyricsEngine;
}