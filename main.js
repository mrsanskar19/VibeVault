
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const themeSwitcher = document.getElementById('theme-switcher');
    const uploadFileBtn = document.getElementById('upload-file-btn');
    const uploadFolderBtn = document.getElementById('upload-folder-btn');
    const fileUpload = document.getElementById('file-upload');
    const folderUpload = document.getElementById('folder-upload');
    const mediaLibraryBody = document.getElementById('media-library-body');
    const libraryLinks = document.getElementById('library-links');
    const playlistList = document.getElementById('playlist-list');
    const addPlaylistBtn = document.getElementById('add-playlist-btn');
    const createPlaylistModal = new bootstrap.Modal(document.getElementById('create-playlist-modal'));
    const savePlaylistBtn = document.getElementById('save-playlist-btn');
    const playlistNameInput = document.getElementById('playlist-name-input');
    const clearLibraryBtn = document.getElementById('clear-library-btn');

    // Player Controls
    const playPauseBtn = document.getElementById('play-pause-btn');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const repeatBtn = document.getElementById('repeat-btn');
    const progressBar = document.getElementById('progress-bar');
    const volumeBar = document.getElementById('volume-bar');
    const volumeIndicator = document.getElementById('volume-indicator');
    const volumeToggleBtn = document.getElementById('volume-toggle-btn');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    const playerArt = document.getElementById('player-art');
    const playerTitle = document.getElementById('player-title');
    const playerArtist = document.getElementById('player-artist');
    const audioPlayer = document.getElementById('audio-player');
    const playerContainer = document.getElementById('player-container');

    // Templates
    const videoPlayerTemplate = document.getElementById('video-player-template');
    const mediaItemTemplate = document.getElementById('media-item-template');
    const playlistItemTemplate = document.getElementById('playlist-item-template');

    // Modals
    const addToPlaylistModal = new bootstrap.Modal(document.getElementById('add-to-playlist-modal'));
    const playlistSelection = document.getElementById('playlist-selection');
    const addToPlaylistConfirmBtn = document.getElementById('add-to-playlist-confirm-btn');

    // --- App State ---
    let db;
    let allSongs = [];
    let currentTrackId = null;
    let currentPlaylist = [];
    let originalPlaylist = [];
    let isShuffle = false;
    let repeatState = 0; // 0: Off, 1: One, 2: All
    let songToAddToPlaylist = null;
    let activePlayer = audioPlayer;
    let isMuted = false;
    let lastVolume = 1;
    let animationFrameId;

    // --- 1. Database Initialization ---
    const initDB = () => {
        const request = indexedDB.open('mediaPlayerDB', 2);
        request.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
            if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = e => {
            db = e.target.result;
            loadAllSongs();
            renderPlaylists();
        };
        request.onerror = e => console.error("DB error:", e.target.errorCode);
    };

    // --- 2. UI & Theme ---
    themeSwitcher.addEventListener('change', () => {
        document.documentElement.setAttribute('data-bs-theme', themeSwitcher.checked ? 'blue-glass' : 'dark');
    });

    // --- 3. File Management ---
    uploadFileBtn.addEventListener('click', () => fileUpload.click());
    uploadFolderBtn.addEventListener('click', () => folderUpload.click());
    fileUpload.addEventListener('change', handleFileUpload);
    folderUpload.addEventListener('change', handleFileUpload);

    async function handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        showToast(`Importing ${files.length} file(s)...`, 'info');
        for (const file of files) {
            if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
                await addToDB('songs', { name: file.name, type: file.type, file: file, favorite: false });
            }
        }
        loadAllSongs();
        event.target.value = '';
    }
    
    clearLibraryBtn.addEventListener('click', () => {
        if (!confirm('Are you sure you want to delete all media and playlists?')) return;
        Promise.all([
            clearDBStore('songs'),
            clearDBStore('playlists')
        ]).then(() => {
            showToast('Library cleared!', 'success');
            loadAllSongs();
            renderPlaylists();
            stopPlayback();
        });
    });

    // --- 4. Library & Playlist Rendering ---
    const loadAllSongs = async () => {
        allSongs = await getAllFromDB('songs');
        renderMediaList(allSongs);
    };

    const renderMediaList = (songs) => {
        mediaLibraryBody.innerHTML = '';
        currentPlaylist = songs.map(s => s.id);
        originalPlaylist = [...currentPlaylist];
        songs.forEach((song, index) => {
            const clone = mediaItemTemplate.content.cloneNode(true);
            const tr = clone.querySelector('.media-item');
            tr.dataset.id = song.id;
            clone.querySelector('[data-col="index"]').textContent = index + 1;
            clone.querySelector('[data-col="title"]').textContent = song.name;
            clone.querySelector('[data-col="type"]').textContent = song.type.split('/')[0];
            clone.querySelector('.favorite-btn').classList.toggle('active', song.favorite);
            mediaLibraryBody.appendChild(clone);
        });
        updateActiveTrackIndicator();
    };

    const renderPlaylists = async () => {
        playlistList.innerHTML = '';
        const playlists = await getAllFromDB('playlists');
        playlists.forEach(playlist => {
            const clone = playlistItemTemplate.content.cloneNode(true);
            const link = clone.querySelector('.nav-link');
            link.dataset.id = playlist.id;
            link.querySelector('.playlist-name').textContent = playlist.name;
            clone.querySelector('.delete-playlist-btn').dataset.id = playlist.id;
            playlistList.appendChild(clone);
        });
    };
    
    const updateActiveTrackIndicator = () => {
        document.querySelectorAll('.media-item').forEach(row => {
            const isActive = parseInt(row.dataset.id) === currentTrackId;
            row.classList.toggle('active-track', isActive);
            if (isActive) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    };

    // --- 5. Playback Logic ---
    const playTrack = async (id) => {
        currentTrackId = id;
        const song = await getFromDB('songs', id);
        if (!song) return stopPlayback();

        const objectURL = URL.createObjectURL(song.file);
        const isVideo = song.type.startsWith('video/');

        if (activePlayer && activePlayer.id !== 'audio-player') playerContainer.innerHTML = '';
        audioPlayer.pause();
        audioPlayer.src = '';

        activePlayer = isVideo ? setupVideoPlayer() : audioPlayer;
        
        activePlayer.src = objectURL;
        activePlayer.play();
        activePlayer.volume = volumeBar.value;

        updatePlayerUI(song);
        playPauseBtn.innerHTML = `<i class="bi bi-pause-circle-fill fs-2"></i>`;
        updateActiveTrackIndicator();
        
        // Start smooth progress bar updates
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animateProgressBar();
    };
    
    const setupVideoPlayer = () => {
        const videoClone = videoPlayerTemplate.content.cloneNode(true);
        playerContainer.appendChild(videoClone);
        const videoEl = playerContainer.querySelector('video');
        videoEl.addEventListener('timeupdate', updateTimeDisplay);
        videoEl.addEventListener('ended', handleTrackEnd);
        videoEl.addEventListener('loadedmetadata', updateTimeDisplay);
        return videoEl;
    }

    const updatePlayerUI = (song) => {
        playerTitle.textContent = song.name;
        playerArtist.textContent = 'Unknown Artist';
        playerArt.src = 'logo.png';
        document.querySelector('.player-bar').classList.add('playing');
    };

    const stopPlayback = () => {
        if (activePlayer) activePlayer.pause();
        if (activePlayer && activePlayer.id !== 'audio-player') playerContainer.innerHTML = '';
        audioPlayer.src = '';
        activePlayer = audioPlayer;
        currentTrackId = null;

        playerTitle.textContent = 'Select a song';
        playerArtist.textContent = 'No artist';
        playerArt.src = 'logo.png';
        document.querySelector('.player-bar').classList.remove('playing');
        playPauseBtn.innerHTML = `<i class="bi bi-play-circle-fill fs-2"></i>`;
        progressBar.value = 0;
        progressBar.style.setProperty('--progress', '0%');
        currentTimeEl.textContent = '0:00';
        durationEl.textContent = '0:00';
        updateActiveTrackIndicator();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };

    playerContainer.addEventListener('click', e => {
        if (e.target.tagName === 'VIDEO') togglePlayPause();
    });

    mediaLibraryBody.addEventListener('click', (event) => {
        const target = event.target.closest('.media-item, .favorite-btn, .add-to-playlist-btn, .remove-song-btn');
        if (!target) return;
        const trackId = parseInt(target.closest('.media-item').dataset.id);

        if (target.matches('.favorite-btn')) toggleFavorite(trackId, target);
        else if (target.matches('.add-to-playlist-btn')) setupAddToPlaylistModal(trackId);
        else if (target.matches('.remove-song-btn')) removeSong(trackId);
        else if (target.matches('.media-item')) playTrack(trackId);
    });
    
     const toggleFavorite = async (id, btn) => {
        const song = await getFromDB('songs', id);
        song.favorite = !song.favorite;
        await updateDB('songs', song);
        allSongs.find(s => s.id === id).favorite = song.favorite;
        btn.classList.toggle('active', song.favorite);
    };

    const removeSong = async (id) => {
        if (!confirm('Are you sure you want to remove this song?')) return;
        await deleteFromDB('songs', id);
        loadAllSongs();
    };

    // --- 6. Player Controls ---
    const togglePlayPause = () => {
        if (!activePlayer.src) return;
        if (activePlayer.paused) {
             activePlayer.play();
             document.querySelector('.player-bar').classList.add('playing');
        } else {
             activePlayer.pause();
             document.querySelector('.player-bar').classList.remove('playing');
        }
        playPauseBtn.innerHTML = `<i class="bi bi-${activePlayer.paused ? 'play' : 'pause'}-circle-fill fs-2"></i>`;
    };
    playPauseBtn.addEventListener('click', togglePlayPause);

    nextBtn.addEventListener('click', () => playNext());
    prevBtn.addEventListener('click', () => playPrev());

    const playNext = (isEndOfTrack = false) => {
        const isRepeatingAll = repeatState === 2 && isEndOfTrack;
        const currentIndex = currentPlaylist.indexOf(currentTrackId);
        let nextIndex = currentIndex + 1;
        if (nextIndex >= currentPlaylist.length) {
            if (isRepeatingAll) nextIndex = 0;
            else return showToast('End of playlist', 'info');
        }
        playTrack(currentPlaylist[nextIndex]);
    };

    const playPrev = () => {
        const currentIndex = currentPlaylist.indexOf(currentTrackId);
        playTrack(currentPlaylist[currentIndex - 1 < 0 ? currentPlaylist.length - 1 : currentIndex - 1]);
    };

    shuffleBtn.addEventListener('click', () => {
        isShuffle = !isShuffle;
        shuffleBtn.classList.toggle('active', isShuffle);
        currentPlaylist = isShuffle ? [...originalPlaylist].sort(() => Math.random() - 0.5) : [...originalPlaylist];
    });

    repeatBtn.addEventListener('click', () => {
        repeatState = (repeatState + 1) % 3;
        const icons = ['bi-repeat', 'bi-repeat-1', 'bi-repeat'];
        repeatBtn.innerHTML = `<i class="bi ${icons[repeatState]}"></i>`;
        repeatBtn.classList.toggle('active', repeatState !== 0);
    });
    
    // --- Progress & Time ---
    const animateProgressBar = () => {
        if (!activePlayer || !activePlayer.duration) return;
        const progress = activePlayer.currentTime / activePlayer.duration;
        progressBar.value = progress * 100;
        progressBar.style.setProperty('--progress', `${progress * 100}%`);
        updateTimeDisplay();
        animationFrameId = requestAnimationFrame(animateProgressBar);
    }

    const updateTimeDisplay = () => {
        if (!activePlayer.duration) return;
        durationEl.textContent = formatTime(activePlayer.duration);
        currentTimeEl.textContent = formatTime(activePlayer.currentTime);
    }

    progressBar.addEventListener('input', (e) => {
        if (activePlayer.duration) {
            activePlayer.currentTime = (e.target.value / 100) * activePlayer.duration;
        }
    });

    const handleTrackEnd = () => {
        if (repeatState === 1) {
            activePlayer.currentTime = 0;
            activePlayer.play();
        } else {
            playNext(true);
        }
    };
    audioPlayer.addEventListener('ended', handleTrackEnd);
    audioPlayer.addEventListener('timeupdate', updateTimeDisplay);
    
    // --- Volume Control ---
    volumeBar.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value);
        setVolume(volume);
    });
    
    volumeToggleBtn.addEventListener('click', () => {
        if(isMuted) {
            setVolume(lastVolume);
            isMuted = false;
        } else {
            lastVolume = activePlayer.volume;
            setVolume(0);
            isMuted = true;
        }
    });
    
    const setVolume = (volume) => {
        activePlayer.volume = volume;
        volumeBar.value = volume;
        isMuted = volume === 0;
        volumeIndicator.textContent = `${Math.round(volume * 100)}%`;
        volumeToggleBtn.innerHTML = `<i class="bi bi-volume-${isMuted ? 'mute' : 'up'}-fill"></i>`;
    }

    // --- 7. Playlist Management ---
    libraryLinks.addEventListener('click', e => {
        e.preventDefault();
        const filter = e.target.closest('a').dataset.filter;
        document.querySelectorAll('#library-links a, #playlist-list a').forEach(a => a.classList.remove('active'));
        e.target.closest('a').classList.add('active');
        if (filter === 'all') renderMediaList(allSongs);
        else if (filter === 'favorites') renderMediaList(allSongs.filter(s => s.favorite));
    });

    playlistList.addEventListener('click', async e => {
        const link = e.target.closest('a');
        const deleteBtn = e.target.closest('.delete-playlist-btn');

        if(deleteBtn) {
            e.stopPropagation();
            if(!confirm('Delete this playlist?')) return;
            await deleteFromDB('playlists', parseInt(deleteBtn.dataset.id));
            renderPlaylists();
            loadAllSongs();
            return;
        }

        if (link) {
            e.preventDefault();
            document.querySelectorAll('#library-links a, #playlist-list a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            const playlistId = parseInt(link.dataset.id);
            const playlist = await getFromDB('playlists', playlistId);
            renderMediaList(allSongs.filter(song => playlist.songs.includes(song.id)));
        }
    });

    addPlaylistBtn.addEventListener('click', () => createPlaylistModal.show());
    savePlaylistBtn.addEventListener('click', async () => {
        const name = playlistNameInput.value.trim();
        if (name) {
            await addToDB('playlists', { name: name, songs: [] });
            renderPlaylists();
            createPlaylistModal.hide();
        }
    });

    async function setupAddToPlaylistModal(trackId) {
        songToAddToPlaylist = trackId;
        playlistSelection.innerHTML = (await getAllFromDB('playlists')).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        addToPlaylistModal.show();
    }

    addToPlaylistConfirmBtn.addEventListener('click', async () => {
        const playlistId = parseInt(playlistSelection.value);
        if (!playlistId) return;
        const playlist = await getFromDB('playlists', playlistId);
        if (!playlist.songs.includes(songToAddToPlaylist)) {
            playlist.songs.push(songToAddToPlaylist);
            await updateDB('playlists', playlist);
            showToast('Song added to playlist', 'success');
        } else {
            showToast('Song already in playlist', 'info');
        }
        addToPlaylistModal.hide();
    });

    // --- 8. DB & Helper Functions ---
    const formatTime = (s) => isNaN(s) ? '0:00' : `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
    const getFromDB = (store, id) => new Promise(res => db.transaction(store).objectStore(store).get(id).onsuccess = e => res(e.target.result));
    const getAllFromDB = (store) => new Promise(res => db.transaction(store).objectStore(store).getAll().onsuccess = e => res(e.target.result));
    const addToDB = (store, item) => new Promise(res => db.transaction(store, 'readwrite').objectStore(store).add(item).onsuccess = e => res(e.target.result));
    const updateDB = (store, item) => new Promise(res => db.transaction(store, 'readwrite').objectStore(store).put(item).onsuccess = e => res(e.target.result));
    const deleteFromDB = (store, id) => new Promise(res => db.transaction(store, 'readwrite').objectStore(store).delete(id).onsuccess = e => res(e.target.result));
    const clearDBStore = (store) => new Promise(res => db.transaction(store, 'readwrite').objectStore(store).clear().onsuccess = e => res());

    function showToast(message, type = 'primary') {
        const toastContainer = document.querySelector('.toast-container');
        const toastEl = new DOMParser().parseFromString(`<div class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true"><div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div></div>`, "text/html").body.firstChild;
        toastContainer.appendChild(toastEl);
        const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }

    // --- Initial Load ---
    initDB();
});










if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}