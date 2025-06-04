document.addEventListener('DOMContentLoaded', () => {
    const audioPlayer = document.getElementById('audio-player');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const progressBar = document.getElementById('progress-bar');
    const volumeBar = document.getElementById('volume-bar');
    const currentSongDisplay = document.getElementById('current-song');
    const playlistUl = document.getElementById('playlist-ul');

    // New UI elements for playlist management
    const songNameInput = document.getElementById('song-name-input');
    const songPathInput = document.getElementById('song-path-input');
    const addSongBtn = document.getElementById('add-song-btn');
    const songFileInput = document.getElementById('song-file-input'); // New file input
    const lyricsInput = document.getElementById('lyrics-input'); // New textarea for lyrics

    // Advanced Feature UI Elements
    const seekBackwardBtn = document.getElementById('seek-backward-btn');
    const seekForwardBtn = document.getElementById('seek-forward-btn');
    const sleepTimerInput = document.getElementById('sleep-timer-input');
    const setSleepTimerBtn = document.getElementById('set-sleep-timer-btn');
    const cancelSleepTimerBtn = document.getElementById('cancel-sleep-timer-btn');
    const sleepTimerStatus = document.getElementById('sleep-timer-status');

    // --- Visualizer ---
    const visualizerCanvas = document.getElementById('visualizer');
    const vCtx = visualizerCanvas.getContext('2d');
    let audioCtx, analyser, sourceNode, animationId;

    let playlist = [];
    let currentIndex = -1;
    let isPlaying = false;
    let sleepTimerId = null; // For storing the setTimeout ID of the sleep timer
    let sleepTimerEndTime = null; // To store when the timer should end

    const lyricsDisplay = document.getElementById('lyrics-display');
    let currentLyrics = [];
    let lyricsSyncInterval = null;

    // --- THEME TOGGLE ---
    const themeBtn = document.getElementById('toggle-theme-btn');
    const themeIcon = document.getElementById('theme-icon');
    const themeLabel = document.getElementById('theme-label');
    function setTheme(mode) {
        if (mode === 'light') {
            document.body.classList.add('light-mode');
            themeIcon.textContent = '☀️';
            themeLabel.textContent = 'Light Mode';
        } else {
            document.body.classList.remove('light-mode');
            themeIcon.textContent = '🌙';
            themeLabel.textContent = 'Dark Mode';
        }
        localStorage.setItem('musicPlayerTheme', mode);
    }
    function getTheme() {
        return localStorage.getItem('musicPlayerTheme') || 'dark';
    }
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = document.body.classList.contains('light-mode') ? 'light' : 'dark';
            setTheme(current === 'light' ? 'dark' : 'light');
        });
    }
    // Apply theme on load
    setTheme(getTheme());

    // --- SHAREABLE SONG LINK ---
    // Add Copy Link button to player
    function addCopyLinkBtn() {
        const controls = document.querySelector('.controls');
        if (!controls || document.getElementById('copy-link-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'copy-link-btn';
        btn.className = 'btn btn-outline-primary';
        btn.innerHTML = '🔗 Copy Link';
        btn.style.marginLeft = '10px';
        btn.onclick = function() {
            const url = new URL(window.location.href);
            url.searchParams.set('song', currentIndex);
            navigator.clipboard.writeText(url.toString());
            btn.innerHTML = '✅ Copied!';
            setTimeout(() => { btn.innerHTML = '🔗 Copy Link'; }, 1200);
        };
        controls.appendChild(btn);
    }
    addCopyLinkBtn();

    // On load, check for ?song=INDEX and play that song
    function playSongFromURL() {
        const params = new URLSearchParams(window.location.search);
        const idx = parseInt(params.get('song'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < playlist.length) {
            loadSong(idx);
            playSong();
        }
    }
    playSongFromURL();

    function parseLyrics(lyrics) {
        // Parse [mm:ss] Lyric format
        if (!lyrics) return [];
        const lines = lyrics.split(/\r?\n/);
        const result = [];
        const timeRegex = /^\s*\[(\d{1,2}):(\d{2})\]\s*(.*)$/;
        for (const line of lines) {
            const match = line.match(timeRegex);
            if (match) {
                const min = parseInt(match[1], 10);
                const sec = parseInt(match[2], 10);
                const time = min * 60 + sec;
                result.push({ time, text: match[3] });
            } else if (line.trim() !== '') {
                result.push({ time: null, text: line });
            }
        }
        return result;
    }

    function showLyrics(song) {
        if (!song || !song.lyrics) {
            lyricsDisplay.innerHTML = '<div class="text-muted">Không có lời bài hát.</div>';
            currentLyrics = [];
            return;
        }
        currentLyrics = parseLyrics(song.lyrics);
        if (currentLyrics.some(l => l.time !== null)) {
            // Có timestamp, render từng dòng
            lyricsDisplay.innerHTML = '<div class="lyrics-lines">' +
                currentLyrics.map((l, i) => `<div class="lyric-line" data-idx="${i}">${l.text}</div>`).join('') +
                '</div>';
        } else {
            // Không có timestamp, chỉ hiển thị toàn bộ
            lyricsDisplay.innerHTML = `<div class="lyrics-plain">${song.lyrics.replace(/\n/g, '<br>')}</div>`;
        }
    }

    function syncLyrics() {
        if (!currentLyrics.length || !currentLyrics.some(l => l.time !== null)) return;
        const currentTime = audioPlayer.currentTime;
        let activeIdx = -1;
        for (let i = 0; i < currentLyrics.length; i++) {
            if (currentLyrics[i].time !== null && currentLyrics[i].time <= currentTime) {
                activeIdx = i;
            }
        }
        // Highlight active line
        const lines = lyricsDisplay.querySelectorAll('.lyric-line');
        lines.forEach((line, idx) => {
            if (idx === activeIdx) {
                line.classList.add('active');
                // Scroll into view if needed
                line.scrollIntoView({ block: 'center', behavior: 'smooth' });
            } else {
                line.classList.remove('active');
            }
        });
    }

    function startLyricsSync() {
        stopLyricsSync();
        if (currentLyrics.length && currentLyrics.some(l => l.time !== null)) {
            lyricsSyncInterval = setInterval(syncLyrics, 300);
        }
    }
    function stopLyricsSync() {
        if (lyricsSyncInterval) clearInterval(lyricsSyncInterval);
        lyricsSyncInterval = null;
    }

    // Show lyrics when song changes
    function showCurrentSongLyrics() {
        const song = playlist[currentIndex];
        showLyrics(song);
        startLyricsSync();
    }

    // Update lyrics on song change, play, pause, seek
    audioPlayer.addEventListener('play', startLyricsSync);
    audioPlayer.addEventListener('pause', stopLyricsSync);
    audioPlayer.addEventListener('ended', stopLyricsSync);
    audioPlayer.addEventListener('timeupdate', syncLyrics);

    function loadSong(songIndex) {
        if (playlist.length === 0) {
            currentSongDisplay.textContent = "Playlist is empty.";
            audioPlayer.src = "";
            playPauseBtn.textContent = "Play";
            isPlaying = false;
            updatePlaylistUI(); // Ensure playlist UI is also cleared or shows empty message
            return;
        }
        if (songIndex >= 0 && songIndex < playlist.length) {
            const song = playlist[songIndex];
            audioPlayer.src = song.path;
            currentSongDisplay.textContent = song.name;
            currentIndex = songIndex;
            updatePlaylistUI(); // Refresh UI to mark the current song
        } else {
            console.error("Invalid song index attempted:", songIndex, "Playlist length:", playlist.length);
            // Behavior for invalid index: perhaps load first song or stop playback
            if (playlist.length > 0) {
                loadSong(0); // Default to first song
            } else {
                currentSongDisplay.textContent = "Error: Song not found";
                audioPlayer.src = "";
            }
        }
        showCurrentSongLyrics();
    }

    function playSong() {
        if (playlist.length === 0) {
            currentSongDisplay.textContent = "Playlist is empty. Add songs to play.";
            return;
        }
        if (currentIndex === -1 && playlist.length > 0) {
            // If no song was ever loaded (e.g. fresh start with items in localstorage)
            loadSong(0); // Load the first song
        }

        if (audioPlayer.src || (playlist.length > 0 && playlist[currentIndex])) {
            // Ensure src is set if trying to play from a valid index
            if (!audioPlayer.src && playlist[currentIndex]) {
                audioPlayer.src = playlist[currentIndex].path;
                currentSongDisplay.textContent = playlist[currentIndex].name;
            }

            audioPlayer.play()
                .then(() => {
                    isPlaying = true;
                    playPauseBtn.innerHTML = '⏸ Pause';
                })
                .catch(error => {
                    console.error("Error playing audio:", error);
                    currentSongDisplay.textContent = playlist[currentIndex] ? ("Error playing: " + playlist[currentIndex].name) : "Error: Could not play.";
                    isPlaying = false; // Ensure state is correct
                    playPauseBtn.innerHTML = '▶️ Play';
                });
        } else if (playlist.length > 0) {
            loadSong(currentIndex !== -1 ? currentIndex : 0); 
            playSong(); 
        } else {
            currentSongDisplay.textContent = "Playlist is empty.";
        }
    }

    function pauseSong() {
        audioPlayer.pause();
        isPlaying = false;
        playPauseBtn.innerHTML = '▶️ Play';
    }

    function prevSong() {
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        loadSong(currentIndex);
        if (isPlaying) playSong(); // If it was playing, continue playing the new song
    }

    function nextSong() {
        currentIndex = (currentIndex + 1) % playlist.length;
        loadSong(currentIndex);
        if (isPlaying) playSong(); // If it was playing, continue playing the new song
    }

    // Make selectSong globally accessible for inline HTML onclick
    window.selectSong = function(index) {
        if (index >= 0 && index < playlist.length) {
            if (index !== currentIndex || !audioPlayer.src || !isPlaying) {
                loadSong(index);
                playSong();
            } 
            // If same song is selected and playing, no action needed.
        } else {
            console.warn("selectSong called with invalid index:", index);
        }
    }

    function updatePlaylistUI() {
        playlistUl.innerHTML = ''; // Clear existing items
        if (playlist.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-group-item text-muted';
            li.textContent = 'Playlist is empty. Add songs below.';
            playlistUl.appendChild(li);
            return;
        }

        playlist.forEach((song, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            
            const songTextSpan = document.createElement('span');
            songTextSpan.textContent = song.name;
            songTextSpan.style.cursor = 'pointer'; // Make text itself clickable
            songTextSpan.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering remove if clicking on name
                selectSong(index);
            });

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-danger btn-sm';
            removeBtn.innerHTML = '🗑️ Remove';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Important to prevent song selection when clicking remove
                removeSong(index);
            });

            li.appendChild(songTextSpan);
            li.appendChild(removeBtn);
            
            if (index === currentIndex) {
                li.classList.add('active');
            }
            playlistUl.appendChild(li);
        });
    }

    function savePlaylistToLocalStorage() {
        // Note: Object URLs for local files won't persist reliably across sessions.
        // The 'isLocalFile' flag can be used to inform the user or handle this on load.
        localStorage.setItem('musicPlayerPlaylist', JSON.stringify(playlist));
    }

    function loadPlaylistFromLocalStorage() {
        const storedPlaylist = localStorage.getItem('musicPlayerPlaylist');
        if (storedPlaylist) {
            playlist = JSON.parse(storedPlaylist);
            // Handle songs marked as local files - they might need re-selection
            playlist = playlist.map(song => {
                if (song.isLocalFile) {
                    // For now, we keep the path, but it might be an invalid Object URL.
                    // A real app might prompt user to re-select these files or clear them.
                    console.warn(`Song "${song.name}" was a local file. Its path might be invalid on new session.`);
                }
                return song;
            });
        } else {
            // Default: 3 songs from music folder
            playlist = [
                { name: "Song 1", path: "music/song1.mp3", isLocalFile: false },
                { name: "Song 2", path: "music/song2.mp3", isLocalFile: false },
                { name: "Song 3", path: "music/song3.mp3", isLocalFile: false }
            ];
            savePlaylistToLocalStorage();
        }
        if (playlist.length > 0) {
            currentIndex = 0;
        } else {
            currentIndex = -1;
        }
    }

    function addSongToPlaylist() {
        let name = songNameInput.value.trim();
        let path = songPathInput.value.trim();
        const file = songFileInput.files[0];
        const lyrics = lyricsInput.value.trim();

        if (file) {
            // If a file is selected, prioritize it
            path = URL.createObjectURL(file);
            if (!name) { // Use file name if custom name is not provided
                name = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension for a cleaner name
            }
            songPathInput.value = '';
        } else if (!path) {
            alert("Please upload an audio file or enter a song URL.");
            return;
        }

        if (!name) {
            alert("Please enter a song name.");
            return;
        }

        playlist.push({ name, path, isLocalFile: !!file, lyrics });
        savePlaylistToLocalStorage();
        updatePlaylistUI();
        songNameInput.value = '';
        songPathInput.value = '';
        songFileInput.value = null;
        lyricsInput.value = '';
        songPathInput.disabled = false;
        songFileInput.disabled = false;

        if (playlist.length === 1 && currentIndex === -1) {
            currentIndex = 0;
            loadSong(currentIndex);
        }
        showCurrentSongLyrics();
    }

    function removeSong(index) {
        if (index >= 0 && index < playlist.length) {
            const wasPlaying = isPlaying;
            const removedSongIndex = index;

            playlist.splice(index, 1);
            savePlaylistToLocalStorage();

            if (playlist.length === 0) {
                audioPlayer.src = '';
                currentSongDisplay.textContent = "Playlist is empty.";
                currentIndex = -1;
                if(wasPlaying) pauseSong();
                playPauseBtn.textContent = "Play";
            } else if (removedSongIndex === currentIndex) {
                // If the currently playing or loaded song was removed
                if (wasPlaying) {
                    // Try to play the next song, or the previous if it was the last one
                    currentIndex = Math.min(removedSongIndex, playlist.length - 1); 
                    loadSong(currentIndex);
                    playSong(); 
                } else {
                    // If it was paused, just load the song at the new current index (or new first song)
                    currentIndex = Math.min(removedSongIndex, playlist.length - 1);
                    loadSong(currentIndex);
                }
            } else if (removedSongIndex < currentIndex) {
                // If a song before the current one was removed, adjust current index
                currentIndex--;
            }
            // If a song after the current one was removed, currentIndex doesn't need to change

            updatePlaylistUI();
        } else {
            console.error("Invalid index for song removal:", index);
        }
        showCurrentSongLyrics();
    }

    // Event Listeners
    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            pauseSong();
        } else {
            playSong();
        }
    });

    prevBtn.addEventListener('click', prevSong);
    nextBtn.addEventListener('click', nextSong);

    volumeBar.addEventListener('input', () => {
        audioPlayer.volume = volumeBar.value;
    });

    audioPlayer.addEventListener('timeupdate', () => {
        if (audioPlayer.duration) {
            const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            progressBar.value = progress;
        } else {
            progressBar.value = 0; // Reset if no duration (e.g., before song loads or error)
        }
    });

    progressBar.addEventListener('input', () => {
        if (audioPlayer.duration) {
            const seekTime = (progressBar.value / 100) * audioPlayer.duration;
            audioPlayer.currentTime = seekTime;
        } 
    });

    audioPlayer.addEventListener('ended', () => {
        // Optional: Auto-play next song when current one ends
        // nextSong(); 
        // For now, just reset play button to 'Play' as per typical guide behavior
        pauseSong(); // Visually reset button and state
        progressBar.value = 0; // Reset progress bar
        // To auto-play next, uncomment nextSong() and ensure playSong() is called within it.
    });

    addSongBtn.addEventListener('click', addSongToPlaylist);

    // Seek controls
    seekBackwardBtn.addEventListener('click', () => {
        if (audioPlayer.src && audioPlayer.duration) {
            audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
        }
    });

    seekForwardBtn.addEventListener('click', () => {
        if (audioPlayer.src && audioPlayer.duration) {
            audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10);
        }
    });

    // Sleep Timer controls
    function updateSleepTimerStatus() {
        if (sleepTimerId && sleepTimerEndTime) {
            const timeLeftMs = sleepTimerEndTime - Date.now();
            if (timeLeftMs <= 0) {
                sleepTimerStatus.textContent = "Timer expired.";
                cancelSleepTimerBtn.style.display = 'none';
                setSleepTimerBtn.disabled = false;
                sleepTimerInput.disabled = false;
                clearInterval(window.sleepTimerInterval);
                window.sleepTimerInterval = null;
            } else {
                const minutes = Math.floor(timeLeftMs / 60000);
                const seconds = Math.floor((timeLeftMs % 60000) / 1000);
                sleepTimerStatus.textContent = `Music will stop in ${minutes}m ${seconds}s`;
            }
        } else {
            sleepTimerStatus.textContent = "";
        }
    }

    setSleepTimerBtn.addEventListener('click', () => {
        const minutes = parseInt(sleepTimerInput.value, 10);
        if (isNaN(minutes) || minutes <= 0) {
            alert("Please enter a valid number of minutes for the sleep timer.");
            return;
        }

        if (sleepTimerId) {
            clearTimeout(sleepTimerId); // Clear existing timer if any
            if(window.sleepTimerInterval) clearInterval(window.sleepTimerInterval);
        }

        const milliseconds = minutes * 60 * 1000;
        sleepTimerEndTime = Date.now() + milliseconds;

        sleepTimerId = setTimeout(() => {
            pauseSong();
            sleepTimerId = null;
            sleepTimerEndTime = null;
            updateSleepTimerStatus(); 
            alert("Sleep timer ended. Music paused.");
        }, milliseconds);

        cancelSleepTimerBtn.style.display = 'inline-block';
        setSleepTimerBtn.disabled = true;
        sleepTimerInput.disabled = true;
        sleepTimerInput.value = ''; // Clear input
        
        if(window.sleepTimerInterval) clearInterval(window.sleepTimerInterval);
        window.sleepTimerInterval = setInterval(updateSleepTimerStatus, 1000);
        updateSleepTimerStatus(); // Initial call to display status
    });

    cancelSleepTimerBtn.addEventListener('click', () => {
        if (sleepTimerId) {
            clearTimeout(sleepTimerId);
            if(window.sleepTimerInterval) clearInterval(window.sleepTimerInterval);
            window.sleepTimerInterval = null;
            sleepTimerId = null;
            sleepTimerEndTime = null;
            sleepTimerStatus.textContent = "Sleep timer cancelled.";
            cancelSleepTimerBtn.style.display = 'none';
            setSleepTimerBtn.disabled = false;
            sleepTimerInput.disabled = false;
            setTimeout(() => { updateSleepTimerStatus(); }, 2000); // Clear message after 2s
        }
    });

    // Event listeners for input interaction
    songFileInput.addEventListener('change', () => {
        if (songFileInput.files.length > 0) {
            songPathInput.disabled = true; // Disable path input if file is chosen
            songPathInput.value = ''; // Clear path input
        } else {
            songPathInput.disabled = false;
        }
    });

    songPathInput.addEventListener('input', () => {
        if (songPathInput.value.trim() !== '') {
            songFileInput.disabled = true; // Disable file input if path is being typed
            songFileInput.value = null; // Clear file input
        } else {
            songFileInput.disabled = false;
        }
    });

    // Reset inputs enable state after adding song is handled in addSongToPlaylist

    // Initial setup
    loadPlaylistFromLocalStorage(); // Load playlist first

    if (playlist.length > 0) {
        // currentIndex is already set by loadPlaylistFromLocalStorage if playlist is not empty
        loadSong(currentIndex); 
    } else {
        currentSongDisplay.textContent = "Playlist is empty. Add songs to play.";
    }
    updatePlaylistUI(); // Render the initial playlist (or empty state)
    // Set initial play/pause icon
    playPauseBtn.innerHTML = isPlaying ? '⏸ Pause' : '▶️ Play';
    showCurrentSongLyrics();

    // --- Visualizer ---
    function setupVisualizer() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (!analyser) {
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64; // 32 bars
        }
        if (sourceNode) {
            sourceNode.disconnect();
        }
        sourceNode = audioCtx.createMediaElementSource(audioPlayer);
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    function drawVisualizer() {
        if (!analyser) return;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        vCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        const barWidth = (visualizerCanvas.width / bufferLength) * 0.7;
        let x = (visualizerCanvas.width - (barWidth + 4) * bufferLength) / 2;
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] * 0.5;
            vCtx.fillStyle = '#1db954';
            vCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 4;
        }
        animationId = requestAnimationFrame(drawVisualizer);
    }

    function startVisualizer() {
        setupVisualizer();
        visualizerCanvas.width = visualizerCanvas.offsetWidth;
        visualizerCanvas.height = 60;
        drawVisualizer();
    }
    function stopVisualizer() {
        if (animationId) cancelAnimationFrame(animationId);
        if (vCtx) vCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    }

    // Start/stop visualizer on play/pause
    audioPlayer.addEventListener('play', () => {
        startVisualizer();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    });
    audioPlayer.addEventListener('pause', stopVisualizer);
    audioPlayer.addEventListener('ended', stopVisualizer);
}); 