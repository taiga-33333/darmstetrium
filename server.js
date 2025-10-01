// server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Edgegap用ポート対応
const port = process.env.PORT || 3000;

// 静的ファイル配信
app.use(express.static(path.join(__dirname, '/')));

// ルートアクセス
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// socket.io セットアップ
const io = new Server(server);

let rooms = {}; // { roomId: { players: [socketId,...], ... } }

// 接続時
io.on('connection', (socket) => {
  console.log('user connected:', socket.id);

  // 部屋参加
  socket.on('join-room', (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }
    if (rooms[roomId].players.length < 2) {
      rooms[roomId].players.push(socket.id);
      socket.join(roomId);
      io.to(roomId).emit('room-update', rooms[roomId].players.length);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    } else {
      socket.emit('room-full');
    }
  });

  // お邪魔ライン送信
  socket.on('send-garbage', ({ roomId, lines }) => {
    if (!rooms[roomId]) return;
    // 相手に送る
    rooms[roomId].players.forEach((id) => {
      if (id !== socket.id) {
        io.to(id).emit('receive-garbage', lines);
      }
    });
  });

  // 切断時
  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const idx = rooms[roomId].players.indexOf(socket.id);
      if (idx !== -1) {
        rooms[roomId].players.splice(idx, 1);
        io.to(roomId).emit('room-update', rooms[roomId].players.length);
        if (rooms[roomId].players.length === 0) {
          delete rooms[roomId];
        }
        console.log(`Socket ${socket.id} left room ${roomId}`);
        break;
      }
    }
  });
});

// サーバー起動
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
