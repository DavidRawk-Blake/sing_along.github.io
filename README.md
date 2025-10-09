# 🎵 Sing Along Application

A single-page web application that displays song lyrics with timed word highlighting, audio playback, and speech recognition for an interactive sing-along experience.

## Features

- **Synchronized Lyrics Display**: Shows sentences one at a time based on timestamps
- **Real-time Word Highlighting**: Individual words get highlighted as they should be sung
- **Audio Playback**: Supports custom audio files with synchronized timing
- **Speech Recognition**: Listens for spoken words and provides feedback
- **Beautiful UI**: Modern, responsive design with smooth animations
- **Progress Tracking**: Visual progress bar showing song advancement

## How to Use

1. **Open the Application**: 
   - Open `index.html` in a web browser
   - Or serve it via HTTP server: `python3 -m http.server 8080`

2. **Basic Demo**:
   - Click "Start" to begin the demo with "Twinkle Twinkle Little Star"
   - Watch as sentences appear and words highlight in real-time
   - Use "Pause" and "Reset" to control playback

3. **Custom Audio**:
   - Click "Choose Your Own Audio File" to upload your own audio
   - The lyrics timing will still use the demo data
   - To customize lyrics, modify the `lyricsData` object in the JavaScript

4. **Speech Recognition**:
   - Click "Toggle Microphone" to enable speech recognition
   - Grant microphone permissions when prompted
   - Speak along with the highlighted words
   - Correctly recognized words will flash green

## Technical Details

### Data Structure
The application uses a structured lyrics format:
```javascript
{
  sentences: [
    {
      text: "Sentence text",
      startTime: 0,     // seconds
      endTime: 4,       // seconds
      words: [
        { text: "Word", startTime: 0, endTime: 0.8 }
      ]
    }
  ]
}
```

### Browser Compatibility
- Modern browsers with Web Speech API support
- Chrome, Edge, Safari (iOS 14.5+)
- Firefox (limited speech recognition support)

### Customization
To add your own songs:
1. Replace the `lyricsData` object with your lyrics and timing
2. Ensure timestamps match your audio file
3. Add your audio file via the file picker

## Files
- `index.html` - Complete single-page application with embedded CSS and JavaScript