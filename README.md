# MarketScope - Stock Market Analysis Explorer

A full-stack stock market analysis tool for deriving insights, comparing investment strategies, and benchmarking against major indices.

## Tech Stack

- **Backend**: Django 6 + Django REST Framework, SQLite, pandas/numpy
- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, Recharts, TanStack Query
- **Data**: yfinance for historical prices and index data

## Quick Start

### 1. Backend

```bash
# Activate virtual environment
source venv/bin/activate

# Run migrations (first time)
cd backend
python manage.py migrate

# Import market cap CSV data
python manage.py import_market_cap_csv ../sp500_top20_market_cap_2016_2025.csv

# Gather historical data (requires internet)
python manage.py gather_index_data
python manage.py gather_price_history

# Start the server
python manage.py runserver 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Features

- **Dashboard**: Market overview with a Top-20-by-market-cap treemap (current year) plus quick benchmark snapshots.
- **Market Cap Explorer**: Rank trajectory bump chart + table view, including the **current year** (derived from daily price history).
- **Stocks**: Browse/search companies.
- **Stock Detail**: Price history chart with benchmark overlays (S&P 500, Dow, Nasdaq), plus market-cap rank history.
- **Strategy Comparison**: Compare strategies with selectable time window, grouped selection UI, ordered charts/legends, and a richer metrics table including **tax impact** estimates.
- **Momentum Strategy Explorer** (`/strategies/momentum`): Deep-dive page with parameter controls (Top N, start/end), annual rebalance buy/sell events, and a full start/end permutation CAGR matrix.
- **Benchmark Comparison**: Normalized benchmark performance comparison.
- **Portfolio Simulator**: Backtest custom allocations against selected benchmarks.
