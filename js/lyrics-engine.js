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
     * Get the offset based on the first sentence's start time
     * @returns {number} - Offset in seconds
     */
    getOffset() {
        // Use explicit offset if provided, otherwise use first sentence start time
        if (this.lyricsData.offset !== undefined) {
            return this.lyricsData.offset;
        }

        // Calculate offset from first sentence start time
        if (this.lyricsData.sentences && this.lyricsData.sentences.length > 0) {
            const firstSentence = this.lyricsData.sentences[0];
            if (firstSentence.words && firstSentence.words.length > 0) {
                for (const word of firstSentence.words) {
                    if (word.start_time !== undefined) {
                        return word.start_time;
                    }
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
        
        // Find all target words whose listening-windows are currently active
        // Use the same dynamic calculation as checkTargetWordTiming
        this.targetWords.forEach(targetWord => {
            const wordStartTime = this.lyricsData.sentences[targetWord.sentenceIndex].words[targetWord.wordIndex].start_time || 0;
            const wordEndTime = this.lyricsData.sentences[targetWord.sentenceIndex].words[targetWord.wordIndex].end_time || 0;
            
            // Calculate sentence boundaries for this target word
            const sentenceStartTime = this.calculateSentenceStartTime(targetWord.sentenceIndex);
            const sentenceEndTime = this.calculateSentenceEndTime(targetWord.sentenceIndex);
            
            // Calculate listening window: 5 seconds before and 2 seconds after word, constrained by sentence
            const windowStart = Math.max(sentenceStartTime, wordStartTime - 5.0);
            const windowEnd = Math.min(sentenceEndTime, wordEndTime + 2.0);
            
            if (currentTime >= windowStart && currentTime <= windowEnd) {
                // Parse individual words and calculate similarity scores
                const individualWords = spokenText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
                const targetLower = targetWord.word.toLowerCase();
                
                console.log(`📝 Recording spoken words for "${targetWord.word}": [${individualWords.join(', ')}] at ${currentTime.toFixed(2)}s`);
                
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
        
        sentence.words.forEach(word => {
            // Skip empty words - don't display or highlight them
            if (!word.text || word.text.length === 0) {
                return; // Skip to next word
            }
            
            // Use absolute timing from word data instead of cumulative calculation
            const wordAbsoluteStart = word.start_time || 0;
            const wordAbsoluteEnd = word.end_time || 0;
            
            // Convert to relative time within the sentence
            const wordRelativeStart = wordAbsoluteStart - sentenceStartTime;
            const wordRelativeEnd = wordAbsoluteEnd - sentenceStartTime;
            
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
     * Check for target words and manage listening windows with table highlighting
     * @param {number} sentenceIndex - Current sentence index
     * @param {number} currentTime - Current playback time
     */
    checkTargetWordTiming(sentenceIndex, currentTime) {
        if (!window.setTargetWordListening || !window.clearTargetWordListening) return;

        // Check all target words across all sentences for their listening windows
        this.targetWords.forEach(targetWord => {
            const wordStartTime = this.lyricsData.sentences[targetWord.sentenceIndex].words[targetWord.wordIndex].start_time || 0;
            const wordEndTime = this.lyricsData.sentences[targetWord.sentenceIndex].words[targetWord.wordIndex].end_time || 0;
            
            // Calculate sentence boundaries for this target word
            const sentenceStartTime = this.calculateSentenceStartTime(targetWord.sentenceIndex);
            const sentenceEndTime = this.calculateSentenceEndTime(targetWord.sentenceIndex);
            
            // Calculate listening window: 5 seconds before and 2 seconds after word, constrained by sentence
            const windowStart = Math.max(sentenceStartTime, wordStartTime - 5.0);
            const windowEnd = Math.min(sentenceEndTime, wordEndTime + 2.0);
            
            if (currentTime >= windowStart && currentTime <= windowEnd) {
                // Within listening window - determine state based on word timing
                if (currentTime < wordStartTime) {
                    // Before the word starts
                    window.setTargetWordListening(targetWord.word, 'pre-listening');
                    
                    // Log target window start (only log once when entering pre-listening)
                    if (!targetWord.loggedWindowStart) {
                        console.log(`🎯 TARGET WINDOW STARTED for "${targetWord.word}" (sentence ${targetWord.sentenceIndex + 1}, word ${targetWord.wordIndex + 1})`);
                        console.log(`   Current time: ${currentTime.toFixed(2)}s`);
                        console.log(`   Window: ${windowStart.toFixed(2)}s - ${windowEnd.toFixed(2)}s (duration: ${(windowEnd - windowStart).toFixed(2)}s)`);
                        console.log(`   Word timing: ${wordStartTime.toFixed(2)}s - ${wordEndTime.toFixed(2)}s`);
                        console.log(`   Sentence bounds: ${sentenceStartTime.toFixed(2)}s - ${sentenceEndTime.toFixed(2)}s`);
                        console.log(`   State: PRE-LISTENING (${(wordStartTime - currentTime).toFixed(2)}s until word starts)`);
                        targetWord.loggedWindowStart = true;
                    }
                } else if (currentTime >= wordStartTime && currentTime <= wordEndTime) {
                    // Word is currently being sung
                    window.setTargetWordListening(targetWord.word, 'active');
                    
                    // Log when word becomes active (only once)
                    if (!targetWord.loggedActive) {
                        console.log(`🎤 TARGET WORD ACTIVE: "${targetWord.word}" is now being sung!`);
                        console.log(`   Current time: ${currentTime.toFixed(2)}s, Word ends at: ${wordEndTime.toFixed(2)}s`);
                        targetWord.loggedActive = true;
                    }
                } else {
                    // After the word ends but still in listening window
                    window.setTargetWordListening(targetWord.word, 'post-listening');
                    
                    // Log when entering post-listening (only once)
                    if (!targetWord.loggedPostListening) {
                        console.log(`⏰ POST-LISTENING for "${targetWord.word}" - window ends at ${windowEnd.toFixed(2)}s`);
                        console.log(`   Current time: ${currentTime.toFixed(2)}s, ${(windowEnd - currentTime).toFixed(2)}s remaining`);
                        targetWord.loggedPostListening = true;
                    }
                }
                
                // Highlight in debug table if available
                if (window.highlightTargetWordInTable) {
                    window.highlightTargetWordInTable(targetWord.id, true);
                }
            } else {
                // Outside listening window
                window.clearTargetWordListening(targetWord.word);
                
                // Log when window ends (only once)
                if (targetWord.loggedWindowStart && !targetWord.loggedWindowEnd) {
                    console.log(`🔚 TARGET WINDOW ENDED for "${targetWord.word}" at ${currentTime.toFixed(2)}s`);
                    targetWord.loggedWindowEnd = true;
                }
                
                // Remove highlight from debug table if available
                if (window.highlightTargetWordInTable) {
                    window.highlightTargetWordInTable(targetWord.id, false);
                }
                
                // Reset logging flags when completely outside window for potential future replays
                if (currentTime < windowStart - 1.0 || currentTime > windowEnd + 1.0) {
                    targetWord.loggedWindowStart = false;
                    targetWord.loggedActive = false;
                    targetWord.loggedPostListening = false;
                    targetWord.loggedWindowEnd = false;
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
     * Calculate the start and end time of a specific word
     * @param {number} sentenceIndex - Index of the sentence
     * @param {number} wordIndex - Index of the word within the sentence
     * @returns {Object} - Object with start and end times
     */
    calculateWordTiming(sentenceIndex, wordIndex) {
        const sentence = this.lyricsData.sentences[sentenceIndex];
        
        if (!sentence || !sentence.words || wordIndex >= sentence.words.length) {
            return { start: 0, end: 0 };
        }
        
        const word = sentence.words[wordIndex];
        
        return {
            start: word.start_time || 0,
            end: word.end_time || 0
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
        
        if (sentenceIndex === -1 && this.isSongFinished(rawTime)) {
            // Song and outro finished - call stop callback if provided
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
            
            // Check if this word is currently highlighted and has target_word flag
            if (currentTime >= wordAbsoluteStart && currentTime <= wordAbsoluteEnd && word.target_word) {
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