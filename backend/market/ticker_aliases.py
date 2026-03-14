"""
Ticker alias resolution for companies that have renamed their stock ticker.
Example: FB -> META (Meta Platforms, effective June 9, 2022).
"""
from datetime import date
from typing import Optional

from .models import TickerAlias


def resolve_canonical(ticker: str, year: int) -> str:
    """
    Resolve a ticker to its canonical form for the given year.
    If the ticker was renamed (e.g., FB -> META), returns the canonical ticker
    that should be used for data consistency.
    - For years before the rename: old_ticker (FB) -> canonical (META)
    - For years on/after the rename: ticker is already canonical, return as-is
    """
    try:
        alias = TickerAlias.objects.get(old_ticker=ticker.upper())
    except TickerAlias.DoesNotExist:
        return ticker

    # Use year-end as cutoff: if the rename happened in 2022, year 2021 and earlier
    # used the old ticker; year 2022+ uses the new ticker in source data.
    # We always normalize to canonical, so FB 2021 -> META.
    return alias.canonical_ticker


def resolve_ticker_for_lookup(ticker: str) -> Optional[str]:
    """
    Resolve a ticker for API lookups. If the given ticker is an alias,
    returns the canonical ticker. Otherwise returns None (use as-is).
    Used for /companies/FB/ -> return META's data.
    """
    try:
        alias = TickerAlias.objects.get(old_ticker=ticker.upper())
        return alias.canonical_ticker
    except TickerAlias.DoesNotExist:
        return None


def seed_default_aliases():
    """Seed TickerAlias with known ticker renames."""
    defaults = [
        ('FB', 'META', date(2022, 6, 9)),  # Meta Platforms (Facebook) ticker change
    ]
    for old, canonical, effective in defaults:
        TickerAlias.objects.get_or_create(
            old_ticker=old,
            defaults={'canonical_ticker': canonical, 'effective_date': effective},
        )
