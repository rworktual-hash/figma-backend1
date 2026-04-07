import { Link } from 'react-router-dom';
import { ArrowLeft, Volume2, Monitor } from 'lucide-react';

export default function Settings() {
  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 max-w-xl mx-auto w-full">
      <h2 className="text-3xl font-black text-white mb-6 border-b border-gray-700 pb-4">
        Settings
      </h2>

      <div className="space-y-6 mb-8">
        <div className="bg-gray-900 p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="text-blue-400" />
            <span className="font-semibold text-gray-200">Sound Effects</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="bg-gray-900 p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="text-green-400" />
            <span className="font-semibold text-gray-200">Show FPS</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>

        <p className="text-sm text-gray-500 italic mt-4">Note: Settings are saved locally in your browser.</p>
      </div>

      <Link to="/" className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
        <ArrowLeft size={18} /> Save & Return
      </Link>
    </div>
  );
}