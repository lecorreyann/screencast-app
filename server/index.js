const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Servir la page viewer
app.use(express.static(path.join(__dirname, '../viewer')));

// Stocker les sessions actives
const sessions = new Map();

// URL publique (sera mise à jour dynamiquement)
let publicUrl = null;

// Endpoint pour définir l'URL publique (appelé par l'app Electron)
app.post('/set-public-url', express.json(), (req, res) => {
  publicUrl = req.body.url;
  console.log('URL publique définie:', publicUrl);
  res.json({ success: true });
});

// Endpoint pour récupérer l'URL publique
app.get('/public-url', (req, res) => {
  res.json({ url: publicUrl });
});

// Générer un ID court et lisible
function generateSessionId() {
  return crypto.randomBytes(3).toString('hex');
}

io.on('connection', (socket) => {
  console.log('Connexion:', socket.id);

  // L'émetteur crée une session
  socket.on('create-session', (callback) => {
    const sessionId = generateSessionId();
    sessions.set(sessionId, {
      broadcaster: socket.id,
      viewers: new Set()
    });
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.isBroadcaster = true;
    console.log('Session créée:', sessionId);
    callback({ sessionId, publicUrl });
  });

  // Un spectateur rejoint une session
  socket.on('join-session', (sessionId, callback) => {
    const session = sessions.get(sessionId);
    if (!session) {
      callback({ error: 'Session non trouvée' });
      return;
    }
    session.viewers.add(socket.id);
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.isBroadcaster = false;
    console.log('Viewer rejoint:', sessionId);

    // Notifier le broadcaster qu'un viewer veut se connecter
    io.to(session.broadcaster).emit('viewer-joined', socket.id);
    callback({ success: true });
  });

  // Relayer les signaux WebRTC
  socket.on('offer', (viewerId, offer) => {
    io.to(viewerId).emit('offer', socket.id, offer);
  });

  socket.on('answer', (broadcasterId, answer) => {
    io.to(broadcasterId).emit('answer', socket.id, answer);
  });

  socket.on('ice-candidate', (targetId, candidate) => {
    io.to(targetId).emit('ice-candidate', socket.id, candidate);
  });

  // Pause/Resume
  socket.on('stream-paused', () => {
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('stream-paused');
    }
  });

  socket.on('stream-resumed', () => {
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('stream-resumed');
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    if (socket.sessionId) {
      const session = sessions.get(socket.sessionId);
      if (session) {
        if (socket.isBroadcaster) {
          // Notifier tous les viewers que le stream est terminé
          io.to(socket.sessionId).emit('stream-ended');
          sessions.delete(socket.sessionId);
          console.log('Session terminée:', socket.sessionId);
        } else {
          session.viewers.delete(socket.id);
          io.to(session.broadcaster).emit('viewer-left', socket.id);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  🖥️  Serveur ScreenCast démarré            ║
║                                            ║
║  Local:   http://localhost:${PORT}            ║
╚════════════════════════════════════════════╝
  `);
});
