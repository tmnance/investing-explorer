import numpy as np
import pandas as pd
from datetime import date
from typing import Optional
from market.models import MarketCapRanking, PriceHistory, BenchmarkIndex
from .metrics import compute_all_metrics


STRATEGY_REGISTRY = {}


def register_strategy(id: str, name: str, description: str):
    """Decorator to register a strategy function."""
    def decorator(fn):
        STRATEGY_REGISTRY[id] = {
            'id': id,
            'name': name,
            'description': description,
            'fn': fn,
        }
        return fn
    return decorator


def get_available_strategies():
    return [
        {'id': s['id'], 'name': s['name'], 'description': s['description']}
        for s in STRATEGY_REGISTRY.values()
    ]


def run_strategy(strategy_id: str, start_year: int = 2016, end_year: int = 2025) -> dict:
    """Run a strategy and return results."""
    if strategy_id not in STRATEGY_REGISTRY:
        raise ValueError(f'Unknown strategy: {strategy_id}')
    return STRATEGY_REGISTRY[strategy_id]['fn'](start_year, end_year)


def _get_annual_prices(tickers: list[str], start_year: int, end_year: int) -> pd.DataFrame:
    """Get a DataFrame of daily adj_close prices for the given tickers, indexed by date."""
    from django.db.models import Q

    start_date = date(start_year, 1, 1)
    end_date = date(end_year, 12, 31)

    all_prices = PriceHistory.objects.filter(
        company__ticker__in=tickers,
        date__gte=start_date,
        date__lte=end_date,
    ).values('company__ticker', 'date', 'adj_close').order_by('date')

    if not all_prices:
        return pd.DataFrame()

    df = pd.DataFrame(list(all_prices))
    df = df.pivot(index='date', columns='company__ticker', values='adj_close')
    df = df.sort_index()
    return df


def _build_strategy_result(
    name: str,
    portfolio_values: pd.Series,
    start_year: int,
    end_year: int,
) -> dict:
    """Build a standardized strategy result dict."""
    values = portfolio_values.dropna()
    if values.empty:
        return {
            'name': name,
            'dates': [],
            'cumulative_returns': [],
            'annual_returns': {},
            'metrics': {
                'total_return': 0, 'cagr': 0, 'volatility': 0,
                'sharpe_ratio': 0, 'sortino_ratio': 0, 'max_drawdown': 0,
            },
        }

    base = values.iloc[0]
    cumulative = (values / base).tolist()
    dates = [str(d) for d in values.index]

    annual_returns = {}
    for year in range(start_year, end_year + 1):
        year_vals = values[(values.index >= date(year, 1, 1)) & (values.index <= date(year, 12, 31))]
        if len(year_vals) >= 2:
            annual_returns[str(year)] = float((year_vals.iloc[-1] / year_vals.iloc[0]) - 1)

    prices_array = values.values.astype(float)
    metrics = compute_all_metrics(prices_array)

    return {
        'name': name,
        'dates': dates,
        'cumulative_returns': cumulative,
        'annual_returns': annual_returns,
        'metrics': metrics,
    }


@register_strategy('sp500_benchmark', 'S&P 500 Benchmark', 'Buy and hold the S&P 500 index')
def sp500_benchmark(start_year: int = 2016, end_year: int = 2025) -> dict:
    start_date = date(start_year, 1, 1)
    end_date = date(end_year, 12, 31)

    records = list(
        BenchmarkIndex.objects.filter(
            index_symbol='^GSPC',
            date__gte=start_date,
            date__lte=end_date,
        ).order_by('date').values('date', 'close')
    )

    if not records:
        return _build_strategy_result('S&P 500 Benchmark', pd.Series(dtype=float), start_year, end_year)

    values = pd.Series(
        [r['close'] for r in records],
        index=[r['date'] for r in records],
    )
    return _build_strategy_result('S&P 500 Benchmark', values, start_year, end_year)


@register_strategy(
    'top5_market_cap',
    'Top 5 Market Cap',
    'Buy the top 5 companies by market cap each year, equal weight, rebalance annually',
)
def top5_market_cap(start_year: int = 2016, end_year: int = 2025) -> dict:
    return _top_n_strategy(5, start_year, end_year)


@register_strategy(
    'top10_market_cap',
    'Top 10 Market Cap',
    'Buy the top 10 companies by market cap each year, equal weight, rebalance annually',
)
def top10_market_cap(start_year: int = 2016, end_year: int = 2025) -> dict:
    return _top_n_strategy(10, start_year, end_year)


@register_strategy(
    'top20_market_cap',
    'Top 20 Market Cap',
    'Buy the top 20 companies by market cap each year, equal weight, rebalance annually',
)
def top20_market_cap(start_year: int = 2016, end_year: int = 2025) -> dict:
    return _top_n_strategy(20, start_year, end_year)


def _top_n_strategy(n: int, start_year: int, end_year: int) -> dict:
    """Generic top-N market cap strategy with annual rebalancing and equal weight."""
    all_rankings = {}
    for year in range(start_year, end_year + 1):
        rankings = list(
            MarketCapRanking.objects.filter(year=year, rank__lte=n)
            .values_list('company__ticker', flat=True)
        )
        all_rankings[year] = rankings

    all_tickers = set()
    for tickers in all_rankings.values():
        all_tickers.update(tickers)

    prices_df = _get_annual_prices(list(all_tickers), start_year, end_year)
    if prices_df.empty:
        name = f'Top {n} Market Cap' if n != 20 else 'Top 20 Equal Weight'
        return _build_strategy_result(name, pd.Series(dtype=float), start_year, end_year)

    portfolio_value = 1.0
    daily_values = []
    daily_dates = []

    for year in range(start_year, end_year + 1):
        tickers = all_rankings.get(year, [])
        if not tickers:
            continue

        year_start = date(year, 1, 2)
        year_end = date(year, 12, 31)
        year_mask = (prices_df.index >= year_start) & (prices_df.index <= year_end)
        year_prices = prices_df.loc[year_mask]

        available = [t for t in tickers if t in year_prices.columns]
        if not available:
            continue

        year_slice = year_prices[available].dropna(how='all')
        if year_slice.empty:
            continue

        weight = 1.0 / len(available)
        daily_returns = year_slice.pct_change().fillna(0)

        for dt, row in daily_returns.iterrows():
            day_return = sum(row.get(t, 0) * weight for t in available)
            portfolio_value *= (1 + day_return)
            daily_values.append(portfolio_value)
            daily_dates.append(dt)

    if not daily_values:
        name = f'Top {n} Market Cap' if n != 20 else 'Top 20 Equal Weight'
        return _build_strategy_result(name, pd.Series(dtype=float), start_year, end_year)

    values = pd.Series(daily_values, index=daily_dates)
    name = f'Top {n} Market Cap' if n != 20 else 'Top 20 Equal Weight'
    return _build_strategy_result(name, values, start_year, end_year)


@register_strategy(
    'momentum',
    'Momentum (Rank Gainers)',
    'Buy companies that moved up the most in rank year-over-year, rebalance annually',
)
def momentum_strategy(start_year: int = 2016, end_year: int = 2025) -> dict:
    portfolio_value = 1.0
    daily_values = []
    daily_dates = []

    for year in range(max(start_year, 2017), end_year + 1):
        current = {
            r['company__ticker']: r['rank']
            for r in MarketCapRanking.objects.filter(year=year).values('company__ticker', 'rank')
        }
        previous = {
            r['company__ticker']: r['rank']
            for r in MarketCapRanking.objects.filter(year=year - 1).values('company__ticker', 'rank')
        }

        movers = []
        for ticker, curr_rank in current.items():
            if ticker in previous:
                rank_change = previous[ticker] - curr_rank
                if rank_change > 0:
                    movers.append((ticker, rank_change))

        movers.sort(key=lambda x: -x[1])
        top_movers = [t for t, _ in movers[:5]]

        if not top_movers:
            continue

        prices_df = _get_annual_prices(top_movers, year, year)
        if prices_df.empty:
            continue

        year_start = date(year, 1, 2)
        year_end = date(year, 12, 31)
        year_mask = (prices_df.index >= year_start) & (prices_df.index <= year_end)
        year_prices = prices_df.loc[year_mask]

        available = [t for t in top_movers if t in year_prices.columns]
        if not available:
            continue

        year_slice = year_prices[available].dropna(how='all')
        if year_slice.empty:
            continue

        weight = 1.0 / len(available)
        daily_returns = year_slice.pct_change().fillna(0)

        for dt, row in daily_returns.iterrows():
            day_return = sum(row.get(t, 0) * weight for t in available)
            portfolio_value *= (1 + day_return)
            daily_values.append(portfolio_value)
            daily_dates.append(dt)

    values = pd.Series(daily_values, index=daily_dates) if daily_values else pd.Series(dtype=float)
    return _build_strategy_result('Momentum (Rank Gainers)', values, start_year, end_year)


@register_strategy(
    'buy_and_hold_faang',
    'Buy & Hold FAANG+',
    'Buy and hold META, AAPL, AMZN, NVDA, GOOGL equal weight from start',
)
def buy_hold_faang(start_year: int = 2016, end_year: int = 2025) -> dict:
    tickers = ['META', 'AAPL', 'AMZN', 'NVDA', 'GOOGL']
    prices_df = _get_annual_prices(tickers, start_year, end_year)
    if prices_df.empty:
        return _build_strategy_result('Buy & Hold FAANG+', pd.Series(dtype=float), start_year, end_year)

    available = [t for t in tickers if t in prices_df.columns]
    if not available:
        return _build_strategy_result('Buy & Hold FAANG+', pd.Series(dtype=float), start_year, end_year)

    weight = 1.0 / len(available)
    daily_returns = prices_df[available].pct_change().fillna(0)
    portfolio_returns = daily_returns.sum(axis=1) * weight
    cumulative = (1 + portfolio_returns).cumprod()

    return _build_strategy_result('Buy & Hold FAANG+', cumulative, start_year, end_year)
