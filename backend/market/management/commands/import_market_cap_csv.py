import csv
from django.core.management.base import BaseCommand
from market.models import Company, MarketCapRanking
from market.ticker_aliases import resolve_canonical


def parse_market_cap(s):
    """Parse '4.533T' or '961.86B' into a float in USD."""
    s = s.strip()
    if s.endswith('T'):
        return float(s[:-1]) * 1e12
    elif s.endswith('B'):
        return float(s[:-1]) * 1e9
    elif s.endswith('M'):
        return float(s[:-1]) * 1e6
    return float(s)


class Command(BaseCommand):
    help = 'Import market cap rankings from CSV file'

    def add_arguments(self, parser):
        parser.add_argument(
            'csv_file',
            help='Path to the CSV file (e.g., sp500_top20_market_cap_2016_2025.csv)',
        )

    def handle(self, *args, **options):
        path = options['csv_file']
        created_companies = 0
        created_rankings = 0

        with open(path, newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_ticker = row['ticker'].strip()
                name = row['company'].strip()
                year = int(row['year'])
                rank = int(row['rank'])
                market_cap = parse_market_cap(row['market_cap'])

                ticker = resolve_canonical(raw_ticker, year)

                company, created = Company.objects.get_or_create(
                    ticker=ticker,
                    defaults={'name': name},
                )
                if created:
                    created_companies += 1
                elif company.name != name:
                    company.name = name
                    company.save(update_fields=['name'])

                _, created = MarketCapRanking.objects.update_or_create(
                    company=company,
                    year=year,
                    defaults={'rank': rank, 'market_cap': market_cap},
                )
                if created:
                    created_rankings += 1

        self.stdout.write(self.style.SUCCESS(
            f'Imported {created_companies} companies and {created_rankings} rankings'
        ))
