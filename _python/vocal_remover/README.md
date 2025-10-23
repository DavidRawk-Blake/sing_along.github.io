# Vocal Remover

A Python script to remove vocals from audio files using different techniques.

## Features

- **Center Channel Extraction**: Simple method that subtracts left and right channels
- **AI-based Separation**: Uses Spleeter for advanced vocal separation  
- **Spectral Analysis**: Frequency-based vocal removal (experimental)

## Installation

Install required dependencies:

```bash
# Basic dependencies
/usr/bin/python3 -m pip install --user librosa soundfile scipy

# For AI-based separation (optional)
/usr/bin/python3 -m pip install --user spleeter
```

## Usage

### Generate Both AI and Spectral Versions (Default)
```bash
python3 vocal_remover.py song.mp3
```
This creates: `song_spleeter.mp3` and `song_spectral.mp3`

### Specify Output File and Format
```bash
python3 vocal_remover.py song.mp3 -o instrumental.wav --format wav
```

### Use Specific Method
```bash
# AI-based separation only
python3 vocal_remover.py song.mp3 -m ai --ai-model spleeter

# Spectral method only  
python3 vocal_remover.py song.mp3 -m spectral

# Center channel method
python3 vocal_remover.py song.mp3 -m center
```

## Methods

### 1. Center Channel Extraction (`-m center`)
- **Best for**: Songs with vocals centered in stereo mix
- **Speed**: Fast
- **Quality**: Good for well-mixed stereo tracks
- **Requirements**: Only librosa and soundfile

### 2. AI-based Separation (`-m ai`)
- **Best for**: High-quality vocal removal
- **Speed**: Slower (requires model processing)
- **Quality**: Excellent results
- **Requirements**: spleeter library

### 3. Spectral Analysis (`-m spectral`)
- **Best for**: Experimental approach
- **Speed**: Medium
- **Quality**: Variable
- **Requirements**: librosa, soundfile, scipy

## Command Line Options

```
positional arguments:
  input_file            Input audio file (MP3, WAV, etc.)

optional arguments:
  -h, --help           Show help message
  -o, --output OUTPUT  Output file (default: input_instrumental.mp3)
  -m, --method {center,ai,spectral,all}
                       Vocal removal method (default: all)
  --ai-model {spleeter,demucs}
                       AI model to use (default: spleeter)
  --format {mp3,wav}   Output audio format (default: mp3)
```

## Examples

```bash
# Generate both AI and spectral versions (default behavior)
python3 vocal_remover.py "My Song.mp3"
# Creates: "My Song_spleeter.mp3" and "My Song_spectral.mp3"

# High-quality AI separation only
python3 vocal_remover.py "My Song.mp3" -m ai -o "My Song Karaoke.mp3"

# Output as WAV format
python3 vocal_remover.py "My Song.mp3" -m ai --format wav

# Process multiple files with both methods
for file in *.mp3; do
    python3 vocal_remover.py "$file"
done
```

## Output

The script creates instrumental versions of your songs suitable for karaoke use. The quality depends on:

- Original song mixing (stereo vs mono vocals)
- Method chosen
- Audio quality of input file

## Tips for Best Results

1. **Use stereo audio files** - Mono files won't work with center channel extraction
2. **Try different methods** - Some songs work better with specific approaches
3. **AI method is best** - But requires additional setup and processing time
4. **Check your input** - Higher quality input = better output

## Integration with Karaoke System

The generated instrumental files can be used as `music_source` in your karaoke lyrics data:

```javascript
window.lyricsData = {
  song_source: "original_song.mp3",        // Original with vocals
  music_source: "song_instrumental.wav",   // Generated instrumental
  // ... rest of lyrics data
};
```