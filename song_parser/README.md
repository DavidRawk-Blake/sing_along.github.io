# Song Parser - Whisper AI Transcription Tool

This tool uses OpenAI's Whisper AI to automatically generate karaoke-ready transcripts from MP3 files with word-level timestamps.

## Installation

1. **Install ffmpeg (required for audio processing):**
   ```bash
   brew install ffmpeg
   ```

2. **Install Python dependencies:**
   ```bash
   pip install openai-whisper pydub
   ```

3. **Make the script executable:**
   ```bash
   chmod +x transcribe_song.py
   ```

### First-time Model Download:
The first run will download the "small" model (~500MB). This is a one-time download.


## Usage

### Basic Usage
```bash
python transcribe_song.py song.mp3
```

## Output Format

The script generates a JavaScript file compatible with your karaoke system:
```javascript
window.lyricsData = {
  "offset": 6.16,
  "outro": 4.32,
  "song_source": "song.mp3",
  "music_source": "song-instrumental.mp3",
  "full_sentence": [
    {
      "text": "Hello world this is a complete sentence",
      "start_time": 6.16,
      "end_time": 8.94,
      "duration": 2.78
    }
  ],
  "sentences": [
    {
      "image": null,
      "words": [
        {"text": "Hello", "duration": 0.5, "target_word": false},
        {"text": "world", "duration": 0.8, "target_word": true}
      ]
    }
  ]
}
```

**Note**: The `offset` and `outro` values are automatically calculated based on when vocals start/end in the audio. The `full_sentence` array provides sentence-level timing data, while `sentences` provides word-by-word breakdown.

## Features

### Automatic Target Word Detection
The script automatically identifies potential target words based on:
- High confidence scores (>85%)
- Word length (4+ characters)
- Excludes common filler words (the, and, or, etc.)
- Only alphabetic words

### Smart Sentence Segmentation
Sentences are detected using:
- Punctuation marks (. ! ?)
- Long pauses between words (>0.5 seconds)
- Natural speech patterns

### Automatic Instrumental Generation
The script automatically creates an instrumental version by:
- Removing center-panned vocals using phase inversion
- Preserving stereo instruments and background vocals
- Exporting as high-quality MP3 (192kbps)
- Saving as `[songname]-instrumental.mp3` in the same directory

### Audio File Requirements
- **Format**: MP3 files
- **Quality**: Clear vocals work best
- **Content**: Songs with distinct words
- **Language**: Any language supported by Whisper (100+ languages)

## Integration with Karaoke System

The generated timestamped `lyrics-data.js` file can be used in your karaoke games:

1. **Copy the output file** to your game directory (e.g., `vampire_trick_or_treat/`)
2. **Rename it** to `lyrics-data.js` (removing the timestamp)
3. **Update the HTML** to include the script:
   ```html
   <script src="lyrics-data.js"></script>
   ```
4. **Add audio files** with matching names:
   - `song.mp3` (vocal track)
   - `song-instrumental.mp3` (background music)

## Tips for Best Results

1. **Use clean vocal tracks** - Instrumentals in background can interfere
2. **Manually adjust timing** - Edit the generated `offset` and `outro` values for each song
3. **Review target words** - Manually adjust important singing words if needed
4. **Test with short clips** first to verify quality

## Troubleshooting

### Common Issues:
- **"No such file or directory: 'ffmpeg'"**: Run `brew install ffmpeg`
- **"Module not found"**: Run `pip install openai-whisper pydub`
- **"Skipping instrumental generation - pydub not installed"**: Run `pip install pydub`
- **Poor accuracy**: Use higher quality audio input or cleaner vocal tracks
- **Wrong timing**: The `offset` and `outro` values are now automatically calculated
- **Missing words**: Use higher quality audio input


