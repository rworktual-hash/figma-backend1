import client from './client'

export const getTopScores = async () => {
  const response = await client.get('/scores/top');
  return response.data;
};

export const submitScore = async (player_name, score) => {
  const response = await client.post('/scores/', { player_name, score });
  return response.data;
};