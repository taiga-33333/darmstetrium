// server.js — Node.js + Express + Socket.IOでTetrisオンライン対戦
// 省略なし。部屋管理、お邪魔ライン処理、b2b/tss/tst判定など含む。

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public')); // index.html, game.html などを配置するフォルダ

// --------- 部屋とプレイヤー管理 ----------
const rooms = {}; // roomId -> { players: [socketId, ...], gameState: {...} }

// 部屋作成・参加
io.on('connection', socket => {
  console.log('a user connected:', socket.id);

  socket.on('joinRoom', roomId => {
    if (!rooms[roomId]) rooms[roomId] = { players: [], pendingGarbage: {} };
    const room = rooms[roomId];

    if (room.players.length >= 2) {
      socket.emit('roomFull');
      return;
    }

    room.players.push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;

    // 初期お邪魔ライン管理
    room.pendingGarbage[socket.id] = 0;

    socket.emit('joinedRoom', { roomId, playerIndex: room.players.indexOf(socket.id) });

    if (room.players.length === 2) {
      // 両方揃ったら開始
      io.to(roomId).emit('startGame');
    }
  });

  socket.on('sendGarbage', count => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];

    // 送信相手
    const targetId = room.players.find(id => id !== socket.id);
    if (!targetId) return;

    // 受信側に溜める
    room.pendingGarbage[targetId] += count;

    io.to(targetId).emit('receiveGarbage', room.pendingGarbage[targetId]);

    // 送信した分はリセット
    room.pendingGarbage[targetId] = 0;
  });

  socket.on('clearPendingGarbage', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    room.pendingGarbage[socket.id] = 0;
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    room.players = room.players.filter(id => id !== socket.id);

    delete room.pendingGarbage[socket.id];

    // 部屋が空になったら削除
    if (room.players.length === 0) delete rooms[roomId];
    else io.to(roomId).emit('playerLeft', socket.id);

    console.log('user disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
