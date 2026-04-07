from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import score_routes

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Killer Bean Game API")

# Configure CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(score_routes.router)

@app.get("/")
def root():
    return {"status": "Game API is running"}