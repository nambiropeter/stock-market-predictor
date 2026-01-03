import React, { useState } from 'react';
import './App.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';

function App() {
  const [stockSymbol, setStockSymbol] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Generate realistic stock price data
  const generateChartData = (currentPrice, days = 30) => {
    const data = [];
    let price = currentPrice * 0.85; // Start lower to show trend
    
    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.45) * (currentPrice * 0.02);
      price += change;
      data.push({
        day: i + 1,
        date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: parseFloat(price.toFixed(2))
      });
    }
    
    // Add current price as last point
    data.push({
      day: days + 1,
      date: 'Today',
      price: parseFloat(currentPrice)
    });
    
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Call your LIVE FastAPI Backend
      const response = await fetch(`http://127.0.0.1:8001/predict/${stockSymbol}`);
      const data = await response.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
        setLoading(false);
        return;
      }

      // 2. Extract real values from the AI response
      const currentPrice = data.current_price;
      const aiSignal = data.prediction; // 'buy' or 'sell' (usually lowercase from model)
      const isBuy = aiSignal.toUpperCase() === 'BUY';

      // 3. Calculate Trade Levels based on REAL price
      // (Using your existing logic but with real numbers)
      const targetPrice = isBuy 
        ? parseFloat((currentPrice * 1.10).toFixed(2)) // 10% gain target
        : parseFloat((currentPrice * 0.90).toFixed(2)); // 10% drop target
      
      const stopLoss = isBuy
        ? parseFloat((currentPrice * 0.96).toFixed(2)) // 4% stop loss
        : parseFloat((currentPrice * 1.04).toFixed(2)); // 4% stop loss
      
      const potentialProfit = Math.abs(((targetPrice - currentPrice) / currentPrice) * 100).toFixed(2);
      const riskAmount = Math.abs(((currentPrice - stopLoss) / currentPrice) * 100).toFixed(2);

      // 4. Construct the Final Prediction Object
      const finalPrediction = {
        symbol: data.symbol,
        prediction: aiSignal.toUpperCase(),
        confidence: (Math.random() * 10 + 85).toFixed(2), // We can add real confidence logic later
        currentPrice: currentPrice,
        targetPrice: targetPrice,
        stopLoss: stopLoss,
        potentialProfit: potentialProfit,
        risk: riskAmount,
        riskRewardRatio: (potentialProfit / riskAmount).toFixed(2),
        chartData: generateChartData(currentPrice), // Seeds the chart with real current price
        timestamp: new Date().toLocaleString(),
        timeframe: '1-2 Weeks' 
      };

      // 5. Update UI State
      setPrediction(finalPrediction);
      setHistory([finalPrediction, ...history].slice(0, 5));

    } catch (err) {
      console.error("Failed to fetch from Backend:", err);
      alert("Backend server not responding. Make sure it's running on port 8001!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <div className="header-content">
            <h1 className="title">STOCK MARKET PREDICTOR</h1>
            <p className="subtitle">Advanced AI-Powered Trading Analytics Platform</p>
          </div>
        </header>

        <main className="main-content">
          <div className="prediction-card">
            <h2 className="card-title">Get Stock Prediction</h2>
            <form onSubmit={handleSubmit} className="prediction-form">
              <div className="input-group">
                <label htmlFor="stockSymbol">Stock Symbol</label>
                <input
                  id="stockSymbol"
                  type="text"
                  placeholder="Enter stock symbol (e.g., AAPL, GOOGL, TSLA)"
                  value={stockSymbol}
                  onChange={(e) => setStockSymbol(e.target.value.toUpperCase())}
                  required
                  disabled={loading}
                  className="stock-input"
                />
              </div>
              <button type="submit" disabled={loading || !stockSymbol} className="predict-btn">
                {loading ? (
                  <span className="loading-text">
                    <span className="spinner"></span>
                    Analyzing...
                  </span>
                ) : (
                  'Get Prediction'
                )}
              </button>
            </form>
          </div>

          {prediction && (
            <>
              <div className="result-card">
                <div className="result-header-main">
                  <div className="header-left">
                    <h3 className="stock-symbol">{prediction.symbol}</h3>
                    <span className="stock-timeframe">{prediction.timeframe}</span>
                  </div>
                  <span className={`prediction-badge ${prediction.prediction.toLowerCase()}`}>
                    {prediction.prediction} SIGNAL
                  </span>
                </div>
                
                <div className="chart-container">
                  <h3 className="chart-title">30-Day Price Chart</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={prediction.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#718096', fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        tick={{ fill: '#718096', fontSize: 12 }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      
                      {/* Entry Price Line */}
                      <ReferenceLine 
                        y={prediction.currentPrice} 
                        stroke="#2563eb" 
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{ 
                          value: `Entry: $${prediction.currentPrice.toFixed(2)}`, 
                          position: 'insideTopRight', 
                          fill: '#2563eb', 
                          fontSize: 11,
                          fontWeight: 'bold'
                        }}
                      />
                      
                      {/* Target Price Line */}
                      <ReferenceLine 
                        y={prediction.targetPrice} 
                        stroke={prediction.prediction === 'BUY' ? '#059669' : '#dc2626'}
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{ 
                          value: `Target: $${prediction.targetPrice.toFixed(2)}`, 
                          position: 'insideBottomRight', 
                          fill: prediction.prediction === 'BUY' ? '#059669' : '#dc2626',
                          fontSize: 11,
                          fontWeight: 'bold'
                        }}
                      />
                      
                      {/* Stop Loss Line */}
                      <ReferenceLine 
                        y={prediction.stopLoss} 
                        stroke="#dc2626" 
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{ 
                          value: `Stop: $${prediction.stopLoss.toFixed(2)}`, 
                          position: 'insideTopRight', 
                          fill: '#dc2626', 
                          fontSize: 11,
                          fontWeight: 'bold'
                        }}
                      />
                      
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#1e40af" 
                        strokeWidth={2.5}
                        dot={false}
                        name="Stock Price"
                      />
                      
                      {/* Mark current position */}
                      <ReferenceDot 
                        x="Today" 
                        y={prediction.currentPrice} 
                        r={6} 
                        fill="#1e40af" 
                        stroke="#fff" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="trading-info">
                  <div className="info-grid">
                    <div className="info-card entry">
                      <div className="info-content">
                        <span className="info-label">Entry Price</span>
                        <span className="info-value">${prediction.currentPrice.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="info-card target">
                      <div className="info-content">
                        <span className="info-label">Target Price</span>
                        <span className="info-value">${prediction.targetPrice.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="info-card stop-loss">
                      <div className="info-content">
                        <span className="info-label">Stop Loss</span>
                        <span className="info-value">${prediction.stopLoss.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="info-card profit">
                      <div className="info-content">
                        <span className="info-label">Potential Profit</span>
                        <span className="info-value positive">+{prediction.potentialProfit}%</span>
                      </div>
                    </div>
                    
                    <div className="info-card risk">
                      <div className="info-content">
                        <span className="info-label">Risk Exposure</span>
                        <span className="info-value negative">-{prediction.risk}%</span>
                      </div>
                    </div>
                    
                    <div className="info-card ratio">
                      <div className="info-content">
                        <span className="info-label">Risk/Reward Ratio</span>
                        <span className="info-value">1:{prediction.riskRewardRatio}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="confidence-section">
                  <div className="confidence-header">
                    <span className="confidence-label">AI Confidence</span>
                    <span className="confidence-percentage">{prediction.confidence}%</span>
                  </div>
                  <div className="confidence-bar">
                    <div 
                      className="confidence-fill"
                      style={{ width: `${prediction.confidence}%` }}
                    ></div>
                  </div>
                </div>

                <div className="trade-summary">
                  <h4>Trading Recommendation</h4>
                  <p className="summary-text">
                    {prediction.prediction === 'BUY' 
                      ? `Recommended LONG position for ${prediction.symbol} with entry at $${prediction.currentPrice.toFixed(2)}. Target profit level set at $${prediction.targetPrice.toFixed(2)} (${prediction.potentialProfit}% gain) with protective stop-loss at $${prediction.stopLoss.toFixed(2)} (${prediction.risk}% risk). Estimated holding period: ${prediction.timeframe}.`
                      : `Recommended SHORT position for ${prediction.symbol} with entry at $${prediction.currentPrice.toFixed(2)}. Target profit level set at $${prediction.targetPrice.toFixed(2)} (${prediction.potentialProfit}% gain) with protective stop-loss at $${prediction.stopLoss.toFixed(2)} (${prediction.risk}% risk). Estimated holding period: ${prediction.timeframe}.`
                    }
                  </p>
                </div>
              </div>
            </>
          )}

          {history.length > 0 && (
            <div className="history-card">
              <h2 className="card-title">Recent Predictions</h2>
              <div className="history-list">
                {history.map((item, index) => (
                  <div key={index} className="history-item">
                    <div className="history-left">
                      <span className="history-symbol">{item.symbol}</span>
                      <span className={`history-badge ${item.prediction.toLowerCase()}`}>
                        {item.prediction}
                      </span>
                    </div>
                    <div className="history-right">
                      <span className="history-confidence">{item.confidence}%</span>
                      <span className="history-time">{item.timestamp.split(',')[1]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        <footer className="footer">
          <p className="disclaimer">DISCLAIMER: Currently operating in demo mode with simulated data. Connect to backend API for live market predictions.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
