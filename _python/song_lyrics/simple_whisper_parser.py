#!/usr/bin/env python3
"""
Simple blocking Whisper parser - no background processing, no version manager issues
Run directly and wait for completion
"""

import json
import sys
import re
import time
import subprocess
from pathlib import Path
from datetime import datetime

def try_whisper_install():
    """Try to find and suggest Whisper installation"""
    python_executables = [
        sys.executable,
        "/usr/bin/python3",
        "/usr/local/bin/python3",
        "python3",
        "python"
    ]
    
    print("🔍 Checking Whisper installation across Python environments:")
    
    for python_exe in python_executables:
        try:
            result = subprocess.run([python_exe, "-c", "import whisper; print(whisper.__file__)"], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                print(f"✅ Found Whisper with: {python_exe}")
                print(f"   Location: {result.stdout.strip()}")
                return python_exe
            else:
                print(f"❌ Not found with: {python_exe}")
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception) as e:
            print(f"❌ Error with {python_exe}: {e}")
    
    print("\n💡 To install Whisper, try:")
    for python_exe in python_executables[:3]:  # Show top 3 options
        print(f"   {python_exe} -m pip install openai-whisper")
    
    return None

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
        print(f"✅ Whisper found at: {whisper.__file__}")
    except ImportError as e:
        print("❌ Whisper not found in current Python environment")
        print(f"🔍 Current Python: {sys.executable}")
        print(f"🔍 Import error: {e}")
        print()
        
        # Try to find Whisper in other Python environments
        working_python = try_whisper_install()
        
        if working_python and working_python != sys.executable:
            print(f"\n💡 Try running with: {working_python} {sys.argv[0]} {sys.argv[1]}")
        
        sys.exit(1)
    
    # Load model
    print("🔧 Loading medium model (this may take a while)...")
    model = whisper.load_model("medium")
    
    print("🎙️ Starting transcription...")
    print("⏳ This will take several minutes for the medium model...")
    
    # Transcribe with settings compatible with standard Whisper
    result = model.transcribe(
        str(audio_path),
        word_timestamps=True,
        temperature=0,
        beam_size=5,
        fp16=False,
        initial_prompt="Kookaburra sits in the old gum tree"  # Help Whisper recognize the song content
    )
    
    print("✅ Transcription complete!")
    
    # Show segment timing info for debugging
    if result['segments']:
        first_segment = result['segments'][0]
        last_segment = result['segments'][-1]
        print(f"🔍 First segment starts at: {first_segment['start']:.2f}s")
        print(f"🔍 Last segment ends at: {last_segment['end']:.2f}s")
        print(f"🔍 Found {len(result['segments'])} segments")
    
    # Extract words
    all_words = []
    for segment in result['segments']:
        if 'words' in segment:
            all_words.extend(segment['words'])
    
    print(f"📊 Extracted {len(all_words)} words")
    
    # Show timing of first and last words
    if all_words:
        first_word_time = all_words[0]['start']
        print(f"🔍 First word: '{all_words[0]['word'].strip()}' at {first_word_time:.2f}s")
        print(f"🔍 Last word: '{all_words[-1]['word'].strip()}' at {all_words[-1]['end']:.2f}s")
        
        # Warn if significant gap at start
        if first_word_time > 5.0:
            print(f"⚠️  WARNING: First word starts at {first_word_time:.1f}s - possible missing content at beginning!")
            print("   Consider checking if the audio file has a long intro or if speech starts earlier.")
    
    print("\n📝 Processing words into sentences...")
    print("=" * 50)
    
    # Create simple structure
    sentences = []
    current_sentence = []
    sentence_words = []  # Track words for current sentence display
    
    for word_data in all_words:
        word_text = word_data['word'].strip()
        if not word_text:
            continue
            
        # Show word as it's being processed
        print(f"  📖 {word_text} ({word_data['start']:.1f}s)", end=" ", flush=True)
            
        word_entry = {
            "text": word_text,
            "start_time": round(word_data['start'], 3),
            "end_time": round(word_data['end'], 3),
            "target_word": False
        }
        
        current_sentence.append(word_entry)
        sentence_words.append(word_text)
        
        # More aggressive sentence break on punctuation, shorter pauses, or sentence length
        should_break = False
        
        # Break on punctuation
        if re.search(r'[.!?,:;]$', word_text):
            should_break = True
        
        # Break on shorter pauses (reduced from 0.8s to 0.4s)
        elif (len(current_sentence) > 0 and len(all_words) > all_words.index(word_data) + 1 and
              all_words[all_words.index(word_data) + 1]['start'] - word_data['end'] > 0.4):
            should_break = True
        
        # Break on sentence length (max 12 words per sentence)
        elif len(current_sentence) >= 12:
            should_break = True
        
        # Break on line breaks or common phrase endings
        elif re.search(r'\n|—|–', word_text):
            should_break = True
            
        if should_break:
            
            if current_sentence:
                # Show completed sentence
                sentence_text = " ".join(sentence_words)
                print(f"\n  ✅ Sentence {len(sentences) + 1}: \"{sentence_text}\"")
                print(f"     ⏱️  {current_sentence[0]['start_time']:.1f}s - {current_sentence[-1]['end_time']:.1f}s")
                print()
                
                sentences.append({"words": current_sentence})
                current_sentence = []
                sentence_words = []
    
    # Add final sentence if any words remain
    if current_sentence:
        sentence_text = " ".join(sentence_words)
        print(f"\n  ✅ Final sentence {len(sentences) + 1}: \"{sentence_text}\"")
        print(f"     ⏱️  {current_sentence[0]['start_time']:.1f}s - {current_sentence[-1]['end_time']:.1f}s")
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
            # Use JSON encoding for safe JavaScript string literals
            escaped_text = json.dumps(word['text'])  # This properly escapes quotes, brackets, etc.
            js_content += f"""        {{
          text: {escaped_text},
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