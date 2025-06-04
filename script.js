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

    // Advanced Feature UI Elements
    const seekBackwardBtn = document.getElementById('seek-backward-btn');
    const seekForwardBtn = document.getElementById('seek-forward-btn');
    const sleepTimerInput = document.getElementById('sleep-timer-input');
    const setSleepTimerBtn = document.getElementById('set-sleep-timer-btn');
    const cancelSleepTimerBtn = document.getElementById('cancel-sleep-timer-btn');
    const sleepTimerStatus = document.getElementById('sleep-timer-status');

    let playlist = [];
    let currentIndex = -1;
    let isPlaying = false;
    let sleepTimerId = null; // For storing the setTimeout ID of the sleep timer
    let sleepTimerEndTime = null; // To store when the timer should end

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
                    playPauseBtn.textContent = "Pause";
                })
                .catch(error => {
                    console.error("Error playing audio:", error);
                    currentSongDisplay.textContent = playlist[currentIndex] ? ("Error playing: " + playlist[currentIndex].name) : "Error: Could not play.";
                    isPlaying = false; // Ensure state is correct
                    playPauseBtn.textContent = "Play";
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
        playPauseBtn.textContent = "Play";
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
            removeBtn.textContent = 'Remove';
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
        localStorage.setItem('musicPlayerPlaylist', JSON.stringify(playlist));
    }

    function loadPlaylistFromLocalStorage() {
        const storedPlaylist = localStorage.getItem('musicPlayerPlaylist');
        if (storedPlaylist) {
            playlist = JSON.parse(storedPlaylist);
        } else {
            // Optional: Default playlist if nothing in localStorage
            // playlist = [
            //     { name: "Default Song 1", path: "music/default1.mp3" },
            //     { name: "Default Song 2", path: "music/default2.mp3" }
            // ];
            playlist = []; // Start with an empty playlist
        }
        if (playlist.length > 0) {
            currentIndex = 0; // Default to first song if playlist is loaded
        } else {
            currentIndex = -1; // No songs, no current index
        }
    }

    function addSongToPlaylist() {
        const name = songNameInput.value.trim();
        const path = songPathInput.value.trim();

        if (name && path) {
            playlist.push({ name, path });
            savePlaylistToLocalStorage();
            updatePlaylistUI();
            songNameInput.value = ''; // Clear input
            songPathInput.value = '';   // Clear input

            // If this is the first song added to an empty playlist, load and prepare it.
            if (playlist.length === 1) {
                currentIndex = 0;
                loadSong(currentIndex);
                // Don't autoplay, just load it.
            }
        } else {
            alert("Please enter both song name and path/URL.");
        }
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

    // Initial setup
    loadPlaylistFromLocalStorage(); // Load playlist first

    if (playlist.length > 0) {
        // currentIndex is already set by loadPlaylistFromLocalStorage if playlist is not empty
        loadSong(currentIndex); 
    } else {
        currentSongDisplay.textContent = "Playlist is empty. Add songs to play.";
    }
    updatePlaylistUI(); // Render the initial playlist (or empty state)
}); 