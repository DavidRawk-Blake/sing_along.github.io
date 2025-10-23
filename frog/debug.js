// Add this to the end of frog/index.html before closing </body> tag
// Or run in browser console to diagnose button issues

console.log('=== FROG PAGE DIAGNOSTICS ===');

// Check if key elements exist
const playBtn = document.getElementById('playBtn');
const restartBtn = document.getElementById('restartBtn');
const song = document.getElementById('song');
const music = document.getElementById('music');

console.log('Play button:', playBtn ? 'Found' : 'MISSING');
console.log('Restart button:', restartBtn ? 'Found' : 'MISSING');
console.log('Song audio:', song ? 'Found' : 'MISSING');
console.log('Music audio:', music ? 'Found' : 'MISSING');

// Check if lyrics data is loaded
console.log('Lyrics data:', window.lyricsData ? 'Loaded' : 'MISSING');
if (window.lyricsData) {
    console.log('Sentences count:', window.lyricsData.sentences?.length || 0);
}

// Check if lyrics engine is initialized
console.log('Lyrics engine:', window.lyricsEngine ? 'Initialized' : 'NOT INITIALIZED');

// Check if functions exist
console.log('togglePlayPause function:', typeof window.togglePlayPause === 'function' ? 'Found' : 'MISSING');
console.log('restartAction function:', typeof window.restartAction === 'function' ? 'Found' : 'MISSING');

// Test button click handlers
if (playBtn) {
    console.log('Play button onclick:', playBtn.onclick ? 'Has handler' : 'NO HANDLER');
    console.log('Play button addEventListener count:', playBtn.getEventListeners ? Object.keys(playBtn.getEventListeners()).length : 'Cannot check');
}

// Check for JavaScript errors
window.addEventListener('error', (e) => {
    console.error('JavaScript Error:', e.error);
});

// Test manual function calls
try {
    if (typeof togglePlayPause === 'function') {
        console.log('togglePlayPause function is callable');
    }
} catch (e) {
    console.error('Error with togglePlayPause:', e);
}

console.log('=== END DIAGNOSTICS ===');