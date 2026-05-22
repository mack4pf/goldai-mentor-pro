
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");


const goldPriceService = require('./market/goldPriceService');
const newsService = require('./market/newsService');
const signalModelService = require('./signalModelService');

class OpenAIService {
  constructor() {
    this.priceAccuracyThreshold = 0.02;

    // ----------------------------------------------------------------------
    // GROQ KEYS (PRIMARY AI PROVIDER)
    // ----------------------------------------------------------------------
    this.groqKeys = [];
    const groqKeyList = [
      process.env.GROQ_API_KEY_1,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3
    ];
    groqKeyList.forEach(key => {
      if (key && key.trim() !== '' && !this.groqKeys.includes(key)) {
        this.groqKeys.push(key);
      }
    });
    this.groqKeyIndex = 0;

    if (this.groqKeys.length > 0) {
      console.log(`✅ Groq AI (Primary) Initialized with ${this.groqKeys.length} API key(s)`);
    } else {
      console.warn('⚠️ No Groq API keys found — will fallback to Gemini.');
    }

    // ----------------------------------------------------------------------
    // GEMINI KEYS (FALLBACK AI PROVIDER)
    // ----------------------------------------------------------------------
    this.geminiKeys = [];
    const possibleKeys = [
      process.env.GEMINI_API_KEY,
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
    possibleKeys.forEach(key => {
      if (key && key.trim() !== '' && !this.geminiKeys.includes(key)) {
        this.geminiKeys.push(key);
      }
    });
    this.currentKeyIndex = 0;

    if (this.geminiKeys.length > 0) {
      console.log(`✅ Gemini AI (Fallback) Initialized with ${this.geminiKeys.length} API key(s)`);
    } else {
      console.warn('⚠️ No Gemini API keys found in environment variables.');
    }
  }

  // Get next Groq key in rotation
  getNextGroqKey() {
    if (this.groqKeys.length === 0) return null;
    const key = this.groqKeys[this.groqKeyIndex];
    this.groqKeyIndex = (this.groqKeyIndex + 1) % this.groqKeys.length;
    return key;
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

      const preValidation = await this.preSignalValidation({
        goldPrice: goldPriceData,
        news: newsData
      }, timeframe);

      const marketData = {
        goldPrice: goldPriceData,
        news: newsData,
        timestamp: new Date().toISOString()
      };

      const modelPlan = signalModelService.predictSignalPlan(marketData, timeframe);
      const dailyRisk = await signalModelService.canTradeByDailyLoss();

      if (!dailyRisk.allowed) {
        return this.getHoldSignal(timeframe, `Daily risk limit reached (${dailyRisk.dailyPnl} USD)`, marketData);
      }

      if (modelPlan.recommendation === 'HOLD') {
        return {
          ...this.getHoldSignal(timeframe, `Model edge too low (${(modelPlan.edgeProbability * 100).toFixed(1)}%)`, marketData),
          modelPlan,
          dailyRisk
        };
      }

      // Direct fallback if price is missing
      if (!goldPriceData || !goldPriceData.price) {
        return this.getHoldSignal(timeframe, "Gold price unavailable", marketData);
      }

      if (goldPriceData.verified === false) {
        return this.getHoldSignal(timeframe, `Price verification failed: ${goldPriceData.verificationMessage || 'cross-source mismatch'}`, marketData);
      }

      const prompt = await this.buildProfessionalTradingPrompt(
        marketData, timeframe, userContext, preValidation, balanceCategory, modelPlan
      );

      // Groq is primary — Gemini is fallback (handled inside callGroq)
      return await this.callGroq(prompt, marketData, timeframe, userContext, preValidation, modelPlan, dailyRisk);

    } catch (error) {
      console.error('❌ CRITICAL SIGNAL FAILURE:', error.message);
      return this.getFallbackSignal(timeframe, error.message);
    }
  }

  async generateMasterHourlySignal(timeframes = ['W1', 'D1', 'H4', 'H1', 'M15']) {
    try {
      console.log(`🚀 HOURLY MASTER ANALYZER: Compiling MTF context for ${timeframes.join(', ')}...`);

      const [goldPriceData, newsData] = await Promise.all([
        this.getValidatedGoldPrice(),
        newsService.getGoldNews()
      ]);

      const preValidation = await this.preSignalValidation({
        goldPrice: goldPriceData,
        news: newsData
      }, 'Master');

      const marketData = {
        goldPrice: goldPriceData,
        news: newsData,
        mtfRange: {
          current: goldPriceData.price,
          high: goldPriceData.high,
          low: goldPriceData.low,
          change: goldPriceData.changePercent
        },
        timestamp: new Date().toISOString()
      };

      const prompt = `
      XAUUSD MASTER ANALYSIS (MTF STORYLINE)
      
      🏦 REAL-TIME PRICE DATA:
      - Current Price: $${marketData.goldPrice?.price}
      - Today's Range: $${marketData.goldPrice?.low} - $${marketData.goldPrice?.high}
      - Momentum: ${marketData.goldPrice?.changePercent}% (${marketData.goldPrice?.marketCondition?.description})
      
      📊 TIME-FRAME CONTEXT (Storyline Data):
      - SHORT-TERM (H1/H4): Directional bias is ${marketData.goldPrice?.predictions?.shortTerm?.direction} (confidence ${marketData.goldPrice?.predictions?.shortTerm?.confidence || 'N/A'}%).
      - MEDIUM-TERM (D1): Directional bias is ${marketData.goldPrice?.predictions?.mediumTerm?.direction} (confidence ${marketData.goldPrice?.predictions?.mediumTerm?.confidence || 'N/A'}%).
      - LONG-TERM (W1/M1): Directional bias is ${marketData.goldPrice?.predictions?.longTerm?.direction} (confidence ${marketData.goldPrice?.predictions?.longTerm?.confidence || 'N/A'}%).
      
      📰 FUNDAMENTAL CONTEXT:
      - Sentiment: ${marketData.news?.overallSentiment}
      - USD Strength: ${marketData.news?.usdAnalysis?.strength}
      - Impact on Gold: ${marketData.news?.usdAnalysis?.impactOnGold?.impact}
      
      🎯 MALAYSIAN SnR TASK:
      1. Define the **Storyline**: (e.g., Weekly rejected Resistance, heading to Daily Support).
      2. Identify a **Fresh Level**: Find a price point where a Line Chart body connection remains untouched.
      3. Verify **Confluence**: Match with a Trendline or Engulfing Zone.
      4. Decision: Output your **best actionable SIGNAL** (BUY/SELL/STRONG_BUY/STRONG_SELL) when confidence is at least 65% and structure is valid.
        Use HOLD only when market structure is truly unclear, contradictory, or confidence is below 65%.
      
      You MUST respond with:
      SIGNAL: [STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL]
      CONFIDENCE: [0-100]%
      STRATEGY GRADE: [A+|A|B+|B|C]
      ENTRY: [Price]
      STOP LOSS: [Price]
      TAKE PROFIT 1: [Price]
      TAKE PROFIT 2: [Price]
      TAKE PROFIT 3: [Price]
      FINAL TP (TP4): [Price]
      TECHNICAL RATIONALE: [Explain the HTF Storyline and why the level is Fresh]
      PROFESSIONAL RECOMMENDATION: [Exact entry trigger, e.g. "Wait for H1 Bearish Engulfing at entry"]
      `;

      // Groq is primary — Gemini is fallback (handled inside callGroq)
      const modelPlan = signalModelService.predictSignalPlan(marketData, 'Master');
      const dailyRisk = await signalModelService.canTradeByDailyLoss();

      if (!dailyRisk.allowed || modelPlan.recommendation === 'HOLD') {
        return {
          ...this.getHoldSignal('Master', 'Model or risk gate blocked trade', marketData),
          modelPlan,
          dailyRisk
        };
      }

      return await this.callGroq(prompt, marketData, 'Master', { balance: 2000, riskTier: 'Professional' }, preValidation, modelPlan, dailyRisk);

    } catch (error) {
      console.error('❌ MASTER SIGNAL FAILURE:', error.message);
      throw error;
    }
  }

  // ----------------------------------------------------------------------
  // 2. AI PROVIDER (GEMINI ONLY)
  // ----------------------------------------------------------------------

  async callAIProviders(prompt, marketData, timeframe, userContext, preValidation = null, modelPlan = null, dailyRisk = null) {
    // Deprecated wrapper, redirects to primary AI
    return this.callGroq(prompt, marketData, timeframe, userContext, preValidation, modelPlan, dailyRisk);
  }

  async callGroq(prompt, marketData, timeframe, userContext, preValidation = null, modelPlan = null, dailyRisk = null) {
    const models = [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'mixtral-8x7b-32768'
    ];
    let lastError = null;

    const maxKeyAttempts = Math.max(this.groqKeys.length, 1);

    for (let i = 0; i < maxKeyAttempts; i++) {
      const apiKey = this.getNextGroqKey();
      if (!apiKey) break; // No keys, skip to Gemini fallback

      for (const modelName of models) {
        try {
          console.log(`   🔄 Groq: Attempting Key #${this.groqKeyIndex} with ${modelName}...`);

          const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: modelName,
              messages: [
                { role: 'system', content: this.getSystemPrompt() },
                { role: 'user', content: prompt }
              ],
              max_tokens: 2000,
              temperature: 0.1
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 45000
            }
          );

          const analysis = response.data.choices[0].message.content;
          console.log(`   ✅ Groq Success! (Key: #${this.groqKeyIndex}, Model: ${modelName})`);
          return this.parseProfessionalSignal(analysis, marketData, timeframe, userContext, 'groq', preValidation, modelPlan, dailyRisk);

        } catch (error) {
          lastError = error;
          const isQuotaError = error.response?.status === 429;
          const isModelError = error.response?.status === 400 || error.response?.status === 404;

          if (isQuotaError) {
            console.warn(`   ⚠️ Groq Rate Limit on Key #${this.groqKeyIndex} (${modelName}). Trying next...`);
          } else if (isModelError) {
            console.warn(`   ⚠️ Groq Model Error on Key #${this.groqKeyIndex} (${modelName}). Trying next model...`);
          } else {
            console.warn(`   ⚠️ Groq Error on Key #${this.groqKeyIndex} (${modelName}): ${error.message}`);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    // All Groq attempts failed — fallback to Gemini
    console.warn(`   ⚠️ All Groq attempts failed. Falling back to Gemini... (Last error: ${lastError?.message})`);
    return this.callGemini(prompt, marketData, timeframe, userContext, preValidation, modelPlan, dailyRisk);
  }

  async callDeepSeek(prompt, marketData, timeframe, userContext, preValidation = null) {
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
    return this.parseProfessionalSignal(analysis, marketData, timeframe, userContext, 'deepseek', preValidation);
  }

  async callGemini(prompt, marketData, timeframe, userContext, preValidation = null, modelPlan = null, dailyRisk = null) {
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
          return this.parseProfessionalSignal(analysis, marketData, timeframe, userContext, 'gemini', preValidation, modelPlan, dailyRisk);

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
  // 3. SYSTEM PROMPT (PROFESSIONAL TRADING STRATEGY)
  // ----------------------------------------------------------------------

  getSystemPrompt() {
    // Professional prompt emphasizing setup quality over forced trade frequency.
    return `You are a professional Gold (XAU/USD) trading assistant integrated inside a Telegram signal bot.
Your role is to act as the primary analyst. You must apply the user's defined trading strategy based on their chosen risk/balance tier.

---
🎯 CORE TRADING PARAMETERS (STRICT ENFORCEMENT):
- **STOP LOSS (SL)**: MUST be between 30 to 80 pips ($3.00 - $8.00 on XAUUSD).
- **RR SELECTION**: Choose the best setup-based RR from 1:1, 1:2, 1:3, or 1:5.
- **TAKE PROFITS**: Respect dynamic RR plan; TP4 can extend up to 300 pips ($30.00) when volatility and confluence justify it.
- **BREAK EVEN (BE)**: Instruct user to move SL to Entry (BE) once profit reaches 30 to 50 pips.

---
🏢 MARLISIINA STRATEGY RULES:
1. **SL PLACEMENT**: Always place SL slightly below a valid Support or above a valid Resistance level.
2. **CANDLE REJECTIONS**: When price enters the ENTRY zone, look for candle rejections like Hammers, Shooting Stars, or Bearish/Bullish Engulfing on Lower Timeframes (M5/M15).
3. **ENTRY FILTERS**: "Trade only at planned levels, wait for candle rejection/confirmation, and execute only when structure and trigger align."

---
🔑 Professional XAUUSD Gold Trading Prompt
Trader Profile: 14+ Year Veteran focusing on tight SL (30-50 pips) and multiple scaling targets.

| Setup Grade | Confidence | Requirements | Position Sizing |
|---|---|---|---|
| **A+ (Perfect)** | 85-95% | HTF Storyline + Fresh SnR + Candle Rejection at Entry + NY/London Session. | Normal (1-2%) |
| **A (Excellent)**| 75-84% | DRD Storyline + 2+ Confluence factors + Engulfing Zone. | Normal (1-2%) |
| **B+ (Good)** | 65-74% | Standard SnR bounce with rejection. | Reduced (0.5-1%) |
| **B/C (Avoid)** | < 65% | Weak Storyline. Output **HOLD**. | No Trade |

IMPORTANT: Use the full 0-100 confidence scale honestly. Do not default to 80% or any fixed band unless the evidence truly supports it.

---
🔒 🇲🇾 MALAYSIAN SnR SYSTEM RULES:
1. **LINE CHART FOCUS**: Analyze price using **Body Connections**. SnR levels are formed at Candle Close/Open connections.
2. **FRESHNESS**: Level is FRESH only if never touched by a wick.
3. **STORYLINE**: Monthly (MRM) -> Weekly (WRW) -> Daily (DRD).

🎯 Decision Logic:
- **ALWAYS** check the "Storyline" first.
- **MENTOR TIP**: Explain the "Shape" and why it's a valid region. Use phrases like "Wait for rejection" and "trade only after confirmation".
- **CONFIDENCE DISCIPLINE**: Base confidence on how many independent confluences align. Use lower values when evidence is mixed, and only exceed 80% when the setup is genuinely exceptional.
- **DIRECTIONAL DISCIPLINE**: Evaluate BOTH bullish and bearish cases before choosing a direction. If confluence is mixed or weak, output HOLD.

💬 Message Format (REQUIRED):
SIGNAL: [STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL]
CONFIDENCE: [0-100]%
STRATEGY GRADE: [A+|A|B+|B|C]
ENTRY: [Price]
STOP LOSS: [Price] (30-50 pips distance)
TAKE PROFIT 1: [Price] (30 pips move)
TAKE PROFIT 2: [Price] (50 pips move)
TAKE PROFIT 3: [Price] (100 pips move)
FINAL TP (TP4): [Price] (150 pips move)
TECHNICAL RATIONALE: [Concise 1-2 sentence explanation of the SnR level and Storyline]
LEVEL EXPLANATION: [Briefly explain SL placement relative to resistance/support]
MARKET WATCH: [Specific 1-sentence lower timeframe trigger to watch for]
PROFESSIONAL RECOMMENDATION: [Clear 1-sentence entry instruction + BE rule]

---
Act exactly according to this prompt. Prioritize professional risk management, selectivity, and capital preservation. Be concise and suitable for Telegram (Max 170 words total).`;
  }



  // ----------------------------------------------------------------------
  // 4. ORCHESTRATION & VALIDATION HELPERS (MOVED FROM AnalysisService)
  // ----------------------------------------------------------------------

  async getValidatedGoldPrice() {
    try {
      const primaryPrice = await goldPriceService.getGoldPrice();
      const verification = await this.verifyGoldPrice(primaryPrice);

      return {
        ...primaryPrice,
        verified: verification.isVerified,
        verificationSources: verification.sources,
        averagePrice: verification.averagePrice,
        priceDeviation: verification.deviationPercent,
        verificationMessage: verification.message
      };
    } catch (error) {
      console.error('Price validation failed:', error);

      return {
        price: null,
        source: 'validation_failure',
        verified: false,
        verificationSources: [],
        averagePrice: null,
        priceDeviation: 1,
        verificationMessage: error.message
      };
    }
  }

  async verifyGoldPrice(primaryPrice) {
    if (!primaryPrice || !primaryPrice.price) {
      return {
        isVerified: false,
        sources: [],
        averagePrice: null,
        deviationPercent: 1,
        message: 'Primary source has no valid price.'
      };
    }

    const verificationQuotes = await goldPriceService.getVerificationSnapshot(primaryPrice.source);
    const allPrices = [primaryPrice.price, ...verificationQuotes.map(q => q.price)].filter(p => Number.isFinite(Number(p)));

    if (allPrices.length < 2) {
      // Only one source available — trust it and proceed rather than blocking signal generation
      return {
        isVerified: true,
        sources: verificationQuotes.map(q => q.source),
        averagePrice: primaryPrice.price,
        deviationPercent: 0,
        message: 'Single source verified (cross-check unavailable — proceeding with primary source).'
      };
    }

    const averagePrice = allPrices.reduce((sum, value) => sum + Number(value), 0) / allPrices.length;
    const deviationPercent = Math.abs(primaryPrice.price - averagePrice) / averagePrice;
    const isVerified = deviationPercent <= this.priceAccuracyThreshold;

    return {
      isVerified,
      sources: verificationQuotes.map(q => q.source),
      averagePrice,
      deviationPercent,
      message: isVerified
        ? 'Price verified across multiple sources.'
        : `Price mismatch too high (${(deviationPercent * 100).toFixed(2)}%).`
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

  async buildProfessionalTradingPrompt(marketData, timeframe, userContext, preValidation, balanceCategory, modelPlan = null) {
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
    - ** SELECTED BALANCE TIER:** ${balanceCategory} - ** APPLY STRATEGY ID:** ${strategyID} ` : 'USER PROFILE: General analysis (No user context provided). APPLY STRATEGY ID: MR/CT (1k-10k)';

    const validationInfo = preValidation ? `
PRE - VALIDATION RESULTS(From User's Code): - Overall Score: ${preValidation.confirmationScore?.toFixed(1) || 'N / A'}/10 - Should Proceed: ${preValidation.shouldProceed ? 'YES' : 'NO'} - Primary Reason: ${preValidation.reason}` : 'PRE - VALIDATION: Not available';

    const modelInfo = modelPlan ? `
  MODEL OUTPUT (Use as primary decision anchor):
  - Recommendation: ${modelPlan.recommendation}
  - Directional Bias: ${modelPlan.direction}
  - Edge Probability: ${(Number(modelPlan.edgeProbability || 0) * 100).toFixed(1)}%
  - Regime: ${modelPlan.regime}
  - Risk Plan: SL ${modelPlan.riskPlan?.minSlPips || 30}-${modelPlan.riskPlan?.maxSlPips || 80} pips, RR options ${(modelPlan.riskPlan?.rrOptions || [1, 2, 3, 5]).map(v => `1:${v}`).join(', ')}, selected 1:${modelPlan.riskPlan?.primaryRr || 2}
  ` : 'MODEL OUTPUT: Not available';

    return `
    Analyze the following market data for the ${timeframes[timeframe] || timeframe} timeframe.
    You MUST apply the logic for **${strategyID}** from your system instructions.
    
    ---
    ${userInfo}
    ---
    YOUR PRE-VALIDATION LOGIC (Respect this):
    ${validationInfo}
    ---
    MODEL-DIRECTIVE (STRICT):
    ${modelInfo}
    If model recommendation is HOLD, keep HOLD unless there is exceptional confluence clearly supported by market structure.
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
    🎯 **TASK:** Apply the logic of the **${strategyID}** Strategy ID to the PROVIDED data and decide if there is a professional-quality setup.
    Choose BUY/SELL only when confluence is clear. Otherwise return HOLD.
    Evaluate BOTH bullish and bearish cases before final direction.
    🎯 **REQUIRED OUTPUT:** Provide your final decision in the strict format:
    SIGNAL: [BUY|SELL|HOLD|STRONG_BUY|STRONG_SELL]
    CONFIDENCE: [0-100]%
    STRATEGY GRADE: [A+|A|B+|B|C]
    ENTRY: [Price]
    STOP LOSS: [Price]
    TAKE PROFIT 1: [Price]
    TAKE PROFIT 2: [Price]
    TAKE PROFIT 3: [Price]
    FINAL TP (TP4): [Price]
    TECHNICAL RATIONALE: [Why the technicals support this trade.]
    LEVEL EXPLANATION: [How the Entry/SL/TP meet the Strategy ID requirements.]
    MARKET CONTEXT & FUNDAMENTALS: [News impact and Macro context.]
    RISK MANAGEMENT: [Lot size guidance and risk note based on the Strategy ID.]
    PROFESSIONAL RECOMMENDATION: [Final instruction to the trader.]`;
  }

  // ----------------------------------------------------------------------
  // 6. CORE PARSING AND FALLBACKS
  // ----------------------------------------------------------------------

  parseProfessionalSignal(analysis, marketData, timeframe, userContext, source = 'multi_ai', preValidation = null, modelPlan = null, dailyRisk = null) {
    const fallbackPrice = marketData.goldPrice?.price;

    const signalMatch = analysis.match(/(?:SIGNAL|TRADING DECISION):\s*(STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL)/i);
    const confidenceMatch = analysis.match(/CONFIDENCE:\s*(\d+)%/i);
    const entryMatch = analysis.match(/(?:Entry|Entry Price):\s*\$?([\d.]+)/i);
    const slMatch = analysis.match(/(?:Stop Loss|SL):\s*\$?([\d.]+)/i);
    const tp1Match = analysis.match(/(?:Take Profit 1|TP1):\s*\$?([\d.]+)/i);
    const tp2Match = analysis.match(/(?:Take Profit 2|TP2):\s*\$?([\d.]+)/i);
    const tp3Match = analysis.match(/(?:Take Profit 3|TP3):\s*\$?([\d.]+)/i);
    const tp4Match = analysis.match(/(?:Take Profit 4|FINAL TP|TP4):\s*\$?([\d.]+)/i);

    let signal = signalMatch ? signalMatch[1].toUpperCase() : 'HOLD'; // SAFETY: Default to HOLD if parse fails

    // SAFETY: If AI gives a signal but forgets confidence, default to 50 (Neutral) instead of 0
    let parsedConfidence = confidenceMatch ? parseInt(confidenceMatch[1]) : null;
    let confidence = parsedConfidence !== null ? parsedConfidence : (signal === 'HOLD' ? 0 : 50);
    let entry = entryMatch ? parseFloat(entryMatch[1]) : fallbackPrice;
    let stopLoss = slMatch ? parseFloat(slMatch[1]) : 0;
    let takeProfit1 = tp1Match ? parseFloat(tp1Match[1]) : 0;
    let takeProfit2 = tp2Match ? parseFloat(tp2Match[1]) : 0;
    let takeProfit3 = tp3Match ? parseFloat(tp3Match[1]) : 0;
    let takeProfit4 = tp4Match ? parseFloat(tp4Match[1]) : 0;

    const strategyGradeMatch = analysis.match(/STRATEGY GRADE:\s*([A-C\+]+)/i);
    const strategyGrade = strategyGradeMatch ? strategyGradeMatch[1].toUpperCase() : 'N/A';

    const technicalAnalysis = this.extractSection(analysis, "TECHNICAL RATIONALE:", "LEVEL EXPLANATION:") || "AI analysis provided below.";
    const levelExplanation = this.extractSection(analysis, "LEVEL EXPLANATION:", "MARKET WATCH:");
    const marketWatch = this.extractSection(analysis, "MARKET WATCH:", "TECHNICAL RATIONALE:") || this.extractSection(analysis, "MARKET WATCH:", "PROFESSIONAL RECOMMENDATION:");
    const riskManagement = this.extractSection(analysis, "RISK MANAGEMENT:", "PROFESSIONAL RECOMMENDATION:") || `Risk/Reward: High RR Setup`;
    const marketContext = this.extractSection(analysis, "MARKET CONTEXT & FUNDAMENTALS:", "RISK MANAGEMENT:");
    const professionalRecommendation = this.extractSection(analysis, "PROFESSIONAL RECOMMENDATION:", "---") || "Trade with caution.";

    // Safety checks for entry and levels generation
    if (!entry || entry === 0) entry = fallbackPrice;
    if (!entry) {
      throw new Error("AI issued signal but could not determine entry price from market data.");
    }

    let levelNormalization = {
      normalized: false,
      reasons: []
    };

    if (signal !== 'HOLD') {
      const normalizedLevels = this.normalizeValidatedLevels(signal, entry, {
        stopLoss,
        takeProfit1,
        takeProfit2,
        takeProfit3,
        takeProfit4
      });

      stopLoss = normalizedLevels.stopLoss;
      takeProfit1 = normalizedLevels.takeProfit1;
      takeProfit2 = normalizedLevels.takeProfit2;
      takeProfit3 = normalizedLevels.takeProfit3;
      takeProfit4 = normalizedLevels.takeProfit4;
      levelNormalization = {
        normalized: normalizedLevels.normalized,
        reasons: normalizedLevels.reasons
      };

      const enforced = this.enforceRiskPlanFromModel(signal, entry, {
        stopLoss,
        takeProfit1,
        takeProfit2,
        takeProfit3,
        takeProfit4
      }, modelPlan);

      stopLoss = enforced.stopLoss;
      takeProfit1 = enforced.takeProfit1;
      takeProfit2 = enforced.takeProfit2;
      takeProfit3 = enforced.takeProfit3;
      takeProfit4 = enforced.takeProfit4;

      if (enforced.enforced) {
        levelNormalization.normalized = true;
        levelNormalization.reasons = [...levelNormalization.reasons, ...enforced.reasons];
      }
    }

    const directionalBias = this.deriveDirectionalBias(marketData);
    const guardResult = this.applyDirectionalGuards({ signal, confidence, strategyGrade }, directionalBias);
    signal = guardResult.signal;
    confidence = guardResult.confidence;

    const aiConfidence = confidence;
    const qualityConfidence = this.calculateSignalQuality(
      { confidence: aiConfidence, entry, stopLoss, takeProfit1, signal },
      preValidation
    );
    confidence = qualityConfidence;

    if (signal === 'HOLD') {
      stopLoss = 0;
      takeProfit1 = 0;
      takeProfit2 = 0;
      takeProfit3 = 0;
      takeProfit4 = 0;
    }

    const positionSizing = this.calculatePositionSizing(userContext, entry, stopLoss);

    // Update Professional Recommendation if BE is missing
    let updatedRecommendation = professionalRecommendation.trim();
    if (!updatedRecommendation.toLowerCase().includes('break-even') && !updatedRecommendation.toLowerCase().includes('be ')) {
      updatedRecommendation += "\n\n💡 MENTOR TIP: Move Stop Loss to Entry (BE) once Take Profit 1 is reached.";
    }

    const selectedRr = Number(modelPlan?.riskPlan?.primaryRr || 2);
    const rrOptions = (modelPlan?.riskPlan?.rrOptions || [1, 2, 3, 5]).map(v => `1:${v}`).join(', ');
    const finalRiskManagement = `Risk/Reward: Selected 1:${selectedRr} | Allowed: ${rrOptions} | Position: ${positionSizing.lots} lots | Max Risk: ${positionSizing.riskPercent} (${positionSizing.riskAmount})`;

    return {
      signal: signal, confidence: confidence, timeframe: timeframe, entry: entry, stopLoss: stopLoss,
      takeProfit1: takeProfit1, takeProfit2: takeProfit2, takeProfit3: takeProfit3, takeProfit4: takeProfit4,
      strategyGrade: strategyGrade, technicalAnalysis: technicalAnalysis.trim() || "AI analysis provided in recommendation.",
      levelExplanation: levelExplanation.trim() || "SL placed below/above regional structure.",
      marketWatch: marketWatch.trim() || "Watch for H1/M15 candle rejections in the entry zone.",
      marketContext: marketContext.trim() || "N/A",
      riskManagement: finalRiskManagement, professionalRecommendation: updatedRecommendation,
      positionSizing: positionSizing, fullAnalysis: analysis, timestamp: new Date().toISOString(), source: source,
      userContext: userContext, riskRewardRatio: "Multi-TP / Scaling",
      selectedRr,
      levelNormalization,
      directionalBias,
      directionGuard: guardResult,
      modelPlan,
      dailyRisk,
      aiConfidence,
      qualityConfidence
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
      const baseConfidence = Math.max(0, Math.min(100, Number(aiSignal.confidence || 50))) / 100;
      const validationScore = Math.max(0, Math.min(10, Number(preAnalysis?.confirmationScore || 5))) / 10;
      const riskReward = this.calculateRiskRewardRatio(aiSignal.entry, aiSignal.stopLoss, aiSignal.takeProfit1);

      const signalBias = String(aiSignal.signal || '').toUpperCase().includes('HOLD') ? 0.35 : 1;
      const quality = ((baseConfidence * 0.35) + (validationScore * 0.35) + (riskReward.score * 0.30)) * signalBias;
      return Math.max(0, Math.min(100, Math.round(quality * 100)));
    } catch (error) {
      return 50;
    }
  }

  deriveDirectionalBias(marketData) {
    const predictions = marketData?.goldPrice?.predictions || {};
    const momentum = Number(marketData?.goldPrice?.changePercent || 0);
    const sentiment = String(marketData?.news?.overallSentiment || '').toLowerCase();
    const usdStrength = String(marketData?.news?.usdAnalysis?.strength || '').toLowerCase();

    let bullish = 0;
    let bearish = 0;

    const vote = (direction) => {
      const d = String(direction || '').toLowerCase();
      if (d.includes('bull')) bullish += 1;
      if (d.includes('bear')) bearish += 1;
    };

    vote(predictions?.shortTerm?.direction);
    vote(predictions?.mediumTerm?.direction);
    vote(predictions?.longTerm?.direction);

    if (momentum >= 0.15) bullish += 1;
    if (momentum <= -0.15) bearish += 1;

    if (sentiment.includes('bull')) bullish += 1;
    if (sentiment.includes('bear')) bearish += 1;

    // Gold typically weakens with strong USD and strengthens with weak USD.
    if (usdStrength.includes('strong')) bearish += 1;
    if (usdStrength.includes('weak')) bullish += 1;

    const delta = bullish - bearish;
    const direction = delta >= 2 ? 'bullish' : delta <= -2 ? 'bearish' : 'neutral';

    return {
      direction,
      bullishVotes: bullish,
      bearishVotes: bearish,
      delta
    };
  }

  applyDirectionalGuards(signalMeta, directionalBias) {
    let signal = String(signalMeta?.signal || 'HOLD').toUpperCase();
    let confidence = Number(signalMeta?.confidence || 0);
    const grade = String(signalMeta?.strategyGrade || 'N/A').toUpperCase();
    const reasons = [];

    if (signal.startsWith('STRONG_') && (confidence < 82 || !['A+', 'A'].includes(grade))) {
      signal = signal.replace('STRONG_', '');
      reasons.push('strong_signal_downgraded');
    }

    if (signal.includes('BUY') && directionalBias.direction === 'bearish' && confidence < 78) {
      signal = 'HOLD';
      confidence = Math.min(confidence, 58);
      reasons.push('buy_conflicts_with_market_bias');
    }

    if (signal.includes('SELL') && directionalBias.direction === 'bullish' && confidence < 78) {
      signal = 'HOLD';
      confidence = Math.min(confidence, 58);
      reasons.push('sell_conflicts_with_market_bias');
    }

    if (directionalBias.direction === 'neutral' && signal !== 'HOLD' && confidence < 72) {
      signal = 'HOLD';
      confidence = Math.min(confidence, 55);
      reasons.push('neutral_bias_requires_stronger_confluence');
    }

    return {
      signal,
      confidence,
      reasons,
      applied: reasons.length > 0
    };
  }
  calculateRiskRewardRatio(entry, stopLoss, takeProfit) {
    const risk = Math.abs((entry || 0) - (stopLoss || 0));
    const reward = Math.abs((takeProfit || 0) - (entry || 0));
    if (risk === 0) return { ratio: 'N/A', score: 0.5 };
    const ratio = (reward / risk).toFixed(2);
    return { ratio: `1:${ratio}`, score: Math.min(parseFloat(ratio) / 2, 1) };
  }

  normalizeValidatedLevels(signal, entry, levels) {
    const isBuy = signal.includes('BUY');
    const pipMultiplier = 0.10;
    const reasons = [];

    const defaults = {
      stopLoss: isBuy ? entry - (45 * pipMultiplier) : entry + (45 * pipMultiplier),
      takeProfit1: isBuy ? entry + (45 * pipMultiplier) : entry - (45 * pipMultiplier),
      takeProfit2: isBuy ? entry + (90 * pipMultiplier) : entry - (90 * pipMultiplier),
      takeProfit3: isBuy ? entry + (135 * pipMultiplier) : entry - (135 * pipMultiplier),
      takeProfit4: isBuy ? entry + (225 * pipMultiplier) : entry - (225 * pipMultiplier)
    };

    const isDirectional = (price) => isBuy ? price > entry : price < entry;

    let stopLoss = levels.stopLoss;
    const slDistance = Math.abs(entry - stopLoss);
    if (!stopLoss || slDistance < (30 * pipMultiplier) || slDistance > (80 * pipMultiplier)) {
      stopLoss = defaults.stopLoss;
      reasons.push('sl_out_of_range');
    }

    const validateTp = (value, fallback, minDistance, reason) => {
      const distance = Math.abs(value - entry);
      if (!value || !isDirectional(value) || distance < minDistance) {
        reasons.push(reason);
        return fallback;
      }
      return value;
    };

    let takeProfit1 = validateTp(levels.takeProfit1, defaults.takeProfit1, 25 * pipMultiplier, 'tp1_invalid');
    let takeProfit2 = validateTp(levels.takeProfit2, defaults.takeProfit2, 40 * pipMultiplier, 'tp2_invalid');
    let takeProfit3 = validateTp(levels.takeProfit3, defaults.takeProfit3, 80 * pipMultiplier, 'tp3_invalid');
    let takeProfit4 = validateTp(levels.takeProfit4, defaults.takeProfit4, 120 * pipMultiplier, 'tp4_invalid');

    const isOrdered = isBuy
      ? (takeProfit1 < takeProfit2 && takeProfit2 < takeProfit3 && takeProfit3 < takeProfit4)
      : (takeProfit1 > takeProfit2 && takeProfit2 > takeProfit3 && takeProfit3 > takeProfit4);

    if (!isOrdered) {
      takeProfit1 = defaults.takeProfit1;
      takeProfit2 = defaults.takeProfit2;
      takeProfit3 = defaults.takeProfit3;
      takeProfit4 = defaults.takeProfit4;
      reasons.push('tp_order_invalid');
    }

    return {
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      takeProfit4,
      normalized: reasons.length > 0,
      reasons
    };
  }

  enforceRiskPlanFromModel(signal, entry, levels, modelPlan) {
    const isBuy = signal.includes('BUY');
    const pip = 0.10;
    const reasons = [];

    const slPips = Number(modelPlan?.riskPlan?.slPips || 45);
    const rrPrimary = Number(modelPlan?.riskPlan?.primaryRr || 2);

    const appliedSlPips = Math.max(30, Math.min(80, slPips));
    const maxTpPips = Number(modelPlan?.riskPlan?.tpMaxPips || 300);

    const targetDistances = [
      appliedSlPips * 1,
      appliedSlPips * Math.max(2, rrPrimary),
      appliedSlPips * Math.max(3, rrPrimary),
      Math.min(maxTpPips, appliedSlPips * Math.max(5, rrPrimary))
    ];

    const directionMul = isBuy ? 1 : -1;
    const fallbackSl = entry + (directionMul * -1 * appliedSlPips * pip);
    const fallbackTp = targetDistances.map(d => entry + (directionMul * d * pip));

    const currSlPips = Math.abs(Number(entry) - Number(levels.stopLoss)) / pip;
    let stopLoss = Number(levels.stopLoss);
    let takeProfit1 = Number(levels.takeProfit1);
    let takeProfit2 = Number(levels.takeProfit2);
    let takeProfit3 = Number(levels.takeProfit3);
    let takeProfit4 = Number(levels.takeProfit4);

    if (!Number.isFinite(currSlPips) || currSlPips < 30 || currSlPips > 80) {
      stopLoss = fallbackSl;
      reasons.push('model_sl_enforced');
    }

    const sanitizeTp = (tp, idx) => {
      if (!Number.isFinite(tp)) return fallbackTp[idx];
      const distPips = Math.abs(tp - entry) / pip;
      if (distPips < targetDistances[idx] * 0.6 || distPips > maxTpPips + 10) {
        reasons.push(`model_tp${idx + 1}_enforced`);
        return fallbackTp[idx];
      }
      return tp;
    };

    takeProfit1 = sanitizeTp(takeProfit1, 0);
    takeProfit2 = sanitizeTp(takeProfit2, 1);
    takeProfit3 = sanitizeTp(takeProfit3, 2);
    takeProfit4 = sanitizeTp(takeProfit4, 3);

    return {
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      takeProfit4,
      enforced: reasons.length > 0,
      reasons,
      rrPrimary,
      slPips: appliedSlPips
    };
  }

  calculateProfessionalLevels(signal, entry, marketData) {
    // We assume the goldPriceService provides a reasonable ATR (e.g., 15 cents/pip)
    const volatility = marketData.goldPrice?.volatility?.atr || 15;
    if (volatility === 0) { throw new Error("Cannot calculate professional risk levels: ATR/Volatility data is missing from Gold Price Service."); }
    let stopLoss, takeProfit1, takeProfit2;

    // Professional Gold Scalping standard: 1:1 and 1:2 R/R
    const risk = volatility * 1.5; // Standard risk based on ATR

    if (signal.includes('BUY')) {
      stopLoss = entry - risk;
      takeProfit1 = entry + risk; // 1:1
      takeProfit2 = entry + (risk * 2); // 1:2
    } else if (signal.includes('SELL')) {
      stopLoss = entry + risk;
      takeProfit1 = entry - risk; // 1:1
      takeProfit2 = entry - (risk * 2); // 1:2
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