#!/usr/bin/env python3
"""
Song Transcription Tool using OpenAI Whisper
Generates karaoke-ready lyrics data with word-level timestamps from MP3 files
Note: Does not generate instrumental tracks - you'll need to provide your own
"""

import argparse
import json
import os
import sys
import warnings
import subprocess
import time
from pathlib import Path
import re
from datetime import datetime

try:
    import whisper
except ImportError:
    print("Error: OpenAI Whisper not installed. Please run: pip install openai-whisper")
    sys.exit(1)


def clean_word(word):
    """Clean up word text by removing extra punctuation and whitespace"""
    return word.strip().strip('.,!?;:"()[]{}')


def detect_sentence_breaks(words, confidence_threshold=0.8):
    """
    Detect natural sentence breaks based on punctuation and pauses
    """
    sentence_breaks = []
    
    for i, word in enumerate(words):
        # Check for sentence-ending punctuation
        if re.search(r'[.!?]', word['word']):
            sentence_breaks.append(i)
        # Check for long pauses (more than 0.5 second gap to next word)
        elif i < len(words) - 1:
            gap = words[i + 1]['start'] - word['end']
            if gap > 0.5:  # 0.5 second pause indicates sentence break
                sentence_breaks.append(i)
    
    # Ensure we end with the last word
    if len(words) > 0 and (len(sentence_breaks) == 0 or sentence_breaks[-1] != len(words) - 1):
        sentence_breaks.append(len(words) - 1)
    
    return sentence_breaks


def identify_target_words(words, min_confidence=0.85, min_length=4):
    """
    Identify potential target words based on confidence and word characteristics
    """
    target_words = []
    
    for word in words:
        clean_text = clean_word(word['word'])
        confidence = word.get('confidence', 0.0)
        
        # Criteria for target words:
        # - High confidence
        # - Reasonable length
        # - Not common filler words
        filler_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        
        if (confidence >= min_confidence and 
            len(clean_text) >= min_length and 
            clean_text.lower() not in filler_words and
            clean_text.isalpha()):  # Only alphabetic words
            target_words.append(word)
    
    return target_words


def words_to_lyrics_data(words, filename, total_duration=0.0):
    """
    Convert Whisper word-level timestamps to lyrics-data.js format
    """
    if not words:
        return None
    
    # Detect sentence boundaries
    sentence_breaks = detect_sentence_breaks(words)
    
    # Identify target words
    target_word_list = identify_target_words(words)
    target_word_texts = {clean_word(tw['word']).lower() for tw in target_word_list}
    
    sentences = []
    full_sentences = []
    sentence_start = 0
    
    for break_index in sentence_breaks:
        sentence_words = []
        sentence_text_parts = []
        sentence_start_time = None
        sentence_end_time = None
        
        for i in range(sentence_start, break_index + 1):
            if i >= len(words):
                break
                
            word = words[i]
            clean_text = clean_word(word['word'])
            
            if not clean_text:  # Skip empty words
                continue
            
            # Track sentence timing
            if sentence_start_time is None:
                sentence_start_time = word['start']
            sentence_end_time = word['end']
            
            # Add to sentence text
            sentence_text_parts.append(clean_text)
            
            # Use start and end times instead of duration for better accuracy
            start_time = word['start']
            end_time = word['end']
            
            # Check if this is a target word
            is_target = clean_text.lower() in target_word_texts
            
            sentence_words.append({
                "text": clean_text,
                "start_time": round(start_time, 2),
                "end_time": round(end_time, 2),
                "target_word": is_target
            })
        
        if sentence_words:  # Only add non-empty sentences
            sentences.append({
                "image": None,
                "words": sentence_words
            })
            
            # Add full sentence data
            full_sentences.append({
                "text": " ".join(sentence_text_parts),
                "start_time": round(sentence_start_time, 2),
                "end_time": round(sentence_end_time, 2),
                "duration": round(sentence_end_time - sentence_start_time, 2)
            })
        
        sentence_start = break_index + 1
    
    # Generate the base filename for audio sources
    base_name = Path(filename).stem
    
    # Set default instrumental filename (user will need to provide their own)
    music_source = f"{base_name}-instrumental.mp3"
    
    # Calculate offset based on the start time of the first sentence
    offset = 0.0
    if full_sentences and len(full_sentences) > 0:
        offset = full_sentences[0]["start_time"]
    
    # Calculate outro based on time between last sentence end and song end
    outro = 3.0  # default fallback
    if full_sentences and len(full_sentences) > 0 and total_duration > 0:
        last_sentence_end = full_sentences[-1]["end_time"]
        outro = max(0.0, total_duration - last_sentence_end)
    
    return {
        "offset": round(offset, 2),
        "outro": round(outro, 2),
        "song_source": f"{base_name}.mp3",
        "music_source": music_source,
        "full_sentence": full_sentences,
        "sentences": sentences
    }


def create_progress_file(audio_file, status, message=""):
    """Create a progress file to track transcription status"""
    progress_file = Path(audio_file).parent / f".transcription_progress_{Path(audio_file).stem}.txt"
    timestamp = datetime.now().strftime("%H:%M:%S")
    with open(progress_file, 'w') as f:
        f.write(f"{status}\n{timestamp}\n{message}")
    return progress_file


def transcribe_to_json(audio_file):
    """
    Transcribe audio file to JSON format with word-level timestamps
    Runs in a separate process to avoid VS Code crashes
    """
    import subprocess
    import sys
    
    # Get absolute paths for the script
    audio_path = Path(audio_file).resolve()
    progress_file_path = audio_path.parent / f'.transcription_progress_{audio_path.stem}.txt'
    result_file_path = audio_path.parent / f'.transcription_result_{audio_path.stem}.json'
    
    # Create a separate Python script that runs the transcription
    script_content = f'''
import whisper
import json
import warnings
from pathlib import Path

def run_transcription():
    try:
        # Update progress
        with open(r"{progress_file_path}", 'w') as f:
            f.write("LOADING\\nLoading Whisper model (tiny - more stable)...")
        
        model = whisper.load_model("tiny")
        
        with open(r"{progress_file_path}", 'w') as f:
            f.write("PROCESSING\\nTranscribing audio...")
        
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="FP16 is not supported on CPU; using FP32 instead")
            result = model.transcribe(r"{audio_path}", word_timestamps=True)
        
        # Save result to temp file
        with open(r"{result_file_path}", 'w') as f:
            json.dump(result, f)
        
        with open(r"{progress_file_path}", 'w') as f:
            f.write("COMPLETED\\nTranscription completed successfully!")
            
    except Exception as e:
        with open(r"{progress_file_path}", 'w') as f:
            f.write(f"ERROR\\n{{str(e)}}")

if __name__ == "__main__":
    run_transcription()
'''
    
    # Write the transcription script
    temp_script = audio_path.parent / f"temp_transcribe_{audio_path.stem}.py"
    with open(temp_script, 'w') as f:
        f.write(script_content)
    
    print(f"Starting transcription process (detached from VS Code)...")
    print(f"Audio file: {audio_path}")
    print("This will run independently and won't freeze your editor.")
    
    # Get the Python executable path
    python_path = sys.executable
    
    # Start the transcription process (detached)
    process = subprocess.Popen([python_path, str(temp_script)], 
                             stdout=subprocess.PIPE, 
                             stderr=subprocess.PIPE)
    
    # Monitor progress by reading the progress file
    progress_file = progress_file_path
    result_file = result_file_path
    
    print("Monitoring progress...")
    while True:
        time.sleep(3)  # Check every 3 seconds
        
        if progress_file.exists():
            with open(progress_file, 'r') as f:
                lines = f.read().strip().split('\\n')
                status = lines[0]
                message = lines[2] if len(lines) > 2 else ""
                
                print(f"Status: {status} - {message}")
                
                if status == "COMPLETED":
                    break
                elif status == "ERROR":
                    raise Exception(f"Transcription failed: {message}")
    
    # Wait for process to complete
    process.wait()
    
    # Read the result
    if not result_file.exists():
        raise Exception("Transcription result file not found")
        
    with open(result_file, 'r') as f:
        result = json.load(f)
    
    # Clean up temp files
    temp_script.unlink()
    progress_file.unlink()
    result_file.unlink()
    
    # Extract word-level data
    words = []
    for segment in result["segments"]:
        if "words" in segment:
            words.extend(segment["words"])
    
    # Calculate total duration from the last word's end time
    total_duration = 0.0
    if words:
        total_duration = max(word['end'] for word in words)
    
    return {
        "text": result["text"],
        "words": words,
        "language": result["language"],
        "duration": total_duration
    }



def save_lyrics_data_js(data, output_file):
    """
    Save data in lyrics-data.js format
    """
    js_content = f"""/**
 * Auto-generated lyrics data from Whisper transcription
 * Generated from: {Path(output_file).stem}
 */

// Global lyrics data for the karaoke game
window.lyricsData = {json.dumps(data, indent=2)};
"""
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe MP3 files to karaoke-ready lyrics data using Whisper AI (lyrics only, no instrumental generation)"
    )
    parser.add_argument("input_file", help="Input MP3 file path")
    
    args = parser.parse_args()
    
    # Validate input file
    if not os.path.exists(args.input_file):
        print(f"Error: Input file '{args.input_file}' not found")
        sys.exit(1)
    
    try:
        # Transcribe the audio
        result = transcribe_to_json(args.input_file)
        
        # Generate output filename in the same directory as the source song
        source_file = Path(args.input_file)
        source_dir = source_file.parent
        
        # Find available filename with numbering if needed
        output_file = source_dir / "lyrics-data.js"
        counter = 1
        while output_file.exists():
            output_file = source_dir / f"lyrics-data({counter}).js"
            counter += 1
        
        # Convert to lyrics-data format
        lyrics_data = words_to_lyrics_data(
            result["words"], 
            args.input_file,
            result["duration"]
        )
        
        if lyrics_data:
            save_lyrics_data_js(lyrics_data, output_file)
            print(f"Lyrics data saved to: {output_file}")
            
            # Print summary
            total_words = sum(len(sentence["words"]) for sentence in lyrics_data["sentences"])
            target_words = sum(1 for sentence in lyrics_data["sentences"] 
                             for word in sentence["words"] if word["target_word"])
            
            print(f"\nSummary:")
            print(f"  Language: {result['language']}")
            print(f"  Sentences: {len(lyrics_data['sentences'])}")
            print(f"  Total words: {total_words}")
            print(f"  Target words: {target_words}")
        else:
            print("Error: No words found in transcription")
            sys.exit(1)
        
    except Exception as e:
        print(f"Error during transcription: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()