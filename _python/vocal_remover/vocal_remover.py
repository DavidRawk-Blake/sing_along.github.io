#!/usr/bin/python3
"""
Vocal Removal Script
Removes vocals from audio files using different techniques
"""

import sys
import numpy as np
from pathlib import Path
import argparse

def main():
    parser = argparse.ArgumentParser(description='Remove vocals from audio files')
    parser.add_argument('input_file', help='Input audio file (MP3, WAV, etc.)')
    parser.add_argument('-o', '--output', help='Output file (default: input_instrumental.mp3)')
    parser.add_argument('-m', '--method', choices=['center', 'ai', 'spectral', 'all'], 
                       default='all', help='Vocal removal method (all = generates both ai and spectral)')
    parser.add_argument('--ai-model', choices=['spleeter', 'demucs'], 
                       default='spleeter', help='AI model to use')
    parser.add_argument('--format', choices=['mp3', 'wav'], default='mp3',
                       help='Output audio format')
    
    args = parser.parse_args()
    
    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"❌ Error: Input file not found: {args.input_file}")
        sys.exit(1)
    
    print(f"🎵 Processing: {input_path.name}")
    print(f"🎯 Method: {args.method}")
    print(f"📄 Format: {args.format}")
    
    if args.method == 'all':
        # Generate both AI and spectral versions
        ai_output = input_path.parent / f"{input_path.stem}_spleeter.{args.format}"
        spectral_output = input_path.parent / f"{input_path.stem}_spectral.{args.format}"
        
        print(f"💾 Generating AI version: {ai_output.name}")
        remove_vocals_ai(input_path, ai_output, args.ai_model, args.format)
        
        print(f"💾 Generating spectral version: {spectral_output.name}")
        remove_vocals_spectral(input_path, spectral_output, args.format)
        
    else:
        # Set output filename
        if args.output:
            output_path = Path(args.output)
        else:
            output_path = input_path.parent / f"{input_path.stem}_instrumental.{args.format}"
        
        print(f"💾 Output: {output_path.name}")
        
        if args.method == 'center':
            remove_vocals_center_channel(input_path, output_path, args.format)
        elif args.method == 'ai':
            remove_vocals_ai(input_path, output_path, args.ai_model, args.format)
        elif args.method == 'spectral':
            remove_vocals_spectral(input_path, output_path, args.format)

def remove_vocals_center_channel(input_path, output_path, output_format='mp3'):
    """
    Remove vocals using center channel extraction
    Works by subtracting left and right channels
    """
    print("📦 Loading audio processing libraries...")
    
    try:
        import librosa
        import soundfile as sf
        if output_format == 'mp3':
            from pydub import AudioSegment
    except ImportError:
        missing = []
        try:
            import librosa
            import soundfile as sf
        except ImportError:
            missing.append("librosa soundfile")
        if output_format == 'mp3':
            try:
                from pydub import AudioSegment
            except ImportError:
                missing.append("pydub")
        
        if missing:
            print("❌ Required libraries not installed.")
            print(f"Run: /usr/bin/python3 -m pip install --user {' '.join(missing)}")
            sys.exit(1)
    
    print("🔊 Loading audio file...")
    
    # Load stereo audio
    y, sr = librosa.load(str(input_path), sr=None, mono=False)
    
    if y.ndim == 1:
        print("❌ Error: Input file is mono. Vocal removal requires stereo audio.")
        sys.exit(1)
    
    print("🎛️ Processing stereo channels...")
    
    # Extract left and right channels
    left = y[0]
    right = y[1]
    
    # Subtract right from left to remove center content (vocals)
    instrumental = left - right
    
    # Optional: Apply some filtering to clean up the result
    # You can uncomment these lines for better results
    # instrumental = librosa.effects.preemphasis(instrumental)
    # instrumental = np.clip(instrumental, -1.0, 1.0)
    
    print("💾 Saving instrumental version...")
    
    # Save the result
    if output_format == 'mp3':
        # Save as temporary WAV first
        temp_path = output_path.with_suffix('.temp.wav')
        sf.write(str(temp_path), instrumental, sr)
        
        # Convert to MP3
        audio = AudioSegment.from_wav(str(temp_path))
        audio.export(str(output_path), format="mp3", bitrate="192k")
        
        # Clean up temp file
        temp_path.unlink()
    else:
        sf.write(str(output_path), instrumental, sr)
    
    print("✅ Vocal removal complete!")
    print(f"📈 Original duration: {len(y[0])/sr:.2f}s")
    print(f"🎉 Instrumental saved to: {output_path}")

def remove_vocals_ai(input_path, output_path, model, output_format='mp3'):
    """
    Remove vocals using AI-based source separation
    """
    print(f"🤖 Using AI model: {model}")
    
    if model == 'spleeter':
        remove_vocals_spleeter(input_path, output_path, output_format)
    elif model == 'demucs':
        remove_vocals_demucs(input_path, output_path, output_format)

def remove_vocals_spleeter(input_path, output_path, output_format='mp3'):
    """
    Use Spleeter for vocal separation
    """
    try:
        from spleeter.separator import Separator
        import librosa
        import soundfile as sf
        if output_format == 'mp3':
            from pydub import AudioSegment
    except ImportError:
        missing = []
        try:
            from spleeter.separator import Separator
            import librosa
            import soundfile as sf
        except ImportError:
            missing.append("spleeter librosa soundfile")
        if output_format == 'mp3':
            try:
                from pydub import AudioSegment
            except ImportError:
                missing.append("pydub")
        
        if missing:
            print("❌ Required libraries not installed.")
            print(f"Run: /usr/bin/python3 -m pip install --user {' '.join(missing)}")
            sys.exit(1)
    
    print("🔧 Initializing Spleeter model...")
    
    # Initialize separator (2stems = vocals + accompaniment)
    separator = Separator('spleeter:2stems-16kHz')
    
    print("🎙️ Loading and processing audio...")
    
    # Load audio
    waveform, _ = librosa.load(str(input_path), sr=16000, mono=False)
    
    if waveform.ndim == 1:
        waveform = np.stack([waveform, waveform])
    
    waveform = waveform.T  # Spleeter expects (samples, channels)
    
    # Separate sources
    prediction = separator.separate(waveform)
    
    # Extract accompaniment (instrumental)
    instrumental = prediction['accompaniment']
    
    print("💾 Saving separated audio...")
    
    # Save instrumental
    if output_format == 'mp3':
        # Save as temporary WAV first
        temp_path = output_path.with_suffix('.temp.wav')
        sf.write(str(temp_path), instrumental, 16000)
        
        # Convert to MP3
        audio = AudioSegment.from_wav(str(temp_path))
        audio.export(str(output_path), format="mp3", bitrate="192k")
        
        # Clean up temp file
        temp_path.unlink()
    else:
        sf.write(str(output_path), instrumental, 16000)
    
    print("✅ AI vocal separation complete!")

def remove_vocals_demucs(input_path, output_path, output_format='mp3'):
    """
    Use Demucs for vocal separation (placeholder)
    """
    print("🔧 Demucs integration coming soon...")
    print("For now, using center channel method as fallback...")
    remove_vocals_center_channel(input_path, output_path, output_format)

def remove_vocals_spectral(input_path, output_path, output_format='mp3'):
    """
    Remove vocals using spectral subtraction
    """
    print("🔬 Using spectral analysis method...")
    
    try:
        import librosa
        import soundfile as sf
        from scipy import signal
        if output_format == 'mp3':
            from pydub import AudioSegment
    except ImportError:
        missing = []
        try:
            import librosa
            import soundfile as sf
            from scipy import signal
        except ImportError:
            missing.append("librosa soundfile scipy")
        if output_format == 'mp3':
            try:
                from pydub import AudioSegment
            except ImportError:
                missing.append("pydub")
        
        if missing:
            print("❌ Required libraries not installed.")
            print(f"Run: /usr/bin/python3 -m pip install --user {' '.join(missing)}")
            sys.exit(1)
    
    print("🔊 Loading audio file...")
    
    # Load audio
    y, sr = librosa.load(str(input_path), sr=None, mono=False)
    
    if y.ndim == 1:
        print("❌ Error: Input file is mono. Vocal removal requires stereo audio.")
        sys.exit(1)
    
    print("🔬 Analyzing frequency spectrum...")
    
    # Convert to mono for spectral analysis
    mono = librosa.to_mono(y)
    
    # Compute STFT
    stft = librosa.stft(mono)
    magnitude = np.abs(stft)
    phase = np.angle(stft)
    
    # Simple spectral subtraction (this is a basic implementation)
    # In practice, you'd use more sophisticated algorithms
    
    # Estimate noise spectrum (assume first 0.5 seconds is mostly instrumental)
    noise_frames = int(0.5 * sr / 512)  # 512 is default hop_length
    noise_spectrum = np.mean(magnitude[:, :noise_frames], axis=1, keepdims=True)
    
    # Subtract noise spectrum (simplified)
    clean_magnitude = magnitude - 0.5 * noise_spectrum
    clean_magnitude = np.maximum(clean_magnitude, 0.1 * magnitude)
    
    # Reconstruct audio
    clean_stft = clean_magnitude * np.exp(1j * phase)
    instrumental = librosa.istft(clean_stft)
    
    print("💾 Saving processed audio...")
    
    # Save result
    if output_format == 'mp3':
        # Save as temporary WAV first
        temp_path = output_path.with_suffix('.temp.wav')
        sf.write(str(temp_path), instrumental, sr)
        
        # Convert to MP3
        audio = AudioSegment.from_wav(str(temp_path))
        audio.export(str(output_path), format="mp3", bitrate="192k")
        
        # Clean up temp file
        temp_path.unlink()
    else:
        sf.write(str(output_path), instrumental, sr)
    
    print("✅ Spectral vocal removal complete!")

if __name__ == "__main__":
    main()