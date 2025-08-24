# QuickChess Chrome Extension

A lightweight Chrome extension that allows you to play chess directly from your browser toolbar with AI opponents at three difficulty levels.

## Features

- 🎯 Instant access from browser toolbar
- 🤖 AI opponent with Easy, Medium, and Hard difficulty levels
- 💾 Automatic game state persistence
- ↩️ Undo move functionality
- 🔄 Restart game option
- 🎨 Clean, minimalist UI
- 📱 Responsive design

## Installation

1. **Create Icons** (Required before installation):
   - Open `create-icons.html` in your browser
   - Right-click each canvas image and save as PNG:
     - Save 16x16 canvas as `assets/icons/icon16.png`
     - Save 48x48 canvas as `assets/icons/icon48.png` 
     - Save 128x128 canvas as `assets/icons/icon128.png`

2. **Install Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `quick-chess-extension` folder
   - The QuickChess icon should appear in your toolbar

## How to Play

1. Click the QuickChess icon in your browser toolbar
2. Select difficulty level (first time only)
3. Click on a piece to select it
4. Click on a highlighted square to move
5. Use the control buttons to:
   - Change difficulty
   - Undo your last move
   - Restart the game

## Technical Details

- Built with vanilla JavaScript for fast performance
- Uses Chrome Storage API for game persistence
- Fully offline-capable
- Manifest V3 compatible
- Popup size: 350x450px

## File Structure

```
quick-chess-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Main UI
├── popup.css             # Styling
├── popup.js              # Game logic
├── background.js         # Service worker
├── create-icons.html     # Icon generation tool
└── assets/
    └── icons/           # Extension icons (create these first)
```

## Development

The extension is ready to use as-is. Key components:

- **Chess Logic**: Full chess rule validation including piece movement, captures, and game state
- **AI Opponent**: Three difficulty levels with different strategic approaches
- **Persistence**: Games automatically save and resume
- **UI**: Responsive chessboard with piece highlighting and move indicators

## Future Enhancements

- Integration with Stockfish.js for stronger AI
- Additional chess variants
- Move notation display
- Game statistics
- Custom themes
- Timed game modes