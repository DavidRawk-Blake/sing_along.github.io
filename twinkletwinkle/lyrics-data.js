/**
 * Twinkle Twinkle Little Star - Lyrics Data
 * Contains timing, recognition flags, and audio source information
 */

// Global lyrics data for the Twinkle Twinkle Little Star karaoke game
window.lyricsData = {
    offset: 17,
    outro: 3,
    song_source: "song.mp3",
    music_source: "song-instrumental.mp3",
    sentences: [
        {
            image: null,
            words: [
                { text: "Twinkle", duration: 1.4, target_word: false },
                { text: "twinkle", duration: 1.4, target_word: false },
                { text: "little", duration: 1.3, target_word: true },
                { text: "star", duration: 2.0, target_word: false }
            ]
        },
        {
            image: null,
            words: [
                { text: "How", duration: 0.49, target_word: false },
                { text: "I", duration: 0.46, target_word: false },
                { text: "wonder", duration: 1.32, target_word: false },
                { text: "what", duration: 0.69, target_word: false },
                { text: "you", duration: 0.46, target_word: false },
                { text: "are", duration: 1.5, target_word: true }
            ]
        },
        {
            image: null,
            words: [
                { text: "", duration: 0.5, target_word: false },
                { text: "Up", duration: 0.75, target_word: false },
                { text: "above", duration: 1.2, target_word: false },
                { text: "the", duration: 0.6, target_word: true },
                { text: "world", duration: 0.6, target_word: false },
                { text: "so", duration: 0.7, target_word: false },
                { text: "high", duration: 1.8, target_word: false }
            ]
        },
        {
            image: null,
            words: [
                { text: "Like", duration: 0.6, target_word: false },
                { text: "a", duration: 0.7, target_word: false },
                { text: "diamond", duration: 1.3, target_word: true },
                { text: "in", duration: 0.4, target_word: false },
                { text: "the", duration: 0.8, target_word: true },
                { text: "sky", duration: 2.0, target_word: false }
            ]
        },
        {
            image: null,
            words: [
                { text: "Twinkle", duration: 1.2, target_word: false },
                { text: "twinkle", duration: 1.1, target_word: false },
                { text: "little", duration: 1.5, target_word: false },
                { text: "star", duration: 2.0, target_word: false }
            ]
        },
        {
            image: null,
            words: [
                { text: "How", duration: 0.49, target_word: false },
                { text: "I", duration: 0.46, target_word: false },
                { text: "wonder", duration: 1.32, target_word: true },
                { text: "what", duration: 0.69, target_word: false },
                { text: "you", duration: 0.46, target_word: false },
                { text: "are", duration: 3.0, target_word: false }
            ]
        }
    ]
};