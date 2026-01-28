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

    // Reset node count for yielding
    this.nodeCount = 0;

    // Run AI calculation asynchronously
    setTimeout(async () => {
      try {
        const possibleMoves = this.game.moves({ verbose: true });
        if (possibleMoves.length === 0) {
          this.isAiThinking = false;
          this.removeThinkingIndicator();
          this.updateStatus();
          return;
        }

        let selectedMove;
        switch (this.difficulty) {
          case 'easy':
            selectedMove = this.getEasyMove(possibleMoves);
            break;
          case 'medium':
            selectedMove = await this.getMediumMove(possibleMoves);
            break;
          case 'hard':
            selectedMove = await this.getHardMove(possibleMoves);
            break;
          case 'grandmaster':
            selectedMove = await this.getGrandmasterMove(possibleMoves);
            break;
        }

        // Make the move
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
      } catch (error) {
        console.error('AI move error:', error);
        this.isAiThinking = false;
        this.removeThinkingIndicator();
        this.updateStatus();
      }
    }, 50);
  }

  getEasyMove(moves) {
    // Easy: Random move with slight preference for captures
    const captures = moves.filter(move => move.captured);
    
    if (captures.length > 0 && Math.random() < 0.3) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    
    return moves[Math.floor(Math.random() * moves.length)];
  }

  async getMediumMove(moves) {
    // Medium: Look 2 moves ahead with minimax
    return await this.findBestMove(2);
  }

  async getHardMove(moves) {
    // Hard: Look 3 moves ahead with minimax
    return await this.findBestMove(3);
  }

  async getGrandmasterMove(moves) {
    // Grandmaster: Look 4 moves ahead with advanced evaluation
    return await this.findBestMove(4);
  }

  async findBestMove(depth) {
    const moves = this.game.moves({ verbose: true });
    if (moves.length === 0) return null;

    let bestMove = null;
    let bestValue = -Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    // Order moves for better alpha-beta pruning (captures first)
    const orderedMoves = this.orderMoves(moves);

    for (let move of orderedMoves) {
      this.game.move(move);
      const value = -await this.minimax(depth - 1, -beta, -alpha, false);
      this.game.undo();

      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }

      alpha = Math.max(alpha, value);
      if (alpha >= beta) {
        break; // Beta cutoff
      }
    }

    return bestMove;
  }

  orderMoves(moves) {
    // Order moves to improve alpha-beta pruning efficiency
    // Captures first, then other moves
    const captures = moves.filter(m => m.captured);
    const others = moves.filter(m => !m.captured);

    // Shuffle for variety
    this.shuffleArray(captures);
    this.shuffleArray(others);

    return [...captures, ...others];
  }

  async minimax(depth, alpha, beta, isMaximizing) {
    // Yield every 500 nodes to keep UI responsive
    this.nodeCount++;
    if (this.nodeCount % 500 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Check for terminal conditions
    if (depth === 0 || this.game.game_over()) {
      return this.evaluatePosition();
    }

    const moves = this.game.moves({ verbose: true });
    if (moves.length === 0) {
      return this.evaluatePosition();
    }

    if (isMaximizing) {
      let maxEval = -Infinity;

      for (let move of moves) {
        const moveResult = this.game.move(move);
        if (moveResult) {
          const eval_score = await this.minimax(depth - 1, alpha, beta, false);
          this.game.undo();

          maxEval = Math.max(maxEval, eval_score);
          alpha = Math.max(alpha, eval_score);

          if (beta <= alpha) {
            break; // Alpha-beta pruning
          }
        }
      }

      return maxEval;
    } else {
      let minEval = Infinity;

      for (let move of moves) {
        const moveResult = this.game.move(move);
        if (moveResult) {
          const eval_score = await this.minimax(depth - 1, alpha, beta, true);
          this.game.undo();

          minEval = Math.min(minEval, eval_score);
          beta = Math.min(beta, eval_score);

          if (beta <= alpha) {
            break; // Alpha-beta pruning
          }
        }
      }

      return minEval;
    }
  }

  evaluatePosition() {
    // Check for game over
    if (this.game.in_checkmate()) {
      return this.game.turn() === 'b' ? 10000 : -10000;
    }
    if (this.game.in_stalemate() || this.game.in_threefold_repetition() ||
        this.game.insufficient_material() || this.game.in_draw()) {
      return 0;
    }

    let score = 0;

    // Material and positional evaluation
    const board = this.game.board();

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece) {
          const pieceValue = this.getPieceValue(piece, i, j);
          score += piece.color === 'b' ? pieceValue : -pieceValue;
        }
      }
    }

    // Mobility evaluation (number of legal moves)
    const currentMoves = this.game.moves().length;
    if (this.game.turn() === 'b') {
      score += currentMoves * 0.1;
    } else {
      score -= currentMoves * 0.1;
    }

    // King safety evaluation
    score += this.evaluateKingSafety('b') - this.evaluateKingSafety('w');

    // Pawn structure evaluation
    score += this.evaluatePawnStructure('b') - this.evaluatePawnStructure('w');

    return score;
  }

  getPieceValue(piece, row, col) {
    // Base piece values
    const pieceValues = {
      'p': 100,
      'n': 320,
      'b': 330,
      'r': 500,
      'q': 900,
      'k': 20000
    };

    const baseValue = pieceValues[piece.type];

    // Piece-square tables for positional evaluation
    const pawnTable = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [5, 10, 10,-20,-20, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ];

    const knightTable = [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ];

    const bishopTable = [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5, 10, 10,  5,  0,-10],
      [-10,  5,  5, 10, 10,  5,  5,-10],
      [-10,  0, 10, 10, 10, 10,  0,-10],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ];

    const rookTable = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [5, 10, 10, 10, 10, 10, 10,  5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [0,  0,  0,  5,  5,  0,  0,  0]
    ];

    const queenTable = [
      [-20,-10,-10, -5, -5,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5,  5,  5,  5,  0,-10],
      [-5,  0,  5,  5,  5,  5,  0, -5],
      [0,  0,  5,  5,  5,  5,  0, -5],
      [-10,  5,  5,  5,  5,  5,  0,-10],
      [-10,  0,  5,  0,  0,  0,  0,-10],
      [-20,-10,-10, -5, -5,-10,-10,-20]
    ];

    const kingMiddleGameTable = [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [20, 20,  0,  0,  0,  0, 20, 20],
      [20, 30, 10,  0,  0, 10, 30, 20]
    ];

    // Select appropriate table
    let table;
    switch (piece.type) {
      case 'p': table = pawnTable; break;
      case 'n': table = knightTable; break;
      case 'b': table = bishopTable; break;
      case 'r': table = rookTable; break;
      case 'q': table = queenTable; break;
      case 'k': table = kingMiddleGameTable; break;
      default: table = null;
    }

    // Apply positional bonus (flip for white pieces)
    let positionalValue = 0;
    if (table) {
      const tableRow = piece.color === 'b' ? row : 7 - row;
      positionalValue = table[tableRow][col];
    }

    return baseValue + positionalValue;
  }

  evaluateKingSafety(color) {
    let safety = 0;
    const board = this.game.board();

    // Find king position
    let kingPos = null;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && piece.type === 'k' && piece.color === color) {
          kingPos = { row: i, col: j };
          break;
        }
      }
      if (kingPos) break;
    }

    if (!kingPos) return 0;

    // Check for pawn shield
    const direction = color === 'w' ? -1 : 1;
    const shieldRow = kingPos.row + direction;

    if (shieldRow >= 0 && shieldRow < 8) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        const col = kingPos.col + colOffset;
        if (col >= 0 && col < 8) {
          const piece = board[shieldRow][col];
          if (piece && piece.type === 'p' && piece.color === color) {
            safety += 10;
          }
        }
      }
    }

    return safety;
  }

  evaluatePawnStructure(color) {
    let score = 0;
    const board = this.game.board();

    // Check for doubled pawns and isolated pawns
    for (let col = 0; col < 8; col++) {
      let pawnsInCol = 0;
      let hasPawnInAdjacentCol = false;

      for (let row = 0; row < 8; row++) {
        const piece = board[row][col];
        if (piece && piece.type === 'p' && piece.color === color) {
          pawnsInCol++;
        }
      }

      // Check adjacent columns for pawns
      for (let adjacentCol of [col - 1, col + 1]) {
        if (adjacentCol >= 0 && adjacentCol < 8) {
          for (let row = 0; row < 8; row++) {
            const piece = board[row][adjacentCol];
            if (piece && piece.type === 'p' && piece.color === color) {
              hasPawnInAdjacentCol = true;
              break;
            }
          }
        }
      }

      // Penalty for doubled pawns
      if (pawnsInCol > 1) {
        score -= 10 * (pawnsInCol - 1);
      }

      // Penalty for isolated pawns
      if (pawnsInCol > 0 && !hasPawnInAdjacentCol) {
        score -= 15;
      }
    }

    return score;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
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
  // Production monetization strategy:
  // Consider integrating with a third-party payment provider like Stripe 
  // or LemonSqueezy for premium features.
  */
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new QuickChess();
});