import React, { useState, useEffect, useRef } from "react";
import io from 'socket.io-client';
import "./App.css";

const socket = io('https://game-backend-production-efdf.up.railway.app', {
  transports: ['websocket', 'polling']
});

const App = () => {
  const [sequence, setSequence] = useState([]);
  const [userInput, setUserInput] = useState([]);
  const [level, setLevel] = useState(1);
  const [gameActive, setGameActive] = useState(false);
  const [inputAllowed, setInputAllowed] = useState(false);
  const [timerWidth, setTimerWidth] = useState(300);
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const [userHighlightedIndex, setUserHighlightedIndex] = useState(null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [players, setPlayers] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [gameMessage, setGameMessage] = useState('');

  const timerIntervalRef = useRef(null);
  const gridSize = 9;
  const timerDuration = 300;  

  useEffect(() => {
    if (gameActive && sequence.length === 0) {
      nextLevel();
    }
  }, [gameActive, sequence]);

  useEffect(() => {
    if (sequence.length > 0) {
      playSequence();
    }
  }, [sequence]);

  useEffect(() => {
    socket.on('roomUpdate', (players) => {
      const currentPlayer = players.find(p => p.id === socket.id);
      if (currentPlayer) {
        setMyPlayerId(currentPlayer.id);
        setLevel(currentPlayer.level);
      }
      setPlayers(players);
    });

    socket.on('gameStart', () => {
      startGame();
    });

    socket.on('restartGame', () => {
      resetGame();
      alert("Game restarted! Another player made a mistake.");
    });

    socket.on('waitingForOthers', () => {
      setGameMessage("Waiting for other players to reach the final level...");
    });
  
    socket.on('gameWin', () => {
      setGameMessage("Connection Error! Troubleshoot it in the Network Room");
  
      setTimeout(() => {
        setGameMessage('');
        resetGame();
      }, 60000); 
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('gameStart');
      socket.off('restartGame');
      socket.off('gameWin');
      socket.off('waitingForOthers');
    };
  }, []);

  const joinRoom = () => {
    if (username && roomId) {
      socket.emit('joinRoom', { roomId, username });
      setJoinedRoom(true);
    }
  };

  const toggleReady = () => {
    socket.emit('toggleReady', roomId);
  };

  const startGame = () => {
    resetGame();
    setGameActive(true);
    setTimerWidth(timerDuration);
  };

  const nextLevel = () => {
    setInputAllowed(false);
    setTimeout(() => {
      const newBox = Math.floor(Math.random() * gridSize);
      setSequence(prev => [...prev, newBox]);
      setUserInput([]);
    }, 1000);
  };

  const playSequence = async () => {
    setInputAllowed(false);
    for (const index of sequence) {
      setHighlightedIndex(index);
      await new Promise(resolve => setTimeout(resolve, 600));
      setHighlightedIndex(null);
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    allowUserInput();
  };

  const allowUserInput = () => {
    setInputAllowed(true);
    startTimer();
  };

  const startTimer = () => {
    setIsTimerActive(true);
    let width = timerDuration;
    timerIntervalRef.current = setInterval(() => {
      if (width <= 0) {
        clearInterval(timerIntervalRef.current);
        socket.emit('mistake', roomId);
      } else {
        width -= 10;
        setTimerWidth(width);
      }
    }, 100);
  };

  const resetGame = () => {
    clearInterval(timerIntervalRef.current);
    setGameActive(false);
    setSequence([]);
    setUserInput([]);
    setLevel(1);
    setInputAllowed(false);
    setTimerWidth(timerDuration);
    setIsTimerActive(false);
  };

  const handleBoxClick = (index) => {
    if (!gameActive || !inputAllowed) return;

    const newUserInput = [...userInput, index];
    setUserInput(newUserInput);
    setUserHighlightedIndex(index);

    setTimeout(() => setUserHighlightedIndex(null), 500);

    if (!sequence.slice(0, newUserInput.length).every((val, i) => val === newUserInput[i])) {
      socket.emit('mistake', roomId);
      return;
    }

    if (newUserInput.length === sequence.length) {
      setInputAllowed(false);
      clearInterval(timerIntervalRef.current);

      setTimeout(() => {
        const newLevel = level + 1;
        setLevel(newLevel);
        socket.emit('levelUp', roomId, newLevel);
        
        // max level
        
        if (newLevel > 3) {  
          socket.emit('playerFinished', roomId);
        } else {
          nextLevel();
        }
      }, 1000);
    }
  };

  return (
    <div className="App">
      {!joinedRoom ? (
        <div className="lobby">
          <h1>Memory Game</h1>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      ) : (
        <>
          <h1>Memory Game</h1>
          <div className="player-list">
            <h3>Players:</h3>
            {players.map(player => (
              <div key={player.id} className={`player ${player.id === myPlayerId ? 'current-player' : ''}`}>
                <span className="username">{player.username}</span>
                <span className={`status ${player.ready ? 'ready' : 'not-ready'}`}>
                  {player.ready ? '✅ Ready' : '❌ Not Ready'}
                </span>
                <span className="level">Level: {player.level}</span>
              </div>
            ))}
          </div>
          
          <button
            className={`ready-btn ${players.find(p => p.id === myPlayerId)?.ready ? 'ready' : ''}`}
            onClick={toggleReady}
            disabled={!joinedRoom || gameActive}
          >
            {players.find(p => p.id === myPlayerId)?.ready ? "⏹️ Unready" : "✅ Ready Up"}
            <div className="ready-count">
              ({players.filter(p => p.ready).length}/{players.length} ready)
            </div>
          </button>
  
          <h2 className="level-title">Level: {level}</h2>
          <div className="grid">
            {Array.from({ length: gridSize }).map((_, index) => (
              <div
                key={index}
                className={`box
                  ${highlightedIndex === index ? "highlight" : ""}
                  ${userHighlightedIndex === index ? "user-highlight" : ""}
                `}
                onClick={() => handleBoxClick(index)}
              />
            ))}
          </div>
          <div
            className={`timer-bar ${isTimerActive ? "active" : ""}`}
            style={{ width: `${timerWidth}px` }}
          />
          {gameMessage && (
            <div className="game-message">
              {gameMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;