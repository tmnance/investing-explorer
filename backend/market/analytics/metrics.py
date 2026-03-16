import numpy as np


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


def calmar_ratio(prices: np.ndarray, trading_days_per_year: float = 252) -> float:
    """CAGR / |max drawdown|. Higher is better."""
    mdd = max_drawdown(prices)
    if mdd == 0:
        return 0.0
    return float(cagr(prices, trading_days_per_year) / abs(mdd))


def tax_adjusted_cagr(
    ann_return: float,
    st_rate: float = 0.37,
    lt_rate: float = 0.20,
    turnover: float = 1.0,
) -> float:
    """
    Estimate after-tax CAGR using a blended tax rate.
    `turnover` is the fraction of the portfolio sold per year (1.0 = annual).
    Gains from the sold portion are taxed at st_rate, the rest deferred
    and eventually taxed at lt_rate.
    """
    if ann_return <= 0:
        return ann_return
    blended_rate = turnover * st_rate + (1 - turnover) * lt_rate
    return ann_return * (1 - blended_rate)


def compute_all_metrics(
    prices: np.ndarray,
    rebalances_per_year: float = 1.0,
) -> dict:
    """Compute all risk/return metrics for a price series."""
    ann_ret = cagr(prices)
    turnover = min(rebalances_per_year, 12.0) / 12.0

    after_tax = tax_adjusted_cagr(ann_ret, turnover=turnover)
    tax_drag = ann_ret - after_tax if ann_ret > 0 else 0.0

    return {
        'total_return': total_return(prices),
        'cagr': ann_ret,
        'volatility': annualized_volatility(prices),
        'sharpe_ratio': sharpe_ratio(prices),
        'sortino_ratio': sortino_ratio(prices),
        'max_drawdown': max_drawdown(prices),
        'calmar_ratio': calmar_ratio(prices),
        'after_tax_cagr': after_tax,
        'tax_drag': tax_drag,
        'turnover': turnover,
    }
