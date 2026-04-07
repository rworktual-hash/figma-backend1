from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import score_models, score_schemas

router = APIRouter(prefix="/scores", tags=["Scores"])

@router.post("/", response_model=score_schemas.ScoreResponse)
def submit_score(score: score_schemas.ScoreCreate, db: Session = Depends(get_db)):
    if score.score < 0:
        raise HTTPException(status_code=400, detail="Score cannot be negative")
    
    db_score = score_models.ScoreRecord(
        player_name=score.player_name or "Anonymous Bean",
        score=score.score
    )
    db.add(db_score)
    db.commit()
    db.refresh(db_score)
    return db_score

@router.get("/top", response_model=List[score_schemas.ScoreResponse])
def get_top_scores(limit: int = 10, db: Session = Depends(get_db)):
    return db.query(score_models.ScoreRecord).order_by(score_models.ScoreRecord.score.desc()).limit(limit).all()