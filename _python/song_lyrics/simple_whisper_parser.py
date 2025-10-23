#!/usr/bin/python3
"""
Simple blocking Whisper parser - no background processing, no version manager issues
Run directly and wait for completion
"""

import json
import sys
import re
import time
from pathlib import Path
from datetime import datetime

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 simple_whisper_parser.py <audio_file>")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    audio_path = Path(audio_file)
    
    if not audio_path.exists():
        print(f"Error: Audio file not found: {audio_file}")
        sys.exit(1)
    
    print(f"🎵 Processing: {audio_path.name}")
    print("📦 Loading Whisper...")
    
    try:
        import whisper
    except ImportError:
        print("❌ Whisper not installed. Run: /usr/bin/python3 -m pip install --user openai-whisper")
        sys.exit(1)
    
    # Load model
    print("🔧 Loading medium model (this may take a while)...")
    model = whisper.load_model("medium")
    
    print("🎙️ Starting transcription...")
    print("⏳ This will take several minutes for the medium model...")
    
    # Transcribe
    result = model.transcribe(
        str(audio_path),
        word_timestamps=True,
        temperature=0,
        beam_size=5,
        fp16=False
    )
    
    print("✅ Transcription complete!")
    
    # Extract words
    all_words = []
    for segment in result['segments']:
        if 'words' in segment:
            all_words.extend(segment['words'])
    
    print(f"📊 Extracted {len(all_words)} words")
    
    # Create simple structure
    sentences = []
    current_sentence = []
    
    for word_data in all_words:
        word_text = word_data['word'].strip()
        if not word_text:
            continue
            
        word_entry = {
            "text": word_text,
            "start_time": round(word_data['start'], 3),
            "end_time": round(word_data['end'], 3),
            "target_word": False
        }
        
        current_sentence.append(word_entry)
        
        # Simple sentence break on punctuation or long pause
        if (re.search(r'[.!?]$', word_text) or 
            (len(current_sentence) > 0 and len(all_words) > all_words.index(word_data) + 1 and
             all_words[all_words.index(word_data) + 1]['start'] - word_data['end'] > 0.8)):
            
            if current_sentence:
                sentences.append({"words": current_sentence})
                current_sentence = []
    
    # Add final sentence if any words remain
    if current_sentence:
        sentences.append({"words": current_sentence})
    
    # Calculate outro
    last_word_end = 0.0
    if sentences and sentences[-1]['words']:
        last_word_end = sentences[-1]['words'][-1]['end_time']
    
    total_duration = max(segment['end'] for segment in result['segments']) if result['segments'] else last_word_end
    outro_time = max(0.0, total_duration - last_word_end)
    
    # Create output
    lyrics_data = {
        "outro": round(outro_time, 2),
        "generated_timestamp": datetime.now().isoformat(),
        "sentences": sentences
    }
    
    # Save file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = Path(f"lyrics_data_{timestamp}.js")
    
    # Generate JavaScript object literal format (unquoted keys)
    js_content = f"""/**
 * Auto-generated lyrics data from Whisper transcription
 * Generated: {lyrics_data['generated_timestamp']}
 */

// Global lyrics data
window.lyricsData = {{
  outro: {lyrics_data['outro']},
  song_source: "song.mp3",
  music_source: "music.mp3",
  generated_timestamp: "{lyrics_data['generated_timestamp']}",
  sentences: [
"""
    
    # Add sentences with unquoted keys
    for i, sentence in enumerate(sentences):
        js_content += "    {\n      words: [\n"
        for j, word in enumerate(sentence['words']):
            js_content += f"""        {{
          text: "{word['text']}",
          start_time: {word['start_time']},
          end_time: {word['end_time']},
          target_word: {str(word['target_word']).lower()}
        }}"""
            if j < len(sentence['words']) - 1:
                js_content += ","
            js_content += "\n"
        js_content += "      ]\n    }"
        if i < len(sentences) - 1:
            js_content += ","
        js_content += "\n"
    
    js_content += """  ]
};
"""
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"💾 Saved to: {output_file}")
    print(f"📈 Summary: {len(sentences)} sentences, {sum(len(s['words']) for s in sentences)} words")
    print("🎉 Complete!")

if __name__ == "__main__":
    main()