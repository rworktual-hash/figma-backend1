import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTopScores } from '../api/scoreApi';
import { Trophy, ArrowLeft } from 'lucide-react';

export default function Leaderboard() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      try {
        const data = await getTopScores();
        setScores(data);
      } catch (error) {
        console.error('Error fetching scores:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchScores();
  }, []);

  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black text-yellow-400 flex items-center gap-3">
          <Trophy size={32} /> Hall of Fame
        </h2>
        <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-2">
          <ArrowLeft size={20}/> Back
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading scores...</div>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-950">
              <tr>
                <th className="p-4 text-gray-400">Rank</th>
                <th className="p-4 text-gray-400">Player</th>
                <th className="p-4 text-gray-400 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {scores.length === 0 ? (
                <tr><td colSpan="3" className="p-4 text-center text-gray-500">No scores yet. Be the first!</td></tr>
              ) : (
                scores.map((s, idx) => (
                  <tr key={s.id} className="border-t border-gray-800 hover:bg-gray-800">
                    <td className="p-4 font-bold text-gray-300">#{idx + 1}</td>
                    <td className="p-4 font-medium text-white">{s.player_name}</td>
                    <td className="p-4 font-mono text-right text-yellow-400">{s.score}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}