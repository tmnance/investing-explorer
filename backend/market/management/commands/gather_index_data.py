from django.core.management.base import BaseCommand
from market.models import BenchmarkIndex
import yfinance as yf
from datetime import date


INDICES = {
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones',
    '^IXIC': 'Nasdaq Composite',
    '^RUT': 'Russell 2000',
}


class Command(BaseCommand):
    help = 'Gather benchmark index data using yfinance'

    def add_arguments(self, parser):
        parser.add_argument('--start', default='2015-01-01', help='Start date (YYYY-MM-DD)')
        parser.add_argument('--end', default=str(date.today()), help='End date (YYYY-MM-DD)')

    def handle(self, *args, **options):
        start = options['start']
        end = options['end']

        for symbol, name in INDICES.items():
            self.stdout.write(f'Gathering {name} ({symbol})...', ending='')
            try:
                ticker = yf.Ticker(symbol)
                df = ticker.history(start=start, end=end)

                if df.empty:
                    self.stdout.write(self.style.WARNING(' no data'))
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
                    date__gte=start,
                    date__lte=end,
                ).delete()
                BenchmarkIndex.objects.bulk_create(records, batch_size=500)
                self.stdout.write(self.style.SUCCESS(f' {len(records)} records'))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f' error: {e}'))

        self.stdout.write(self.style.SUCCESS('Done gathering index data.'))
