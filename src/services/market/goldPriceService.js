const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GoldPriceService {
  constructor() {
    // Multiple GoldAPI.io keys (5 keys)
    this.goldAPIKeys = [
      process.env.GOLDAPI_KEY,
      process.env.GOLDAPI_KEY_2,
      process.env.GOLDAPI_KEY_3,
      process.env.GOLDAPI_KEY_4,
      process.env.GOLDAPI_KEY_5
    ].filter(key => key);


    this.alphaVantageKeys = [
      process.env.ALPHA_VANTAGE_KEY,
      process.env.ALPHA_VANTAGE_KEY_2,
      process.env.ALPHA_VANTAGE_KEY_3,
      process.env.ALPHA_VANTAGE_KEY_4,
      process.env.ALPHA_VANTAGE_KEY_5
    ].filter(key => key); // Remove empty keys

    // Track current key indices for rotation
    this.currentGoldAPIKeyIndex = 0;
    this.currentAlphaVantageKeyIndex = 0;

    // Initialize Gemini AI Flash 2.5
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

      // Try GoldAPI.io with multiple keys
      if (this.goldAPIKeys.length > 0) {
        console.log(`🔑 Trying ${this.goldAPIKeys.length} GoldAPI keys...`);
        priceData = await this.tryGoldAPIWithMultipleKeys();
      }

      // If GoldAPI failed, try Alpha Vantage with multiple keys
      if (!priceData && this.alphaVantageKeys.length > 0) {
        console.log(`🔑 Trying ${this.alphaVantageKeys.length} Alpha Vantage keys...`);
        priceData = await this.tryAlphaVantageWithMultipleKeys();
      }

      // If ALL paid APIs failed, throw error (NO HALLUCINATION)
      if (!priceData) {
        console.log('❌ ALL paid APIs failed! Cannot fetch real price.');
        throw new Error('Gold Price Service Unavailable (All APIs failed)');
      } else {
        // Enhance the successful API data
        priceData = await this.enhanceWithPredictions(priceData);
      }

      // Cache the result
      this.priceCache = {
        priceData: priceData,
        timestamp: Date.now(),
        ttl: 30000
      };

      console.log('✅ Gold price fetched successfully');
      return priceData;

    } catch (error) {
      console.error('❌ CRITICAL: All gold price methods failed:', error.message);
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
  }

  async tryGoldAPIWithMultipleKeys() {
    for (let i = 0; i < this.goldAPIKeys.length; i++) {
      const keyIndex = (this.currentGoldAPIKeyIndex + i) % this.goldAPIKeys.length;
      const apiKey = this.goldAPIKeys[keyIndex];

      try {
        console.log(`...trying GoldAPI key ${keyIndex + 1}/${this.goldAPIKeys.length}`);
        const priceData = await this.getGoldAPIPrice(apiKey);

        // Update current key index for next rotation
        this.currentGoldAPIKeyIndex = (keyIndex + 1) % this.goldAPIKeys.length;
        console.log(`✅ GoldAPI key ${keyIndex + 1} successful!`);
        return priceData;

      } catch (error) {
        console.log(`❌ GoldAPI key ${keyIndex + 1} failed: ${error.message}`);
        // Continue to next key
      }
    }

    console.log('❌ All GoldAPI keys failed');
    return null;
  }

  async tryAlphaVantageWithMultipleKeys() {
    for (let i = 0; i < this.alphaVantageKeys.length; i++) {
      const keyIndex = (this.currentAlphaVantageKeyIndex + i) % this.alphaVantageKeys.length;
      const apiKey = this.alphaVantageKeys[keyIndex];

      try {
        console.log(`...trying Alpha Vantage key ${keyIndex + 1}/${this.alphaVantageKeys.length}`);
        const priceData = await this.getAlphaVantagePrice(apiKey);

        // Update current key index for next rotation
        this.currentAlphaVantageKeyIndex = (keyIndex + 1) % this.alphaVantageKeys.length;
        console.log(`✅ Alpha Vantage key ${keyIndex + 1} successful!`);
        return priceData;

      } catch (error) {
        console.log(`❌ Alpha Vantage key ${keyIndex + 1} failed: ${error.message}`);
        // Continue to next key
      }
    }

    console.log('❌ All Alpha Vantage keys failed');
    return null;
  }

  async getGoldAPIPrice(apiKey) {
    const response = await axios.get(
      'https://www.goldapi.io/api/XAU/USD',
      {
        headers: { 'x-access-token': apiKey },
        timeout: 10000
      }
    );

    const data = response.data;

    if (!data || !data.price) {
      throw new Error('Invalid response data');
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
      reliability: 'very_high',
      rawData: data
    };
  }

  async getAlphaVantagePrice(apiKey) {
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=XAUUSD&apikey=${apiKey}`,
      { timeout: 10000 }
    );

    const data = response.data['Global Quote'];

    if (!data || !data['05. price']) {
      throw new Error('Invalid response data');
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
      reliability: 'high',
      rawData: data
    };
  }


  async enhanceWithPredictions(priceData) {
    if (!priceData) {
      throw new Error("Cannot enhance null price data");
    }

    console.log('🟡 Enhancing price data with analysis...');

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
        timeframe: '1_week',
        predictedPrice: parseFloat((currentPrice * longTermFactor).toFixed(2)),
        confidence: Math.max(40, 60 - Math.abs(momentum) * 6),
        direction: momentum >= 0 ? 'bullish' : 'bearish',
        factors: ['weekly_trend', 'fundamental_analysis', 'economic_outlook']
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

  analyzeVolatilityCondition(range) {
    const volatility = range / 2000;
    if (volatility > 0.015) return 'high_volatility';
    if (volatility > 0.008) return 'moderate_volatility';
    return 'low_volatility';
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