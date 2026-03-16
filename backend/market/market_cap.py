"""
Compute estimated daily market caps using implied shares outstanding.

Approach: shares_outstanding ≈ annual_market_cap / close_price_at_year_end
Then:     daily_market_cap  ≈ shares_outstanding × daily_close
"""

from datetime import date

from django.db import connection


def get_realtime_rankings(limit=20):
    """
    Top N companies by estimated current market cap.

    For each company with a MarketCapRanking, derives implied shares
    outstanding from the most recent ranking year's market cap and
    year-end close price, then multiplies by the latest close price.

    Returns list of dicts:
        ticker, name, estimated_market_cap, price_date, rank
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            WITH latest_rank AS (
                SELECT company_id, year, market_cap,
                       ROW_NUMBER() OVER (
                           PARTITION BY company_id ORDER BY year DESC
                       ) as rn
                FROM market_marketcapranking
            ),
            year_end AS (
                SELECT ph.company_id, ph.close,
                       ROW_NUMBER() OVER (
                           PARTITION BY ph.company_id ORDER BY ph.date DESC
                       ) as rn
                FROM market_pricehistory ph
                INNER JOIN latest_rank lr
                    ON lr.company_id = ph.company_id AND lr.rn = 1
                WHERE ph.date BETWEEN lr.year || '-01-01' AND lr.year || '-12-31'
            ),
            newest AS (
                SELECT ph.company_id, ph.close, ph.date,
                       ROW_NUMBER() OVER (
                           PARTITION BY ph.company_id ORDER BY ph.date DESC
                       ) as rn
                FROM market_pricehistory ph
                INNER JOIN latest_rank lr
                    ON lr.company_id = ph.company_id AND lr.rn = 1
            )
            SELECT
                c.ticker,
                c.name,
                CASE WHEN ye.close > 0
                    THEN (lr.market_cap / ye.close) * nw.close
                    ELSE lr.market_cap
                END as estimated_market_cap,
                nw.date as price_date
            FROM latest_rank lr
            JOIN market_company c ON c.ticker = lr.company_id
            LEFT JOIN year_end ye ON ye.company_id = lr.company_id AND ye.rn = 1
            LEFT JOIN newest nw ON nw.company_id = lr.company_id AND nw.rn = 1
            WHERE lr.rn = 1 AND nw.close IS NOT NULL
            ORDER BY estimated_market_cap DESC
            LIMIT %s
        """, [limit])
        columns = [col[0] for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

    for i, row in enumerate(rows):
        row['rank'] = i + 1

    return rows


def get_implied_shares():
    """
    Compute implied shares outstanding for every (company, year) pair
    in MarketCapRanking.

    Returns {ticker: {year: implied_shares}}.
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT r.company_id, r.year, r.market_cap, (
                SELECT ph.close
                FROM market_pricehistory ph
                WHERE ph.company_id = r.company_id
                  AND ph.date BETWEEN r.year || '-01-01' AND r.year || '-12-31'
                ORDER BY ph.date DESC
                LIMIT 1
            ) as year_end_close
            FROM market_marketcapranking r
        """)

        shares_map = {}
        for company_id, year, market_cap, close in cursor.fetchall():
            if close and close > 0:
                shares_map.setdefault(company_id, {})[year] = market_cap / close

    return shares_map
