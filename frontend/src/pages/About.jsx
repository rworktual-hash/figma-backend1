import { Link } from 'react-router-dom';
import { ArrowLeft, Code, Coffee } from 'lucide-react';

export default function About() {
  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 max-w-xl mx-auto w-full text-center">
      <div className="flex justify-center mb-6">
        <div className="bg-red-600 p-4 rounded-full">
          <Coffee size={40} className="text-white" />
        </div>
      </div>
      
      <h2 className="text-3xl font-black text-white mb-2">
        Killer Bean Clone
      </h2>
      <p className="text-red-400 font-medium mb-6">Version 1.0.0</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 text-left">
        <p className="text-gray-300 mb-4">
          A tribute to classic 2D action-platformer mechanics. Built entirely from scratch using HTML5 Canvas, React, and FastAPI.
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          <p className="flex items-center gap-2"><Code size={16} className="text-blue-400"/> Frontend: React, Vite, Tailwind CSS</p>
          <p className="flex items-center gap-2"><Code size={16} className="text-green-400"/> Backend: Python, FastAPI, SQLite</p>
          <p className="flex items-center gap-2"><Code size={16} className="text-yellow-400"/> Engine: Custom Canvas Rendering</p>
        </div>
      </div>

      <Link to="/" className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
        <ArrowLeft size={18} /> Main Menu
      </Link>
    </div>
  );
}