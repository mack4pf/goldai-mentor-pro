// server.js

// Load environment variables
require('dotenv').config();

// Import dependencies
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Import our services
const authService = require('./services/authService');
const databaseService = require('./services/databaseService');

// Import market data services - Fixed paths
// const tradingViewService = require('./services/market/tradingViewService'); // DELETED
const goldPriceService = require('./services/market/goldPriceService');
const newsService = require('./services/market/newsService');

const openaiService = require('./services/openaiService');

// Initialize Express app for health checks
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'GoldAI Mentor Pro',
    timestamp: new Date().toISOString()
  });
});

// Start the web server
app.listen(PORT, () => {
  console.log(`🟢 Health check server running on port ${PORT}`);
  console.log(`📡 Signal API available at /api/signal/generate`);
});
const signalRoutes = require('./routes/signalRoutes');
app.use('/api/signal', signalRoutes);

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
  request: {
    timeout: 60000, // Increase timeout to 60 seconds
    agentOptions: {
      keepAlive: true,
      family: 4 // Use IPv4
    }
  }
});

// Bot startup message
console.log('🟡 Starting GoldAI Mentor Pro Bot...');
console.log('✅ All services (Gemini/DeepSeek AI) initialized!');

// Basic error handling
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

// ==================== NEW RATE LIMITING LOGIC (COMMENTED OUT) ====================

// Rate limiting logic remains commented out

// ==================== TELEGRAM KEYBOARDS ====================

// This is the main "quick buttons" for all users
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      ['💰 Gold Price', '📊 Market Sentiment'],
      ['📰 Market News', '🤖 Get Signal'],
      ['⚡ Quick Analysis', 'ℹ️ Help']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

const adminKeyboard = {
  reply_markup: {
    keyboard: [
      ['👑 Create User', '📊 List Users'],
      ['⬅️ Main Menu']
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

// Remove keyboard
const removeKeyboard = {
  reply_markup: {
    remove_keyboard: true
  }
};

// Inline keyboards for specific actions
function getInlineTimeframeKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🚀 5m', callback_data: 'signal_5m' },
          { text: '⚡ 15m', callback_data: 'signal_15m' },
          { text: '📈 1h', callback_data: 'signal_1h' }
        ],
        [
          { text: '🎯 4h', callback_data: 'signal_4h' },
          { text: '📅 Daily', callback_data: 'signal_24h' },
          { text: '🔄 All', callback_data: 'signal_all' }
        ]
      ]
    }
  };
}

// NEW FUNCTION: Asks for the user's balance/risk profile
function getBalanceKeyboard(timeframe) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 $10 - $50 (Compounding)', callback_data: `signal_${timeframe}_balance_10_50` }],
        [{ text: '📈 $51 - $100', callback_data: `signal_${timeframe}_balance_51_100` }],
        [{ text: '🚀 $200 - $500', callback_data: `signal_${timeframe}_balance_200_500` }],
        [{ text: '💎 $1000+ (Scaling/Macro)', callback_data: `signal_${timeframe}_balance_1k_plus` }],
      ]
    }
  };
}

function getAnalysisOptionsKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 Technical Only', callback_data: 'analysis_technical' },
          { text: '📰 News Only', callback_data: 'analysis_news' }
        ],
        [
          { text: '🤖 Full AI Analysis', callback_data: 'analysis_full' },
          { text: '💰 Price Prediction', callback_data: 'analysis_prediction' }
        ]
      ]
    }
  };
}

// ==================== HELPER FUNCTIONS ====================

// Authentication middleware
async function requireAuth(telegramId) {
  try {
    const user = await databaseService.findUserByTelegramId(telegramId.toString());

    if (!user) {
      return {
        authorized: false,
        message: '❌ Please activate your subscription first with /start YOUR_PASSWORD'
      };
    }

    if (user.status !== 'active') {
      return {
        authorized: false,
        message: '❌ Your subscription is inactive or expired. Please contact support.'
      };
    }

    // CRITICAL: We return the user object
    return { authorized: true, user: user };

  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      authorized: false,
      message: '❌ Authentication system error. Please try again.'
    };
  }
}

// Signal formatting function
function formatSignalMessage(signal) {
  const signalEmoji = signal.signal === 'STRONG_BUY' ? '🟢🟢' :
    signal.signal === 'BUY' ? '🟢' :
      signal.signal === 'STRONG_SELL' ? '🔴🔴' :
        signal.signal === 'SELL' ? '🔴' : '🟡'; // HOLD is 🟡

  const confidenceColor = signal.confidence >= 70 ? '🟢' :
    signal.confidence >= 60 ? '🟡' : '🔴';

  let message = `${signalEmoji} <b>TRADING SIGNAL: ${signal.signal}</b>\n`;
  message += `⏰ <b>Timeframe:</b> ${signal.timeframe.toUpperCase()}\n`;
  message += `${confidenceColor} <b>Confidence:</b> ${signal.confidence}%\n\n`;

  if (signal.signal !== 'HOLD') {
    message += `🎯 <b>TRADE SETUP</b>\n`;
    // CRITICAL FIX: Check if entry is null before displaying price
    message += `📍 <b>Entry:</b> ${signal.entry ? `$${signal.entry}` : 'N/A'}\n`;
    message += `🛑 <b>Stop Loss:</b> ${signal.stopLoss ? `$${signal.stopLoss}` : 'N/A'}\n`;
    message += `🎯 <b>Take Profit 1:</b> ${signal.takeProfit1 ? `$${signal.takeProfit1}` : 'N/A'}\n`;
    message += `🎯 <b>Take Profit 2:</b> ${signal.takeProfit2 ? `$${signal.takeProfit2}` : 'N/A'}\n\n`;

    if (signal.levelExplanation) {
      message += `💡 <b>LEVEL EXPLANATION</b>\n`;
      message += `${signal.levelExplanation}\n\n`;
    }
  }

  message += `📊 <b>TECHNICAL ANALYSIS</b>\n`;
  message += `${signal.technicalAnalysis}\n\n`;

  if (signal.marketContext) {
    message += `🌍 <b>MARKET CONTEXT</b>\n`;
    message += `${signal.marketContext}\n\n`;
  }

  message += `⚖️ <b>RISK MANAGEMENT</b>\n`;
  message += `${signal.riskManagement}\n\n`; // This now contains our position size

  if (signal.professionalRecommendation) {
    message += `💎 <b>PROFESSIONAL RECOMMENDATION</b>\n`;
    message += `${signal.professionalRecommendation}\n\n`;
  }

  message += `⚠️ <i>Trade responsibly. This is analysis and My current Setup </i>\n`;
  message += `⏰ ${new Date(signal.timestamp).toLocaleString()}`;

  return message;
}

// This function now correctly shows the 'mainKeyboard' (quick buttons)
function showMainMenu(chatId, userName = 'Trader') {
  const welcomeMessage = `🤖 <b>Welcome ${userName} to GoldAI Mentor Pro!</b>\n\n` +
    `I'm your AI-powered gold trading assistant with institutional-grade analysis.\n\n` +
    `<b>Available Actions:</b>\n` +
    `💰 <b>Gold Price</b> - Real-time XAU/USD price with predictions\n` +
    `📊 <b>Market Sentiment</b> - Technical indicators & sentiment\n` +
    `📰 <b>Market News</b> - Latest news & fundamental analysis\n` +
    `🤖 <b>Get Signal</b> - AI trading signals with risk management\n` +
    `⚡ <b>Quick Analysis</b> - Rapid market assessment\n\n` +
    `Or use commands:\n` +
    `<code>/signal 1h</code> - 1-hour trading signal\n` +
    `<code>/analysis</code> - Full market analysis\n` +
    `<code>/help</code> - Show all commands`;

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'HTML',
    reply_markup: mainKeyboard.reply_markup // This is the "quick buttons"
  });
}

// ==================== BOT COMMANDS & MESSAGE HANDLERS ====================

// Start command - Main entry point
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const userName = msg.from.first_name || 'Trader';

  // If password provided
  if (match[1]) {
    const password = match[1].trim();

    const authResult = await authService.authenticateUser(password, telegramId);

    if (authResult.success) {
      bot.sendMessage(chatId,
        `🎉 <b>Welcome ${userName} to GoldAI Mentor Pro!</b>\n\n` +
        `✅ Your <b>${authResult.user.plan}</b> subscription is now active!\n\n` +
        `💎 <b>Professional Features:</b>\n` +
        `• Institutional-grade AI analysis\n` +
        `• Multi-timeframe trading signals\n` +
        `• Risk-managed position sizing\n` +
        `• Real-time market monitoring\n` +
        `• Professional trade explanations\n\n` +
        `Use the buttons below or commands to get started! 🚀`,
        { parse_mode: 'HTML' }
      );

      // Show main menu (quick buttons) after successful auth
      setTimeout(() => showMainMenu(chatId, userName), 1000);

    } else {
      bot.sendMessage(chatId, authResult.message);
    }

  } else {
    // No password provided - check if user is already registered
    const auth = await requireAuth(telegramId);
    if (auth.authorized) {
      // User is already logged in, just show the menu
      showMainMenu(chatId, userName);
    } else {
      // User is new and has no password
      const welcomeMsg = `🤖 <b>Welcome ${userName} to GoldAI Mentor Pro!</b>\n\n` +
        `I'm your AI-powered gold trading mentor with institutional-grade analysis.\n\n` +
        `To activate your subscription, use:\n` +
        `<code>/start YOUR_ACCESS_CODE</code>\n\n` +
        `Example: <code>/start GOLDPRO_ABC123</code>\n\n` +
        `Need an access code? Contact support.`;

      bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'HTML',
        reply_markup: removeKeyboard.reply_markup
      });
    }
  }
});

// Handle "quick button" clicks
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const text = msg.text;

  // Skip if it's a command
  if (text && text.startsWith('/')) return;

  // CRITICAL: Get user object from auth
  const auth = await requireAuth(telegramId);
  if (!auth.authorized) {
    bot.sendMessage(chatId, auth.message);
    return;
  }
  // We now have auth.user which contains balance, etc.

  try {
    switch (text) {
      case '💰 Gold Price':
        await handleGoldPrice(chatId);
        break;
      case '📊 Market Sentiment':
        await handleMarketSentiment(chatId);
        break;
      case '📰 Market News':
        await handleMarketNews(chatId);
        break;
      case '🤖 Get Signal':
        // Step 1: Ask for timeframe
        bot.sendMessage(chatId, '🎯 Choose your preferred timeframe:', getInlineTimeframeKeyboard());
        break;
      case '⚡ Quick Analysis':
        await handleQuickAnalysis(chatId);
        break;
      case 'ℹ️ Help':
        await handleHelp(chatId, msg.from.id);
        break;

      case '⬅️ Main Menu': // Unified "Back" button
        showMainMenu(chatId, msg.from.first_name);
        break;

      // Admin buttons
      case '👑 Create User':
      case '📊 List Users':
        if (msg.from.id.toString() === process.env.ADMIN_TELEGRAM_ID) {
          handleAdminCommand(chatId, text);
        } else {
          bot.sendMessage(chatId, '❌ Admin access required.');
        }
        break;
      default:
        // Ignore unknown text messages
        break;
    }
  } catch (error) {
    console.error('Button handler error:', error);
    bot.sendMessage(chatId, '❌ Error processing your request. Please try again.');
  }
});

// Handle inline button (callback_query) clicks
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const telegramId = callbackQuery.from.id;

  // Answer the callback query immediately to prevent timeout
  try {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Processing your request...'
    });
  } catch (error) {
    console.error('Error answering callback query:', error);
  }

  // CRITICAL: Get user object from auth
  const auth = await requireAuth(telegramId);
  if (!auth.authorized) {
    await bot.sendMessage(chatId, auth.message);
    return;
  }
  // We now have auth.user

  try {
    if (data.startsWith('signal_')) {
      const parts = data.split('_');
      const timeframe = parts[1];

      if (parts.length === 2 && timeframe !== 'all') {

        await bot.editMessageText(`🎯 Timeframe set to ${timeframe.toUpperCase()}. Now, choose your account **Balance/Risk Tier** for a customized signal:`, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'HTML',
          reply_markup: getBalanceKeyboard(timeframe).reply_markup
        });
      } else if (parts.length > 3 && parts[2] === 'balance') {

        const balanceCategory = parts.slice(3).join('_');
        await generateAndSendSignal(chatId, timeframe, auth.user, balanceCategory);
      } else if (timeframe === 'all') {
        // Handle 'all' signal request
        await generateMultipleSignals(chatId, auth.user);
      }
    }

    else if (data.startsWith('analysis_')) {
      const type = data.replace('analysis_', '');
      await handleAnalysisType(chatId, type);
    }

  } catch (error) {
    console.error('Callback error:', error);
    await bot.sendMessage(chatId, '❌ Error processing your request. Please try again.');
  }
});



async function handleGoldPrice(chatId) {
  try {
    const goldData = await goldPriceService.getGoldPrice();

    const changeEmoji = goldData.change >= 0 ? '📈' : '📉';

    let message = `💰 <b>GOLD PRICE ANALYSIS</b>\n\n`;
    message += `💵 <b>Current:</b> $${goldData.price}\n`;
    message += `${changeEmoji} <b>Change:</b> ${goldData.change} (${goldData.changePercent}%)\n`;
    message += `📊 <b>Range:</b> $${goldData.low} - $${goldData.high}\n`;
    message += `🔄 <b>Source:</b> ${goldData.source}\n\n`;

    if (goldData.predictions) {
      message += `🔮 <b>PRICE PREDICTIONS</b>\n`;
      message += `⏰ 5-hour: $${goldData.predictions.shortTerm?.predictedPrice || 'N/A'} (${goldData.predictions.shortTerm?.confidence || 'N/A'}%)\n`;
      message += `📅 24-hour: $${goldData.predictions.mediumTerm?.predictedPrice || 'N/A'} (${goldData.predictions.mediumTerm?.confidence || 'N/A'}%)\n`;
      message += `🗓️ 1-month: $${goldData.predictions.longTerm?.predictedPrice || 'N/A'} (${goldData.predictions.longTerm?.confidence || 'N/A'}%)\n\n`;
    }

    if (goldData.marketCondition) {
      message += `🎯 <b>MARKET CONDITION</b>\n`;
      message += `⚡ Speed: ${goldData.marketCondition.speed}\n`;
      message += `📊 Volatility: ${goldData.marketCondition.condition}\n`;
      message += `💪 Momentum: ${goldData.marketCondition.confidence}\n\n`;
    }

    message += `⏰ ${new Date(goldData.timestamp).toLocaleString()}`;

    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Gold price error:', error);
    await bot.sendMessage(chatId, `❌ Error fetching gold price: ${error.message}`);
  }
}

async function handleMarketSentiment(chatId) {
  try {
    // CRITICAL FIX: The call site is now fixed to use the method inside the openaiService instance.
    const sentiment = await openaiService.getMarketSentimentPlaceholder();

    let message = `📊 <b>TECHNICAL ANALYSIS (AI-DELEGATED)</b>\n\n`;
    message += `🎯 <b>Overall Bias:</b> ${sentiment.trend?.direction || 'Neutral'}\n`;
    message += `💪 <b>Strength:</b> ${sentiment.trend?.strength || 'Medium'}\n`;

    message += `⚠️ Note: This summary is based on placeholder analysis. **Use the "Get Signal" button for full AI chart analysis**.\n\n`;

    if (sentiment.oscillators) {
      message += `🔄 <b>OSCILLATORS</b>\n`;
      message += `• RSI: ${sentiment.oscillators.RSI?.value || 'N/A'} (${sentiment.oscillators.RSI?.condition || 'Neutral'})\n`;
      message += `• MACD: ${sentiment.oscillators.MACD?.condition || 'Neutral'}\n`;
      message += `• Stochastic: ${sentiment.oscillators.Stochastic?.condition || 'Neutral'}\n\n`;
    }

    if (sentiment.supportResistance) {
      message += `🎯 <b>KEY LEVELS</b>\n`;
      message += `• Resistance (R1): $${sentiment.supportResistance.resistance[0] || 'N/A'}\n`;
      message += `• Support (S1): $${sentiment.supportResistance.support[0] || 'N/A'}\n\n`;
    }

    message += `⏰ ${new Date(sentiment.timestamp).toLocaleString()}`;

    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Market sentiment error:', error);
    await bot.sendMessage(chatId, `❌ Error fetching market sentiment: ${error.message}\n\nData is currently unavailable.`);
  }
}

async function handleMarketNews(chatId) {
  try {
    const newsData = await newsService.getGoldNews();

    let message = `📰 <b>MARKET NEWS & FUNDAMENTALS</b>\n\n`;
    message += `🎯 <b>Overall Sentiment:</b> ${newsData.overallSentiment?.toUpperCase() || 'NEUTRAL'}\n`;
    message += `🏷️ <b>Key Themes:</b> ${newsData.keyThemes?.join(', ') || 'General market'}\n`;
    message += `📊 <b>High-Impact News:</b> ${newsData.marketSummary?.highImpactNews || 0} articles\n\n`;

    if (newsData.usdAnalysis) {
      message += `💵 <b>USD ANALYSIS</b>\n`;
      message += `• Strength: ${newsData.usdAnalysis.strength}\n`;
      message += `• Gold Impact: ${newsData.usdAnalysis.impactOnGold?.impact || 'Neutral'}\n\n`;
    }

    // Handle both array and object structures for articles
    let articles = newsData.articles || [];
    if (articles && typeof articles === 'object' && !Array.isArray(articles)) {
      articles = Object.values(articles).flat();
    }

    // Show top 2 news articles
    if (articles.length > 0) {
      message += `📝 <b>TOP NEWS</b>\n`;
      articles.slice(0, 2).forEach((article, index) => {
        const sentimentEmoji = article.sentiment === 'bullish' ? '🟢' :
          article.sentiment === 'bearish' ? '🔴' : '🟡';
        message += `${index + 1}. ${article.title}\n`;
        message += `   ${sentimentEmoji} ${article.sentiment?.toUpperCase()}\n\n`;
      });
    }

    message += `⏰ ${new Date(newsData.timestamp).toLocaleString()}`;

    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Market news error:', error);
    await bot.sendMessage(chatId, `❌ Error fetching news: ${error.message}\n\nData is currently unavailable.`);
  }
}

// --- CRITICAL UPDATE: Direct Call to OpenAIService ---
async function generateAndSendSignal(chatId, timeframe, userContext = null, balanceCategory = 'default') {
  // Rate limiting logic remains commented out
  let processingMsg;

  try {
    processingMsg = await bot.sendMessage(chatId,
      `🟡 Generating professional ${timeframe} trading signal for **${balanceCategory}** risk profile...\n` +
      `🧠 AI Analyst Confirming trading Setup this may take a minute...`
    );

    // CRITICAL FIX: Direct call to openaiService
    const signal = await openaiService.generateTradingSignal(timeframe, userContext, balanceCategory);

    const signalMessage = formatSignalMessage(signal);
    await bot.editMessageText(signalMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'HTML'
    });

  } catch (error) {
    console.error('Signal generation error:', error);

    // CRITICAL: Use the error message from the critical failure (no mock)
    const errorMessage = `❌ CRITICAL FAILURE: ${error.message}\n\nSIGNAL UNAVAILABLE. Please check API keys and services.`;

    if (processingMsg) {
      try {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'HTML'
        });
      } catch (editError) {
        await bot.sendMessage(chatId, errorMessage);
      }
    } else {
      await bot.sendMessage(chatId, errorMessage);
    }
  }
}

// --- CRITICAL BUG FIX ---
async function generateMultipleSignals(chatId, userContext = null) {
  let processingMsg;

  try {
    const timeframes = ['15m', '1h', '4h'];
    let allSignals = [];

    processingMsg = await bot.sendMessage(chatId,
      `🟡 Generating multi-timeframe analysis...\n` +
      `⏰ Timeframes: 15m, 1h, 4h\n` +
      `📊 This may take a moment...`
    );

    for (const tf of timeframes) {
      try {
        // CRITICAL FIX: Direct call to openaiService
        const signal = await openaiService.generateTradingSignal(tf, userContext, 'default_multi_signal');
        allSignals.push(signal);
      } catch (error) {
        console.error(`Error generating ${tf} signal:`, error);
        allSignals.push({ timeframe: tf, signal: 'ERROR', confidence: 0, technicalAnalysis: error.message }); // Use non-mock error signal
      }
    }

    let summaryMessage = `🤖 <b>MULTI-TIMEFRAME ANALYSIS SUMMARY</b>\n\n`;

    allSignals.forEach(signal => {
      const signalEmoji = signal.signal === 'STRONG_BUY' ? '🟢🟢' :
        signal.signal === 'BUY' ? '🟢' :
          signal.signal === 'STRONG_SELL' ? '🔴🔴' :
            signal.signal === 'SELL' ? '🔴' : signal.signal === 'ERROR' ? '❌' : '🟡';

      summaryMessage += `${signalEmoji} <b>${signal.timeframe.toUpperCase()}:</b> ${signal.signal} (${signal.confidence}%)\n`;
      if (signal.signal === 'ERROR') {
        summaryMessage += `<i>Failure: ${signal.technicalAnalysis.substring(0, 50)}...</i>\n`;
      }
    });

    summaryMessage += `\n💡 <i>Use specific timeframe signals for detailed trade setups.</i>`;

    await bot.editMessageText(summaryMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'HTML'
    });

  } catch (error) {
    console.error('Multi-signal error:', error);
    const errorMessage = `❌ Error generating multi-timeframe analysis: ${error.message}`;

    if (processingMsg) {
      try {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'HTML'
        });
      } catch (editError) {
        await bot.sendMessage(chatId, errorMessage);
      }
    } else {
      await bot.sendMessage(chatId, errorMessage);
    }
  }
}

async function handleQuickAnalysis(chatId) {
  let processingMsg;

  try {
    processingMsg = await bot.sendMessage(chatId,
      `⚡ Running quick market analysis...\n` +
      `📊 Checking all market dimensions...`
    );

    // CRITICAL: We only use goldPriceService and newsService now.
    const [goldData, newsData] = await Promise.all([
      goldPriceService.getGoldPrice().catch(() => null),
      newsService.getGoldNews().catch(() => null)
    ]);

    // NOTE: Technical sentiment is simulated as 'Neutral' since the service is gone
    const technicalSentiment = { trend: { direction: 'Neutral' } };

    let analysisMessage = `⚡ <b>QUICK MARKET ANALYSIS</b>\n\n`;

    if (goldData) {
      const changeEmoji = goldData.change >= 0 ? '📈' : '📉';
      analysisMessage += `💰 <b>GOLD:</b> $${goldData.price} ${changeEmoji}\n`;
    }

    analysisMessage += `📊 <b>TECHNICAL:</b> Neutral bias (AI required for full chart analysis)\n`;

    if (newsData) {
      analysisMessage += `📰 <b>NEWS:</b> ${newsData.overallSentiment || 'Neutral'} sentiment\n`;
    }

    analysisMessage += `\n🎯 <b>RECOMMENDATION:</b> `;

    // Simple recommendation logic - uses real data if available
    if (technicalSentiment?.trend?.direction === 'bullish' && newsData?.overallSentiment === 'bullish') {
      analysisMessage += `Consider LONG positions\n`;
    } else if (technicalSentiment?.trend?.direction === 'bearish' && newsData?.overallSentiment === 'bearish') {
      analysisMessage += `Consider SHORT positions\n`;
    } else {
      analysisMessage += `Wait for clearer signals\n`;
    }

    analysisMessage += `\n💡 <i>Use "Get Signal" for detailed trade setup.</i>`;

    await bot.editMessageText(analysisMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'HTML'
    });

  } catch (error) {
    console.error('Quick analysis error:', error);
    const errorMessage = `❌ Error in quick analysis: ${error.message}`;

    if (processingMsg) {
      try {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'HTML'
        });
      } catch (editError) {
        await bot.sendMessage(chatId, errorMessage);
      }
    } else {
      await bot.sendMessage(chatId, errorMessage);
    }
  }
}

async function handleHelp(chatId, telegramId) {
  const isAdmin = telegramId.toString() === process.env.ADMIN_TELEGRAM_ID;

  let helpText = `<b>📚 GoldAI Mentor Pro - Commands Guide</b>\n\n` +
    `<b>🎯 Quick Actions (Buttons):</b>\n` +
    `• <b>Gold Price</b> - Live price with predictions\n` +
    `• <b>Market Sentiment</b> - Technical indicators\n` +
    `• <b>Market News</b> - News & fundamentals\n` +
    `• <b>Get Signal</b> - AI trading signals\n` +
    `• <b>Quick Analysis</b> - Rapid market scan\n\n` +

    `<b>⌨️ Text Commands:</b>\n` +
    `<code>/start</code> - Welcome & activation\n` +
    `<code>/menu</code> - Show main menu\n` +
    `<code>/price</code> - Gold price details\n` +
    `<code>/sentiment</code> - Technical analysis\n` +
    `<code>/news</code> - Market news\n` +
    `<code>/signal TIMEFRAME</code> - Trading signal\n` +
    `<code>/analysis</code> - Full market analysis\n` +
    `<code>/help</code> - This help message\n\n` +

    `<b>📊 Timeframes:</b> 5m, 15m, 1h, 4h, 24h\n\n` +

    `<b>💎 Professional Features:</b>\n` +
    `• AI powered Trading \n` +
    `• Risk-managed position sizing\n` +
    `• Multi-confirmation signals\n` +
    `• Real-time market monitoring`;

  if (isAdmin) {
    helpText += `\n\n<b>👑 Admin Commands:</b>\n` +
      `<code>/admin create basic|premium</code>\n` +
      `<code>/admin users</code> - List all users`;
  }

  await bot.sendMessage(chatId, helpText, {
    parse_mode: 'HTML',
    reply_markup: mainKeyboard.reply_markup
  });
}

async function handleAnalysisType(chatId, type) {
  // Implementation for different analysis types
  const analysisTypes = {
    technical: '📊 Technical Analysis',
    news: '📰 News Analysis',
    full: '🤖 Full AI Analysis',
    prediction: '🔮 Price Prediction'
  };

  await bot.sendMessage(chatId, `Starting ${analysisTypes[type]}... This feature is coming soon!`);
}

function handleAdminCommand(chatId, command) {
  // Admin command handlers would go here
  bot.sendMessage(chatId, `Admin command: ${command} - Implementation needed`);
}

// ==================== TEXT COMMANDS (Backward Compatibility) ====================

// NEW: Added /menu command
bot.onText(/\/menu/, (msg) => {
  showMainMenu(msg.chat.id, msg.from.first_name);
});

bot.onText(/\/price/, (msg) => handleGoldPrice(msg.chat.id));
bot.onText(/\/sentiment/, (msg) => handleMarketSentiment(msg.chat.id));
bot.onText(/\/news/, (msg) => handleMarketNews(msg.chat.id));

// --- CRITICAL BUG FIX ---
// This command must also check auth and pass userContext
bot.onText(/\/signal(?: (.+))?/, async (msg, match) => {
  const timeframe = match[1] || '1h';

  // BUG FIX: Added auth check
  const auth = await requireAuth(msg.from.id);
  if (!auth.authorized) {
    bot.sendMessage(msg.chat.id, auth.message);
    return;
  }

  // New flow: Skip directly to balance selection if using command
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, `🎯 Timeframe set to ${timeframe.toUpperCase()}. Now, choose your account **Balance/Risk Tier** for a customized signal:`, {
    parse_mode: 'HTML',
    reply_markup: getBalanceKeyboard(timeframe).reply_markup
  });
});

bot.onText(/\/analysis/, (msg) => handleQuickAnalysis(msg.chat.id));
bot.onText(/\/help/, (msg) => handleHelp(msg.chat.id, msg.from.id));

// Admin commands (keep existing)
bot.onText(/\/admin create (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;
  const planType = match[1].toLowerCase();

  if (adminId.toString() !== process.env.ADMIN_TELEGRAM_ID) {
    await bot.sendMessage(chatId, '❌ Unauthorized: Admin access required');
    return;
  }

  const result = await authService.createUser(planType);

  if (result.success) {
    await bot.sendMessage(chatId,
      `👑 ADMIN: User Created Successfully!\n\n` +
      `📋 Plan: ${result.plan}\n` +
      `🔑 Password: ${result.password}\n` +
      `🆔 User ID: ${result.userId}\n\n` +
      `Send this to your customer:\n` +
      `"Your GoldAI Mentor access: /start ${result.password}"`
    );
  } else {
    await bot.sendMessage(chatId, result.message);
  }
});

bot.onText(/\/admin users/, async (msg) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;

  if (adminId.toString() !== process.env.ADMIN_TELEGRAM_ID) {
    await bot.sendMessage(chatId, '❌ Unauthorized: Admin access required');
    return;
  }

  try {
    const users = await databaseService.getAllUsers();

    if (users.length === 0) {
      await bot.sendMessage(chatId, '📊 No users found in the system.');
      return;
    }

    let userList = `📊 TOTAL USERS: ${users.length}\n\n`;

    users.forEach((user, index) => {
      userList += `${index + 1}. ${user.plan.toUpperCase()} - ${user.status}\n`;
      userList += `   Telegram: ${user.telegramId || 'Not activated'}\n`;
      userList += `   Password: ${user.password}\n`;
      userList += `   Created: ${new Date(user.createdAt).toLocaleDateString()}\n\n`;
    });

    await bot.sendMessage(chatId, userList);
  } catch (error) {
    console.error('Admin users error:', error);
    await bot.sendMessage(chatId, '❌ Error listing users');
  }
});

console.log('✅ GoldAI Mentor Pro Bot started successfully!');
console.log('🤖 Bot is now listening for messages...');
console.log('🎯 Telegram quick buttons enabled for easy navigation');
console.log('👑 Admin commands available');