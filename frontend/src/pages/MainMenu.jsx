import { Link } from 'react-router-dom';
import { Play, Trophy, HelpCircle, Settings, Info } from 'lucide-react';

export default function MainMenu() {
  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 text-center">
      <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500 mb-8 uppercase tracking-widest">
        Killer Bean
      </h1>
      
      <div className="space-y-4 max-w-md mx-auto">
        <Link to="/game" className="flex items-center justify-center gap-3 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition-transform hover:scale-105">
          <Play size={24} /> Start Game
        </Link>
        
        <Link to="/leaderboard" className="flex items-center justify-center gap-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
          <Trophy size={20} /> Leaderboard
        </Link>
        
        <div className="grid grid-cols-2 gap-4">
          <Link to="/instructions" className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg">
            <HelpCircle size={18} /> How to Play
          </Link>
          <Link to="/settings" className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg">
            <Settings size={18} /> Settings
          </Link>
        </div>

        <Link to="/about" className="flex items-center justify-center gap-2 w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg">
          <Info size={18} /> About
        </Link>
      </div>
    </div>
  );
}