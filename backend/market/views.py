from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db.models import Max, Min, OuterRef, Subquery
from django.db import connection
from .models import Company, MarketCapRanking, PriceHistory, BenchmarkIndex
from .serializers import (
    CompanySerializer,
    MarketCapRankingSerializer,
    PriceHistorySerializer,
    BenchmarkIndexSerializer,
)
import json
import numpy as np
import pandas as pd
from datetime import date as date_cls
from .analytics.strategies import get_available_strategies, run_strategy
from .analytics.metrics import compute_all_metrics
from .market_cap import get_realtime_rankings
from .sync import get_sync_status, run_sync
from .ticker_aliases import resolve_ticker_for_lookup


class CompanyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    lookup_field = 'ticker'
    pagination_class = None

    def get_object(self):
        ticker = self.kwargs.get(self.lookup_field)
        if ticker:
            canonical = resolve_ticker_for_lookup(ticker)
            if canonical:
                self.kwargs = {**self.kwargs, self.lookup_field: canonical}
        return super().get_object()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': len(serializer.data),
            'next': None,
            'previous': None,
            'results': serializer.data,
        })


class MarketCapRankingViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MarketCapRankingSerializer
    pagination_class = None

    def _current_year_if_needed(self):
        """
        Return the current calendar year if it's beyond the latest ranking
        year and we have price data for it; otherwise None.
        """
        latest_ranking_year = MarketCapRanking.objects.aggregate(Max('year'))['year__max']
        if not latest_ranking_year:
            return None
        current_year = date_cls.today().year
        if current_year <= latest_ranking_year:
            return None
        has_prices = PriceHistory.objects.filter(
            date__year=current_year,
        ).exists()
        return current_year if has_prices else None

    def _realtime_rankings_data(self, current_year, ticker_filter=None):
        """Build serializer-compatible dicts for the computed current year."""
        rows = get_realtime_rankings(limit=20)
        data = [{
            'id': -(i + 1),
            'year': current_year,
            'rank': r['rank'],
            'ticker': r['ticker'],
            'company_name': r['name'],
            'market_cap': r['estimated_market_cap'],
        } for i, r in enumerate(rows)]
        if ticker_filter:
            data = [d for d in data if d['ticker'] == ticker_filter]
        return data

    def get_queryset(self):
        qs = MarketCapRanking.objects.select_related('company').all()
        year = self.request.query_params.get('year')
        ticker = self.request.query_params.get('ticker')
        if year:
            qs = qs.filter(year=year)
        if ticker:
            lookup_ticker = resolve_ticker_for_lookup(ticker) or ticker
            qs = qs.filter(company__ticker=lookup_ticker)
        return qs

    def _resolve_ticker_param(self):
        """Return the canonical ticker from the query params, or None."""
        ticker = self.request.query_params.get('ticker')
        if not ticker:
            return None
        return resolve_ticker_for_lookup(ticker) or ticker

    def list(self, request, *args, **kwargs):
        year_param = request.query_params.get('year')
        current_year = self._current_year_if_needed()
        ticker_filter = self._resolve_ticker_param()

        if year_param and current_year and int(year_param) == current_year:
            data = self._realtime_rankings_data(current_year, ticker_filter)
            return Response({
                'count': len(data),
                'next': None,
                'previous': None,
                'results': data,
            })

        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        results = list(serializer.data)

        if not year_param and current_year:
            results.extend(self._realtime_rankings_data(current_year, ticker_filter))

        return Response({
            'count': len(results),
            'next': None,
            'previous': None,
            'results': results,
        })

    @action(detail=False, methods=['get'])
    def years(self, request):
        years = list(
            MarketCapRanking.objects
            .values_list('year', flat=True)
            .distinct()
            .order_by('-year')
        )
        current_year = self._current_year_if_needed()
        if current_year:
            years.insert(0, current_year)
        return Response(years)

    @action(detail=False, methods=['get'])
    def top_movers(self, request):
        latest_year = MarketCapRanking.objects.aggregate(Max('year'))['year__max']
        if not latest_year:
            return Response({'gainers': [], 'losers': []})

        prev_year = latest_year - 1

        current = {
            r.company_id: r
            for r in MarketCapRanking.objects.filter(year=latest_year).select_related('company')
        }
        previous = {
            r.company_id: r
            for r in MarketCapRanking.objects.filter(year=prev_year).select_related('company')
        }

        movers = []
        for ticker, curr in current.items():
            prev = previous.get(ticker)
            if prev:
                rank_change = prev.rank - curr.rank
                movers.append((curr, rank_change))

        gainers_raw = sorted([m for m in movers if m[1] > 0], key=lambda x: -x[1])
        losers_raw = sorted([m for m in movers if m[1] < 0], key=lambda x: x[1])

        new_entries = [
            curr for ticker, curr in current.items()
            if ticker not in previous
        ]

        context = self.get_serializer_context()
        gainers = MarketCapRankingSerializer(
            [m[0] for m in gainers_raw[:5]] + new_entries[:3],
            many=True,
            context=context,
        ).data
        losers = MarketCapRankingSerializer(
            [m[0] for m in losers_raw[:5]],
            many=True,
            context=context,
        ).data

        return Response({'gainers': gainers, 'losers': losers})


@api_view(['GET'])
def price_history(request, ticker):
    lookup_ticker = resolve_ticker_for_lookup(ticker) or ticker
    try:
        company = Company.objects.get(ticker=lookup_ticker)
    except Company.DoesNotExist:
        return Response({'error': 'Company not found'}, status=status.HTTP_404_NOT_FOUND)

    qs = PriceHistory.objects.filter(company=company)

    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    if start_date:
        qs = qs.filter(date__gte=start_date)
    if end_date:
        qs = qs.filter(date__lte=end_date)

    serializer = PriceHistorySerializer(qs, many=True)
    return Response(serializer.data)


MAX_BENCHMARK_POINTS = 500


@api_view(['GET'])
def benchmark_data(request):
    start_date = request.query_params.get('start_date', '2015-01-01')
    end_date = request.query_params.get('end_date') or str(date_cls.today())

    symbols = list(BenchmarkIndex.objects.values_list('index_symbol', flat=True).distinct())
    if not symbols:
        return Response([])

    result = []
    with connection.cursor() as cursor:
        for symbol in symbols:
            # First get the total number of points for this symbol and range
            cursor.execute(
                """
                SELECT COUNT(*) FROM market_benchmarkindex
                WHERE index_symbol = %s AND date >= %s AND date <= %s
                """,
                [symbol, start_date, end_date],
            )
            total_points = cursor.fetchone()[0] or 0
            if total_points == 0:
                continue

            # Compute a sampling step so we never exceed MAX_BENCHMARK_POINTS
            step = max(1, total_points // MAX_BENCHMARK_POINTS)  # 1 = no sampling

            cursor.execute(
                """
                SELECT date, close, index_name FROM (
                    SELECT date, close, index_name,
                           ROW_NUMBER() OVER (ORDER BY date) - 1 AS rn
                    FROM market_benchmarkindex
                    WHERE index_symbol = %s AND date >= %s AND date <= %s
                ) sub
                WHERE rn %% %s = 0
                ORDER BY date
                """,
                [symbol, start_date, end_date, step],
            )
            rows = cursor.fetchall()
            if not rows:
                continue

            first_close = float(rows[0][1])
            index_name = rows[0][2]
            result.append({
                'index_symbol': symbol,
                'index_name': index_name,
                'dates': [str(r[0]) for r in rows],
                'normalized_values': [float(r[1]) / first_close for r in rows],
            })

    return Response(result)


@api_view(['GET'])
def benchmark_latest(request):
    # Single query: latest record per index_symbol (one row per symbol)
    latest_pks = BenchmarkIndex.objects.filter(
        index_symbol=OuterRef('index_symbol'),
    ).order_by('-date').values('pk')[:1]
    qs = BenchmarkIndex.objects.filter(
        pk__in=BenchmarkIndex.objects.values('index_symbol').annotate(
            latest_pk=Subquery(latest_pks),
        ).values_list('latest_pk', flat=True),
    ).order_by('index_symbol')
    data = BenchmarkIndexSerializer(qs, many=True).data
    return Response(data)


@api_view(['GET'])
def available_strategies(request):
    return Response(get_available_strategies())


@api_view(['GET'])
def strategy_comparison(request):
    strategy_ids = request.query_params.get('strategies', '')
    if not strategy_ids:
        return Response({'error': 'strategies parameter required'}, status=status.HTTP_400_BAD_REQUEST)

    ids = [s.strip() for s in strategy_ids.split(',') if s.strip()]
    start_year = int(request.query_params.get('start_year', 2016))
    end_year = int(request.query_params.get('end_year', 2025))

    results = []
    for sid in ids:
        try:
            results.append(run_strategy(sid, start_year, end_year))
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(results)


@api_view(['GET'])
def portfolio_simulator(request):
    allocations_str = request.query_params.get('allocations', '[]')
    try:
        allocations = json.loads(allocations_str)
    except json.JSONDecodeError:
        return Response({'error': 'Invalid allocations JSON'}, status=status.HTTP_400_BAD_REQUEST)

    if not allocations:
        return Response({'error': 'No allocations provided'}, status=status.HTTP_400_BAD_REQUEST)

    start_year = int(request.query_params.get('start_year', 2016))
    end_year = int(request.query_params.get('end_year', 2025))
    benchmarks_param = request.query_params.get('benchmarks', '^GSPC')
    benchmarks_selected = [b.strip() for b in benchmarks_param.split(',') if b.strip()]
    ALLOWED = {'^GSPC', '^DJI', '^IXIC'}
    benchmarks_selected = [b for b in benchmarks_selected if b in ALLOWED]
    if not benchmarks_selected:
        benchmarks_selected = ['^GSPC']

    start_date = date_cls(start_year, 1, 1)
    end_date = date_cls(end_year, 12, 31)

    tickers = [a['ticker'] for a in allocations]
    weights = {a['ticker']: a['weight'] for a in allocations}

    all_prices = PriceHistory.objects.filter(
        company__ticker__in=tickers,
        date__gte=start_date,
        date__lte=end_date,
    ).values('company__ticker', 'date', 'adj_close').order_by('date')

    if not all_prices:
        return Response({'error': 'No price data for selected tickers'}, status=status.HTTP_400_BAD_REQUEST)

    df = pd.DataFrame(list(all_prices))
    df = df.pivot(index='date', columns='company__ticker', values='adj_close').sort_index()

    available = [t for t in tickers if t in df.columns]
    if not available:
        return Response({'error': 'No price data for any selected ticker'}, status=status.HTTP_400_BAD_REQUEST)

    df = df[available].dropna(how='all').ffill()
    daily_returns = df.pct_change().fillna(0)

    portfolio_returns = sum(daily_returns[t] * weights.get(t, 0) for t in available)
    portfolio_cumulative = (1 + portfolio_returns).cumprod()

    BENCHMARK_NAMES = {'^GSPC': 'S&P 500', '^DJI': 'Dow Jones', '^IXIC': 'Nasdaq'}

    benchmark_series_list = []
    for symbol in benchmarks_selected:
        benchmark_records = list(
            BenchmarkIndex.objects.filter(
                index_symbol=symbol,
                date__gte=start_date,
                date__lte=end_date,
            ).order_by('date').values('date', 'close')
        )

        if not benchmark_records:
            continue

        benchmark_series = pd.Series(
            [r['close'] for r in benchmark_records],
            index=[r['date'] for r in benchmark_records],
        )
        benchmark_cumulative = benchmark_series / benchmark_series.iloc[0]
        benchmark_series_list.append((BENCHMARK_NAMES[symbol], benchmark_cumulative))

    common_dates = portfolio_cumulative.index
    for _, b_series in benchmark_series_list:
        common_dates = common_dates.intersection(b_series.index)

    p_vals = portfolio_cumulative.loc[common_dates]
    p_metrics = compute_all_metrics(p_vals.values.astype(float))

    benchmarks_data = []
    for name, b_series in benchmark_series_list:
        b_vals = b_series.loc[common_dates]
        b_vals_renorm = b_vals / b_vals.iloc[0]
        b_metrics = compute_all_metrics(b_vals_renorm.values.astype(float))
        benchmarks_data.append({
            'name': name,
            'values': b_vals_renorm.tolist(),
            'metrics': b_metrics,
        })

    return Response({
        'dates': [str(d) for d in common_dates],
        'portfolio_values': p_vals.tolist(),
        'benchmarks': benchmarks_data,
        'metrics': p_metrics,
    })


@api_view(['GET'])
def sync_status(request):
    return Response(get_sync_status())


@api_view(['POST'])
def sync_data(request):
    result = run_sync()
    return Response(result)
