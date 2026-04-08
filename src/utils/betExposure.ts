/**
 * Ported from web bookSummaryUtils.js
 * Exposure (P/L) calculation for runners.
 */

function normSel(s: string): string {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export type ExposureBet = {
  selection: string
  odds: number
  stake: number
  betType: 'back' | 'lay'
}

/**
 * Calculates current P/L for a set of possible outcome labels (runners)
 * given a list of matched and/or pending bets.
 */
export function computeOutcomePlTable(
  bets: ExposureBet[],
  outcomes: string[]
): Record<string, number> {
  if (!outcomes.length) return {}
  const result: Record<string, number> = {}

  for (const winningTarget of outcomes) {
    const winningNorm = normSel(winningTarget)
    let pl = 0
    for (const bet of bets) {
      const bsel = normSel(bet.selection)
      const s = Number(bet.stake) || 0
      const o = Number(bet.odds) || 0
      if (s <= 0 || o < 1.01) continue

      const bt = bet.betType.toLowerCase()
      if (bt === 'back') {
        if (bsel === winningNorm) pl += s * (o - 1)
        else pl -= s
      } else {
        if (bsel === winningNorm) pl -= s * (o - 1)
        else pl += s
      }
    }
    result[winningTarget] = pl
  }
  return result
}

/**
 * Merges open bets for a specific market with current slip for live P/L preview.
 */
export function collectMarketBets({
  openBets = [],
  marketId,
  selectedBet,
  stake,
}: {
  openBets: any[]
  marketId: string
  selectedBet?: any | null
  stake?: string
}) {
  const mid = String(marketId)
  
  // 1. Matched bets from server
  const fromOpen: ExposureBet[] = openBets
    .filter(b => String(b.marketId ?? b.market_id ?? '') === mid)
    .map(b => ({
      selection: String(b.selectionName ?? b.selection_name ?? ''),
      odds: Number(b.odds ?? b.executedOdds ?? 0),
      stake: Number(b.stake) || 0,
      betType: String(b.betType ?? b.bet_type ?? 'back').toLowerCase() as 'back' | 'lay',
    }))

  // 2. Add pending slip bet if it matches this market
  if (selectedBet && selectedBet.placePayload && String(selectedBet.placePayload.marketId) === mid) {
    const s = Number(stake) || 0
    if (s > 0) {
      fromOpen.push({
        selection: String(selectedBet.placePayload.selectionName),
        odds: Number(selectedBet.odds),
        stake: s,
        betType: String(selectedBet.placePayload.betType).toLowerCase() as 'back' | 'lay',
      })
    }
  }

  return fromOpen
}
