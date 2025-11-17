const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// In-memory storage for session pairing
const sessions = new Map();

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Home page - show options
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Mobile capture page
app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// Desktop receiver page
app.get('/desktop', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'desktop.html'));
});

// Upload and process chess board image
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { pairingCode } = req.body;

    if (!pairingCode) {
      return res.status(400).json({ error: 'Pairing code required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    console.log(`Processing image for session: ${pairingCode}`);

    // Process image with Gemini Vision API
    const fen = await detectChessPosition(req.file.buffer);

    if (!fen) {
      return res.status(500).json({ error: 'Could not detect chess position' });
    }

    console.log(`Detected FEN: ${fen}`);

    // Emit to desktop client in the same session
    io.to(pairingCode).emit('position-detected', { fen });

    res.json({
      success: true,
      fen,
      message: 'Position detected and sent to desktop'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detect chess position using Gemini Vision API
async function detectChessPosition(imageBuffer) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set in .env file');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a chess position analyzer. Analyze this image of a chess board and return ONLY the FEN (Forsyth-Edwards Notation) string representing the position.

Important instructions:
- Return ONLY the FEN string, nothing else
- FEN format: piece placement / piece placement / ... / piece placement side_to_move castling en_passant halfmove fullmove
- Use standard notation: K=white king, k=black king, Q=queen, R=rook, B=bishop, N=knight, P=pawn (uppercase=white, lowercase=black)
- Numbers represent empty squares
- Start from rank 8 (top) to rank 1 (bottom), files a-h (left to right)
- If you cannot determine the position clearly, return: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 (starting position)

Example FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`;

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: 'image/jpeg'
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text().trim();

    console.log('Gemini response:', text);

    // Extract FEN from response (in case there's extra text)
    const fenMatch = text.match(/[rnbqkpRNBQKP1-8\/]+\s+[wb]\s+[KQkq-]+\s+[a-h3-6-]+\s+\d+\s+\d+/);
    return fenMatch ? fenMatch[0] : text;

  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-session', (pairingCode) => {
    socket.join(pairingCode);
    console.log(`Client ${socket.id} joined session: ${pairingCode}`);

    // Track session
    if (!sessions.has(pairingCode)) {
      sessions.set(pairingCode, new Set());
    }
    sessions.get(pairingCode).add(socket.id);

    socket.emit('session-joined', { pairingCode });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Clean up sessions
    sessions.forEach((clients, code) => {
      if (clients.has(socket.id)) {
        clients.delete(socket.id);
        if (clients.size === 0) {
          sessions.delete(code);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Chess Practice Server running on port ${PORT}`);
  console.log(`\n📱 Mobile: http://localhost:${PORT}/mobile`);
  console.log(`💻 Desktop: http://localhost:${PORT}/desktop\n`);
});
