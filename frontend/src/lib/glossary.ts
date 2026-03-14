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
}

export type GlossaryTerm = keyof typeof GLOSSARY

export function getGlossaryDefinition(term: string): string | undefined {
  return GLOSSARY[term]
}
