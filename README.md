# Offline Media Player

A web-based offline media player that allows you to play local audio and video files. It supports playlists, favorites, and themes.

## Features

- **Local File Playback**: Play audio and video files directly from your device without uploading them to a server.
- **Library Management**: Organize your media into a library.
- **Playlists**: Create and manage custom playlists.
- **Favorites**: Mark songs as favorites for quick access.
- **Responsive Design**: Works on desktop and mobile devices.
- **Theming**: Toggle between Dark and Blue/Glass themes.
- **Persistent Storage**: Uses IndexedDB to store your library and playlists locally in your browser.

## Usage

1.  **Upload Media**: Click the "Upload File" or "Upload Folder" button in the navigation bar to add media to your library.
2.  **Play**: Click on any media item in the list to start playback.
3.  **Controls**: Use the player bar at the bottom to play/pause, skip, shuffle, repeat, and adjust volume.
4.  **Playlists**: Create new playlists from the sidebar and add songs to them using the context menu (three dots) on each song.

## Technologies Used

- HTML5
- CSS3 (Bootstrap 5)
- JavaScript (ES6+)
- IndexedDB
- Service Worker (for PWA capabilities)

## Installation

Simply open `index.html` in a modern web browser. No server is required, but serving it via a local server (e.g., Live Server) is recommended for Service Worker functionality.
