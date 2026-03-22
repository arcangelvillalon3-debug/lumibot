// ══════════════════════════════════════════════
//  LumiBot Server — Express + Socket.io
//  Deploy: Railway / Render / Fly.io
// ══════════════════════════════════════════════
require('dotenv').config();
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const path     = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// ── In-memory stores (swap with Supabase for production) ──
const rooms    = {};   // { roomCode: { host, players:[], subject, started } }
const scores   = {};   // { userId: { name, pts, streak } }
const gallery  = [];   // shared pixel art gallery

// ══════════════════════════════════════════════
//  REST ENDPOINTS
// ══════════════════════════════════════════════

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length, players: Object.keys(scores).length });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const board = Object.entries(scores)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 50);
  res.json(board);
});

// Update score
app.post('/api/score', (req, res) => {
  const { userId, name, pts } = req.body;
  if (!scores[userId]) scores[userId] = { name, pts: 0 };
  scores[userId].pts += pts;
  scores[userId].name = name;
  res.json(scores[userId]);
});

// Pixel gallery — get
app.get('/api/gallery', (req, res) => {
  res.json(gallery.slice(-30).reverse());
});

// Pixel gallery — post
app.post('/api/gallery', (req, res) => {
  const { userId, name, data, size } = req.body;
  gallery.push({ userId, name, data, size, time: new Date().toISOString() });
  if (gallery.length > 200) gallery.shift();
  res.json({ ok: true, total: gallery.length });
});

// ══════════════════════════════════════════════
//  SOCKET.IO — REAL-TIME MULTIPLAYER
// ══════════════════════════════════════════════

const QUESTIONS = {
  Matematicas: [
    { q:'¿Cuánto es 8 × 7?',     opts:['54','56','64','58'],     ans:1 },
    { q:'¿Cuánto es 15 + 27?',   opts:['41','42','43','44'],     ans:1 },
    { q:'¿Cuánto es 100 ÷ 4?',   opts:['20','25','30','35'],     ans:1 },
    { q:'¿Cuánto es 13²?',       opts:['156','169','144','196'], ans:1 },
    { q:'¿Cuánto es 9 × 9?',     opts:['72','81','90','64'],     ans:1 },
  ],
  Ciencias: [
    { q:'¿Qué gas produce la fotosíntesis?',   opts:['CO₂','N₂','O₂','H₂'],    ans:2 },
    { q:'¿Cuántos planetas tiene el sistema solar?', opts:['7','8','9','10'],   ans:1 },
    { q:'¿Qué órgano bombea la sangre?',       opts:['Pulmón','Hígado','Riñón','Corazón'], ans:3 },
    { q:'¿De qué está hecho el ADN?',          opts:['Proteínas','Nucleótidos','Lípidos','Glucosa'], ans:1 },
    { q:'¿Cuál es la velocidad de la luz?',    opts:['200k km/s','300k km/s','400k km/s','500k km/s'], ans:1 },
  ],
  Historia: [
    { q:'¿En qué año llegó Colón a América?',  opts:['1488','1490','1492','1500'], ans:2 },
    { q:'¿Quién fue el primer presidente de EE.UU.?', opts:['Lincoln','Jefferson','Washington','Adams'], ans:2 },
    { q:'¿Cuál fue el primer país en votar por mujeres?', opts:['Francia','EEUU','Nueva Zelanda','Argentina'], ans:2 },
    { q:'¿En qué siglo fue la Revolución Francesa?', opts:['XVII','XVIII','XIX','XVI'], ans:1 },
    { q:'¿Qué civilización construyó Machu Picchu?', opts:['Azteca','Maya','Inca','Olmeca'], ans:2 },
  ],
  General: [
    { q:'¿Cuál es el animal más grande del mundo?',   opts:['Elefante','Ballena azul','Tiburón ballena','Jirafa'], ans:1 },
    { q:'¿Cuántos colores tiene el arcoíris?',        opts:['5','6','7','8'],  ans:2 },
    { q:'"Hello" en español es...',                   opts:['Gracias','Adiós','Hola','Por favor'], ans:2 },
    { q:'¿Cuál es el continente más grande?',         opts:['América','África','Europa','Asia'], ans:3 },
    { q:'¿Cuántas horas tiene un día?',               opts:['12','18','24','48'], ans:2 },
  ]
};

function getRoomQuestions(subject) {
  const bank = QUESTIONS[subject] || QUESTIONS.General;
  return [...bank].sort(() => Math.random() - 0.5).slice(0, 10);
}

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // ── Create room ──
  socket.on('create_room', ({ playerName, subject, avatar }) => {
    const code = Math.random().toString(36).substr(2, 4).toUpperCase();
    rooms[code] = {
      code,
      host: socket.id,
      subject: subject || 'General',
      players: [{ id: socket.id, name: playerName, avatar: avatar || '🦉', score: 0, ready: true }],
      questions: getRoomQuestions(subject || 'General'),
      currentQ: 0,
      started: false,
      answers: {}
    };
    socket.join(code);
    socket.roomCode = code;
    socket.emit('room_created', { code, room: rooms[code] });
    console.log(`🏠 Room ${code} created by ${playerName}`);
  });

  // ── Join room ──
  socket.on('join_room', ({ code, playerName, avatar }) => {
    const room = rooms[code.toUpperCase()];
    if (!room) { socket.emit('error', { msg: 'Sala no encontrada' }); return; }
    if (room.started) { socket.emit('error', { msg: 'La batalla ya comenzó' }); return; }
    if (room.players.length >= 4) { socket.emit('error', { msg: 'Sala llena (máx 4 jugadores)' }); return; }

    room.players.push({ id: socket.id, name: playerName, avatar: avatar || '🦋', score: 0, ready: false });
    socket.join(code.toUpperCase());
    socket.roomCode = code.toUpperCase();

    io.to(code.toUpperCase()).emit('player_joined', { players: room.players, newcomer: playerName });
    socket.emit('joined_room', { code: code.toUpperCase(), room });
    console.log(`👥 ${playerName} joined room ${code}`);
  });

  // ── Player ready ──
  socket.on('player_ready', () => {
    const code = socket.roomCode;
    if (!rooms[code]) return;
    const player = rooms[code].players.find(p => p.id === socket.id);
    if (player) player.ready = true;
    io.to(code).emit('room_update', { players: rooms[code].players });
  });

  // ── Start battle ──
  socket.on('start_battle', () => {
    const code = socket.roomCode;
    if (!rooms[code]) return;
    if (rooms[code].host !== socket.id) { socket.emit('error', { msg: 'Solo el host puede iniciar' }); return; }

    rooms[code].started = true;
    rooms[code].currentQ = 0;
    rooms[code].answers = {};

    io.to(code).emit('battle_start', { totalQuestions: rooms[code].questions.length });
    setTimeout(() => sendQuestion(code), 1000);
  });

  // ── Submit answer ──
  socket.on('submit_answer', ({ answerIdx }) => {
    const code = socket.roomCode;
    if (!rooms[code]) return;
    const room = rooms[code];
    const qIdx = room.currentQ;
    if (room.answers[socket.id] !== undefined) return; // already answered

    const q = room.questions[qIdx];
    const correct = answerIdx === q.ans;
    const timeBonus = Math.max(0, 10 - Math.floor((Date.now() - room.questionStart) / 1000));
    const pts = correct ? (10 + timeBonus) : 0;

    const player = room.players.find(p => p.id === socket.id);
    if (player) player.score += pts;
    room.answers[socket.id] = { answerIdx, correct, pts };

    socket.emit('answer_result', { correct, pts, correctAnswer: q.ans });

    // Broadcast scores
    io.to(code).emit('scores_update', { players: room.players });

    // Check if all answered
    if (Object.keys(room.answers).length >= room.players.length) {
      clearTimeout(room.questionTimer);
      proceedNextQuestion(code);
    }
  });

  // ── Chat in room ──
  socket.on('room_chat', ({ msg }) => {
    const code = socket.roomCode;
    if (!rooms[code]) return;
    const player = rooms[code].players.find(p => p.id === socket.id);
    io.to(code).emit('chat_msg', { name: player?.name || 'Jugador', msg, avatar: player?.avatar });
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (code && rooms[code]) {
      rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
      if (rooms[code].players.length === 0) {
        delete rooms[code];
        console.log(`🗑️ Room ${code} deleted (empty)`);
      } else {
        if (rooms[code].host === socket.id) rooms[code].host = rooms[code].players[0].id;
        io.to(code).emit('player_left', { players: rooms[code].players });
      }
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// ── Question engine ──
function sendQuestion(code) {
  const room = rooms[code];
  if (!room) return;
  const qIdx = room.currentQ;
  if (qIdx >= room.questions.length) { endBattle(code); return; }

  const q = room.questions[qIdx];
  room.answers = {};
  room.questionStart = Date.now();

  io.to(code).emit('question', {
    idx: qIdx,
    total: room.questions.length,
    question: q.q,
    options: q.opts,
    timeLimit: 15
  });

  // Auto-advance after 15s
  room.questionTimer = setTimeout(() => proceedNextQuestion(code), 15000);
}

function proceedNextQuestion(code) {
  const room = rooms[code];
  if (!room) return;
  const q = room.questions[room.currentQ];

  // Reveal correct answer to all
  io.to(code).emit('reveal_answer', {
    correctAnswer: q.ans,
    answers: room.answers,
    players: room.players
  });

  room.currentQ++;
  setTimeout(() => sendQuestion(code), 2500);
}

function endBattle(code) {
  const room = rooms[code];
  if (!room) return;
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  io.to(code).emit('battle_end', { results: sorted, winner: sorted[0] });
  setTimeout(() => { if (rooms[code]) rooms[code].started = false; }, 5000);
}

// ── Serve index for all routes (SPA) ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`\n🦉 LumiBot Server running on port ${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Deploy: https://lumibot.app\n`);
});
