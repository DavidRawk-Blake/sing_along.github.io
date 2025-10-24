# Simple Whisper Lyrics Parser

A standalone script that uses OpenAI Whisper (medium model) to parse audio files into word-level lyrics data in JavaScript format.

## Features

- Converts audio files to word-level transcriptions using Whisper medium model
- Automatically detects sentence boundaries based on punctuation and pauses
- Creates structured JavaScript data with sentences containing word arrays
- Includes timing information for each word
- Generates ready-to-use JavaScript files with `window.lyricsData`
- Creates timestamped output files automatically
- Shows progress updates with emoji indicators
- Uses medium model for better accuracy (trades speed for quality)

## Installation

Install the required dependency using one of these methods:

```bash
# Method 1: Standard pip install
pip install openai-whisper

# Method 2: Using pip3 explicitly
pip3 install openai-whisper

# Method 3: Using python3 module install
python3 -m pip install openai-whisper

# Method 4: User-local install (if permission issues)
pip install --user openai-whisper

# Method 5: System python (if other methods fail)
/usr/bin/python3 -m pip install --user openai-whisper
```

## Troubleshooting

If you get "Whisper not found" errors:

1. **Run the diagnostic script** (recommended first step):
   ```bash
   python3 test_whisper.py
   ```

2. **Version Manager Issues** (common on macOS):
   - If using `asdf`, `pyenv`, or similar: make sure the correct Python version is active
   - Try with system Python: `/usr/bin/python3 simple_whisper_parser.py your_file.mp3`
   - Check active Python: `which python3`

3. **Check your Python version**: Make sure you're using Python 3.8+
   ```bash
   python3 --version
   ```

4. **Verify Whisper installation**:
   ```bash
   python3 -c "import whisper; print('Whisper found!')"
   ```

5. **The script will auto-detect** working Python environments and suggest the correct command

6. **Manual installation troubleshooting**:
   ```bash
   # Find which Python has Whisper
   /usr/bin/python3 -c "import whisper; print('System Python OK')"
   python3 -c "import whisper; print('Current Python OK')"
   
   # Install for specific Python
   /usr/bin/python3 -m pip install openai-whisper
   ```

## Usage

First, verify Whisper is properly installed:
```bash
python3 -c "import whisper; print('✅ Whisper is ready!')"
```

Then run the script with your audio file:
```bash
/usr/bin/python3 simple_whisper_parser.py song.mp3
```

The script will:
1. Use the Whisper medium model (higher accuracy than base model)
2. Create a timestamped output file in the script directory
3. Show progress updates with emoji indicators during processing

Output file format: `lyrics_data_YYYYMMDD_HHMMSS.js`

## Output Format

The script generates a JavaScript file with this structure:

```javascript
/**
 * Auto-generated lyrics data from Whisper transcription
 * Generated: 2025-10-24T14:30:45.123456
 */

// Global lyrics data
window.lyricsData = {
  total_song_length: 180.45,
  song_source: "song.mp3",
  music_source: "music.mp3",
  generated_timestamp: "2025-10-24T14:30:45.123456",
  sentences: [
    {
      words: [
        {
          text: "Hello",
          start_time: 1.234,
          end_time: 1.567,
          target_word: false
        }
      ]
    }
  ]
};
```

## Example

Process any audio file:
```bash
python3 simple_whisper_parser.py "My Song.mp3"
```

Output will be saved as: `lyrics_data_20251024_143045.js`

## Progress Output

The script shows helpful progress messages with emoji indicators:
```
🎵 Processing: My Song.mp3
📦 Loading Whisper...
🔧 Loading medium model (this may take a while)...
🎙️ Starting transcription...
⏳ This will take several minutes for the medium model...
✅ Transcription complete!
📊 Extracted 156 words
💾 Saved to: lyrics_data_20251024_143045.js
📈 Summary: 12 sentences, 156 words
🎉 Complete!
```

## Features in Output

The generated JavaScript file includes:
- **total_song_length**: Total duration of the song in seconds
- **song_source**: Reference to the audio file with vocals
- **music_source**: Reference to the backing track file
- **generated_timestamp**: When the file was created
- **sentences**: Array of sentence objects with word timing data

## Notes

- Uses the **medium** Whisper model for better accuracy
- Processing time is longer than base model but provides better transcription quality
- Automatically handles sentence boundaries based on punctuation and pauses
- Output format is compatible with the karaoke game system