import yfinance as yf
import pandas as pd
import joblib
import os
import numpy as np

# Setup paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "stock_model.pkl")
model = joblib.load(MODEL_PATH)

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    # Avoid division by zero
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs.fillna(0)))

def fetch_and_predict(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        # Fetch 100 days to ensure we have enough for the 50-day MA and 14-day RSI
        df = ticker.history(period="150d") 
        
        if df.empty or len(df) < 50:
            return {"error": f"Not enough history for {symbol}"}

        # 1. CALCULATE FEATURES (Must follow your list 1-14)
        # Returns (Percentage Change)
        df['ret_1'] = df['Close'].pct_change(1)
        df['ret_3'] = df['Close'].pct_change(3)
        df['ret_5'] = df['Close'].pct_change(5)
        df['ret_10'] = df['Close'].pct_change(10)
        df['ret_20'] = df['Close'].pct_change(20)
        df['ret_50'] = df['Close'].pct_change(50)

        # Moving Averages
        df['ma_1'] = df['Close'] # 1-day MA is just the price
        df['ma_3'] = df['Close'].rolling(window=3).mean()
        df['ma_5'] = df['Close'].rolling(window=5).mean()
        df['ma_10'] = df['Close'].rolling(window=10).mean()
        df['ma_20'] = df['Close'].rolling(window=20).mean()
        df['ma_50'] = df['Close'].rolling(window=50).mean()

        # Volatility (Standard Deviation of returns)
        df['vol_10'] = df['ret_1'].rolling(window=10).std()

        # RSI
        df['rsi_14'] = calculate_rsi(df['Close'], 14)

        # 2. DROP MISSING DATA
        df_clean = df.dropna().copy()
        
        if df_clean.empty:
            return {"error": "Technical indicators resulted in empty data. Try a more established stock."}

        # 3. ORGANIZE IN EXACT ORDER
        # Your model's requirement: ret_1, ma_1, ret_3, ma_3, ret_5, ma_5, ret_10, ma_10, ret_20, ma_20, ret_50, ma_50, vol_10, rsi_14
        feature_columns = [
            'ret_1', 'ma_1', 'ret_3', 'ma_3', 'ret_5', 'ma_5', 
            'ret_10', 'ma_10', 'ret_20', 'ma_20', 'ret_50', 'ma_50', 
            'vol_10', 'rsi_14'
        ]
        
        latest_row = df_clean.iloc[[-1]][feature_columns]

        # 4. PREDICT
        prediction_signal = model.predict(latest_row)[0]
        
        # Mapping 1 -> BUY, 0 -> SELL (Adjust if your model uses different labels)
        readable_prediction = "BUY" if str(prediction_signal) in ['1', '1.0', 'BUY'] else "SELL"

        return {
            "symbol": symbol.upper(),
            "prediction": readable_prediction,
            "current_price": round(df['Close'].iloc[-1], 2),
            "details": {
                "rsi": round(df_clean['rsi_14'].iloc[-1], 2),
                "volatility": round(df_clean['vol_10'].iloc[-1], 4),
                "ma_50": round(df_clean['ma_50'].iloc[-1], 2)
            }
        }
    except Exception as e:
        print(f"Prediction Error: {e}")
        return {"error": str(e)}