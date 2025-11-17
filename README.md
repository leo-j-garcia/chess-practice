# ♟️ Chess Practice - Position Capture

Capture chess positions from books using your phone's camera and analyze them instantly on chess.com!

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Your Free Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

### 3. Create Environment File

Create a `.env` file in the project root:

```bash
GEMINI_API_KEY=your_api_key_here
PORT=3000
```

### 4. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

## 📱 How to Use

### Setup

1. **Desktop**: Open `http://localhost:3000/desktop` in your desktop browser
   - A 4-digit pairing code will be generated automatically
   - Keep this tab open

2. **Mobile**: On your phone, navigate to your computer's local IP address
   - Example: `http://192.168.1.100:3000/mobile`
   - Enter the same 4-digit pairing code from your desktop

### Capture & Analyze

1. **On Mobile**:
   - Tap "Start Camera"
   - Point your camera at the chess position in your book
   - Tap "Capture Position"
   - Review the photo, retake if needed
   - Tap "Analyze & Send"

2. **On Desktop**:
   - The position will automatically open in chess.com
   - Start analyzing!

## 🌐 Accessing from Your Phone

### Option A: Local Network (Easiest)

1. Find your computer's local IP address:

   **macOS/Linux:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

   **Windows:**
   ```bash
   ipconfig
   ```

2. On your phone, use: `http://YOUR_IP_ADDRESS:3000/mobile`
   - Example: `http://192.168.1.100:3000/mobile`

### Option B: ngrok (Access from Anywhere)

1. Install ngrok: [https://ngrok.com/download](https://ngrok.com/download)

2. Start ngrok:
   ```bash
   ngrok http 3000
   ```

3. Use the provided HTTPS URL on your phone
   - Example: `https://abc123.ngrok.io/mobile`

## 🎯 Features

- ✅ **Free to use** - Gemini Flash API has generous free tier
- ✅ **No database needed** - Everything in memory
- ✅ **Real-time sync** - Instant position transfer via WebSockets
- ✅ **Mobile-optimized** - Uses phone's rear camera
- ✅ **Auto-open** - Desktop automatically opens chess.com
- ✅ **Simple pairing** - Easy 4-digit codes

## 🛠️ Technology Stack

- **Backend**: Node.js + Express
- **Real-time**: Socket.io
- **Vision AI**: Google Gemini Flash (free tier)
- **Frontend**: Vanilla HTML/CSS/JS
- **No database**: In-memory sessions

## 📋 Requirements

- Node.js 14+
- Modern browser with camera support (mobile)
- Google Gemini API key (free)

## 🔧 Troubleshooting

### Camera doesn't work
- Make sure you're using HTTPS or localhost
- Check browser camera permissions
- Try a different browser

### Can't connect from phone
- Ensure phone and computer are on the same WiFi network
- Check firewall settings
- Use ngrok if local network doesn't work

### Position detection issues
- Ensure good lighting
- Position the camera directly above the board
- Make sure all pieces are clearly visible
- Try retaking the photo with better angle

### API Rate Limits
Gemini Flash free tier:
- 15 requests per minute
- 1,500 requests per day
- More than enough for personal use!

## 📝 Notes

- Positions are detected using AI, so accuracy depends on image quality
- The system assumes standard chess piece designs
- For best results, ensure the entire board is visible
- FEN strings include position, castling rights, and other metadata

## 🎓 How It Works

1. Mobile captures image using device camera
2. Image uploaded to Express server
3. Gemini Vision API analyzes the chess board
4. AI generates FEN (Forsyth-Edwards Notation) string
5. FEN sent to desktop via WebSocket
6. Desktop opens chess.com with the position

## 📄 License

MIT

## 🤝 Contributing

Feel free to open issues or submit PRs!

---

Happy analyzing! ♟️
