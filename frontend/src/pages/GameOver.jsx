import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { submitScore } from '../api/scoreApi';
import { Home, RotateCcw, Trophy } from 'lucide-react';

export default function GameOver() {
  const location = useLocation();
  const navigate = useNavigate();
  const score = location.state?.score || 0;
  
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSaveScore = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      await submitScore(name, score);
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit score', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-red-900 max-w-md mx-auto text-center">
      <h1 className="text-5xl font-black text-red-500 mb-2">GAME OVER</h1>
      <p className="text-2xl text-white mb-6">Final Score: <span className="text-yellow-400 font-bold">{score}</span></p>

      {!submitted ? (
        <form onSubmit={handleSaveScore} className="mb-8">
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={15}
            required
            className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white mb-3 text-center focus:outline-none focus:border-red-500"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Score'}
          </button>
        </form>
      ) : (
        <div className="bg-green-900 text-green-200 p-4 rounded mb-8">
          Score Saved Successfully!
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => navigate('/game')} className="flex flex-col items-center p-3 bg-gray-700 hover:bg-gray-600 rounded text-sm">
          <RotateCcw size={20} className="mb-1"/> Retry
        </button>
        <Link to="/leaderboard" className="flex flex-col items-center p-3 bg-gray-700 hover:bg-gray-600 rounded text-sm text-yellow-400">
          <Trophy size={20} className="mb-1"/> Scores
        </Link>
        <Link to="/" className="flex flex-col items-center p-3 bg-gray-700 hover:bg-gray-600 rounded text-sm">
          <Home size={20} className="mb-1"/> Menu
        </Link>
      </div>
    </div>
  );
}