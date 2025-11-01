// Variable global para el reproductor de YouTube
let player;
// Variable para guardar el ID del video actual
let currentVideoId = '';
// Asumimos una tasa de frames de 30 FPS para la simulación
const FRAME_RATE = 30;

// Esta función es llamada automáticamente por la API de YouTube cuando está lista.
function onYouTubeIframeAPIReady() {
    console.log("API de YouTube lista.");
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores de Elementos ---
    const videoUrlInput = document.getElementById('videoUrl');
    const loadVideoButton = document.getElementById('loadVideo');
    const playPauseButton = document.getElementById('playPause');
    const backwardSecButton = document.getElementById('backward-sec');
    const forwardSecButton = document.getElementById('forward-sec');
    const backwardFrameButton = document.getElementById('backward-frame');
    const forwardFrameButton = document.getElementById('forward-frame');
    const captureFrameButton = document.getElementById('captureFrame');
    const capturedImage = document.getElementById('capturedImage');
    const downloadLink = document.getElementById('downloadLink');

    // --- Carga de Video ---
    loadVideoButton.addEventListener('click', () => {
        const url = videoUrlInput.value.trim();
        const videoId = extractYouTubeVideoId(url);

        if (videoId) {
            currentVideoId = videoId;
            if (player) {
                player.loadVideoById(videoId);
            } else {
                createPlayer(videoId);
            }
        } else {
            alert('URL de YouTube no válida. Por favor, usa un formato como /watch?v=... o /shorts/...');
        }
    });

    // --- Controles de Reproducción ---
    playPauseButton.addEventListener('click', () => {
        if (player && typeof player.getPlayerState === 'function') {
            const playerState = player.getPlayerState();
            if (playerState === YT.PlayerState.PLAYING) player.pauseVideo();
            else player.playVideo();
        }
    });

    forwardSecButton.addEventListener('click', () => seek(1));
    backwardSecButton.addEventListener('click', () => seek(-1));
    forwardFrameButton.addEventListener('click', () => seek(1 / FRAME_RATE));
    backwardFrameButton.addEventListener('click', () => seek(-1 / FRAME_RATE));

    // --- Captura de Frame ---
    captureFrameButton.addEventListener('click', async () => {
        if (!player || !currentVideoId || typeof player.getCurrentTime !== 'function') {
            alert('Por favor, carga un video primero.');
            return;
        }

        const timestamp = player.getCurrentTime();
        capturedImage.style.display = 'none';
        downloadLink.style.display = 'none';

        const originalButtonText = captureFrameButton.textContent;
        captureFrameButton.textContent = 'Capturando...';
        captureFrameButton.disabled = true;

        try {
            // Usar la nueva ruta /api/
            const functionUrl = `/api/capture-frame?videoId=${currentVideoId}&timestamp=${timestamp}`;
            const response = await fetch(functionUrl);

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Error del servidor (${response.status}): ${errorData}`);
            }

            const imageBase64 = await response.text();

            capturedImage.src = `data:image/png;base64,${imageBase64}`;
            capturedImage.style.display = 'block';

            downloadLink.href = capturedImage.src;
            downloadLink.download = `frame_${currentVideoId}_${timestamp.toFixed(2)}s.png`;
            downloadLink.style.display = 'inline-block';

        } catch (error) {
            console.error('Error al llamar a la función de captura:', error);
            alert(`No se pudo capturar el frame. Detalles:\n${error.message}`);
        } finally {
            captureFrameButton.textContent = originalButtonText;
            captureFrameButton.disabled = false;
        }
    });
});

function seek(amount) {
    if (player && typeof player.getCurrentTime === 'function') {
        const currentTime = player.getCurrentTime();
        player.seekTo(currentTime + amount, true);
    }
}

function extractYouTubeVideoId(url) {
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
}

function createPlayer(videoId) {
    player = new YT.Player('player', {
        height: '390',
        width: '640',
        videoId: videoId,
        playerVars: { 'playsinline': 1, 'controls': 1, 'rel': 0 },
        events: { 'onReady': onPlayerReady }
    });
}

function onPlayerReady(event) {
    console.log("El reproductor de YouTube está listo.");
    event.target.playVideo();
}
