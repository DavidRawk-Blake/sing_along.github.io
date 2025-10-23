/**
 * Twinkle Twinkle Little Star - Lyrics Data
 * Contains timing, recognition flags, and audio source information
 */

// Global lyrics data for the Twinkle Twinkle Little Star karaoke game
window.lyricsData = {
    outro: 3,
    song_source: "song.mp3",
    music_source: "song-instrumental.mp3",
    full_sentence: [
        {
            text: "Twinkle twinkle little star",
            start_time: 17.0,
            end_time: 23.1,
            duration: 6.1
        },
        {
            text: "How I wonder what you are",
            start_time: 23.1,
            end_time: 28.02,
            duration: 4.92
        },
        {
            text: "Up above the world so high",
            start_time: 28.52,
            end_time: 34.17,
            duration: 5.65
        },
        {
            text: "Like a diamond in the sky",
            start_time: 34.17,
            end_time: 39.97,
            duration: 5.8
        },
        {
            text: "Twinkle twinkle little star",
            start_time: 39.97,
            end_time: 45.77,
            duration: 5.8
        },
        {
            text: "How I wonder what you are",
            start_time: 45.77,
            end_time: 52.19,
            duration: 6.42
        }
    ],
    sentences: [
        {
            image: null,
            words: [
                { text: "Twinkle", start_time: 17.0, end_time: 18.4, target_word: false },
                { text: "twinkle", start_time: 18.4, end_time: 19.8, target_word: false },
                { text: "little", start_time: 19.8, end_time: 21.1, target_word: true },
                { text: "star", start_time: 21.1, end_time: 23.1, target_word: false }
            ]
        },
        {
            image: null,
            words: [
                { text: "How", start_time: 23.1, end_time: 23.59, target_word: false },
                { text: "I", start_time: 23.59, end_time: 24.05, target_word: false },
                { text: "wonder", start_time: 24.05, end_time: 25.37, target_word: false },
                { text: "what", start_time: 25.37, end_time: 26.06, target_word: false },
                { text: "you", start_time: 26.06, end_time: 26.52, target_word: false },
                { text: "are", start_time: 26.52, end_time: 28.02, target_word: true }
            ]
        },
        {
            image: null,
            words: [
                { text: "", start_time: 28.02, end_time: 28.52, target_word: false },
                { text: "Up", start_time: 28.52, end_time: 29.27, target_word: false },
                { text: "above", start_time: 29.27, end_time: 30.47, target_word: false },
                { text: "the", start_time: 30.47, end_time: 31.07, target_word: true },
                { text: "world", start_time: 31.07, end_time: 31.67, target_word: false },
                { text: "so", start_time: 31.67, end_time: 32.37, target_word: false },
                { text: "high", start_time: 32.37, end_time: 34.17, target_word: false }
            ]
        },
        {
            image: null,
            words: [
                { text: "Like", start_time: 34.17, end_time: 34.77, target_word: false },
                { text: "a", start_time: 34.77, end_time: 35.47, target_word: false },
                { text: "diamond", start_time: 35.47, end_time: 36.77, target_word: true },
                { text: "in", start_time: 36.77, end_time: 37.17, target_word: false },
                { text: "the", start_time: 37.17, end_time: 37.97, target_word: true },
                { text: "sky", start_time: 37.97, end_time: 39.97, target_word: false }
            ]
        },
        {
            image: null,
            words: [
                { text: "Twinkle", start_time: 39.97, end_time: 41.17, target_word: false },
                { text: "twinkle", start_time: 41.17, end_time: 42.27, target_word: false },
                { text: "little", start_time: 42.27, end_time: 43.77, target_word: false },
                { text: "star", start_time: 43.77, end_time: 45.77, target_word: false }
            ]
        },
        {
            image: null,
            words: [
                { text: "How", start_time: 45.77, end_time: 46.26, target_word: false },
                { text: "I", start_time: 46.26, end_time: 46.72, target_word: false },
                { text: "wonder", start_time: 46.72, end_time: 48.04, target_word: true },
                { text: "what", start_time: 48.04, end_time: 48.73, target_word: false },
                { text: "you", start_time: 48.73, end_time: 49.19, target_word: false },
                { text: "are", start_time: 49.19, end_time: 52.19, target_word: false }
            ]
        }
    ]
};