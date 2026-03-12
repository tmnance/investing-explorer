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

Open http://localhost:5173

## Features

- **Dashboard** -- Market overview with treemap, benchmark cards, and top movers
- **Market Cap Explorer** -- Bump chart showing rank trajectory of top 20 companies (2016-2025)
- **Stock Detail** -- Price charts, performance metrics, benchmark overlay, rank history
- **Strategy Comparison** -- Compare strategies (Top N, Equal Weight, Momentum, FAANG+) with risk/return metrics
- **Benchmark Comparison** -- Normalized index overlay, correlation matrix
- **Portfolio Simulator** -- Custom stock/weight allocation backtested against S&P 500

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/companies/` | List all companies |
| `GET /api/companies/:ticker/` | Company detail |
| `GET /api/rankings/?year=2025` | Market cap rankings (filterable by year/ticker) |
| `GET /api/rankings/years/` | Available years |
| `GET /api/rankings/top_movers/` | Biggest rank changes YoY |
| `GET /api/prices/:ticker/` | Price history for a stock |
| `GET /api/benchmarks/` | Normalized benchmark index data |
| `GET /api/benchmarks/latest/` | Latest close for each index |
| `GET /api/strategies/` | Available strategies |
| `GET /api/strategies/compare/?strategies=id1,id2` | Run and compare strategies |
| `GET /api/simulator/?allocations=[...]&start_year=2016&end_year=2025` | Custom portfolio backtest |
