# Generated manually for TickerAlias model

from datetime import date

from django.db import migrations, models


def seed_ticker_aliases(apps, schema_editor):
    TickerAlias = apps.get_model('market', 'TickerAlias')
    TickerAlias.objects.get_or_create(
        old_ticker='FB',
        defaults={'canonical_ticker': 'META', 'effective_date': date(2022, 6, 9)},
    )


def reverse_seed(apps, schema_editor):
    TickerAlias = apps.get_model('market', 'TickerAlias')
    TickerAlias.objects.filter(old_ticker='FB').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('market', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TickerAlias',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('old_ticker', models.CharField(db_index=True, max_length=10)),
                ('canonical_ticker', models.CharField(max_length=10)),
                ('effective_date', models.DateField()),
            ],
            options={
                'verbose_name_plural': 'ticker aliases',
                'ordering': ['old_ticker'],
            },
        ),
        migrations.RunPython(seed_ticker_aliases, reverse_seed),
    ]
