/**
 * Industry term definitions for tooltips across the app.
 */
export const GLOSSARY: Record<string, string> = {
  CAGR:
    'Compound Annual Growth Rate — the geometric average annual return over a period, as if the investment grew at a constant rate each year.',
  'Sharpe Ratio':
    'Risk-adjusted return: (return − risk-free rate) ÷ volatility. Higher is better; compares excess return per unit of total risk.',
  'Sortino Ratio':
    'Like Sharpe but uses downside deviation instead of total volatility. Penalizes only bad volatility; higher is better.',
  'Max DD':
    'Maximum Drawdown — the largest peak-to-trough decline over the period. Expressed as a negative percentage.',
  'Max Drawdown':
    'The largest peak-to-trough decline over the period. Expressed as a negative percentage.',
  Volatility:
    'Annualized standard deviation of returns. Measures how much returns vary over time; higher means more risk.',
  'Total Return':
    'Cumulative return over the period: (ending value ÷ starting value) − 1, often expressed as a percentage.',
  'Market Cap':
    'Market capitalization — total dollar value of a company’s outstanding shares (price × shares).',
  Rank: 'Position by market cap among the set (e.g. #1 = largest).',
  YTD: 'Year to date — return or change from the start of the current calendar year.',
  Benchmark:
    'A reference index or portfolio (e.g. S&P 500) used to compare performance.',
  Rebalance:
    'Adjusting portfolio weights back to target (e.g. equal weight) at set intervals (e.g. annually).',
  'Calmar Ratio':
    'CAGR ÷ |max drawdown|. Measures return per unit of worst-case risk; higher is better.',
  'After-Tax CAGR':
    'Estimated CAGR after federal capital gains taxes, blended by turnover: short-term gains (37%) on the rebalanced portion and long-term gains (20%) on the rest.',
  'Tax Drag':
    'The annual return lost to taxes — the difference between pre-tax and after-tax CAGR. Higher turnover means more tax drag.',
  'Tax Impact':
    'Estimated effect of U.S. federal capital gains taxes on strategy returns. Based on 37% short-term and 20% long-term rates, blended by portfolio turnover.',
  Turnover:
    'The fraction of the portfolio replaced each year through rebalancing. Higher turnover generates more taxable events.',
  'Win Rate':
    'Percentage of calendar years with a positive return. A 70% win rate means 7 out of 10 years were profitable.',
  'Best Year':
    'The highest single-year return achieved by the strategy over the backtest period.',
  'Worst Year':
    'The lowest single-year return (largest loss) suffered by the strategy over the backtest period.',
}

export type GlossaryTerm = keyof typeof GLOSSARY

export function getGlossaryDefinition(term: string): string | undefined {
  return GLOSSARY[term]
}
