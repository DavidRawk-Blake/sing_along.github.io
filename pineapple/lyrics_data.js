/**
 * Pineapple Karaoke - Lyrics Data Template
 * Add your song lyrics here with timing data
 */

// Global lyrics data for the Pineapple karaoke game
window.lyricsData = {
  outro: 3.0,
  song_source: "song.mp3",
  music_source: "music.mp3",
  sentences: [
    {
      words: [
        { text: "Welcome", start_time: 0.0, end_time: 0.8, target_word: false },
        { text: "to", start_time: 0.8, end_time: 1.0, target_word: false },
        { text: "Pineapple", start_time: 1.0, end_time: 1.8, target_word: true },
        { text: "Karaoke!", start_time: 1.8, end_time: 2.5, target_word: true }
      ]
    },
    {
      words: [
        { text: "Add", start_time: 3.0, end_time: 3.3, target_word: false },
        { text: "your", start_time: 3.3, end_time: 3.6, target_word: false },
        { text: "tropical", start_time: 3.6, end_time: 4.2, target_word: true },
        { text: "song", start_time: 4.2, end_time: 4.8, target_word: true },
        { text: "here!", start_time: 4.8, end_time: 5.5, target_word: false }
      ]
    },
    {
      words: [
        { text: "🍍", start_time: 6.0, end_time: 6.5, target_word: true },
        { text: "🏖️", start_time: 6.5, end_time: 7.0, target_word: true },
        { text: "🌺", start_time: 7.0, end_time: 7.5, target_word: true }
      ]
    }
  ]
};