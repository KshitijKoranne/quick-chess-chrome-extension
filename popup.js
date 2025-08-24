class QuickChess {
  constructor() {
    // Initialize chess.js game
    this.game = new Chess();
    this.board = null;
    this.difficulty = 'easy'; // Default difficulty
    this.isAiThinking = false;
    this.lastMoveSquares = [];
    
    this.init();
  }

  async init() {
    // Load saved game state
    await this.loadGameState();
    
    // Initialize chessboard.js
    this.initializeBoard();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Update UI
    this.updateStatus();
    this.highlightLastMove();
    
    // Show difficulty modal if first time
    const hasPlayedBefore = await this.getStorageData('hasPlayedBefore');
    if (!hasPlayedBefore) {
      this.showDifficultyModal();
    }
    
    // If it's AI's turn, make AI move
    if (this.game.turn() === 'b' && !this.game.game_over()) {
      setTimeout(() => this.makeAIMove(), 500);
    }
  }

  initializeBoard() {
    const config = {
      draggable: true,
      position: this.game.fen(),
      onDragStart: this.onDragStart.bind(this),
      onDrop: this.onDrop.bind(this),
      onSnapEnd: this.onSnapEnd.bind(this),
      pieceTheme: 'assets/pieces/{piece}.png'
    };

    this.board = Chessboard('chessboard', config);
    
    // Resize board to fit popup
    window.addEventListener('resize', () => {
      this.board.resize();
    });
  }

  onDragStart(source, piece, position, orientation) {
    // Don't allow moves if game is over or AI is thinking
    if (this.game.game_over() || this.isAiThinking) {
      return false;
    }
    
    // Only allow white pieces to be moved (user is always white)
    if (piece.search(/^b/) !== -1) {
      return false;
    }
    
    // Don't allow moves if it's not white's turn
    if (this.game.turn() !== 'w') {
      return false;
    }
  }

  onDrop(source, target) {
    // Clear any previous highlighting
    this.removeHighlights();
    
    // Try to make the move
    const move = this.game.move({
      from: source,
      to: target,
      promotion: 'q' // Always promote to queen for simplicity
    });

    // If the move is illegal, snap back
    if (move === null) {
      return 'snapback';
    }

    // Store move for highlighting
    this.lastMoveSquares = [source, target];
    
    // Update UI
    this.updateStatus();
    this.highlightLastMove();
    this.saveGameState();
    
    // Make AI move after a delay
    if (!this.game.game_over() && this.game.turn() === 'b') {
      setTimeout(() => this.makeAIMove(), 1200);
    }
  }

  onSnapEnd() {
    this.board.position(this.game.fen());
  }

  makeAIMove() {
    if (this.game.game_over() || this.isAiThinking) {
      return;
    }
    
    this.isAiThinking = true;
    this.updateStatus('AI is thinking...');
    this.addThinkingIndicator();
    
    // Get possible moves
    const possibleMoves = this.game.moves({ verbose: true });
    
    if (possibleMoves.length === 0) {
      this.isAiThinking = false;
      this.removeThinkingIndicator();
      this.updateStatus();
      return;
    }
    
    // Select move based on difficulty
    let selectedMove;
    
    switch (this.difficulty) {
      case 'easy':
        selectedMove = this.getEasyMove(possibleMoves);
        break;
      case 'medium':
        selectedMove = this.getMediumMove(possibleMoves);
        break;
      case 'hard':
        selectedMove = this.getHardMove(possibleMoves);
        break;
    }
    
    // Make the move
    setTimeout(() => {
      if (selectedMove) {
        this.game.move(selectedMove);
        this.board.position(this.game.fen());
        
        // Store move for highlighting
        this.lastMoveSquares = [selectedMove.from, selectedMove.to];
        this.highlightLastMove();
      }
      
      this.isAiThinking = false;
      this.removeThinkingIndicator();
      this.updateStatus();
      this.saveGameState();
    }, 800); // Additional delay for thinking effect
  }

  getEasyMove(moves) {
    // Easy: Random move with slight preference for captures
    const captures = moves.filter(move => move.captured);
    
    if (captures.length > 0 && Math.random() < 0.3) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    
    return moves[Math.floor(Math.random() * moves.length)];
  }

  getMediumMove(moves) {
    // Medium: Prefer captures and avoid blunders
    let bestMoves = [];
    let bestScore = -Infinity;
    
    const pieceValues = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
    };
    
    moves.forEach(move => {
      let score = 0;
      
      // Prefer captures
      if (move.captured) {
        score += pieceValues[move.captured] * 10;
      }
      
      // Prefer center squares
      const centerSquares = ['d4', 'd5', 'e4', 'e5'];
      if (centerSquares.includes(move.to)) {
        score += 2;
      }
      
      // Avoid moving into attacks (simple check)
      score -= this.countAttackers(move.to) * 0.5;
      
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    });
    
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  getHardMove(moves) {
    // Hard: More strategic thinking
    // For now, use medium logic with some improvements
    // In a real implementation, you'd want minimax or similar
    return this.getMediumMove(moves);
  }

  countAttackers(square) {
    // Simple function to count how many white pieces attack a square
    let count = 0;
    const moves = this.game.moves({ verbose: true, square: square });
    return moves.length;
  }

  highlightLastMove() {
    this.removeHighlights();
    
    if (this.lastMoveSquares.length === 2) {
      const [from, to] = this.lastMoveSquares;
      this.addHighlight(from);
      this.addHighlight(to);
    }
  }

  addHighlight(square) {
    const squareEl = document.querySelector(`[data-square="${square}"]`);
    if (squareEl) {
      squareEl.classList.add('last-move');
    }
  }

  removeHighlights() {
    document.querySelectorAll('.last-move').forEach(el => {
      el.classList.remove('last-move');
    });
  }

  addThinkingIndicator() {
    document.getElementById('board-container').classList.add('thinking');
  }

  removeThinkingIndicator() {
    document.getElementById('board-container').classList.remove('thinking');
  }

  undoMove() {
    if (this.isAiThinking || this.game.history().length === 0) {
      return;
    }
    
    // Undo user move
    this.game.undo();
    
    // Undo AI move if it exists
    if (this.game.history().length > 0 && this.game.turn() === 'w') {
      this.game.undo();
    }
    
    this.board.position(this.game.fen());
    this.lastMoveSquares = [];
    this.removeHighlights();
    this.updateStatus();
    this.saveGameState();
  }

  restartGame() {
    if (this.isAiThinking) {
      return;
    }
    
    this.game.reset();
    this.board.position('start');
    this.lastMoveSquares = [];
    this.removeHighlights();
    this.updateStatus();
    this.saveGameState();
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    document.getElementById('difficulty-btn').textContent = `Difficulty: ${capitalizedDifficulty}`;
    this.saveGameState();
    return true;
  }

  updateStatus(customMessage = null) {
    const turnIndicator = document.getElementById('turn-indicator');
    const gameStatus = document.getElementById('game-status');
    
    // Update button states
    const undoBtn = document.getElementById('undo-btn');
    const restartBtn = document.getElementById('restart-btn');
    const difficultyBtn = document.getElementById('difficulty-btn');
    
    const isDisabled = this.isAiThinking || this.game.game_over();
    undoBtn.disabled = isDisabled || this.game.history().length === 0;
    restartBtn.disabled = this.isAiThinking;
    difficultyBtn.disabled = this.isAiThinking;

    if (customMessage) {
      turnIndicator.textContent = customMessage;
      gameStatus.textContent = '';
      return;
    }

    if (this.game.game_over()) {
      turnIndicator.textContent = '';
      
      if (this.game.in_checkmate()) {
        if (this.game.turn() === 'w') {
          gameStatus.textContent = 'CHECKMATE - AI WINS';
        } else {
          gameStatus.textContent = 'CHECKMATE - YOU WIN!';
          // Trigger confetti animation for user win
          this.triggerWinCelebration();
        }
      } else if (this.game.in_stalemate()) {
        gameStatus.textContent = 'STALEMATE - DRAW';
      } else if (this.game.in_threefold_repetition()) {
        gameStatus.textContent = 'DRAW - THREEFOLD REPETITION';
      } else if (this.game.insufficient_material()) {
        gameStatus.textContent = 'DRAW - INSUFFICIENT MATERIAL';
      } else {
        gameStatus.textContent = 'DRAW - 50 MOVE RULE';
      }
    } else {
      gameStatus.textContent = '';
      
      if (this.game.in_check()) {
        if (this.game.turn() === 'w') {
          turnIndicator.textContent = 'CHECK - Your turn';
        } else {
          turnIndicator.textContent = 'CHECK - AI turn';
        }
      } else {
        if (this.game.turn() === 'w') {
          turnIndicator.textContent = 'Your turn';
        } else {
          turnIndicator.textContent = 'AI turn';
        }
      }
    }
  }

  showDifficultyModal() {
    document.getElementById('difficulty-modal').classList.remove('hidden');
  }

  hideDifficultyModal() {
    document.getElementById('difficulty-modal').classList.add('hidden');
    this.setStorageData('hasPlayedBefore', true);
  }

  setupEventListeners() {
    // Control buttons
    document.getElementById('difficulty-btn').addEventListener('click', () => {
      if (!this.isAiThinking) {
        this.showDifficultyModal();
      }
    });

    document.getElementById('undo-btn').addEventListener('click', () => {
      this.undoMove();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      this.restartGame();
    });

    // Difficulty modal
    document.querySelectorAll('.difficulty-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const difficulty = e.target.dataset.difficulty;
        
        // Remove previous selection
        document.querySelectorAll('.difficulty-option').forEach(b => {
          b.classList.remove('selected');
        });
        
        // Add selection to clicked button
        e.target.classList.add('selected');
        
        if (this.setDifficulty(difficulty)) {
          setTimeout(() => {
            this.hideDifficultyModal();
          }, 200);
        }
      });
    });

    // Close modal when clicking outside
    document.getElementById('difficulty-modal').addEventListener('click', (e) => {
      if (e.target.id === 'difficulty-modal') {
        this.hideDifficultyModal();
      }
    });

    // Share button
    document.getElementById('share-btn').addEventListener('click', () => {
      this.shareExtension();
    });
  }

  // Storage methods
  async saveGameState() {
    const gameState = {
      fen: this.game.fen(),
      difficulty: this.difficulty,
      lastMoveSquares: this.lastMoveSquares,
      pgn: this.game.pgn()
    };
    
    await this.setStorageData('gameState', gameState);
  }

  async loadGameState() {
    const gameState = await this.getStorageData('gameState');
    if (gameState) {
      if (gameState.fen) {
        this.game.load(gameState.fen);
      }
      if (gameState.difficulty) {
        this.difficulty = gameState.difficulty;
        const capitalizedDifficulty = this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1);
        document.getElementById('difficulty-btn').textContent = `Difficulty: ${capitalizedDifficulty}`;
      }
      if (gameState.lastMoveSquares) {
        this.lastMoveSquares = gameState.lastMoveSquares;
      }
    }
  }

  async getStorageData(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  async setStorageData(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }


  triggerWinCelebration() {
    // Add celebration pulse to game status
    const gameStatus = document.getElementById('game-status');
    gameStatus.classList.add('win-celebration');
    
    // Create confetti container
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    document.body.appendChild(confettiContainer);
    
    // Create confetti pieces
    for (let i = 0; i < 10; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      // Randomize animation duration for variety
      confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
      confettiContainer.appendChild(confetti);
    }
    
    // Clean up after animation
    setTimeout(() => {
      if (confettiContainer.parentNode) {
        confettiContainer.parentNode.removeChild(confettiContainer);
      }
      gameStatus.classList.remove('win-celebration');
    }, 4000);
  }

  shareExtension() {
    // Create shareable text
    const shareText = 'Check out QuickChess - Play chess instantly from your browser! 🏆♟️';
    const extensionUrl = 'https://chrome.google.com/webstore/detail/quickchess/YOUR_EXTENSION_ID';
    
    // Try to use Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: 'QuickChess - Instant Chess',
        text: shareText,
        url: extensionUrl
      }).catch(() => {
        // Fallback if share is cancelled
        this.fallbackShare(shareText, extensionUrl);
      });
    } else {
      // Fallback for browsers without Web Share API
      this.fallbackShare(shareText, extensionUrl);
    }
  }

  fallbackShare(text, url) {
    // Copy to clipboard as fallback
    const shareContent = `${text}\n${url}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareContent).then(() => {
        this.showShareSuccess('Link copied to clipboard!');
      }).catch(() => {
        this.showShareDialog(text, url);
      });
    } else {
      this.showShareDialog(text, url);
    }
  }

  showShareSuccess(message) {
    // Create temporary success message
    const successMsg = document.createElement('div');
    successMsg.textContent = message;
    successMsg.style.cssText = `
      position: fixed;
      bottom: 50px;
      right: 8px;
      background: rgba(76, 175, 80, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 2000;
      backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(successMsg);
    
    setTimeout(() => {
      if (successMsg.parentNode) {
        successMsg.parentNode.removeChild(successMsg);
      }
    }, 2000);
  }

  showShareDialog(text, url) {
    // Simple alert as final fallback
    alert(`${text}\n\nShare this link:\n${url}`);
  }

  /* 
  // Production Chrome Web Store payment implementation:
  async purchasePremium() {
    try {
      // Use Chrome Web Store Licensing API
      const response = await chrome.identity.getAuthToken({interactive: true});
      
      // Process payment with Google Payments
      const result = await chrome.payments.buy({
        'sku': 'premium_chess_unlock',
        'success': this.onPurchaseSuccess.bind(this),
        'failure': this.onPurchaseFailure.bind(this)
      });
      
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  }
  */
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new QuickChess();
});