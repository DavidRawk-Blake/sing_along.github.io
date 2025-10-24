# Sing Along Simple - Karaoke System

An interactive karaoke system with speech recognition and real-time word matching.

## Features

### Voice Recognition & Word Matching
- Enhanced speech recognition with robust error handling and auto-restart
- Captures 15 words of context around target words for improved accuracy
- Advanced scoring using Jaro-Winkler (≥0.8) and Trigram (≥0.4) similarity algorithms
- Automatic microphone permission management

### Debug Table with Smart Scrolling
- Real-time display of target words, spoken words, and matching scores
- **Smooth auto-scrolling** to keep current sentence always visible during playback
- Visual highlighting of active listening windows and matched words
- Sentence-aware scrolling that shows complete phrases, not just individual words

### Song-Based Timing System
- Uses total song length from Whisper transcription for accurate timing
- Song progress bar and timestamps based on actual audio duration
- Supports outro periods beyond lyrics for complete song experience

### Enhanced User Experience
- Multiple themed songs with custom styling
- Responsive design with smooth animations and transitions
- Robust error handling for audio playback and microphone access
- Visual feedback for word matches and listening states

## Building a New Page

### Steps
1. Write a song, or let GPT create a short poem.
2. Use AI to create a song, based on the poem.
    - https://www.aisongmaker.io/tools/lyrics-to-song
3. Extract the timestamped lyrics from the song.
    - https://huggingface.co/spaces/Xenova/whisper-word-level-timestamps
4. Extract the music only version of the song.
    - https://emastered.com/stemify/
    - https://vocalremover.easeus.com/
5. Convert the lyrics to lyrics data using the Python parser
