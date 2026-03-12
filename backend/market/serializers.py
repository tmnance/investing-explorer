from rest_framework import serializers
from .models import Company, MarketCapRanking, PriceHistory, BenchmarkIndex


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['ticker', 'name', 'sector', 'industry']


class MarketCapRankingSerializer(serializers.ModelSerializer):
    ticker = serializers.CharField(source='company.ticker')
    company_name = serializers.CharField(source='company.name')

    class Meta:
        model = MarketCapRanking
        fields = ['id', 'year', 'rank', 'ticker', 'company_name', 'market_cap']


class PriceHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceHistory
        fields = ['date', 'open', 'high', 'low', 'close', 'volume', 'adj_close']


class BenchmarkIndexSerializer(serializers.ModelSerializer):
    class Meta:
        model = BenchmarkIndex
        fields = ['index_symbol', 'index_name', 'date', 'close']
