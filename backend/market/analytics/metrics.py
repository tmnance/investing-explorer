import numpy as np
from typing import Optional


def compute_returns(prices: np.ndarray) -> np.ndarray:
    """Compute daily returns from a price series."""
    return np.diff(prices) / prices[:-1]


def cagr(prices: np.ndarray, trading_days_per_year: float = 252) -> float:
    """Compound annual growth rate."""
    if len(prices) < 2 or prices[0] == 0:
        return 0.0
    total_return = prices[-1] / prices[0]
    n_years = len(prices) / trading_days_per_year
    if n_years == 0:
        return 0.0
    return float(total_return ** (1 / n_years) - 1)


def total_return(prices: np.ndarray) -> float:
    if len(prices) < 2 or prices[0] == 0:
        return 0.0
    return float((prices[-1] / prices[0]) - 1)


def annualized_volatility(prices: np.ndarray, trading_days_per_year: float = 252) -> float:
    """Annualized volatility (standard deviation of returns)."""
    returns = compute_returns(prices)
    if len(returns) == 0:
        return 0.0
    return float(np.std(returns, ddof=1) * np.sqrt(trading_days_per_year))


def sharpe_ratio(
    prices: np.ndarray,
    risk_free_rate: float = 0.04,
    trading_days_per_year: float = 252,
) -> float:
    """Annualized Sharpe ratio."""
    ann_ret = cagr(prices, trading_days_per_year)
    vol = annualized_volatility(prices, trading_days_per_year)
    if vol == 0:
        return 0.0
    return float((ann_ret - risk_free_rate) / vol)


def sortino_ratio(
    prices: np.ndarray,
    risk_free_rate: float = 0.04,
    trading_days_per_year: float = 252,
) -> float:
    """Annualized Sortino ratio (uses downside deviation)."""
    returns = compute_returns(prices)
    if len(returns) == 0:
        return 0.0
    ann_ret = cagr(prices, trading_days_per_year)
    downside = returns[returns < 0]
    if len(downside) == 0:
        return 0.0
    downside_std = float(np.std(downside, ddof=1) * np.sqrt(trading_days_per_year))
    if downside_std == 0:
        return 0.0
    return float((ann_ret - risk_free_rate) / downside_std)


def max_drawdown(prices: np.ndarray) -> float:
    """Maximum drawdown as a negative fraction."""
    if len(prices) < 2:
        return 0.0
    running_max = np.maximum.accumulate(prices)
    drawdowns = (prices - running_max) / running_max
    return float(np.min(drawdowns))


def compute_all_metrics(prices: np.ndarray) -> dict:
    """Compute all risk/return metrics for a price series."""
    return {
        'total_return': total_return(prices),
        'cagr': cagr(prices),
        'volatility': annualized_volatility(prices),
        'sharpe_ratio': sharpe_ratio(prices),
        'sortino_ratio': sortino_ratio(prices),
        'max_drawdown': max_drawdown(prices),
    }
