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
    // Use Pro model for better accuracy with vision
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.1, // Lower temperature for more accurate/deterministic output
      }
    });    const prompt = `You are an expert chess position analyzer. Your task is to read a PRINTED CHESS DIAGRAM from a book with 100% accuracy.

STEP 1 - UNDERSTAND THE DIAGRAM FORMAT:
- This is a PRINTED chess diagram in a book, NOT a photo of a real board
- The board is shown from WHITE'S perspective
- Rank 8 (black's back rank) is at the TOP
- Rank 1 (white's back rank) is at the BOTTOM
- Files a-h go from LEFT to RIGHT
- The board has 8 files (columns) and 8 ranks (rows) = 64 squares total

STEP 2 - IDENTIFY PIECE COLORS:
- White pieces are HOLLOW/OUTLINED (you can see inside them)
- Black pieces are SOLID/FILLED (completely black/dark)
- Look very carefully at each piece to determine if it's hollow (white) or filled (black)

STEP 3 - IDENTIFY PIECE TYPES:
- KING (K/k): Tallest piece with a cross on top
- QUEEN (Q/q): Tall piece with multiple small points on crown
- ROOK (R/r): Castle tower with crenellations on top
- BISHOP (B/b): Pointed hat/miter shape, slanted top
- KNIGHT (N/n): Horse head shape (unique silhouette)
- PAWN (P/p): Smallest piece, round top

STEP 4 - READ RANK BY RANK:
I will now analyze EACH rank systematically from rank 8 down to rank 1.

For RANK 8 (top row), going left to right (a8, b8, c8, d8, e8, f8, g8, h8):
[Count each square carefully - if empty, note it. If piece, identify type and color]

For RANK 7 (second row), going left to right (a7, b7, c7, d7, e7, f7, g7, h7):
[Continue same process]

[Do this for ALL 8 ranks]

STEP 5 - COUNT EMPTY SQUARES:
- Between pieces on the same rank, count consecutive empty squares
- Represent consecutive empty squares as a NUMBER (1-8)
- Make sure squares add up to 8 per rankSTEP 6 - VERIFY YOUR WORK:
Before finalizing:
1. Count total pieces - does it make sense? (typical game has 16-32 pieces total)
2. Each rank string should represent exactly 8 squares (pieces + empty squares)
3. Check you have exactly 8 rank strings separated by /
4. Verify piece colors match their appearance (hollow=white, filled=black)

STEP 7 - READ THE TEXT:
Look for text below/near diagram:
- "White to play" or "White to move" → sideToMove = "w"
- "Black to play" or "Black to move" → sideToMove = "b"
- If unclear, default to "w"

STEP 8 - OUTPUT FORMAT:
Return ONLY this JSON (no other text):
{
  "fen": "rank8/rank7/rank6/rank5/rank4/rank3/rank2/rank1 w KQkq - 0 1",
  "sideToMove": "w"
}

IMPORTANT FEN RULES:
- Uppercase = White pieces (KQRBNP)
- Lowercase = Black pieces (kqrbnp)
- Numbers = empty squares (1-8)
- / = separates ranks
- Each rank must sum to 8 squares

EXAMPLE:
If rank 8 has: black rook, empty, empty, black queen, empty, black rook, black king, empty
FEN for rank 8: "r2q1rk1"
(r=black rook, 2=two empty, q=black queen, 1=one empty, r=black rook, k=black king, 1=one empty)

Now analyze the image and return the JSON.`;

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

    // Parse JSON response
    try {
      // Try to extract JSON if there's extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      const parsed = JSON.parse(jsonText);

      // Update the FEN with the correct side to move
      let fen = parsed.fen;
      const sideToMove = parsed.sideToMove || 'w';

      // Replace the side-to-move part of the FEN (second field)
      const fenParts = fen.split(' ');
      if (fenParts.length >= 2) {
        fenParts[1] = sideToMove;
        fen = fenParts.join(' ');
      }

      console.log(`Position: ${fen}, Side to move: ${sideToMove === 'w' ? 'White' : 'Black'}`);
      return fen;

    } catch (parseError) {
      console.warn('Could not parse JSON, falling back to regex extraction');
      // Fallback to old method if JSON parsing fails
      const fenMatch = text.match(/[rnbqkpRNBQKP1-8\/]+\s+[wb]\s+[KQkq-]+\s+[a-h3-6-]+\s+\d+\s+\d+/);
      return fenMatch ? fenMatch[0] : text;
    }

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
