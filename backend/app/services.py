import yfinance as yf
import pandas as pd
import joblib
import os
import numpy as np

# --------------------------------------------------
# Load trained model
# --------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "stock_model.pkl")
model = joblib.load(MODEL_PATH)

# --------------------------------------------------
# RSI Calculation
# --------------------------------------------------
def calculate_rsi(series, period=14):
    delta = series.diff()

    gain = delta.where(delta > 0, 0.0).rolling(window=period).mean()
    loss = -delta.where(delta < 0, 0.0).rolling(window=period).mean()

    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))

    return rsi.fillna(0)

# --------------------------------------------------
# Main Prediction Function
# --------------------------------------------------
def fetch_and_predict(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="150d")

        if df.empty or len(df) < 50:
            return {"error": f"Not enough historical data for {symbol}"}

        # --------------------------------------------------
        # Feature Engineering (EXACT training order)
        # --------------------------------------------------
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

        df_clean = df.dropna().copy()

        if df_clean.empty:
            return {"error": "Indicators resulted in empty dataset"}

        feature_columns = [
            "ret_1", "ma_1",
            "ret_3", "ma_3",
            "ret_5", "ma_5",
            "ret_10", "ma_10",
            "ret_20", "ma_20",
            "ret_50", "ma_50",
            "vol_10", "rsi_14"
        ]

        latest_features = df_clean.iloc[[-1]][feature_columns]

        # --------------------------------------------------
        # Model Prediction (PROBABILITIES)
        # --------------------------------------------------
        probabilities = model.predict_proba(latest_features)[0]

        sell_confidence = float(probabilities[0])
        buy_confidence = float(probabilities[1])

        # --------------------------------------------------
        # Decision Logic (NO DEFAULT SELL)
        # --------------------------------------------------
        if buy_confidence >= 0.55:
            signal = "BUY"
            confidence = buy_confidence
        elif sell_confidence >= 0.55:
            signal = "SELL"
            confidence = sell_confidence
        else:
            signal = "HOLD"
            confidence = max(buy_confidence, sell_confidence)

        # --------------------------------------------------
        # Response
        # --------------------------------------------------
        return {
            "symbol": symbol.upper(),
            "signal": signal,
            "confidence": round(confidence, 2),
            "current_price": round(float(df["Close"].iloc[-1]), 2),
            "details": {
                "rsi": round(float(df_clean["rsi_14"].iloc[-1]), 2),
                "volatility": round(float(df_clean["vol_10"].iloc[-1]), 4),
                "ma_50": round(float(df_clean["ma_50"].iloc[-1]), 2)
            }
        }

    except Exception as e:
        print(f"Prediction Error: {e}")
        return {"error": str(e)}
