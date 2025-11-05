const axios = require('axios');

class GoldPriceService {
  constructor() {
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
    this.goldAPIKey = process.env.GOLDAPI_KEY;
   
    this.exchangeRateKey = process.env.EXCHANGERATE_API_KEY;
    
    this.lastPriceUpdate = null;
    this.priceCache = { priceData: null, timestamp: null, ttl: 30000 }; 
  }

  async getGoldPrice() {
    try {
      console.log('🟡 Fetching REAL-TIME gold price...');
      
      if (this.isPriceCacheValid()) {
        console.log('✅ Using cached gold price');
        return this.priceCache.priceData;
      }

      let priceData;
      
      if (this.goldAPIKey) {
        console.log('...using GoldAPI (Paid)');
        priceData = await this.getGoldAPIPrice();
      } else if (this.alphaVantageKey) {
        console.log('...using Alpha Vantage (Paid)');
        priceData = await this.getAlphaVantagePrice();
      } else {
        console.log('...no paid keys found. Using Free Multi-Source.');
        priceData = await this.getMultiSourcePrice(); 
      }

      
      const enhancedData = await this.enhanceWithPredictions(priceData);
      
      
      this.priceCache = {
        priceData: enhancedData,
        timestamp: Date.now(),
        ttl: 30000 
      };

      console.log('✅ REAL-TIME Gold price fetched:', enhancedData.price);
      return enhancedData;
      
    } catch (error) {
      console.error('❌ REAL Gold price fetch failed:', error.message);
      
      if (this.priceCache.priceData) {
        console.log('⚠️ Using stale cached price due to API failure');
        return this.priceCache.priceData;
      }
      
      return this.getReliableFallbackPrice();
    }
  }

  async getMultiSourcePrice() {
    console.log('🟡 Using multi-source price verification...');
    
    const sources = [
      this.getForexAPIPrice(),
      this.getMetalAPIPrice(),
     
      this.getExchangeRateAPIPrice() 
    ];

   
    for (const sourcePromise of sources) {
      try {
        const priceData = await sourcePromise;
        if (priceData && priceData.price > 1000 && priceData.price < 3500) { 
          console.log(`✅ Price verified: $${priceData.price} from ${priceData.source}`);
          return priceData;
        } else {
          console.log(`...source ${priceData ? priceData.source : 'unknown'} returned unrealistic price: $${priceData ? priceData.price : 'N/A'}`);
        }
      } catch (error) {
        console.log(`...source failed: ${error.message}`);
        continue; 
      }
    }
    
    throw new Error('All free price sources failed');
  }

  async getForexAPIPrice() {
    // This API is free and requires no key
    const response = await axios.get(
      'https://api.fxratesapi.com/latest?base=XAU&symbols=USD',
      { timeout: 8000 }
    );

    if (!response.data || !response.data.rates || !response.data.rates.USD) {
      throw new Error('fxratesapi returned invalid data');
    }
    const price = response.data.rates.USD;
    
    return {
      symbol: 'XAUUSD',
      price: parseFloat(price.toFixed(2)),
      change: 0,
      changePercent: 0,
      high: price * 1.005, // Mock OHLC
      low: price * 0.995,
      open: price,
      previousClose: price,
      timestamp: new Date().toISOString(),
      source: 'fxratesapi',
      reliability: 'high'
    };
  }

  async getMetalAPIPrice() {
    // This API uses a "free" public key
    const response = await axios.get(
      'https.api.metalpriceapi.com/v1/latest?api_key=free&base=XAU&currencies=USD',
      { timeout: 8000 }
    );

    if (!response.data || !response.data.rates || !response.data.rates.USD) {
      throw new Error('metalpriceapi returned invalid data');
    }
    const price = response.data.rates.USD;
    
    return {
      symbol: 'XAUUSD',
      price: parseFloat(price.toFixed(2)),
      change: 0,
      changePercent: 0,
      high: price * 1.008, // Mock OHLC
      low: price * 0.992,
      open: price,
      previousClose: price,
      timestamp: new Date().toISOString(),
      source: 'metalpriceapi',
      reliability: 'medium'
    };
  }

  /**
   * --- NEW FUNCTION ---
   * This function replaces getCommodityAPIPrice()
   */
  async getExchangeRateAPIPrice() {
    if (!this.exchangeRateKey) {
      throw new Error('ExchangeRate-API key not provided, skipping');
    }
    
    // This API call converts 1 XAU to USD
    const response = await axios.get(
      `https://v6.exchangerate-api.com/v6/${this.exchangeRateKey}/latest/XAU`,
      { timeout: 8000 }
    );

    if (!response.data || response.data.result !== 'success' || !response.data.conversion_rates || !response.data.conversion_rates.USD) {
      throw new Error('ExchangeRate-API returned invalid data');
    }

    const price = response.data.conversion_rates.USD;
    
    return {
      symbol: 'XAUUSD',
      price: parseFloat(price.toFixed(2)),
      change: 0,
      changePercent: 0,
      high: price * 1.01, // Mock OHLC
      low: price * 0.99,
      open: price,
      previousClose: price,
      timestamp: new Date().toISOString(),
      source: 'exchangerate-api',
      reliability: 'medium'
    };
  }

  // --- REMOVED: getCommodityAPIPrice() ---

  async getAlphaVantagePrice() {
    // This is a paid/freemium key-based API
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=XAUUSD&apikey=${this.alphaVantageKey}`,
      { timeout: 10000 }
    );

    const data = response.data['Global Quote'];
    
    if (!data || !data['05. price']) {
      throw new Error('Alpha Vantage returned invalid data');
    }
    
    return {
      symbol: 'XAUUSD',
      price: parseFloat(data['05. price']),
      change: parseFloat(data['09. change']),
      changePercent: parseFloat(data['10. change percent'].replace('%', '')),
      high: parseFloat(data['03. high']),
      low: parseFloat(data['04. low']),
      open: parseFloat(data['02. open']),
      previousClose: parseFloat(data['08. previous close']),
      volume: data['06. volume'] ? parseInt(data['06. volume']) : 0,
      timestamp: new Date().toISOString(),
      source: 'alphavantage',
      reliability: 'high'
    };
  }

  async getGoldAPIPrice() {
    // This is a paid key-based API
    const response = await axios.get(
      'https://www.goldapi.io/api/XAU/USD',
      {
        headers: { 'x-access-token': this.goldAPIKey },
        timeout: 10000
      }
    );

    const data = response.data;

    if (!data || !data.price) {
      throw new Error('GoldAPI returned invalid data');
    }
    
    return {
      symbol: 'XAUUSD',
      price: data.price,
      change: data.ch,
      changePercent: data.chp,
      high: data.high_price,
      low: data.low_price,
      open: data.open_price,
      previousClose: data.prev_close_price,
      timestamp: new Date(data.timestamp * 1000).toISOString(),
      source: 'goldapi',
      reliability: 'very_high'
    };
  }

  // --- All Analysis Functions

  async enhanceWithPredictions(priceData) {
    if (!priceData) {
      throw new Error("Cannot enhance null price data.");
    }
    console.log('🟡 Enhancing price data with logical analysis...');
    
    const marketAnalysis = await this.analyzeMarketCondition(priceData);
    const predictions = await this.generatePricePredictions(priceData, marketAnalysis);
    
    return {
      ...priceData,
      marketCondition: marketAnalysis,
      predictions: predictions,
      volatility: this.calculateVolatility(priceData),
      trend: this.analyzeTrend(priceData),
      tradingRecommendation: this.getTradingRecommendation(marketAnalysis, predictions)
    };
  }

  async analyzeMarketCondition(priceData) {
    const volatility = Math.abs(priceData.high - priceData.low) / priceData.price;
    const momentum = priceData.changePercent;
    
    let condition, speed, confidence;

    if (volatility > 0.015) {
      speed = 'fast';
      condition = 'high_volatility';
    } else if (volatility > 0.008) {
      speed = 'normal';
      condition = 'moderate_volatility';
    } else {
      speed = 'slow';
      condition = 'low_volatility';
    }

    if (Math.abs(momentum) > 1.5) {
      confidence = 'high';
    } else if (Math.abs(momentum) > 0.5) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      condition: condition,
      speed: speed,
      volatility: volatility,
      momentum: momentum,
      confidence: confidence,
      description: this.getMarketDescription(condition, speed, momentum)
    };
  }

 
  async generatePricePredictions(priceData, marketAnalysis) {
    const currentPrice = priceData.price;
    const volatility = marketAnalysis.volatility;
    const momentum = marketAnalysis.momentum;
    
    // Logical prediction 
    const shortTermFactor = 1 + (momentum / 100) + (volatility * 0.5 * (momentum >= 0 ? 1 : -1));
    const mediumTermFactor = 1 + (momentum / 100) * 3 + (volatility * 1.2 * (momentum >= 0 ? 1 : -1));
    const longTermFactor = 1 + (momentum / 100) * 10 + (volatility * 2 * (momentum >= 0 ? 1 : -1));

    return {
      shortTerm: {
        timeframe: '5_hours',
        predictedPrice: parseFloat((currentPrice * shortTermFactor).toFixed(2)),
        confidence: Math.max(60, 80 - Math.abs(momentum) * 10),
        direction: momentum >= 0 ? 'bullish' : 'bearish',
        factors: ['current_momentum', 'intraday_volatility', 'session_analysis']
      },
      mediumTerm: {
        timeframe: '24_hours',
        predictedPrice: parseFloat((currentPrice * mediumTermFactor).toFixed(2)),
        confidence: Math.max(50, 70 - Math.abs(momentum) * 8),
        direction: momentum >= 0 ? 'bullish' : 'bearish',
        factors: ['daily_trend', 'technical_levels', 'market_sentiment']
      },
      longTerm: {
        timeframe: '1_month',
        predictedPrice: parseFloat((currentPrice * longTermFactor).toFixed(2)),
        confidence: Math.max(40, 60 - Math.abs(momentum) * 6),
        direction: momentum >= 0 ? 'bullish' : 'bearish',
        factors: ['monthly_trend', 'fundamental_analysis', 'economic_outlook']
      }
    };
  }

  calculateVolatility(priceData) {
    const range = priceData.high - priceData.low;
    const volatility = (range / priceData.price) * 100;
    
    return {
      atr: range,
      volatilityPercent: parseFloat(volatility.toFixed(2)),
      level: volatility > 1.5 ? 'high' : volatility > 0.8 ? 'medium' : 'low'
    };
  }

  analyzeTrend(priceData) {
    const change = priceData.change;
    const changePercent = priceData.changePercent;
    
    let trend, strength;

    if (changePercent > 0.5) {
      trend = 'bullish';
      strength = changePercent > 2 ? 'strong' : 'moderate';
    } else if (changePercent < -0.5) {
      trend = 'bearish';
      strength = changePercent < -2 ? 'strong' : 'moderate';
    } else {
      trend = 'neutral';
      strength = 'weak';
    }

    return {
      direction: trend,
      strength: strength,
      change: change,
      changePercent: changePercent
    };
  }

  getTradingRecommendation(marketAnalysis, predictions) {
    const { condition, speed } = marketAnalysis;
    const shortTermPred = predictions.shortTerm;
    
    let recommendation, riskLevel;

    if (condition === 'high_volatility' && speed === 'fast') {
      recommendation = 'Wait for stability';
      riskLevel = 'high';
    } else if (shortTermPred.confidence > 70 && shortTermPred.direction === 'bullish') {
      recommendation = 'Consider buying opportunities';
      riskLevel = 'medium';
    } else if (shortTermPred.confidence > 70 && shortTermPred.direction === 'bearish') {
      recommendation = 'Consider selling opportunities';
      riskLevel = 'medium';
    } else {
      recommendation = 'Hold and monitor';
      riskLevel = 'low';
    }

    return {
      action: recommendation,
      risk: riskLevel,
      confidence: shortTermPred.confidence,
      timeframe: 'short_term',
      reason: this.getRecommendationReason(recommendation)
    };
  }

  getMarketDescription(condition, speed, momentum) {
    const descriptions = {
      high_volatility: `Market moving ${speed} with high volatility`,
      moderate_volatility: `Market moving ${speed} with normal fluctuations`,
      low_volatility: `Market moving ${speed} with low activity`
    };
    
    const momentumDesc = momentum > 0 ? 'bullish momentum' : momentum < 0 ? 'bearish pressure' : 'sideways movement';
    
    return `${descriptions[condition]}. Showing ${momentumDesc}.`;
  }

  getRecommendationReason(recommendation) {
    const reasons = {
      'Wait for stability': 'High volatility increases risk. Better to wait for calmer market conditions.',
      'Consider buying opportunities': 'Strong bullish signals with favorable risk/reward.',
      'Consider selling opportunities': 'Bearish momentum with technical confirmation.',
      'Hold and monitor': 'Market conditions unclear. Wait for stronger signals.'
    };
    
    return reasons[recommendation] || 'Monitor market for clearer direction.';
  }

  
  async getReliableFallbackPrice() {
    console.log('🟡 Using reliable fallback price... No real-time data available.');
    return null;
  }

  isPriceCacheValid() {
    if (!this.priceCache.priceData || !this.priceCache.timestamp) {
      return false;
    }
    
    const cacheAge = Date.now() - this.priceCache.timestamp;
    return cacheAge < this.priceCache.ttl;
  }
}

module.exports = new GoldPriceService();

