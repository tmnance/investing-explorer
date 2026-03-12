from django.db import models


class Company(models.Model):
    ticker = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=200)
    sector = models.CharField(max_length=100, blank=True, default='')
    industry = models.CharField(max_length=200, blank=True, default='')

    class Meta:
        verbose_name_plural = 'companies'
        ordering = ['ticker']

    def __str__(self):
        return f"{self.ticker} - {self.name}"


class MarketCapRanking(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='rankings')
    year = models.IntegerField()
    rank = models.IntegerField()
    market_cap = models.FloatField(help_text='Market cap in USD')

    class Meta:
        ordering = ['year', 'rank']
        unique_together = ['company', 'year']
        indexes = [
            models.Index(fields=['year', 'rank']),
            models.Index(fields=['company', 'year']),
        ]

    def __str__(self):
        return f"{self.year} #{self.rank}: {self.company.ticker}"


class PriceHistory(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='prices')
    date = models.DateField()
    open = models.FloatField()
    high = models.FloatField()
    low = models.FloatField()
    close = models.FloatField()
    volume = models.BigIntegerField()
    adj_close = models.FloatField()

    class Meta:
        verbose_name_plural = 'price histories'
        ordering = ['company', 'date']
        unique_together = ['company', 'date']
        indexes = [
            models.Index(fields=['company', 'date']),
            models.Index(fields=['date']),
        ]

    def __str__(self):
        return f"{self.company.ticker} {self.date}: ${self.close:.2f}"


class BenchmarkIndex(models.Model):
    index_symbol = models.CharField(max_length=20)
    index_name = models.CharField(max_length=100)
    date = models.DateField()
    close = models.FloatField()

    class Meta:
        verbose_name_plural = 'benchmark indices'
        ordering = ['index_symbol', 'date']
        unique_together = ['index_symbol', 'date']
        indexes = [
            models.Index(fields=['index_symbol', 'date']),
            models.Index(fields=['date']),
        ]

    def __str__(self):
        return f"{self.index_symbol} {self.date}: {self.close:.2f}"
