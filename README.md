# GoldAI Mentor Pro - Telegram Trading Bot

## 🤖 Overview

**GoldAI Mentor Pro** is a sophisticated, AI-powered Telegram bot designed for professional XAU/USD (Gold) traders. It moves beyond simple signals by integrating advanced AI models (Google Gemini & DeepSeek) to provide institutional-grade analysis, dynamic trading strategies, and comprehensive risk management.

The bot's core "brain" is built on a multi-tier strategy system that adapts its trading logic based on the user's specified account balance, simulating strategies for compounding, stability, and wealth preservation.

## ✨ Key Features

  * **Dual AI Core:** Uses **Google Gemini 2.5 Flash** as its primary AI analyst, with a seamless fallback to **DeepSeek** for high availability.
  * **Dynamic Trading Strategies:** The AI selects from four distinct trading strategies based on the user's account profile (defined in `openaiService.js`):
      * **DLS (10-1k):** High RRR compounding for small accounts.
      * **MR/CT (1k-10k):** Mean reversion and range trading for stable growth.
      * **MOMENTUM (10k-50k):** Scaling in on retests of broken structures.
      * **MACRO (50k+):** Long-term wealth preservation with wide stops.
  * **Aggressive Signal Mandate:** The AI is instructed to *always* find a tradable setup (BUY or SELL) and to avoid non-actionable "HOLD" signals, forcing it to determine the highest probability direction.
  * **Real-time Multi-Source Data:**
      * **Price:** Fetches gold prices from `GoldAPI`, `Alpha Vantage`, and a free multi-source fallback (`fxratesapi`, `exchangerate-api`) with a 30-second cache.
      * **News:** Aggregates fundamentals from `NewsAPI`, `Finnhub`, `Alpha Vantage`, and `GNews`, performing sentiment analysis and USD impact assessment.
  * **Pre-Signal Validation:** A built-in logic layer (`preSignalValidation`) checks market conditions (news impact, volatility) before querying the AI.
  * **Authentication & User Management:** A secure, password-based authentication system (`authService.js`) links a subscription password to a unique Telegram ID upon first activation.
  * **Admin Panel:** Includes commands for admins to create new user passwords and list all users in the database.
  * **Simple Persistence:** Uses a local JSON file (`database.data`) as a simple, serverless database for users and signal history.
  * **Interactive UI:** Utilizes Telegram's inline and reply keyboards for a seamless, guided user experience (e.g., `Get Signal` -\> `Select Timeframe` -\> `Select Balance Tier`).

## 🛠️ Tech Stack

  * **Backend:** Node.js
  * **Bot Framework:** `node-telegram-bot-api`
  * **AI Models:** Google Gemini, DeepSeek
  * **HTTP Client:** `axios`
  * **Database:** Local JSON file (via Node.js `fs` module)
  * **Health Checks:** `express` (provides a simple `/health` endpoint)

## 🏛️ Project Structure & Service Overview

The project is built on a service-oriented architecture, with each file handling a specific domain:

  * `server.js`: **Main Entry Point.** Initializes the Telegram bot, handles all user commands and button clicks, and orchestrates the other services.
  * `openaiService.js`: **The "Brain."** This is the most critical service. It:
      * Initializes Gemini and DeepSeek.
      * Contains the master `generateTradingSignal` function.
      * Holds the extensive system prompt with the 4-tier trading strategies.
      * Parses AI responses into a structured signal format.
  * `goldPriceService.js`: **Price Data.** Responsible for fetching, caching (30s), and performing logical analysis (predictions, volatility) on XAU/USD price data.
  * `newsService.js`: **Fundamental Data.** Responsible for fetching, categorizing, and analyzing market news, sentiment, and USD-specific impact.
  * `authService.js`: **Security & Users.** Manages user authentication, password generation, activation (linking password to Telegram ID), and access validation.
  * `databaseService.js`: **Persistence Layer.** A simple wrapper for reading from and writing to the `database.data` JSON file. Manages user and signal records.

## 🚀 Getting Started

### 1\. Prerequisites

  * Node.js (v18.x or higher)
  * `npm`
  * A Telegram Bot Token (from @BotFather)

### 2\. Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/mackpf/goldai-mentor-pro.git
    cd goldai-mentor-pro
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

### 3\. Configuration (Crucial)

Create a `.env` file in the project's root directory. This file is **required** to store all your API keys and settings.

```ini
# --- Core Bot Settings ---
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
ADMIN_TELEGRAM_ID=YOUR_PERSONAL_TELEGRAM_ID
PORT=3000

# --- AI Service Keys (At least one is needed) ---
GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_API_KEY
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY

# --- Gold Price Service Keys (At least one paid key is recommended) ---
GOLDAPI_KEY=YOUR_GOLDAPI_IO_KEY
ALPHA_VANTAGE_API_KEY=YOUR_ALPHA_VANTAGE_KEY
EXCHANGERATE_API_KEY=YOUR_EXCHANGERATE_API_KEY

# --- News Service Keys (At least one paid key is recommended) ---
NEWS_API_KEY=YOUR_NEWSAPI_ORG_KEY
FINNHUB_API_KEY=YOUR_FINNHUB_IO_KEY
GNEWS_API_KEY=YOUR_GNEWS_IO_KEY

# Note: Alpha Vantage key is used for both price and news
```

### 4\. Running the Bot

Once your `.env` file is configured, you can start the bot:

```bash
node server.js
```

The bot will start, create the `data/database.data` file if it doesn't exist, and begin polling for messages.

## 💬 Bot Usage

### User Flow

1.  **First-time User:**

      * A new user messages the bot.
      * The bot asks for an access code: `/start YOUR_ACCESS_CODE`.
      * The user provides the code (e.g., `GOLDPRO_...`) generated by the admin.
      * `authService` validates the code and permanently links it to the user's `telegramId`.

2.  **Authenticated User:**

      * The user is greeted with the main menu and quick-reply buttons.
      * **Quick Buttons:**
          * `💰 Gold Price`: Fetches real-time price and logical predictions.
          * `📊 Market Sentiment`: Shows placeholder technicals (full analysis is via AI signal).
          * `📰 Market News`: Provides a summary of the latest news and sentiment.
          * `🤖 Get Signal`: Starts the main signal generation flow.
          * `⚡ Quick Analysis`: Gives a rapid overview of market conditions.
          * `ℹ️ Help`: Shows the help message.
      * **Text Commands:**
          * `/start`: Activates a subscription or shows the main menu.
          * `/price`: Same as "Gold Price" button.
          * `/news`: Same as "Market News" button.
          * `/signal 1h`: A shortcut to the signal flow, pre-selecting the timeframe.

### 📈 The Signal Generation Flow

This is the bot's core feature:

1.  User clicks `🤖 Get Signal` (or types `/signal 1h`).
2.  Bot replies with an inline keyboard asking for a **Timeframe** (5m, 15m, 1h, 4h, Daily).
3.  After selection, the message updates, asking for the user's **Balance/Risk Tier**.
      * `💰 $10 - $50 (Compounding)` -\> Uses **DLS** Strategy
      * `🚀 $200 - $500` -\> Uses **MR/CT** Strategy
      * `💎 $1000+ (Scaling/Macro)` -\> Uses **MOMENTUM** Strategy
4.  Once selected, `openaiService.generateTradingSignal` is called with the `timeframe` and `balanceCategory`.
5.  The bot sends a "processing" message, then edits it with the full, formatted signal from the AI, including Entry, SL, TPs, and rationale.

### 👑 Admin Commands

  * `/admin create [plan]`

      * **Description:** Generates a new, unactivated password.
      * **Example:** `/admin create premium`
      * **Output:** The bot replies with the new password (e.g., `GOLDPRO_XYZ123`). The admin must then send this password to the new user.

  * `/admin users`

      * **Description:** Lists all users in the database, showing their plan, status, and whether they have activated (linked a Telegram ID).

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.