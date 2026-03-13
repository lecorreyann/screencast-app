const { ipcRenderer } = require('electron');
const io = require('socket.io-client');
const { exec } = require('child_process');

// Configuration
const SERVER_URL = 'http://localhost:3000';

// État
let socket = null;
let stream = null;
let sessionId = null;
let isPaused = false;
let peerConnections = new Map();
let viewerCount = 0;
let publicUrl = null;
let cloudflaredProcess = null;

// Éléments DOM
const sourceSelect = document.getElementById('source-select');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const linkBox = document.getElementById('link-box');
const linkInput = document.getElementById('link-input');
const copyBtn = document.getElementById('copy-btn');
const statusEl = document.getElementById('status');
const viewersEl = document.getElementById('viewers');

// Configuration WebRTC
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Détecter et lancer cloudflared si disponible
async function setupTunnel() {
  return new Promise((resolve) => {
    // Vérifier si cloudflared existe
    exec('which cloudflared', (error) => {
      if (error) {
        console.log('cloudflared non trouvé, utilisation de localhost');
        resolve(null);
        return;
      }

      statusEl.textContent = 'Création du tunnel...';

      // Lancer cloudflared
      cloudflaredProcess = exec('cloudflared tunnel --url http://localhost:3000', (err) => {
        if (err && !err.killed) {
          console.error('Erreur cloudflared:', err);
        }
      });

      // Capturer l'URL depuis stderr (cloudflared écrit là)
      cloudflaredProcess.stderr.on('data', (data) => {
        const match = data.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match && !publicUrl) {
          publicUrl = match[0];
          console.log('URL publique détectée:', publicUrl);

          // Informer le serveur de l'URL publique
          fetch(`${SERVER_URL}/set-public-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: publicUrl })
          });

          statusEl.textContent = 'Tunnel prêt';
          resolve(publicUrl);
        }
      });

      // Timeout après 15 secondes
      setTimeout(() => {
        if (!publicUrl) {
          console.log('Timeout tunnel, utilisation de localhost');
          resolve(null);
        }
      }, 15000);
    });
  });
}

// Charger les sources disponibles
async function loadSources() {
  const sources = await ipcRenderer.invoke('get-sources');
  sourceSelect.innerHTML = '';

  // Ajouter les écrans
  const screens = sources.filter(s => s.id.startsWith('screen'));
  if (screens.length > 0) {
    const group = document.createElement('optgroup');
    group.label = '🖥️ Écrans';
    screens.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      group.appendChild(opt);
    });
    sourceSelect.appendChild(group);
  }

  // Ajouter les fenêtres
  const windows = sources.filter(s => s.id.startsWith('window'));
  if (windows.length > 0) {
    const group = document.createElement('optgroup');
    group.label = '📱 Fenêtres';
    windows.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name.length > 30 ? s.name.substring(0, 30) + '...' : s.name;
      group.appendChild(opt);
    });
    sourceSelect.appendChild(group);
  }
}

// Démarrer le partage
async function startSharing() {
  const sourceId = sourceSelect.value;
  if (!sourceId) return;

  try {
    startBtn.disabled = true;
    startBtn.textContent = 'Démarrage...';

    // Lancer le tunnel si pas déjà fait
    if (!publicUrl) {
      await setupTunnel();
    }

    // Capturer l'écran/fenêtre
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 30
        }
      }
    });

    // Connecter au serveur
    socket = io(SERVER_URL);

    socket.on('connect', () => {
      socket.emit('create-session', (response) => {
        sessionId = response.sessionId;

        // Utiliser l'URL publique si disponible, sinon localhost
        const baseUrl = publicUrl || SERVER_URL;
        const shareUrl = `${baseUrl}/watch.html?s=${sessionId}`;

        linkInput.value = shareUrl;
        linkBox.classList.add('active');
        statusEl.textContent = 'En direct';
        statusEl.className = 'status live';
        updateViewerCount();
      });
    });

    // Quand un viewer rejoint
    socket.on('viewer-joined', async (viewerId) => {
      viewerCount++;
      updateViewerCount();
      await createPeerConnection(viewerId);
    });

    // Quand un viewer part
    socket.on('viewer-left', (viewerId) => {
      viewerCount = Math.max(0, viewerCount - 1);
      updateViewerCount();
      const pc = peerConnections.get(viewerId);
      if (pc) {
        pc.close();
        peerConnections.delete(viewerId);
      }
    });

    // Réponse WebRTC d'un viewer
    socket.on('answer', (viewerId, answer) => {
      const pc = peerConnections.get(viewerId);
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // ICE candidate d'un viewer
    socket.on('ice-candidate', (viewerId, candidate) => {
      const pc = peerConnections.get(viewerId);
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // UI
    startBtn.style.display = 'none';
    startBtn.disabled = false;
    startBtn.textContent = '▶ Démarrer';
    pauseBtn.style.display = 'block';
    stopBtn.style.display = 'block';
    sourceSelect.disabled = true;

  } catch (err) {
    console.error('Erreur:', err);
    statusEl.textContent = 'Erreur: ' + err.message;
    startBtn.disabled = false;
    startBtn.textContent = '▶ Démarrer';
  }
}

// Créer une connexion peer avec un viewer
async function createPeerConnection(viewerId) {
  const pc = new RTCPeerConnection(rtcConfig);
  peerConnections.set(viewerId, pc);

  // Ajouter le stream
  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream);
  });

  // ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', viewerId, event.candidate);
    }
  };

  // Créer et envoyer l'offre
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', viewerId, offer);
}

// Pause/Resume
function togglePause() {
  isPaused = !isPaused;

  stream.getVideoTracks().forEach(track => {
    track.enabled = !isPaused;
  });

  if (isPaused) {
    pauseBtn.textContent = '▶ Reprendre';
    pauseBtn.className = 'btn btn-start';
    statusEl.textContent = 'En pause';
    statusEl.className = 'status';
    socket.emit('stream-paused');
  } else {
    pauseBtn.textContent = '⏸ Pause';
    pauseBtn.className = 'btn btn-pause';
    statusEl.textContent = 'En direct';
    statusEl.className = 'status live';
    socket.emit('stream-resumed');
  }
}

// Arrêter le partage
function stopSharing() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  sessionId = null;
  isPaused = false;
  viewerCount = 0;

  // UI
  startBtn.style.display = 'block';
  pauseBtn.style.display = 'none';
  stopBtn.style.display = 'none';
  pauseBtn.textContent = '⏸ Pause';
  pauseBtn.className = 'btn btn-pause';
  linkBox.classList.remove('active');
  sourceSelect.disabled = false;
  statusEl.textContent = publicUrl ? 'Tunnel actif' : '';
  statusEl.className = 'status';
  viewersEl.textContent = '';
}

// Mettre à jour le compteur de viewers
function updateViewerCount() {
  if (viewerCount === 0) {
    viewersEl.textContent = 'En attente de spectateurs...';
  } else if (viewerCount === 1) {
    viewersEl.textContent = '👁️ 1 spectateur';
  } else {
    viewersEl.textContent = `👁️ ${viewerCount} spectateurs`;
  }
}

// Copier le lien
function copyLink() {
  linkInput.select();
  navigator.clipboard.writeText(linkInput.value);
  copyBtn.textContent = '✓ Copié!';
  setTimeout(() => {
    copyBtn.textContent = 'Copier';
  }, 2000);
}

// Nettoyer à la fermeture
window.addEventListener('beforeunload', () => {
  if (cloudflaredProcess) {
    cloudflaredProcess.kill();
  }
});

// Events
startBtn.addEventListener('click', startSharing);
pauseBtn.addEventListener('click', togglePause);
stopBtn.addEventListener('click', stopSharing);
copyBtn.addEventListener('click', copyLink);

// Init
loadSources();
