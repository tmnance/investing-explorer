"""
One-time consolidation of ticker aliases.
Reassigns MarketCapRanking and PriceHistory from alias companies (e.g. FB)
to canonical companies (e.g. META), then deletes the alias company.
Run after adding TickerAlias records and migrating the schema.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from market.models import Company, MarketCapRanking, PriceHistory, TickerAlias
from market.ticker_aliases import seed_default_aliases


class Command(BaseCommand):
    help = 'Consolidate ticker aliases: move rankings and price history to canonical company, then delete alias'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        seed_default_aliases()

        for alias in TickerAlias.objects.all():
            self.stdout.write(f'Processing {alias.old_ticker} -> {alias.canonical_ticker}')

            try:
                alias_company = Company.objects.get(ticker=alias.old_ticker)
            except Company.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f'  No company with ticker {alias.old_ticker}, skipping'
                ))
                continue

            canonical_company, created = Company.objects.get_or_create(
                ticker=alias.canonical_ticker,
                defaults={'name': alias_company.name},
            )
            if created:
                self.stdout.write(f'  Created canonical company {alias.canonical_ticker}')
            elif not created and canonical_company.name != alias_company.name:
                # Prefer the longer/more recent name (e.g. Meta Platforms over Facebook)
                if len(alias_company.name) > len(canonical_company.name):
                    canonical_company.name = alias_company.name
                    if not dry_run:
                        canonical_company.save(update_fields=['name'])

            ranking_count = MarketCapRanking.objects.filter(company=alias_company).count()
            if ranking_count > 0:
                if dry_run:
                    self.stdout.write(
                        f'  Would reassign {ranking_count} MarketCapRanking(s) to {alias.canonical_ticker}'
                    )
                else:
                    with transaction.atomic():
                        MarketCapRanking.objects.filter(company=alias_company).update(
                            company=canonical_company
                        )
                    self.stdout.write(f'  Reassigned {ranking_count} MarketCapRanking(s)')

            price_count = PriceHistory.objects.filter(company=alias_company).count()
            if price_count > 0:
                if dry_run:
                    self.stdout.write(
                        f'  Would merge {price_count} PriceHistory row(s) into {alias.canonical_ticker}'
                    )
                else:
                    merged, skipped = self._merge_price_history(alias_company, canonical_company)
                    self.stdout.write(
                        f'  Merged {merged} PriceHistory row(s), skipped {skipped} duplicates'
                    )

            if not dry_run:
                alias_company.delete()
                self.stdout.write(self.style.SUCCESS(f'  Deleted company {alias.old_ticker}'))

        self.stdout.write(self.style.SUCCESS('Done.'))

    def _merge_price_history(self, alias_company, canonical_company):
        """Move alias company price history to canonical. Skip dates that already exist."""
        alias_prices = PriceHistory.objects.filter(company=alias_company).order_by('date')
        canonical_dates = set(
            PriceHistory.objects.filter(company=canonical_company)
            .values_list('date', flat=True)
        )
        merged = 0
        skipped = 0
        for ph in alias_prices:
            if ph.date in canonical_dates:
                ph.delete()
                skipped += 1
            else:
                ph.company = canonical_company
                ph.save()
                merged += 1
                canonical_dates.add(ph.date)
        return merged, skipped
