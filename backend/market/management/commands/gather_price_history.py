from django.core.management.base import BaseCommand
from market.models import Company, PriceHistory
import yfinance as yf
from datetime import date


class Command(BaseCommand):
    help = 'Gather historical price data for all tracked companies using yfinance'

    def add_arguments(self, parser):
        parser.add_argument('--start', default='2015-01-01', help='Start date (YYYY-MM-DD)')
        parser.add_argument('--end', default=str(date.today()), help='End date (YYYY-MM-DD)')
        parser.add_argument('--tickers', nargs='*', help='Specific tickers to gather (default: all)')

    def handle(self, *args, **options):
        start = options['start']
        end = options['end']

        if options['tickers']:
            companies = Company.objects.filter(ticker__in=options['tickers'])
        else:
            companies = Company.objects.all()

        total = companies.count()
        self.stdout.write(f'Gathering price data for {total} companies ({start} to {end})...')

        for i, company in enumerate(companies, 1):
            self.stdout.write(f'  [{i}/{total}] {company.ticker}...', ending='')
            try:
                ticker = yf.Ticker(company.ticker)
                df = ticker.history(start=start, end=end, auto_adjust=False)

                if df.empty:
                    self.stdout.write(self.style.WARNING(' no data'))
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

                PriceHistory.objects.filter(
                    company=company,
                    date__gte=start,
                    date__lte=end,
                ).delete()
                PriceHistory.objects.bulk_create(records, batch_size=500)
                self.stdout.write(self.style.SUCCESS(f' {len(records)} records'))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f' error: {e}'))

        self.stdout.write(self.style.SUCCESS('Done gathering price history.'))
