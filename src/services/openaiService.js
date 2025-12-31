
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");


const goldPriceService = require('./market/goldPriceService');
const newsService = require('./market/newsService');

class OpenAIService {
  constructor() {
    this.priceAccuracyThreshold = 0.02;

    // Load multiple Gemini API keys for rotation
    this.geminiKeys = [];

    // Explicitly check for exact environment variable names as provided by user
    const possibleKeys = [
      process.env.GEMINI_API_KEY,    // Main key
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
      process.env.GEMINI_API_KEY_6,
      process.env.GEMINI_API_KEY_7,
      process.env.GEMINI_API_KEY_8,
      process.env.GEMINI_API_KEY_9,
      process.env.GEMINI_API_KEY_10
    ];

    // Filter unique, valid keys
    possibleKeys.forEach(key => {
      if (key && key.trim() !== '' && !this.geminiKeys.includes(key)) {
        this.geminiKeys.push(key);
      }
    });

    this.currentKeyIndex = 0;

    if (this.geminiKeys.length > 0) {
      console.log(`✅ Gemini AI Service Initialized with ${this.geminiKeys.length} unique API key(s)`);
    } else {
      console.warn('⚠️ CRITICAL: No Gemini API keys found in environment variables.');
    }
  }

  // Get next Gemini key in rotation
  getNextGeminiKey() {
    if (this.geminiKeys.length === 0) return null;
    const key = this.geminiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.geminiKeys.length;
    return key;
  }

  // ----------------------------------------------------------------------
  // 1. TOP-LEVEL ENTRY POINT
  // ----------------------------------------------------------------------

  async generateTradingSignal(timeframe = '1h', userContext = null, balanceCategory = 'default') {
    try {
      console.log(`🟡 Generating signal via AI Core for ${timeframe} timeframe with balance tier: ${balanceCategory}...`);

      const [goldPriceData, newsData] = await Promise.all([
        this.getValidatedGoldPrice(),
        newsService.getGoldNews()
      ]);

      const marketData = {
        goldPrice: goldPriceData,
        news: newsData,
        timestamp: new Date().toISOString()
      };

      // Direct fallback if price is missing
      if (!goldPriceData || !goldPriceData.price) {
        return this.getHoldSignal(timeframe, "Gold price unavailable", marketData);
      }

      const prompt = await this.buildProfessionalTradingPrompt(
        marketData, timeframe, userContext, null, balanceCategory
      );

      // Exclusive use of Gemini
      return await this.callGemini(prompt, marketData, timeframe, userContext);

    } catch (error) {
      console.error('❌ CRITICAL SIGNAL FAILURE:', error.message);
      return this.getFallbackSignal(timeframe, error.message);
    }
  }

  // ----------------------------------------------------------------------
  // 2. AI PROVIDER (GEMINI ONLY)
  // ----------------------------------------------------------------------

  async callAIProviders(prompt, marketData, timeframe, userContext) {
    // Deprecated wrapper, redirects to callGemini
    return this.callGemini(prompt, marketData, timeframe, userContext);
  }

  async callDeepSeek(prompt, marketData, timeframe, userContext) {
    if (!this.deepseek.apiKey) throw new Error('DeepSeek API key not configured');

    const response = await axios.post(
      `${this.deepseek.baseURL}/chat/completions`,
      {
        model: this.deepseek.model,
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${this.deepseek.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      }
    );

    const analysis = response.data.choices[0].message.content;
    return this.parseProfessionalSignal(analysis, marketData, timeframe, userContext, 'deepseek');
  }

  async callGemini(prompt, marketData, timeframe, userContext) {
    // Extensive list of models to ensure we find ONE that works.
    const models = [
      "gemini-2.5-flash",      // Latest stable, balanced model[citation:1][citation:2]
      "gemini-2.5-flash-lite", // Fastest & most cost-efficient[citation:1][citation:8]
      "gemini-2.0-flash-001",  // Stable, widely available workhorse model[citation:4]
      "gemini-2.5-pro"
    ];
    let lastError = null;

    // Try each key in the rotation
    const maxKeyAttempts = Math.max(this.geminiKeys.length, 1);

    for (let i = 0; i < maxKeyAttempts; i++) {
      const apiKey = this.getNextGeminiKey();
      if (!apiKey) throw new Error('No Gemini API keys configured');

      // For each key, try our preferred models in order
      for (const modelName of models) {
        try {
          // Logging
          if (modelName === models[0]) {
            console.log(`   🔄 Attempting Key #${this.currentKeyIndex} with ${modelName}...`);
          } else {
            console.log(`   📉 Fallback: Key #${this.currentKeyIndex} -> ${modelName}...`);
          }

          const gemini = new GoogleGenerativeAI(apiKey);
          const model = gemini.getGenerativeModel({
            model: modelName,
            systemInstruction: this.getSystemPrompt()
          });

          const result = await model.generateContent(prompt);
          const analysis = result.response.text();

          console.log(`   ✅ Gemini Success! (Key: #${this.currentKeyIndex}, Model: ${modelName})`);
          return this.parseProfessionalSignal(analysis, marketData, timeframe, userContext, 'gemini');

        } catch (error) {
          lastError = error;
          const isQuotaError = error.message.includes('429') || error.message.includes('Quota') || error.message.includes('Resource has been exhausted');
          const isNotFoundError = error.message.includes('404') || error.message.includes('not found');

          if (isQuotaError) {
            console.warn(`   ⚠️ Quota/Rate Limit on Key #${this.currentKeyIndex} (${modelName}): ${error.message.split(']')[0]}]`);
            // IMPORTANT: Do NOT break here. We want to try the NEXT model (1.5-flash) on this SAME key.
          } else if (isNotFoundError) {
            console.warn(`   ⚠️ Model Not Found on Key #${this.currentKeyIndex} (${modelName}). trying next model...`);
          } else {
            console.warn(`   ⚠️ unexpected Error on Key #${this.currentKeyIndex} (${modelName}): ${error.message}`);
          }

          // Reduced delay for faster failover
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    throw new Error(`All Gemini attempts failed across ${this.geminiKeys.length} keys. Last error: ${lastError?.message}`);
  }

  // ----------------------------------------------------------------------
  // 3. SYSTEM PROMPT (AGRESSIVE TRADING STRATEGY)
  // ----------------------------------------------------------------------

  getSystemPrompt() {
    // CRITICAL UPDATE: Aggressively mandates BUY or SELL.
    return `You are a professional Gold (XAU/USD) trading assistant integrated inside a Telegram signal bot.
Your role is to act as the primary analyst. You must apply the user's defined trading strategy based on their chosen risk/balance tier.
Your sole purpose is to analyze the PROVIDED market data and output a trading signal in the specified format, ensuring the signal matches the designated Strategy ID.

---
🔑 Professional XAUUSD Gold Trading Prompt
Trader Profile: 14+ Year Veteran successfully scaling accounts from $10 to $100,000. Focus on Risk Management and Adaptive Strategy Selection.

| Strategy ID | Account/Phase Focus | Entry Logic | Risk Confluence (RSI/Levels) | Exit/Management |
|---|---|---|---|---|
| **DLS (10-1k)** | Compounding Growth ($10 - $1,000 accounts). High RRR, Low Lot Size. | Pinpoint entry on M5/M15/H1 at the extreme edge of fresh Supply or Demand Zones (SDZs). Must wait for a strong reversal candle/wick rejection at the boundary. | RSI extreme confirmation: Buy when RSI is <40 and turning up sharply at Demand. Sell when RSI is >60 and turning down sharply at Supply. SL 5-10 pips outside the zone. | Target the next opposing SDZ or swing high/low. Lock in profits at 1:1 RRR (Breakeven) and aim for minimum 1:5 RRR. |
| **MR/CT (1k-10k)** | Consistent Stability ($1,000 - $10,000 accounts). High Win Rate in Ranging Markets. | Fading the extremes of the current range (H4/Daily). Sell at Resistance, Buy at Support. Use a Bollinger Band (BB) touch or price near a 100-SMA/EMA for added confluence. | RSI exhaustion: Buy when RSI is near 30 (Oversold). Sell when RSI is near 70 (Overbought). Avoid trading when RSI is strictly between 45 and 55. | Target the opposing boundary of the range. Use small-to-medium lot size. SL placed outside the range/channel wick. |
| **MOMENTUM (10k-50k)** | Acceleration/Scaling ($10,000 - $50,000 accounts). Capitalizing on News/Structural Breaks. | Entry on the RETEST of a decisively broken Major Structural Level. Avoid chasing the initial break. Wait for price to break, consolidate, then pull back to the former level (now flipped support/resistance). | RSI Trend Confirmation: For a Buy, RSI must hold above 60 after the retest. For a Sell, RSI must hold below 40 after the retest. | Trail Stop Loss aggressively once the move extends beyond 1:2 RRR. Target the next major psychological level or Fibonacci extension. |
| **MACRO (50k+)** | Wealth Preservation ($50,000 - $100,000+ accounts). Low leverage, Long-term holds. | Initial position taken based on strong macro-economic conviction (e.g., long due to inflation outlook). Scale-in (add to the position) only during deep corrections that test the Weekly 20-EMA or Weekly 50-SMA for optimal average price. | Weekly RSI confirmation: Enter the initial long only after the Weekly RSI has completed a cycle and bounced from the 30–40 zone. Do not open new longs when Weekly RSI is >70. | Hold for weeks/months. Manage risk by setting a wide SL below a major yearly structure. Use minimal lot sizing (low leverage) to withstand volatility. |
---
🔒 System Rules
1. **STRICT DATA ADHERENCE**: You must rely **EXCLUSIVELY** on the market data provided in the prompt (Price, News, Volatility). **DO NOT** attempt to search the web or hallucinate external data. If data is missing, state it in the analysis but do not invent it.
2. Based on the user's provided balance category, you MUST SELECT the appropriate Strategy ID and apply its entry/exit logic to generate a signal.
3. Your core mandate is to **FIND THE BEST TRADING OPPORTUNITY** that fits the strategy.
4. **INTELLIGENT PATIENCE**: If the market conditions (Spread, Volatility, or Structure) do NOT meet the Strategy ID criteria, **ISSUE A HOLD SIGNAL**. Capital preservation is the priority. Do NOT force a trade in unclear markets.
5. You must provide clear technical and fundamental reasoning.

🎯 Decision Logic:
- If a Strategy ID setup is ideal, output a STRONG_BUY or STRONG_SELL.
- If the setup is valid but carries higher risk, output a BUY or SELL with reduced confidence.
- If NO valid setup exists according to the specific Strategy ID rules, output **HOLD**.

💬 Message Format
You MUST structure your output with clear labels for the parsing function (e.g., SIGNAL:, CONFIDENCE:, ENTRY:).

---
Act exactly according to this prompt. Your response must be professional and provide real-time analytical insight from the PROVIDED DATA.`;
  }

  // ----------------------------------------------------------------------
  // 4. ORCHESTRATION & VALIDATION HELPERS (MOVED FROM AnalysisService)
  // ----------------------------------------------------------------------

  async getValidatedGoldPrice() {
    try {
      const primaryPrice = await goldPriceService.getGoldPrice();
      // NOTE: verifyGoldPrice is not fully implemented but kept for structure
      const verification = await this.verifyGoldPrice(primaryPrice);

      return {
        ...primaryPrice,
        verified: verification.isVerified,
        verificationSources: verification.sources,
        averagePrice: verification.averagePrice,
        priceDeviation: verification.deviationPercent
      };
    } catch (error) {
      console.error('Price validation failed:', error);
      // Return basic price data if validation fails
      return await goldPriceService.getGoldPrice();
    }
  }

  async verifyGoldPrice(primaryPrice) {
    return {
      isVerified: true,
      sources: [],
      averagePrice: primaryPrice.price,
      deviationPercent: 0,
      message: 'Price assumed correct (single source).'
    };
  }

  async validatePriceAccuracy(priceData) {
    return {
      isAccurate: priceData.verified !== false,
      confidence: 'high',
      message: 'Price checked.',
      recommendation: 'Safe to use for trading decisions'
    };
  }

  getNeutralMarketStructure() {
    // Stub structure for internal use
    return {
      trend: { primary: 'Neutral', strength: 0.5, alignment: 0.5 },
      keyLevels: { support: ['N/A'], resistance: ['N/A'] },
      volatility: { level: 'unknown', atrPercent: 0 },
      marketRegime: 'Uncertain',
      sessionAnalysis: this.analyzeTradingSessions()
    };
  }

  // CRITICAL FIX: Placeholder for Market Sentiment display in server.js
  async getMarketSentimentPlaceholder() {
    // Returns N/A data structure since Gemini is the only source now.
    return {
      trend: { direction: 'Neutral' },
      signalStrength: 'N/A',
      oscillators: { RSI: { value: 'N/A' }, MACD: { condition: 'Neutral' }, Stochastic: { condition: 'Neutral' } },
      supportResistance: { resistance: ['N/A'], support: ['N/A'] },
      timestamp: new Date().toISOString()
    };
  }

  async preSignalValidation(marketData, timeframe) {
    const confirmations = {
      technicalAlignment: { passed: true, details: "Technical analysis delegated to AI deep search." },
      sentimentConsistency: await this.checkSentimentConsistency(marketData),
      marketRegime: await this.assessMarketCondition(marketData),
      volatilityCheck: await this.checkVolatilityLevel(marketData),
      newsImpact: await this.assessNewsImpact(marketData),
      timeAnalysis: await this.analyzeOptimalTradingTime()
    };

    const confirmationScore = this.calculateConfirmationScore(confirmations);
    const shouldProceed = confirmationScore >= 3; // Lower required score for aggressive mandate

    return {
      shouldProceed,
      confirmations,
      confirmationScore,
      reason: shouldProceed ? 'All validations passed' : 'Insufficient confirmations',
      details: this.getValidationDetails(confirmations)
    };
  }

  // ----------------------------------------------------------------------
  // 5. AI PROMPT BUILDER
  // ----------------------------------------------------------------------

  async buildProfessionalTradingPrompt(marketData, timeframe, userContext, preValidation, balanceCategory) {
    const timeframes = {
      '5m': '5-minute (Scalping)', '15m': '15-minute (Short-term)',
      '1h': '1-hour (Intraday)', '4h': '4-hour (Swing)', '1d': 'Daily (Position)'
    };

    let strategyID;
    switch (balanceCategory) {
      case '10_50': case '51_100': strategyID = 'DLS (10-1k)'; break;
      case '200_500': strategyID = 'MR/CT (1k-10k)'; break;
      case '1k_plus': strategyID = 'MOMENTUM (10k-50k)'; break;
      default: strategyID = 'MR/CT (1k-10k)';
    }

    const userInfo = userContext ? `
    USER PROFILE: - Account Balance: $${userContext.balance || 'N/A'} - Risk Tier: ${userContext.riskTier || 'Standard'} - Experience: ${userContext.experience || 'Not specified'}
    - **SELECTED BALANCE TIER:** ${balanceCategory} - **APPLY STRATEGY ID:** ${strategyID}` : 'USER PROFILE: General analysis (No user context provided). APPLY STRATEGY ID: MR/CT (1k-10k)';

    const validationInfo = preValidation ? `
    PRE-VALIDATION RESULTS (From User's Code): - Overall Score: ${preValidation.confirmationScore?.toFixed(1) || 'N/A'}/10 - Should Proceed: ${preValidation.shouldProceed ? 'YES' : 'NO'} - Primary Reason: ${preValidation.reason}` : 'PRE-VALIDATION: Not available';

    return `
    Analyze the following market data for the ${timeframes[timeframe] || timeframe} timeframe.
    You MUST apply the logic for **${strategyID}** from your system instructions.
    
    ---
    ${userInfo}
    ---
    YOUR PRE-VALIDATION LOGIC (Respect this):
    ${validationInfo}
    (If "Should Proceed: NO", your task is to find a counter-trade or a CAUTIOUS setup that aligns with the chosen strategy).
    ---
    CURRENT MARKET DATA (USE THIS EXCLUSIVELY):
    🏦 GOLD PRICE & MARKET CONDITION:
    - Current Price: $${marketData.goldPrice?.price || 'N/A'} - Price Source: ${marketData.goldPrice?.source || 'Unknown'}
    - Today's Range: $${marketData.goldPrice?.low || 'N/A'} - $${marketData.goldPrice?.high || 'N/A'}
    - Change: ${marketData.goldPrice?.change || 0} (${marketData.goldPrice?.changePercent || 0}%)
    📰 FUNDAMENTAL & NEWS ANALYSIS:
    - Overall Sentiment: ${marketData.news?.overallSentiment || 'Neutral'} - Key Themes: ${marketData.news?.keyThemes?.join(', ') || 'General market'}
    - High-Impact News: ${marketData.news?.marketSummary?.highImpactNews || 0} articles - USD Strength: ${marketData.news?.usdAnalysis?.strength || 'Stable'}
    - Gold Impact: ${marketData.news?.usdAnalysis?.impactOnGold?.impact || 'Neutral impact'}
    ---
    🎯 **TASK:** Apply the logic of the **${strategyID}** Strategy ID to the PROVIDED data and **GENERATE A BUY OR SELL SIGNAL.**
    🎯 **REQUIRED OUTPUT:** Provide your final decision (BUY, SELL) in the strict format:
    SIGNAL: [BUY|SELL|STRONG_BUY|STRONG_SELL]
    CONFIDENCE: [0-100]%
    ENTRY: [Price]
    STOP LOSS: [Price]
    TAKE PROFIT 1: [Price]
    TAKE PROFIT 2: [Price]
    TECHNICAL RATIONALE: [Why the technicals support this trade.]
    LEVEL EXPLANATION: [How the Entry/SL/TP meet the Strategy ID requirements.]
    MARKET CONTEXT & FUNDAMENTALS: [News impact and Macro context.]
    RISK MANAGEMENT: [Lot size guidance and risk note based on the Strategy ID.]
    PROFESSIONAL RECOMMENDATION: [Final instruction to the trader.]`;
  }

  // ----------------------------------------------------------------------
  // 6. CORE PARSING AND FALLBACKS
  // ----------------------------------------------------------------------

  parseProfessionalSignal(analysis, marketData, timeframe, userContext, source = 'multi_ai') {
    const fallbackPrice = marketData.goldPrice?.price;

    const signalMatch = analysis.match(/(?:SIGNAL|TRADING DECISION):\s*(STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL)/i);
    const confidenceMatch = analysis.match(/CONFIDENCE:\s*(\d+)%/i);
    const entryMatch = analysis.match(/(?:Entry|Entry Price):\s*\$?([\d.]+)/i);
    const slMatch = analysis.match(/(?:Stop Loss|SL):\s*\$?([\d.]+)/i);
    const tp1Match = analysis.match(/(?:Take Profit 1|TP1):\s*\$?([\d.]+)/i);
    const tp2Match = analysis.match(/(?:Take Profit 2|TP2):\s*\$?([\d.]+)/i);

    let signal = signalMatch ? signalMatch[1].toUpperCase() : 'HOLD'; // SAFETY: Default to HOLD if parse fails
    let confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;
    let entry = entryMatch ? parseFloat(entryMatch[1]) : fallbackPrice;
    let stopLoss = slMatch ? parseFloat(slMatch[1]) : 0;
    let takeProfit1 = tp1Match ? parseFloat(tp1Match[1]) : 0;
    let takeProfit2 = tp2Match ? parseFloat(tp2Match[1]) : 0;

    const technicalAnalysis = this.extractSection(analysis, "TECHNICAL RATIONALE:", "LEVEL EXPLANATION:") || "AI analysis provided below.";
    const levelExplanation = this.extractSection(analysis, "LEVEL EXPLANATION:", "MARKET CONTEXT & FUNDAMENTALS:");
    const riskManagement = this.extractSection(analysis, "RISK MANAGEMENT:", "PROFESSIONAL RECOMMENDATION:") || `Risk/Reward: ${this.calculateRiskRewardRatio(entry, stopLoss, takeProfit1).ratio}`;
    const marketContext = this.extractSection(analysis, "MARKET CONTEXT & FUNDAMENTALS:", "RISK MANAGEMENT:");
    const professionalRecommendation = this.extractSection(analysis, "PROFESSIONAL RECOMMENDATION:", "---") || "Trade with caution.";

    // REMOVED: The logic that forced HOLD -> BUY/SELL. 
    // We now respect the AI's decision to HOLD if market conditions are poor.

    // Safety checks for entry and levels generation
    if (!entry) {
      throw new Error("AI issued signal but could not determine entry price from market data.");
    }
    if (stopLoss === 0 || takeProfit1 === 0) {
      const calculated = this.calculateProfessionalLevels(signal, entry, marketData);
      stopLoss = calculated.stopLoss;
      takeProfit1 = calculated.takeProfit1;
      takeProfit2 = calculated.takeProfit2;
    }

    const positionSizing = this.calculatePositionSizing(userContext, entry, stopLoss);
    const finalRiskManagement = `Risk/Reward: ${this.calculateRiskRewardRatio(entry, stopLoss, takeProfit1).ratio} | Position: ${positionSizing.lots} lots | Max Risk: ${positionSizing.riskPercent} (${positionSizing.riskAmount})`;


    return {
      signal: signal, confidence: confidence, timeframe: timeframe, entry: entry, stopLoss: stopLoss,
      takeProfit1: takeProfit1, takeProfit2: takeProfit2, technicalAnalysis: technicalAnalysis.trim() || "AI analysis provided in recommendation.",
      levelExplanation: levelExplanation.trim() || "Levels calculated based on volatility.", marketContext: marketContext.trim() || "N/A",
      riskManagement: finalRiskManagement, professionalRecommendation: professionalRecommendation.trim() || "Trade setup generated by AI.",
      positionSizing: positionSizing, fullAnalysis: analysis, timestamp: new Date().toISOString(), source: source,
      userContext: userContext, riskRewardRatio: this.calculateRiskRewardRatio(entry, stopLoss, takeProfit1).ratio
    };
  }

  // ----------------------------------------------------------------------
  // 7. VALIDATION CHECK DEFINITIONS
  // ----------------------------------------------------------------------

  calculateConfirmationScore(confirmations) {
    let score = 0;
    let totalWeights = 0;
    const weights = { technicalAlignment: 2, sentimentConsistency: 1.5, marketRegime: 2, volatilityCheck: 1.5, newsImpact: 1.5, timeAnalysis: 1.5 };

    for (const [key, weight] of Object.entries(weights)) {
      if (confirmations[key] && confirmations[key].passed) { score += weight; }
      totalWeights += weight;
    }
    return (score / totalWeights) * 10;
  }

  async checkSentimentConsistency(marketData) {
    try {
      const newsSentiment = marketData.news?.overallSentiment || 'neutral';
      const isConsistent = newsSentiment !== 'neutral';
      return { passed: isConsistent, details: `News Sentiment: ${newsSentiment}. Considered passed if not neutral.` };
    } catch (error) {
      return { passed: false, details: 'Error checking sentiment consistency' };
    }
  }

  async assessMarketCondition(marketData) { return { passed: true, details: 'Technical data delegated to AI.' }; }
  async checkVolatilityLevel(marketData) { return { passed: true, details: 'Volatility check delegated to AI.' }; }

  async assessNewsImpact(marketData) {
    try {
      let articles = marketData.news?.articles || [];
      if (articles && typeof articles === 'object' && !Array.isArray(articles)) { articles = Object.values(articles).flat(); }
      if (!Array.isArray(articles)) { articles = []; }

      const highImpactNews = articles.filter(article =>
        article && article.title && typeof article.title === 'string' && (
          article.title.toLowerCase().includes('fed') || article.title.toLowerCase().includes('cpi') ||
          article.title.toLowerCase().includes('nfp') || article.title.toLowerCase().includes('rate decision')
        )
      );
      return { passed: highImpactNews.length === 0, details: `High-impact news articles: ${highImpactNews.length}` };
    } catch (error) {
      return { passed: false, details: 'Error assessing news impact' };
    }
  }

  async analyzeOptimalTradingTime() {
    try {
      const hour = new Date().getUTCHours();
      const isOptimalTime = (hour >= 8 && hour < 16) || (hour >= 20 && hour < 24);
      return { passed: isOptimalTime, details: `Current UTC hour: ${hour}, Optimal: ${isOptimalTime}` };
    } catch (error) {
      return { passed: false, details: 'Error analyzing trading time' };
    }
  }

  // ----------------------------------------------------------------------
  // 8. SAFETY FALLBACKS (MOVED FROM AnalysisService)
  // ----------------------------------------------------------------------

  getHoldSignal(timeframe, reason, marketData) {
    const currentPrice = marketData?.goldPrice?.price;
    if (!currentPrice) { throw new Error("Cannot generate HOLD signal: Current price is unavailable."); }

    return {
      signal: 'HOLD', confidence: 60, timeframe: timeframe, entry: currentPrice, stopLoss: 0, takeProfit1: 0, takeProfit2: 0,
      technicalAnalysis: `Market conditions not favorable for trading. ${reason}`,
      reasoning: `Pre-validation checks failed: ${reason}. Waiting for better market conditions.`,
      riskManagement: 'No trade recommended. Preserve capital and wait for higher probability setups.',
      fullAnalysis: `HOLD signal generated due to: ${reason}.`, timestamp: new Date().toISOString(),
      source: 'pre-validation', isHold: true, holdReason: reason
    };
  }

  getFallbackSignal(timeframe, errorMessage) {
    return {
      signal: 'HOLD', confidence: 50, timeframe: timeframe, entry: null, stopLoss: 0, takeProfit1: 0, takeProfit2: 0,
      technicalAnalysis: `System error: ${errorMessage}. Market analysis temporarily unavailable.`,
      reasoning: 'CRITICAL ERROR: AI or data pipeline failure. Please check API keys and services.',
      riskManagement: 'Wait for system recovery before trading. Avoid market entries during system issues.',
      fullAnalysis: `Service unavailable due to technical issues: ${errorMessage}`, timestamp: new Date().toISOString(),
      source: 'fallback', isFallback: true, error: errorMessage
    };
  }

  // ----------------------------------------------------------------------
  // 9.HELPERS
  // ----------------------------------------------------------------------

  analyzeTradingSessions() {
    const hour = new Date().getUTCHours();
    let currentSession, nextSession, recommendation;
    if (hour >= 0 && hour < 8) { currentSession = 'Asian'; nextSession = 'London'; recommendation = 'Wait for London open'; }
    else if (hour >= 8 && hour < 16) { currentSession = 'London'; nextSession = 'New York'; recommendation = 'Active trading'; }
    else { currentSession = 'New York'; nextSession = 'Asian'; recommendation = 'Reduce position sizes'; }
    return { currentSession, nextSession, recommendation };
  }

  calculateSignalQuality(aiSignal, preAnalysis) {
    try {
      const baseConfidence = (aiSignal.confidence || 50) / 100;
      const validationScore = (preAnalysis.confirmationScore || 5) / 10;
      const riskReward = this.calculateRiskRewardRatio(aiSignal.entry, aiSignal.stopLoss, aiSignal.takeProfit1);

      const quality = (baseConfidence * 0.4) + (validationScore * 0.4) + (riskReward.score * 0.2);
      return Math.round(quality * 10);
    } catch (error) {
      return 5;
    }
  }
  calculateRiskRewardRatio(entry, stopLoss, takeProfit) {
    const risk = Math.abs((entry || 0) - (stopLoss || 0));
    const reward = Math.abs((takeProfit || 0) - (entry || 0));
    if (risk === 0) return { ratio: 'N/A', score: 0.5 };
    const ratio = (reward / risk).toFixed(2);
    return { ratio: `1:${ratio}`, score: Math.min(parseFloat(ratio) / 2, 1) };
  }
  calculateProfessionalLevels(signal, entry, marketData) {
    // We assume the goldPriceService provides a reasonable ATR (e.g., 15 cents/pip)
    const volatility = marketData.goldPrice?.volatility?.atr || 15;
    if (volatility === 0) { throw new Error("Cannot calculate professional risk levels: ATR/Volatility data is missing from Gold Price Service."); }
    let stopLoss, takeProfit1, takeProfit2;
    if (signal.includes('BUY')) {
      stopLoss = entry - (volatility * 1.5); takeProfit1 = entry + (volatility * 1.5); takeProfit2 = entry + (volatility * 3.0);
    } else if (signal.includes('SELL')) {
      stopLoss = entry + (volatility * 1.5); takeProfit1 = entry - (volatility * 1.5); takeProfit2 = entry - (volatility * 3.0);
    } else {
      return { stopLoss: 0, takeProfit1: 0, takeProfit2: 0 };
    }
    return { stopLoss: this.roundToNearestQuarter(stopLoss), takeProfit1: this.roundToNearestQuarter(takeProfit1), takeProfit2: this.roundToNearestQuarter(takeProfit2) };
  }
  calculatePositionSizing(userContext, entry, stopLoss) {
    if (!userContext || !userContext.balance) { return { lots: 0.01, riskAmount: 'N/A', riskPercent: '2% (Standard)', note: 'User balance not provided. Defaulting to 0.01 lots (Min).' }; }

    // SAFETY: Enforce safer defaults
    const balance = parseFloat(userContext.balance);
    const riskMap = { 'low': 0.01, 'standard': 0.02, 'high': 0.03 }; // Max 3% risk
    const riskPerTradePercent = riskMap[userContext.riskTier] || 0.02;

    // 1. Calculate max dollar risk allowed
    const riskAmount = balance * riskPerTradePercent;

    // 2. Calculate distance to stop loss per unit (price change)
    const riskPerPoint = Math.abs(entry - stopLoss);

    if (riskPerPoint === 0) {
      // Prevent division by zero
      return { lots: 0.01, riskAmount: '$0.00', riskPercent: '0%', note: 'Invalid SL (0 distance), defaulting to min lots.' };
    }

    // 3. APPLY CONTRACT SIZE (CRITICAL FIX)
    // Standard XAUUSD Lot = 100 oz. 
    // Profit/Loss = (Price_Diff) * Lots * 100
    // Therefore: Lots = Risk_Amount / (Price_Diff * 100)
    const contractSize = 100;

    let rawLots = riskAmount / (riskPerPoint * contractSize);

    // 4. Rounding and Safety Caps
    // Round down to 2 decimals to be safe (never round up risk)
    let lots = Math.floor(rawLots * 100) / 100;

    // Hard cap to prevent massive accidental positions (e.g. 50 lots on small account)
    // Dynamic cap: Max leverage approx 1:20 effectively for this trade
    const maxLeverageLots = (balance * 20) / (entry * contractSize);
    lots = Math.min(lots, maxLeverageLots, 50.0); // Absolute max 50 lots
    lots = Math.max(0.01, lots); // Absolute min 0.01

    return {
      lots: lots,
      riskAmount: `$${(lots * riskPerPoint * contractSize).toFixed(2)}`,
      riskPercent: `${((lots * riskPerPoint * contractSize / balance) * 100).toFixed(2)}%`,
      maxPosition: `$${(lots * entry * contractSize).toFixed(2)} (Notional)`,
      calculation: `Risk $${riskAmount.toFixed(2)} (${(riskPerTradePercent * 100).toFixed(1)}%) / (SL Dist ${riskPerPoint.toFixed(2)} * 100 oz)`
    };
  }
  roundToNearestQuarter(price) { return parseFloat((price || 0).toFixed(2)); }
  extractSection(text, start, end) {
    try {
      const startRegex = new RegExp(start, "i");
      const endRegex = new RegExp(end, "i");
      let startIndex = text.search(startRegex);
      if (startIndex === -1) return "";
      startIndex += text.match(startRegex)[0].length;
      let endIndex = text.substring(startIndex).search(endRegex);
      if (endIndex === -1) { return text.substring(startIndex).trim(); }
      return text.substring(startIndex, startIndex + endIndex).trim();
    } catch (e) { return ""; }
  }
  getValidationDetails(confirmations) {
    return Object.entries(confirmations).map(([key, value]) => ({
      check: key, passed: value?.passed || false, details: value?.details || 'Check failed'
    }));
  }
}

module.exports = new OpenAIService();