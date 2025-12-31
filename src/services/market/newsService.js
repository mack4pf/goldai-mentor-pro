const axios = require('axios');

class NewsService {
  constructor() {

    this.newsAPIKey = process.env.NEWS_API_KEY;
    this.finnhubKey = process.env.FINNHUB_API_KEY;
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;


    this.gnewsKey = process.env.GNEWS_API_KEY;

  }

  async getGoldNews() {
    try {
      console.log('🟡 Fetching market news...');

      let newsData;


      if (this.newsAPIKey) {
        console.log('...using NewsAPI');
        newsData = await this.getEnhancedNewsAPI();
      } else if (this.finnhubKey) {
        console.log('...using Finnhub');
        newsData = await this.getEnhancedFinnhubNews();
      } else if (this.alphaVantageKey) {
        console.log('...using Alpha Vantage');
        newsData = await this.getAlphaVantageNews();
      } else {

        console.log('...No paid keys found. Using Enhanced Free News (Fallback).');
        newsData = await this.getEnhancedFreeNews();
      }

      console.log('✅ News fetched successfully');
      return newsData;

    } catch (error) {
      console.error('❌ Top-level News fetch failed:', error.message);
      return this.getFallbackNews();
    }
  }

  async getEnhancedNewsAPI() {

    const queries = [
      'gold OR XAUUSD OR "precious metals" OR "gold price"',
      'USD OR "US dollar" OR "dollar index" OR DXY OR "Federal Reserve" OR FOMC',
      'inflation OR "interest rates" OR "central bank" OR Fed OR CPI',
      'geopolitical OR "safe haven" OR "market turmoil" OR NFP'
    ];

    const allArticles = [];

    // OPTIMIZATION: Run queries in parallel to save time (Critical for Render 30s timeout)
    const promises = queries.map(query =>
      axios.get(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=5&apiKey=${this.newsAPIKey}`,
        { timeout: 8000 } // Reduced timeout per request
      ).then(response => {
        if (response.data.articles) {
          return response.data.articles.map(article => ({
            title: article.title,
            summary: article.description,
            source: article.source.name,
            url: article.url,
            publishedAt: article.publishedAt,
            sentiment: this.analyzeEnhancedSentiment(article.title + ' ' + article.description),
            category: this.categorizeArticle(article.title + ' ' + article.description),
            impact: this.assessImpactLevel(article.title + ' ' + article.description),
            query: query
          }));
        }
        return [];
      }).catch(err => {
        console.log(`Query failed: ${query}`, err.message);
        return [];
      })
    );

    const results = await Promise.all(promises);
    results.forEach(articles => allArticles.push(...articles));


    const uniqueArticles = this.removeDuplicates(allArticles).slice(0, 15);
    const categorizedArticles = this.categorizeArticles(uniqueArticles);

    return {
      articles: categorizedArticles,
      marketSummary: await this.generateMarketSummary(categorizedArticles),
      keyThemes: this.extractEnhancedKeyThemes(categorizedArticles),
      overallSentiment: this.calculateEnhancedSentiment(categorizedArticles),
      usdAnalysis: await this.analyzeUSDStrength(categorizedArticles),
      goldFundamentals: await this.analyzeGoldFundamentals(categorizedArticles),
      timestamp: new Date().toISOString(),
      source: 'newsapi_enhanced'
    };
  }

  async getEnhancedFinnhubNews() {
    const response = await axios.get(
      `https://finnhub.io/api/v1/news?category=general&token=${this.finnhubKey}`,
      { timeout: 10000 }
    );

    const relevantNews = response.data
      .filter(news => {
        const headline = news.headline.toLowerCase();
        return headline.includes('gold') ||
          headline.includes('xau') ||
          headline.includes('precious') ||
          headline.includes('fed') ||
          headline.includes('fomc') ||
          headline.includes('cpi') ||
          headline.includes('nfp') ||
          headline.includes('dollar') ||
          headline.includes('usd') ||
          headline.includes('inflation') ||
          headline.includes('rate') ||
          headline.includes('central bank') ||
          headline.includes('geopolitical')
      })
      .slice(0, 12)
      .map(article => ({
        title: article.headline,
        summary: article.summary,
        source: article.source,
        url: article.url,
        publishedAt: new Date(article.datetime * 1000).toISOString(),
        sentiment: this.analyzeEnhancedSentiment(article.headline + ' ' + article.summary),
        category: this.categorizeArticle(article.headline + ' ' + article.summary),
        impact: this.assessImpactLevel(article.headline + ' ' + article.summary)
      }));

    const categorizedArticles = this.categorizeArticles(relevantNews);

    return {
      articles: categorizedArticles,
      marketSummary: await this.generateMarketSummary(categorizedArticles),
      keyThemes: this.extractEnhancedKeyThemes(categorizedArticles),
      overallSentiment: this.calculateEnhancedSentiment(categorizedArticles),
      usdAnalysis: await this.analyzeUSDStrength(categorizedArticles),
      goldFundamentals: await this.analyzeGoldFundamentals(categorizedArticles),
      timestamp: new Date().toISOString(),
      source: 'finnhub_enhanced'
    };
  }

  async getAlphaVantageNews() {
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=USD,XAU&topics=economy_monetary,financial_markets&apikey=${this.alphaVantageKey}`,
      { timeout: 10000 }
    );

    if (!response.data || !response.data.feed) {
      console.warn('Alpha Vantage returned no news feed.');
      return this.getFallbackNews(); // or throw error
    }

    const articles = response.data.feed.slice(0, 10).map(article => ({
      title: article.title,
      summary: article.summary,
      source: article.source,
      url: article.url,
      publishedAt: article.time_published, // Format: 20240101T120000
      sentiment: article.overall_sentiment_label.toLowerCase(),
      category: this.categorizeArticle(article.title + ' ' + article.summary),
      impact: this.assessImpactLevel(article.title + ' ' + article.summary),
      ticker_sentiment: article.ticker_sentiment
    }));

    const categorizedArticles = this.categorizeArticles(articles);

    return {
      articles: categorizedArticles,
      marketSummary: await this.generateMarketSummary(categorizedArticles),
      keyThemes: this.extractEnhancedKeyThemes(categorizedArticles),
      overallSentiment: this.calculateEnhancedSentiment(categorizedArticles),
      usdAnalysis: await this.analyzeUSDStrength(categorizedArticles),
      goldFundamentals: await this.analyzeGoldFundamentals(categorizedArticles),
      timestamp: new Date().toISOString(),
      source: 'alphavantage'
    };
  }


  async getEnhancedFreeNews() {
    try {

      const sources = [
        this.getGNewsData(),
      ];

      const results = await Promise.allSettled(sources);
      let allArticles = [];

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allArticles = allArticles.concat(result.value);
        }
      });

      if (allArticles.length === 0) {
        console.warn('No articles returned from any free news source. Returning fallback.');
        return this.getFallbackNews();
      }

      const uniqueArticles = this.removeDuplicates(allArticles).slice(0, 12);
      const categorizedArticles = this.categorizeArticles(uniqueArticles);

      return {
        articles: categorizedArticles,
        marketSummary: await this.generateMarketSummary(categorizedArticles),
        keyThemes: this.extractEnhancedKeyThemes(categorizedArticles),
        overallSentiment: this.calculateEnhancedSentiment(categorizedArticles),
        usdAnalysis: await this.analyzeUSDStrength(categorizedArticles),
        goldFundamentals: await this.analyzeGoldFundamentals(categorizedArticles),
        timestamp: new Date().toISOString(),
        source: 'gnews_free_source' // Updated source
      };

    } catch (error) {
      console.error('Enhanced free news failed:', error);
      return this.getFallbackNews();
    }
  }

  async getGNewsData() {
    if (!this.gnewsKey) {
      console.log('...GNews API key not configured, skipping GNews');
      return [];
    }

    try {
      const query = 'gold OR XAUUSD OR "Federal Reserve" OR inflation OR "precious metals" OR FOMC OR CPI OR NFP';
      const response = await axios.get(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=8&apikey=${this.gnewsKey}`,
        { timeout: 8000 }
      );

      if (!response.data.articles) return [];

      return response.data.articles.map(article => ({
        title: article.title,
        summary: article.description,
        source: article.source.name,
        url: article.url,
        publishedAt: article.publishedAt,
        sentiment: this.analyzeEnhancedSentiment(article.title + ' ' + article.description),
        category: this.categorizeArticle(article.title + ' ' + article.description),
        impact: this.assessImpactLevel(article.title + ' ' + article.description)
      }));
    } catch (error) {
      console.error('❌ GNews fetch failed:', error.message);
      return [];
    }
  }


  // ===============================================
  // ALL HELPER FUNCTIONS BELOW ARE GOOD AND REMAIN
  // ===============================================

  categorizeArticle(text) {
    if (!text) return 'general';
    const lowerText = text.toLowerCase();

    // --- IMPORTANT: Added FOMC, NFP, CPI for Rule A ---
    if (lowerText.includes('fomc') || lowerText.includes('fed decision') || lowerText.includes('rate decision')) {
      return 'monetary_policy';
    } else if (lowerText.includes('cpi') || lowerText.includes('consumer price') || lowerText.includes('inflation')) {
      return 'inflation';
    } else if (lowerText.includes('nfp') || lowerText.includes('non-farm') || lowerText.includes('jobs report')) {
      return 'monetary_policy'; // Also policy-related
    }
    // ---
    else if (lowerText.includes('fed') || lowerText.includes('federal reserve') || lowerText.includes('interest rate')) {
      return 'monetary_policy';
    } else if (lowerText.includes('usd') || lowerText.includes('dollar') || lowerText.includes('dxy')) {
      return 'currency_markets';
    } else if (lowerText.includes('geopolitical') || lowerText.includes('tension') || lowerText.includes('crisis') || lowerText.includes('war')) {
      return 'geopolitical';
    } else if (lowerText.includes('safe haven') || lowerText.includes('risk off')) {
      return 'safe_haven';
    } else if (lowerText.includes('mining') || lowerText.includes('production') || lowerText.includes('supply')) {
      return 'supply_demand';
    } else if (lowerText.includes('technical') || lowerText.includes('chart') || lowerText.includes('resistance')) {
      return 'technical_analysis';
    } else {
      return 'general';
    }
  }

  categorizeArticles(articles) {
    const categories = {
      monetary_policy: [],
      inflation: [],
      currency_markets: [],
      geopolitical: [],
      safe_haven: [],
      supply_demand: [],
      technical_analysis: [],
      general: []
    };

    articles.forEach(article => {
      if (categories[article.category]) {
        categories[article.category].push(article);
      } else {
        categories.general.push(article);
      }
    });

    return categories;
  }

  analyzeEnhancedSentiment(text) {
    if (!text) return 'neutral'; // Safety check
    const lowerText = text.toLowerCase();

    const veryBullishWords = ['surge', 'rally', 'skyrocket', 'soar', 'breakout', 'bull run'];
    const bullishWords = ['rise', 'gain', 'up', 'positive', 'strong', 'buy', 'recovery'];
    const bearishWords = ['drop', 'fall', 'decline', 'down', 'negative', 'weak', 'sell'];
    const veryBearishWords = ['crash', 'plunge', 'collapse', 'tumble', 'bear market'];

    let score = 0;

    veryBullishWords.forEach(word => {
      if (lowerText.includes(word)) score += 2;
    });

    bullishWords.forEach(word => {
      if (lowerText.includes(word)) score += 1;
    });

    bearishWords.forEach(word => {
      if (lowerText.includes(word)) score -= 1;
    });

    veryBearishWords.forEach(word => {
      if (lowerText.includes(word)) score -= 2;
    });

    if (score >= 3) return 'very_bullish';
    if (score >= 1) return 'bullish';
    if (score <= -3) return 'very_bearish';
    if (score <= -1) return 'bearish';
    return 'neutral';
  }

  assessImpactLevel(text) {
    if (!text) return 'low'; // Safety check
    const lowerText = text.toLowerCase();

    // --- IMPORTANT: Added FOMC, NFP, CPI for Rule A ---
    const highImpactWords = ['fomc', 'nfp', 'cpi', 'fed decision', 'rate decision', 'jobs report', 'crisis', 'war', 'federal reserve'];
    const mediumImpactWords = ['inflation data', 'report', 'meeting', 'speech', 'tension', 'sanctions', 'central bank'];

    // Check for high impact first
    for (const word of highImpactWords) {
      if (lowerText.includes(word)) return 'high';
    }

    // Then check for medium impact
    for (const word of mediumImpactWords) {
      if (lowerText.includes(word)) return 'medium';
    }

    return 'low';
  }

  extractEnhancedKeyThemes(categorizedArticles) {
    const themes = new Set();
    const allArticles = Object.values(categorizedArticles).flat();

    if (!allArticles || allArticles.length === 0) return ['general market'];

    allArticles.forEach(article => {
      const text = (article.title + ' ' + (article.summary || '')).toLowerCase();

      const keywords = [
        'fed policy', 'interest rates', 'inflation data', 'usd strength',
        'dollar index', 'safe haven', 'geopolitical risk', 'central banks',
        'economic data', 'market sentiment', 'technical levels', 'support resistance',
        'gold demand', 'mining output', 'etf flows', 'investor sentiment',
        'fomc', 'cpi', 'nfp' // Add high impact
      ];

      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          themes.add(keyword);
        }
      });
    });

    return Array.from(themes).slice(0, 8);
  }

  calculateEnhancedSentiment(categorizedArticles) {
    const allArticles = Object.values(categorizedArticles).flat();
    if (allArticles.length === 0) return 'neutral';

    const sentiments = allArticles.map(a => a.sentiment);

    const sentimentCount = {
      very_bullish: 0,
      bullish: 0,
      neutral: 0,
      bearish: 0,
      very_bearish: 0
    };

    sentiments.forEach(sentiment => {
      if (sentimentCount.hasOwnProperty(sentiment)) {
        sentimentCount[sentiment]++;
      } else {
        sentimentCount.neutral++; // Default to neutral if sentiment is unusual
      }
    });

    const total = allArticles.length;
    const netSentiment = (
      (sentimentCount.very_bullish * 2) +
      (sentimentCount.bullish * 1) +
      (sentimentCount.neutral * 0) +
      (sentimentCount.bearish * -1) +
      (sentimentCount.very_bearish * -2)
    );

    if (total === 0) return 'neutral';
    const averageSentiment = netSentiment / total;

    if (averageSentiment > 0.5) return 'very_bullish';
    if (averageSentiment > 0.1) return 'bullish';
    if (averageSentiment < -0.5) return 'very_bearish';
    if (averageSentiment < -0.1) return 'bearish';
    return 'neutral';
  }

  async analyzeUSDStrength(articles) {
    if (!articles || !articles.currency_markets || !articles.monetary_policy) {
      return this.getFallbackNews().usdAnalysis; // Return fallback object
    }

    const usdArticles = [...articles.currency_markets, ...articles.monetary_policy];
    const sentiment = this.calculateEnhancedSentiment({ usd: usdArticles });

    let strength, outlook;

    if (sentiment === 'very_bullish' || sentiment === 'bullish') {
      strength = 'strong';
      outlook = 'Appreciating against major currencies';
    } else if (sentiment === 'very_bearish' || sentiment === 'bearish') {
      strength = 'weak';
      outlook = 'Depreciating pressure observed';
    } else {
      strength = 'stable';
      outlook = 'Trading within normal ranges';
    }

    return {
      strength: strength,
      outlook: outlook,
      sentiment: sentiment,
      drivers: this.extractUSDDrivers(usdArticles),
      impactOnGold: this.assessUSDGoldCorrelation(strength, sentiment)
    };
  }

  async analyzeGoldFundamentals(articles) {
    if (!articles || !articles.monetary_policy) {
      return this.getFallbackNews().goldFundamentals; // Return fallback object
    }

    const fundamentalArticles = [
      ...(articles.monetary_policy || []),
      ...(articles.inflation || []),
      ...(articles.geopolitical || []),
      ...(articles.safe_haven || [])
    ];

    const sentiment = this.calculateEnhancedSentiment({ fundamentals: fundamentalArticles });

    return {
      sentiment: sentiment,
      demandDrivers: this.extractDemandDrivers(articles),
      supplyFactors: this.extractSupplyFactors(articles),
      macroEnvironment: this.assessMacroEnvironment(articles),
      riskAppetite: this.assessRiskAppetite(articles),
      summary: this.generateGoldFundamentalsSummary(articles, sentiment)
    };
  }

  extractUSDDrivers(usdArticles) {
    const drivers = new Set();
    if (!usdArticles) return ['Economic Data'];

    usdArticles.forEach(article => {
      const text = (article.title + ' ' + (article.summary || '')).toLowerCase();

      if (text.includes('interest rate')) drivers.add('Interest Rate Differentials');
      if (text.includes('inflation')) drivers.add('Inflation Expectations');
      if (text.includes('economic growth')) drivers.add('Economic Growth Outlook');
      if (text.includes('safe haven')) drivers.add('Safe-Haven Flows');
      if (text.includes('fed policy')) drivers.add('Federal Reserve Policy');
    });

    if (drivers.size === 0) drivers.add('Economic Data');
    return Array.from(drivers);
  }

  assessUSDGoldCorrelation(usdStrength, sentiment) {
    // USD and gold typically have inverse correlation
    if (usdStrength === 'strong') {
      return {
        correlation: 'negative',
        impact: 'Bearish for gold prices',
        strength: 'strong',
        explanation: 'Strong USD makes gold more expensive for other currencies'
      };
    } else if (usdStrength === 'weak') {
      return {
        correlation: 'positive',
        impact: 'Bullish for gold prices',
        strength: 'strong',
        explanation: 'Weak USD makes gold cheaper for other currencies'
      };
    } else {
      return {
        correlation: 'mixed',
        impact: 'Neutral for gold prices',
        strength: 'moderate',
        explanation: 'Stable USD with other factors driving gold prices'
      };
    }
  }

  extractDemandDrivers(articles) {
    const drivers = new Set();
    const allArticles = Object.values(articles).flat();
    if (allArticles.length === 0) return ['Market Monitoring'];

    allArticles.forEach(article => {
      const text = (article.title + ' ' + (article.summary || '')).toLowerCase();

      if (text.includes('inflation hedge')) drivers.add('Inflation Hedging');
      if (text.includes('safe haven')) drivers.add('Safe-Haven Demand');
      if (text.includes('central bank') && text.includes('buy')) drivers.add('Central Bank Purchases');
      if (text.includes('jewelry') || text.includes('physical')) drivers.add('Physical Demand');
      if (text.includes('etf') || text.includes('investment')) drivers.add('Investment Demand');
    });

    if (drivers.size === 0) drivers.add('Market Monitoring');
    return Array.from(drivers);
  }

  extractSupplyFactors(articles) {
    const factors = new Set();
    const allArticles = Object.values(articles).flat();
    if (allArticles.length === 0) return ['Standard Supply'];

    allArticles.forEach(article => {
      const text = (article.title + ' ' + (article.summary || '')).toLowerCase();

      if (text.includes('mining') || text.includes('production')) factors.add('Mining Production');
      if (text.includes('recycling')) factors.add('Recycling Supply');
      if (text.includes('reserve') || text.includes('inventory')) factors.add('Central Bank Sales');
    });

    if (factors.size === 0) factors.add('Standard Supply');
    return Array.from(factors);
  }

  assessMacroEnvironment(articles) {
    if (!articles || !articles.inflation || !articles.monetary_policy || !articles.geopolitical) {
      return { environment: 'stable', description: 'Markets in observation mode' };
    }
    const inflationArticles = articles.inflation.length;
    const policyArticles = articles.monetary_policy.length;
    const geopoliticalArticles = articles.geopolitical.length;

    let environment, description;

    if (inflationArticles > policyArticles && inflationArticles > 2) {
      environment = 'inflationary';
      description = 'High inflation concerns dominating market sentiment';
    } else if (geopoliticalArticles > 3) {
      environment = 'uncertain';
      description = 'Geopolitical risks creating market uncertainty';
    } else if (policyArticles > 2) {
      environment = 'policy_driven';
      description = 'Central bank policies as main market driver';
    } else {
      environment = 'stable';
      description = 'Relatively stable macroeconomic conditions';
    }

    return { environment, description };
  }

  assessRiskAppetite(articles) {
    if (!articles || !articles.safe_haven || !articles.geopolitical) {
      return { appetite: 'risk_on', level: 'moderate', description: 'Normal market conditions' };
    }
    const safeHavenArticles = articles.safe_haven.length;
    const geopoliticalArticles = articles.geopolitical.length;

    if (safeHavenArticles > 2 || geopoliticalArticles > 2) {
      return {
        appetite: 'risk_off',
        level: 'high',
        description: 'Investors seeking safe-haven assets like gold'
      };
    } else {
      return {
        appetite: 'risk_on',
        level: 'moderate',
        description: 'Normal risk appetite in markets'
      };
    }
  }

  generateGoldFundamentalsSummary(articles, sentiment) {
    const drivers = this.extractDemandDrivers(articles);
    const macro = this.assessMacroEnvironment(articles);
    const risk = this.assessRiskAppetite(articles);

    return `Gold fundamentals show ${sentiment} sentiment. Key drivers: ${drivers.join(', ')}. ` +
      `Macro environment: ${macro.description}. Risk appetite: ${risk.description}.`;
  }

  async generateMarketSummary(categorizedArticles) {
    const allArticles = Object.values(categorizedArticles).flat();
    const totalArticles = allArticles.length;

    const highImpactCount = allArticles.filter(a => a.impact === 'high').length;
    const mediumImpactCount = allArticles.filter(a => a.impact === 'medium').length;

    return {
      totalNews: totalArticles,
      highImpactNews: highImpactCount,
      mediumImpactNews: mediumImpactCount,
      primaryFocus: this.getPrimaryFocus(categorizedArticles),
      marketMood: this.assessMarketMood(categorizedArticles),
      tradingImplications: this.getTradingImplications(categorizedArticles),
      updateFrequency: this.getUpdateFrequency(allArticles)
    };
  }

  getPrimaryFocus(categorizedArticles) {
    const categoryCounts = Object.entries(categorizedArticles)
      .map(([category, articles]) => ({ category, count: articles.length }))
      .sort((a, b) => b.count - a.count);

    return categoryCounts[0]?.category || 'general';
  }

  assessMarketMood(categorizedArticles) {
    const sentiment = this.calculateEnhancedSentiment(categorizedArticles);
    const riskAppetite = this.assessRiskAppetite(categorizedArticles);

    if (sentiment === 'very_bullish' && riskAppetite.appetite === 'risk_off') {
      return 'bullish_safe_haven';
    } else if (sentiment === 'bullish') {
      return 'optimistic';
    } else if (sentiment === 'bearish') {
      return 'cautious';
    } else if (sentiment === 'very_bearish') {
      return 'pessimistic';
    } else {
      return 'neutral';
    }
  }

  getTradingImplications(categorizedArticles) {
    const mood = this.assessMarketMood(categorizedArticles);
    const usdAnalysis = this.analyzeUSDStrength(categorizedArticles);

    const implications = {
      bullish_safe_haven: 'Favorable for gold longs, focus on risk management',
      optimistic: 'Consider long positions with proper stops',
      cautious: 'Reduce position sizes, wait for clearer signals',
      pessimistic: 'Avoid long positions, consider shorts or stay out',
      neutral: 'Range trading likely, use support/resistance levels'
    };

    return implications[mood] || 'Monitor market for direction';
  }

  getUpdateFrequency(articles) {
    if (articles.length === 0) return 'low';

    const now = new Date();
    const recentArticles = articles.filter(article => {
      if (!article.publishedAt) return false;
      const articleTime = new Date(article.publishedAt);
      return (now - articleTime) < 2 * 60 * 60 * 1000; // 2 hours
    });

    if (recentArticles.length > 8) return 'very_high';
    if (recentArticles.length > 4) return 'high';
    if (recentArticles.length > 2) return 'medium';
    return 'low';
  }

  removeDuplicates(articles) {
    const seen = new Set();
    return articles.filter(article => {
      const identifier = article.title.toLowerCase().trim();
      if (seen.has(identifier)) {
        return false;
      }
      seen.add(identifier);
      return true;
    });
  }

  getFallbackNews() {
    console.log('🟡 Using fallback market news...');

    const fallbackArticles = [
      {
        title: "Gold Market Monitoring Key Economic Indicators",
        summary: "Traders watching USD strength, inflation data, and central bank policies for gold direction.",
        source: "Market Analysis",
        publishedAt: new Date().toISOString(),
        sentiment: "neutral",
        category: "general",
        impact: "medium"
      }
    ];

    return {
      articles: { general: fallbackArticles },
      marketSummary: {
        totalNews: 1,
        highImpactNews: 0,
        mediumImpactNews: 1,
        primaryFocus: "general",
        marketMood: "neutral",
        tradingImplications: "Monitor markets for clearer signals",
        updateFrequency: "low"
      },
      keyThemes: ["market monitoring", "economic indicators"],
      overallSentiment: "neutral",
      usdAnalysis: {
        strength: "stable",
        outlook: "Monitoring economic data",
        sentiment: "neutral",
        drivers: ["Economic Data"],
        impactOnGold: {
          correlation: "mixed",
          impact: "Neutral impact",
          strength: "moderate",
          explanation: "Multiple factors influencing gold prices"
        }
      },
      goldFundamentals: {
        sentiment: "neutral",
        demandDrivers: ["Market Monitoring"],
        supplyFactors: ["Standard Supply"],
        macroEnvironment: {
          environment: "stable",
          description: "Markets in observation mode"
        },
        riskAppetite: {
          appetite: "risk_on",
          level: "moderate",
          description: "Normal market conditions"
        },
        summary: "Markets awaiting clearer directional signals"
      },
      timestamp: new Date().toISOString(),
      source: 'fallback'
    };
  }
}

module.exports = new NewsService();

