"""
Detailed momentum strategy analysis: events, variable-N exploration,
and start/end year permutation matrix.
"""
import pandas as pd
from datetime import date
from market.models import MarketCapRanking, PriceHistory
from .metrics import compute_all_metrics


def _get_prices(tickers, start_year, end_year):
    """Get daily adj_close prices for tickers across the given years."""
    records = PriceHistory.objects.filter(
        company__ticker__in=tickers,
        date__gte=date(start_year, 1, 1),
        date__lte=date(end_year, 12, 31),
    ).values('company__ticker', 'date', 'adj_close').order_by('date')

    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(list(records))
    df = df.pivot(index='date', columns='company__ticker', values='adj_close')
    return df.sort_index()


def _compute_annual_return(values):
    """Simple return from first to last value in a Series."""
    if len(values) < 2 or values.iloc[0] == 0:
        return 0.0
    return float((values.iloc[-1] / values.iloc[0]) - 1)


def run_momentum_detail(top_n=5, start_year=2016, end_year=2025):
    """
    Run the momentum strategy with full event detail.
    Returns timeline data, buy/sell events per rebalance, and per-year metrics.
    """
    all_rankings = {}
    for year in range(start_year - 1, end_year + 1):
        year_rankings = {
            r['company__ticker']: r['rank']
            for r in MarketCapRanking.objects.filter(year=year)
                .values('company__ticker', 'rank')
        }
        if year_rankings:
            all_rankings[year] = year_rankings

    events = []
    portfolio_value = 1.0
    daily_values = []
    daily_dates = []
    prev_holdings = set()

    for year in range(max(start_year, 2017), end_year + 1):
        current = all_rankings.get(year, {})
        previous = all_rankings.get(year - 1, {})
        if not current or not previous:
            continue

        movers = []
        for ticker, curr_rank in current.items():
            if ticker in previous:
                rank_change = previous[ticker] - curr_rank
                if rank_change > 0:
                    movers.append({
                        'ticker': ticker,
                        'rank_change': rank_change,
                        'prev_rank': previous[ticker],
                        'curr_rank': curr_rank,
                    })

        movers.sort(key=lambda x: -x['rank_change'])
        selected = movers[:top_n]
        selected_tickers = {m['ticker'] for m in selected}

        buys = selected_tickers - prev_holdings
        sells = prev_holdings - selected_tickers

        tickers_list = [m['ticker'] for m in selected]
        prices_df = _get_prices(tickers_list, year, year)

        year_return = 0.0
        year_start_value = portfolio_value

        if not prices_df.empty:
            year_start = date(year, 1, 2)
            year_end = date(year, 12, 31)
            mask = (prices_df.index >= year_start) & (prices_df.index <= year_end)
            year_prices = prices_df.loc[mask]
            available = [t for t in tickers_list if t in year_prices.columns]

            if available:
                year_slice = year_prices[available].dropna(how='all')
                if not year_slice.empty:
                    weight = 1.0 / len(available)
                    daily_returns = year_slice.pct_change().fillna(0)

                    for dt, row in daily_returns.iterrows():
                        day_return = sum(row.get(t, 0) * weight for t in available)
                        portfolio_value *= (1 + day_return)
                        daily_values.append(portfolio_value)
                        daily_dates.append(dt)

        year_return = (portfolio_value / year_start_value - 1) if year_start_value else 0.0

        events.append({
            'year': year,
            'holdings': [
                {
                    'ticker': m['ticker'],
                    'prev_rank': m['prev_rank'],
                    'curr_rank': m['curr_rank'],
                    'rank_change': m['rank_change'],
                }
                for m in selected
            ],
            'buys': sorted(buys),
            'sells': sorted(sells),
            'year_return': year_return,
            'portfolio_value': portfolio_value,
        })
        prev_holdings = selected_tickers

    values = (
        pd.Series(daily_values, index=daily_dates)
        if daily_values
        else pd.Series(dtype=float)
    )

    if values.empty:
        metrics = {
            'total_return': 0, 'cagr': 0, 'volatility': 0,
            'sharpe_ratio': 0, 'sortino_ratio': 0, 'max_drawdown': 0,
            'calmar_ratio': 0, 'after_tax_cagr': 0, 'tax_drag': 0, 'turnover': 0,
        }
    else:
        metrics = compute_all_metrics(values.values.astype(float), rebalances_per_year=1.0)

    base = values.iloc[0] if not values.empty else 1.0
    cumulative = (values / base).tolist() if not values.empty else []
    dates = [str(d) for d in values.index] if not values.empty else []

    return {
        'top_n': top_n,
        'start_year': start_year,
        'end_year': end_year,
        'dates': dates,
        'cumulative_returns': cumulative,
        'events': events,
        'metrics': metrics,
    }


def run_momentum_matrix(top_n=5, min_year=2017, max_year=2025):
    """
    Compute a matrix of CAGR values for every valid (start, end) year pair.
    Returns a list of {start, end, cagr, total_return} dicts.
    """
    all_rankings = {}
    for year in range(min_year - 1, max_year + 1):
        year_rankings = {
            r['company__ticker']: r['rank']
            for r in MarketCapRanking.objects.filter(year=year)
                .values('company__ticker', 'rank')
        }
        if year_rankings:
            all_rankings[year] = year_rankings

    all_tickers = set()
    for yr in all_rankings.values():
        all_tickers.update(yr.keys())

    prices_df = _get_prices(list(all_tickers), min_year, max_year)

    cells = []
    for sy in range(min_year, max_year + 1):
        for ey in range(sy, max_year + 1):
            portfolio_value = 1.0
            daily_values = []
            daily_dates = []

            for year in range(sy, ey + 1):
                current = all_rankings.get(year, {})
                previous = all_rankings.get(year - 1, {})
                if not current or not previous:
                    continue

                movers = []
                for ticker, curr_rank in current.items():
                    if ticker in previous:
                        rc = previous[ticker] - curr_rank
                        if rc > 0:
                            movers.append((ticker, rc))
                movers.sort(key=lambda x: -x[1])
                top_movers = [t for t, _ in movers[:top_n]]

                if not top_movers or prices_df.empty:
                    continue

                year_start = date(year, 1, 2)
                year_end = date(year, 12, 31)
                mask = (prices_df.index >= year_start) & (prices_df.index <= year_end)
                year_prices = prices_df.loc[mask]
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

            if daily_values and len(daily_values) > 1:
                arr = pd.Series(daily_values, index=daily_dates).values.astype(float)
                n_years = len(arr) / 252.0
                total_ret = float(arr[-1] / arr[0] - 1)
                cagr_val = float((arr[-1] / arr[0]) ** (1 / n_years) - 1) if n_years > 0 else 0
            else:
                total_ret = 0
                cagr_val = 0

            cells.append({
                'start': sy,
                'end': ey,
                'cagr': cagr_val,
                'total_return': total_ret,
            })

    return cells
