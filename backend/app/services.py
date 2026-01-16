import yfinance as yf
import pandas as pd
import joblib
import os
import numpy as np
import math

# --------------------------------------------------
# 1. SAFE MODEL LOADING
# --------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "stock_model.pkl")

model = None
try:
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print(f"✅ Model loaded successfully from {MODEL_PATH}")
    else:
        # Check current directory fallback
        local_path = os.path.join(os.getcwd(), "stock_model.pkl")
        if os.path.exists(local_path):
            model = joblib.load(local_path)
            print(f"✅ Model loaded from local directory")
        else:
            print(f"⚠️ Warning: Model not found. Server running in Logic-Only Mode.")
except Exception as e:
    print(f"⚠️ Error loading model: {e}")

# --------------------------------------------------
# 2. HELPER TO PREVENT JSON CRASHES
# --------------------------------------------------
def clean_float(val):
    """Converts NaN or Infinite values to 0.0 to prevent server crashes."""
    if val is None or math.isnan(val) or pd.isna(val) or np.isnan(val) or np.isinf(val):
        return 0.0
    return float(val)

# --------------------------------------------------
# 3. RSI CALCULATION
# --------------------------------------------------
def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0).rolling(window=period).mean()
    loss = -delta.where(delta < 0, 0.0).rolling(window=period).mean()
    
    # Avoid division by zero
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    
    return rsi.fillna(50) # Default to neutral 50 if calculation fails

# --------------------------------------------------
# 4. MAIN PREDICTION FUNCTION
# --------------------------------------------------
def fetch_and_predict(symbol: str):
    try:
        # Fetch Data
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="150d")

        if df.empty or len(df) < 50:
            return {"error": f"Not enough historical data for {symbol}"}

        # --- Feature Engineering ---
        df["ret_1"] = df["Close"].pct_change(1)
        df["ret_3"] = df["Close"].pct_change(3)
        df["ret_5"] = df["Close"].pct_change(5)
        df["ret_10"] = df["Close"].pct_change(10)
        df["ret_20"] = df["Close"].pct_change(20)
        df["ret_50"] = df["Close"].pct_change(50)

        df["ma_1"] = df["Close"]
        df["ma_3"] = df["Close"].rolling(window=3).mean()
        df["ma_5"] = df["Close"].rolling(window=5).mean()
        df["ma_10"] = df["Close"].rolling(window=10).mean()
        df["ma_20"] = df["Close"].rolling(window=20).mean()
        df["ma_50"] = df["Close"].rolling(window=50).mean()

        df["vol_10"] = df["ret_1"].rolling(window=10).std()
        df["rsi_14"] = calculate_rsi(df["Close"], 14)

        # Drop NaNs created by rolling windows
        df_clean = df.dropna().copy()

        if df_clean.empty:
            return {"error": "Indicators resulted in empty dataset"}

        # --- Get Safe Values for Logic ---
        current_price = clean_float(df["Close"].iloc[-1])
        rsi_val = clean_float(df_clean["rsi_14"].iloc[-1])
        vol_val = clean_float(df_clean["vol_10"].iloc[-1])
        ma50_val = clean_float(df_clean["ma_50"].iloc[-1])
        ma20_val = clean_float(df_clean["ma_20"].iloc[-1])
        ma10_val = clean_float(df_clean["ma_10"].iloc[-1])

        # --------------------------------------------------
        # STRICT PREDICTION LOGIC
        # --------------------------------------------------
        
        # NOTE: We are prioritizing strict math rules over the AI model 
        # because the AI model is biased towards "BUY" in this market.
        
        signal = "HOLD"
        confidence = 0.50

        # Rule 1: STRONG SELL (Momentum broken)
        # Price dropped below 10-day avg AND 20-day avg
        if current_price < ma10_val and current_price < ma20_val:
            signal = "SELL"
            confidence = 0.75
        
        # Rule 2: OVERBOUGHT SELL
        # Price is high, but RSI is too hot (> 70)
        elif rsi_val > 70:
            signal = "SELL"
            confidence = 0.85

        # Rule 3: STRICT BUY
        # Price > 20-Day Avg (Uptrend) AND RSI < 60 (Not too expensive)
        elif current_price > ma20_val and rsi_val < 60:
            signal = "BUY"
            confidence = 0.75

        # Rule 4: WEAK HOLD
        # Price is messy (between 20-day and 50-day averages)
        elif current_price < ma20_val and current_price > ma50_val:
            signal = "HOLD"
            confidence = 0.60
            
        else:
            signal = "HOLD"
            confidence = 0.50

        # --------------------------------------------------
        # FINAL RETURN
        # --------------------------------------------------
        return {
            "symbol": symbol.upper(),
            "prediction": signal, # Frontend expects 'prediction', not 'signal'
            "confidence": round(clean_float(confidence), 2),
            "current_price": round(current_price, 2),
            "details": {
                "rsi": round(rsi_val, 2),
                "volatility": round(vol_val, 4),
                "ma_50": round(ma50_val, 2)
            }
        }

    except Exception as e:
        print(f"Prediction Error: {e}")
        # Return a safe error structure
        return {"error": str(e)}