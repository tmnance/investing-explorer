from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'companies', views.CompanyViewSet, basename='company')
router.register(r'rankings', views.MarketCapRankingViewSet, basename='ranking')

urlpatterns = [
    path('', include(router.urls)),
    path('prices/<str:ticker>/', views.price_history, name='price-history'),
    path('benchmarks/', views.benchmark_data, name='benchmark-data'),
    path('benchmarks/latest/', views.benchmark_latest, name='benchmark-latest'),
    path('strategies/', views.available_strategies, name='available-strategies'),
    path('strategies/compare/', views.strategy_comparison, name='strategy-comparison'),
    path('simulator/', views.portfolio_simulator, name='portfolio-simulator'),
]
