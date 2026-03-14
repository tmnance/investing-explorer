"""
Incremental sync of price and benchmark index data.
Pulls only data after the latest date we already have.
"""
from datetime import date, timedelta

import yfinance as yf

from .models import Company, PriceHistory, BenchmarkIndex
from django.db.models import Max

INDICES = {
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones',
    '^IXIC': 'Nasdaq Composite',
    '^RUT': 'Russell 2000',
}


def _yf_ticker(ticker: str) -> str:
    """Convert our ticker to yfinance format (e.g. BRK.B -> BRK-B)."""
    return ticker.replace('.', '-') if '.' in ticker else ticker


def get_sync_status():
    """Return the latest dates we have data for."""
    price_max = PriceHistory.objects.aggregate(Max('date'))['date__max']
    index_max = BenchmarkIndex.objects.aggregate(Max('date'))['date__max']
    return {
        'prices_latest': str(price_max) if price_max else None,
        'indices_latest': str(index_max) if index_max else None,
    }


def run_sync():
    """
    Pull incremental price and index data from the day after our latest dates.
    Returns dict with counts and any errors.
    """
    today = date.today()
    result = {'price_records': 0, 'index_records': 0, 'errors': []}

    # Prices: use global max date (prices may have gaps per ticker, but we sync all from same start)
    price_max = PriceHistory.objects.aggregate(Max('date'))['date__max']
    price_start = (price_max + timedelta(days=1)) if price_max else date(2015, 1, 1)

    if price_start <= today:
        companies = Company.objects.all()
        for company in companies:
            try:
                yf_symbol = _yf_ticker(company.ticker)
                ticker = yf.Ticker(yf_symbol)
                df = ticker.history(start=str(price_start), end=str(today), auto_adjust=False)

                if df.empty:
                    continue

                records = []
                for dt, row in df.iterrows():
                    records.append(PriceHistory(
                        company=company,
                        date=dt.date(),
                        open=row['Open'],
                        high=row['High'],
                        low=row['Low'],
                        close=row['Close'],
                        volume=int(row['Volume']),
                        adj_close=row.get('Adj Close', row['Close']),
                    ))

                # Upsert: delete existing in range, then insert
                PriceHistory.objects.filter(
                    company=company,
                    date__gte=price_start,
                    date__lte=today,
                ).delete()
                PriceHistory.objects.bulk_create(records, batch_size=500)
                result['price_records'] += len(records)

            except Exception as e:
                result['errors'].append(f'{company.ticker}: {e}')

    # Indices
    index_max = BenchmarkIndex.objects.aggregate(Max('date'))['date__max']
    index_start = (index_max + timedelta(days=1)) if index_max else date(2015, 1, 1)

    if index_start <= today:
        for symbol, name in INDICES.items():
            try:
                ticker = yf.Ticker(symbol)
                df = ticker.history(start=str(index_start), end=str(today))

                if df.empty:
                    continue

                records = []
                for dt, row in df.iterrows():
                    records.append(BenchmarkIndex(
                        index_symbol=symbol,
                        index_name=name,
                        date=dt.date(),
                        close=row['Close'],
                    ))

                BenchmarkIndex.objects.filter(
                    index_symbol=symbol,
                    date__gte=index_start,
                    date__lte=today,
                ).delete()
                BenchmarkIndex.objects.bulk_create(records, batch_size=500)
                result['index_records'] += len(records)

            except Exception as e:
                result['errors'].append(f'{symbol}: {e}')

    result['status'] = get_sync_status()
    return result
