#!/bin/bash

# Song Parser Setup Script
# Installs dependencies and sets up the transcription tool

echo "🎵 Setting up Song Parser with Whisper AI..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3 and try again."
    exit 1
fi

# Check if pip is available
if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
    echo "❌ pip is required but not installed."
    echo "Please install pip and try again."
    exit 1
fi

# Install requirements
echo "📦 Installing OpenAI Whisper..."
pip3 install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Installation successful!"
    
    # Make script executable
    chmod +x transcribe_song.py
    echo "✅ Made transcribe_song.py executable"
    
    echo ""
    echo "🚀 Setup complete! You can now use the transcription tool:"
    echo ""
    echo "Basic usage:"
    echo "  python3 transcribe_song.py your_song.mp3"
    echo ""
    echo "Or with options:"
    echo "  python3 transcribe_song.py your_song.mp3 --model large --output karaoke_data.js"
    echo ""
    echo "📖 See README.md for full documentation"
else
    echo "❌ Installation failed. Please check your Python/pip setup."
    exit 1
fi