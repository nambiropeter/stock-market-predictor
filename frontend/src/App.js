import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';

function App() {
  const [stockSymbol, setStockSymbol] = useState('');
  const [selectedName, setSelectedName] = useState(''); // NEW: Store Company Name
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  // --- AUTOCOMPLETE STATES ---
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null); 

  // --- CURRENCY STATE ---
  const [currency, setCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState({ USD: 1 }); 
  const HOLDING_PERIOD = "1 Day"; 
  const CURRENCY_SYMBOLS = { USD: '$', KES: 'KSh ' };

  // --- CLICK OUTSIDE HANDLER ---
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // --- FETCH RATES ---
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        setExchangeRates(data.rates);
      } catch (err) { console.error(err); }
    };
    fetchRates();
  }, []);

  const formatPrice = (priceInUSD) => {
    if (priceInUSD === undefined || priceInUSD === null) return "0.00";
    const rate = exchangeRates[currency] || 1; 
    const symbol = CURRENCY_SYMBOLS[currency] || currency; 
    const converted = priceInUSD * rate;
    return `${symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // --- SMART SEARCH LOGIC ---
  const handleInputChange = async (e) => {
    const userInput = e.target.value;
    setStockSymbol(userInput.toUpperCase());
    setSelectedName(''); // Reset name on new typing

    if (userInput.length > 1) { // Only search if 2+ chars
      try {
        // Call Python Backend Proxy
        const res = await fetch(`http://127.0.0.1:8001/search/${userInput}`);
        const data = await res.json();
        
        if (data.quotes) {
          // FILTER: STRICT NASDAQ CHECK
          const cleanList = data.quotes.filter(item => 
            item.isYahooFinance && 
            item.exchDisp && 
            item.exchDisp.toUpperCase().includes('NASDAQ')
          );
          
          setFilteredStocks(cleanList);
          // Only open dropdown if we actually found NASDAQ results
          setShowDropdown(cleanList.length > 0);
        }
      } catch (err) {
        console.error("Search failed", err);
      }
    } else {
      setShowDropdown(false);
    }
  };

  // UPDATED: Select Stock now accepts the full object to get the name
  const selectStock = (stock) => {
    setStockSymbol(stock.symbol);
    // Try to get the best available name
    const companyName = stock.shortname || stock.longname || stock.name || "";
    setSelectedName(companyName);
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPrediction(null);
    setShowDropdown(false); 

    try {
      const [predResponse, histResponse] = await Promise.all([
        fetch(`http://127.0.0.1:8001/predict/${stockSymbol}`),
        fetch(`http://127.0.0.1:8001/history/${stockSymbol}`)
      ]);

      const data = await predResponse.json();
      const historyData = await histResponse.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
        setLoading(false); return;
      }

      const currentPrice = data.current_price;
      const aiSignal = data.prediction; 
      const isBuy = aiSignal.toUpperCase() === 'BUY';
      const aiConfidence = data.confidence ? (data.confidence * 100).toFixed(2) : "0.00";
      const targetPrice = isBuy ? parseFloat((currentPrice * 1.05).toFixed(2)) : parseFloat((currentPrice * 0.95).toFixed(2));
      const stopLoss = isBuy ? parseFloat((currentPrice * 0.98).toFixed(2)) : parseFloat((currentPrice * 1.02).toFixed(2));
      const potentialProfit = Math.abs(((targetPrice - currentPrice) / currentPrice) * 100).toFixed(2);
      const riskAmount = Math.abs(((currentPrice - stopLoss) / currentPrice) * 100).toFixed(2);

      const finalPrediction = {
        symbol: data.symbol,
        name: selectedName, // Pass the selected name to the result
        prediction: aiSignal.toUpperCase(),
        confidence: aiConfidence,
        currentPrice: currentPrice,
        targetPrice: targetPrice,
        stopLoss: stopLoss,
        potentialProfit: potentialProfit,
        risk: riskAmount,
        riskRewardRatio: (potentialProfit / riskAmount).toFixed(2),
        chartData: Array.isArray(historyData) ? historyData : [], 
        timestamp: new Date().toLocaleString(),
        timeframe: HOLDING_PERIOD 
      };

      setPrediction(finalPrediction);
      setHistory([finalPrediction, ...history].slice(0, 5));
    } catch (err) {
      console.error("Failed to fetch:", err);
      alert("Backend server not responding.");
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
              
              <div className="form-row">
                
                {/* --- AUTOCOMPLETE INPUT --- */}
                <div className="input-group" ref={wrapperRef} style={{position: 'relative'}}>
                  <label htmlFor="stockSymbol">Stock Symbol / Company</label>
                  <input
                    id="stockSymbol"
                    type="text"
                    placeholder="Type Company Name (e.g. NVIDIA)"
                    value={stockSymbol}
                    onChange={handleInputChange} 
                    onFocus={() => stockSymbol.length > 1 && setShowDropdown(true)}
                    autoComplete="off"
                    required
                    disabled={loading}
                    className="stock-input"
                  />

                  {/* DYNAMIC DROPDOWN LIST */}
                  {showDropdown && filteredStocks.length > 0 && (
                    <ul className="autocomplete-dropdown">
                      {filteredStocks.map((stock) => (
                        <li 
                          key={stock.symbol} 
                          onClick={() => selectStock(stock)} // Pass full object
                          className="autocomplete-item"
                        >
                          <div className="item-header">
                            <span className="item-symbol">{stock.symbol}</span>
                            {stock.exchDisp && <span className="item-exchange">{stock.exchDisp}</span>}
                          </div>
                          <span className="item-name">
                            {stock.shortname || stock.longname || stock.name || "Unknown Company"} 
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="input-group">
                  <label htmlFor="currencySelect">Currency</label>
                  <select 
                    id="currencySelect"
                    value={currency} 
                    onChange={(e) => setCurrency(e.target.value)}
                    className="stock-input currency-select"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="KES">KES (KSh)</option>
                  </select>
                </div>

              </div>

              <button type="submit" disabled={loading || !stockSymbol} className="predict-btn">
                {loading ? (
                  <span className="loading-text"><span className="spinner"></span>Analyzing...</span>
                ) : 'Get Prediction'}
              </button>
            </form>
          </div>

          {prediction && (
            <>
              <div className="result-card">
                <div className="result-header-main">
                  <div className="header-left">
                    <h3 className="stock-symbol">
                      {prediction.symbol}
                      {prediction.name && <span className="company-name-tag"> ({prediction.name})</span>}
                    </h3>
                    <span className="stock-timeframe">{prediction.timeframe}</span>
                  </div>
                  <span className={`prediction-badge ${prediction.prediction.toLowerCase()}`}>
                    {prediction.prediction} SIGNAL
                  </span>
                </div>
                
                <div className="chart-container">
                  <h3 className="chart-title">30-Day Price Trend ({currency})</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={prediction.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fill: '#718096', fontSize: 12 }} interval="preserveStartEnd" />
                      <YAxis 
                        tick={{ fill: '#718096', fontSize: 12 }} 
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => (val * (exchangeRates[currency] || 1)).toFixed(0)}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px' }}
                        formatter={(value) => [formatPrice(value), "Price"]}
                      />
                      <Legend />
                      <ReferenceLine y={prediction.currentPrice} stroke="#2563eb" strokeDasharray="5 5" label={{ value: 'Entry', position: 'insideTopRight', fill: '#2563eb', fontSize: 11 }} />
                      <ReferenceLine y={prediction.targetPrice} stroke={prediction.prediction === 'BUY' ? '#059669' : '#dc2626'} strokeDasharray="5 5" label={{ value: 'Target', position: 'insideBottomRight', fill: prediction.prediction === 'BUY' ? '#059669' : '#dc2626', fontSize: 11 }} />
                      <ReferenceLine y={prediction.stopLoss} stroke="#dc2626" strokeDasharray="5 5" label={{ value: 'Stop', position: 'insideTopRight', fill: '#dc2626', fontSize: 11 }} />
                      <Line type="monotone" dataKey="price" stroke="#1e40af" strokeWidth={2.5} dot={false} name="Close Price" />
                      <ReferenceDot x={prediction.chartData.length > 0 ? prediction.chartData[prediction.chartData.length-1].date : ''} y={prediction.currentPrice} r={6} fill="#1e40af" stroke="#fff" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="trading-info">
                  <div className="info-grid">
                    <div className="info-card entry">
                      <div className="info-content">
                        <span className="info-label">Entry Price</span>
                        <span className="info-value">{formatPrice(prediction.currentPrice)}</span>
                      </div>
                    </div>
                    <div className="info-card target">
                      <div className="info-content">
                        <span className="info-label">Target Price</span>
                        <span className="info-value">{formatPrice(prediction.targetPrice)}</span>
                      </div>
                    </div>
                    <div className="info-card stop-loss">
                      <div className="info-content">
                        <span className="info-label">Stop Loss</span>
                        <span className="info-value">{formatPrice(prediction.stopLoss)}</span>
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
                    <div className="confidence-fill" style={{ width: `${prediction.confidence}%` }}></div>
                  </div>
                </div>

                <div className="trade-summary">
                  <h4>Trading Recommendation</h4>
                  <p className="summary-text">
                    {prediction.prediction === 'BUY' 
                      ? `Recommended LONG position for ${prediction.symbol} ${prediction.name ? `(${prediction.name})` : ''} with entry at ${formatPrice(prediction.currentPrice)}. Target profit level set at ${formatPrice(prediction.targetPrice)} (${prediction.potentialProfit}% gain). Estimated holding period: ${prediction.timeframe}.`
                      : `Recommended SHORT position for ${prediction.symbol} ${prediction.name ? `(${prediction.name})` : ''} with entry at ${formatPrice(prediction.currentPrice)}. Target profit level set at ${formatPrice(prediction.targetPrice)} (${prediction.potentialProfit}% gain). Estimated holding period: ${prediction.timeframe}.`
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
          <p className="disclaimer">DISCLAIMER: Trading stocks involves risk. This tool is for educational purposes only.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;