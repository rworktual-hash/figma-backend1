from pydantic import BaseModel
from datetime import datetime

class ScoreCreate(BaseModel):
    player_name: str
    score: int

class ScoreResponse(BaseModel):
    id: int
    player_name: str
    score: int
    created_at: datetime

    class Config:
        from_attributes = True