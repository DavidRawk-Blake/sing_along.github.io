# Whisper Lyrics Parser

A standalone script that uses OpenAI Whisper (base model) to parse MP3 files into word-level lyrics data in JavaScript format.

## Features

- Converts MP3 files to word-level transcriptions using Whisper base model
- Automatically detects sentence boundaries based on punctuation and pauses
- Creates structured JavaScript data with sentences containing word arrays
- Includes timing information for each word
- Generates ready-to-use JavaScript files with `window.lyricsData`
- Creates timestamped output files automatically
- Shows progress updates during processing

## Installation

First, install the required dependency:

```bash
pip install openai-whisper
```

## Usage

Simple usage - just provide the MP3 file:
```bash
python whisper_lyrics_parser.py your_song.mp3
```

The script will:
1. Use the Whisper base model (good balance of speed and accuracy)
2. Create a timestamped output file in the script directory
3. Show progress updates during processing

Output file format: `lyrics_data_YYYYMMDD_HHMMSS.js`

## Output Format

The script generates a JavaScript file with this structure:

```javascript
/**
 * Auto-generated lyrics data from Whisper transcription
 * Generated: 2025-10-22T14:30:45.123456
 */

// Global lyrics data
window.lyricsData = {
  "outro": 3.25,
  "generated_timestamp": "2025-10-22T14:30:45.123456",
  "sentences": [
    {
      "words": [
        {
          "text": "Hello",
          "start_time": 1.234,
          "end_time": 1.567,
          "confidence": 0.95,
          "target_word": false
        }
      ]
    }
  ]
};
```

## Example

Process any MP3 file:
```bash
python whisper_lyrics_parser.py "My Song.mp3"
```

Output will be saved as: `lyrics_data_20251022_143045.js`

## Progress Output

The script shows helpful progress messages:
```
Processing: My Song.mp3
==================================================
Loading Whisper model (base)...
Starting transcription of: My Song.mp3
Processing audio... (this may take a few minutes)
Transcription completed!
Analyzing sentence boundaries...
Found 12 sentences
Building word-level structure...
Creating final data structure...
Generating JavaScript output...
✓ Lyrics data saved to: lyrics_data_20251022_143045.js
```