from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import PredictionRequest
from app.services import fetch_and_predict
import yfinance as yf
app = FastAPI(title="Stock Market Predictor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows your React app to connect
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# This allows your Frontend to talk to this Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/predict/{symbol}")
def get_prediction(symbol: str):
    result = fetch_and_predict(symbol)
    return result

@app.post("/predict")
def predict(request: PredictionRequest):
    result = fetch_and_predict(request)
    return {"prediction": result}

@app.get("/history/{symbol}")
def get_history(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        # Fetch 30 days of 1-hour intervals for a detailed chart
        df = ticker.history(period="1mo", interval="1h") 
        
        if df.empty:
            return {"error": "No history found"}

        # Format data for Recharts: [{time: '09:30', price: 150}, ...]
        history_data = []
        for index, row in df.iterrows():
            history_data.append({
                "time": index.strftime('%m/%d %H:%M'), 
                "price": round(row['Close'], 2)
            })
            
        return history_data
    except Exception as e:
        return {"error": str(e)}