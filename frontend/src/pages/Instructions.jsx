import { Link } from 'react-router-dom';
import { ArrowLeft, Move, Crosshair, ChevronsUp } from 'lucide-react';

export default function Instructions() {
  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 max-w-2xl mx-auto w-full">
      <h2 className="text-3xl font-black text-white mb-6 border-b border-gray-700 pb-4">
        How to Play
      </h2>
      
      <div className="space-y-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="bg-blue-600 p-3 rounded-lg text-white"><Move size={24}/></div>
          <div>
            <h3 className="text-xl font-bold text-blue-400">Movement</h3>
            <p className="text-gray-300">Use <kbd className="bg-gray-900 px-2 py-1 rounded">A</kbd> / <kbd className="bg-gray-900 px-2 py-1 rounded">D</kbd> or the Left and Right arrow keys to run across the map.</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="bg-green-600 p-3 rounded-lg text-white"><ChevronsUp size={24}/></div>
          <div>
            <h3 className="text-xl font-bold text-green-400">Jumping</h3>
            <p className="text-gray-300">Press <kbd className="bg-gray-900 px-2 py-1 rounded">W</kbd>, <kbd className="bg-gray-900 px-2 py-1 rounded">Up Arrow</kbd>, or <kbd className="bg-gray-900 px-2 py-1 rounded">Spacebar</kbd> to jump and dodge enemies.</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="bg-red-600 p-3 rounded-lg text-white"><Crosshair size={24}/></div>
          <div>
            <h3 className="text-xl font-bold text-red-400">Combat</h3>
            <p className="text-gray-300">Press <kbd className="bg-gray-900 px-2 py-1 rounded">F</kbd> or <kbd className="bg-gray-900 px-2 py-1 rounded">Enter</kbd> to shoot your weapons. Destroy enemies to earn points. Don't let them touch you!</p>
          </div>
        </div>
      </div>

      <Link to="/" className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
        <ArrowLeft size={18} /> Return to Menu
      </Link>
    </div>
  );
}