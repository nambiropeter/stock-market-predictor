from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, requests
import yfinance as yf

# Import your logic
# We use try/except to handle if you have 'app.services' folder or just flat files
try:
    from app.services import fetch_and_predict
except ImportError:
    from services import fetch_and_predict

app = FastAPI(title="Stock Market Predictor API")

# --- 1. ENABLE CORS (Once is enough) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. PREDICTION ENDPOINT ---
@app.get("/predict/{symbol}")
def get_prediction(symbol: str):
    result = fetch_and_predict(symbol)
    
    # Map 'signal' to 'prediction' so React doesn't crash
    if "signal" in result:
        result["prediction"] = result["signal"]
        
    return result

# --- 3. HISTORY ENDPOINT (For the Chart) ---
@app.get("/history/{symbol}")
def get_history(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        # Fetch 1 month of history
        df = ticker.history(period="1mo", interval="1d") # 1d is often cleaner for charts than 1h
        
        if df.empty:
            return {"error": "No history found"}

        # Format for Recharts
        history_data = []
        for index, row in df.iterrows():
            history_data.append({
                "date": index.strftime('%m/%d'), 
                "price": round(row['Close'], 2)
            })
            
        return history_data
    except Exception as e:
        return {"error": str(e)}

@app.get("/search/{query}")
def search_stocks(query: str):
    try:
        # We query Yahoo Finance's autocomplete API directly
        url = f"https://query1.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=10&newsCount=0"
        
        # Yahoo requires a User-Agent to look like a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers)
        data = response.json()
        
        # We allow CORS here so React can read it
        return data
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)