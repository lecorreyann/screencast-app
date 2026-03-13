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

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Sessions actives
const sessions = new Map();

function generateSessionId() {
  return crypto.randomBytes(3).toString('hex');
}

io.on('connection', (socket) => {
  console.log('Connexion:', socket.id);

  // Créer une session (émetteur)
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
    callback({ sessionId });
  });

  // Rejoindre une session (spectateur)
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
    io.to(session.broadcaster).emit('viewer-joined', socket.id);
    callback({ success: true });
  });

  // Signaling WebRTC
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
║  🖥️  ScreenCast Server                     ║
║                                            ║
║  http://localhost:${PORT}                     ║
╚════════════════════════════════════════════╝
  `);
});
