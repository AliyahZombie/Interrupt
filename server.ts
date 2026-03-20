import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { RoomManager } from './server/RoomManager';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  const PORT = 3000;

  const roomManager = new RoomManager(io);

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Initially join the main city
    roomManager.joinCity(socket);

    socket.on('input', (data) => {
      roomManager.handleInput(socket.id, data);
    });

    socket.on('joinRoom', (roomType) => {
      roomManager.joinRoomByType(socket, roomType);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      roomManager.leaveRoom(socket);
    });
  });

  // Game Loop
  const TICK_RATE = 60;
  setInterval(() => {
    roomManager.update(1 / TICK_RATE);
  }, 1000 / TICK_RATE);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
