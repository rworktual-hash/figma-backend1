from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from database import Base

class ScoreRecord(Base):
    __tablename__ = "leaderboard"

    id = Column(Integer, primary_key=True, index=True)
    player_name = Column(String, index=True)
    score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)