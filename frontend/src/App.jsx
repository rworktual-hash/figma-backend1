import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainMenu from './pages/MainMenu';
import GameScreen from './pages/GameScreen';
import GameOver from './pages/GameOver';
import Leaderboard from './pages/Leaderboard';
import Instructions from './pages/Instructions';
import Settings from './pages/Settings';
import About from './pages/About';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <Routes>
            <Route path="/" element={<MainMenu />} />
            <Route path="/game" element={<GameScreen />} />
            <Route path="/game-over" element={<GameOver />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/instructions" element={<Instructions />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;