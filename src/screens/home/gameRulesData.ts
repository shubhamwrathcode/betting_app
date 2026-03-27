export type RuleBullet = { bold: string; body: string }

export type RuleSectionModel = {
  id: string
  title: string
  bullets: RuleBullet[]
}

export const GAME_RULE_SECTIONS: RuleSectionModel[] = [
  {
    id: 'cricket',
    title: 'Cricket Betting Rules',
    bullets: [
      {
        bold: 'Match result :',
        body:
          ' Settled on the official result as declared by the governing body. For limited-overs matches, the result is after the scheduled overs (or revised overs in case of D/L or VJD). Tie, no result, or abandonment is settled as per the official competition rules.',
      },
      {
        bold: 'Minimum overs :',
        body:
          ' For match winner and most run markets, a minimum number of overs must be bowled for bets to stand: Test matches – at least 60 overs in the fourth innings (unless a result is achieved earlier); One-Day matches – at least 25 overs per side (or as per official rules); T20 – at least 10 overs per side (or as per official rules). If the match is reduced and the minimum is not met, match bets are void and stakes returned.',
      },
      {
        bold: 'Duckworth-Lewis / VJD :',
        body:
          ' Where the result is determined by D/L or VJD, that result is used for settlement. Bets placed after the interruption may be voided if the market was offered in error.',
      },
      {
        bold: 'Postponement / Abandonment :',
        body:
          ' If a match is postponed and not played on the scheduled date (or official reserve day where applicable), all bets on that match are void unless the match is played within the timeframe specified in the market rules. If a match is abandoned without an official result, match winner and similar markets are void; markets already determined (e.g. first innings runs, session runs) may be settled at the figure when play stopped.',
      },
      {
        bold: 'Session / Fancy / Innings runs :',
        body:
          ' Session and innings runs are settled at the score when the relevant session or innings is complete or when the match is officially stopped. Once a session is completed and settled, it is not reversed even if the match is later abandoned or no result.',
      },
      {
        bold: 'Player markets (top batsman, runs, wickets) :',
        body:
          ' The player must take part in the match (bat or bowl as applicable) for bets to stand. If the player does not participate, bets are void. Settlement is based on official statistics.',
      },
    ],
  },
  {
    id: 'football',
    title: 'Football Betting Rules',
    bullets: [
      {
        bold: 'Match result (1X2, Draw No Bet, etc.) :',
        body:
          ' Settled on the result at the end of normal time (90 minutes plus injury time). Extra time and penalty shootouts do not count unless the market explicitly states “Including Extra Time” or “To Qualify”.',
      },
      {
        bold: 'Postponement :',
        body:
          ' If a match is postponed and not played within 48 hours of the original scheduled kick-off time (unless otherwise stated in the market), all bets on that match are void and stakes returned.',
      },
      {
        bold: 'Abandonment :',
        body:
          ' If a match is abandoned after kick-off and not resumed within 48 hours, all bets are void except for markets whose outcome has already been determined (e.g. first half result, first goal scorer if a goal was scored, corners in first half). Such determined markets are settled on the result at the time of abandonment.',
      },
      {
        bold: 'Own goals :',
        body:
          ' Count towards the team that benefits from the goal (the team that scores it) for total goals and correct score markets. For “first goal scorer” and “anytime scorer”, the player credited with the goal (including own goal) is the winner.',
      },
      {
        bold: 'Cards and corners :',
        body:
          ' Only cards shown to players on the field during normal time count. Corners awarded but not taken (e.g. match abandoned) do not count. Settlement is based on official match statistics.',
      },
    ],
  },
  {
    id: 'tennis',
    title: 'Tennis & Other Sports',
    bullets: [
      {
        bold: 'Tennis – Match winner :',
        body:
          ' Settled on the winner of the match. If a player retires or is disqualified, the player who advances is the winner and all match bets stand. Set and game markets may be void if not completed.',
      },
      {
        bold: 'Walkover :',
        body:
          ' If a player receives a walkover before the match has started, all bets on that match are void. If the match has started and a player retires, match winner bets stand on the player who advances.',
      },
      {
        bold: 'Other sports :',
        body:
          ' Settlement is based on the official result and rules of the governing body for that sport. In case of dispute, our decision (based on official sources) is final.',
      },
    ],
  },
  {
    id: 'casino',
    title: 'Casino & Games Rules',
    bullets: [
      {
        bold: 'Teen Patti (3 Patti) :',
        body:
          ' Standard Teen Patti rules apply as displayed in the game. Hand rankings (Trail, Pure Sequence, Sequence, Color, Pair, High Card) are as per the game rules. In case of tie, the hand with higher value wins as per the game’s tie rules. Dealer’s decision in live games is final.',
      },
      {
        bold: 'Roulette :',
        body:
          ' Results are determined by the ball landing in a numbered pocket. Single-zero and double-zero rules apply as per the variant. Outside bets (Red/Black, Odd/Even, Dozens) are settled according to the number. Zero may result in loss of outside bets unless “La Partage” or “En Prison” applies as stated in the game.',
      },
      {
        bold: 'Slots & RNG games :',
        body:
          ' Outcomes are determined by a certified Random Number Generator (RNG). Each spin or round is independent. Game rounds are final once the result is displayed. In case of malfunction (e.g. game freeze, incorrect display), the round may be voided and stakes returned; we will not pay out on incorrect results.',
      },
      {
        bold: 'Live dealer :',
        body:
          ' Live dealer games follow the rules displayed in the game. The dealer’s decision is final. If there is a dispute due to stream or technical error, we may void the round and refund stakes.',
      },
      {
        bold: 'Bonuses :',
        body:
          ' Bonus offers (welcome bonus, free spins, cashback, etc.) are subject to wagering requirements, game weightings, and time limits as stated in the offer terms. Bonus abuse (e.g. multiple accounts, chip dumping) will result in forfeiture of bonus and winnings and possible account closure.',
      },
    ],
  },
  {
    id: 'general',
    title: 'General Rules',
    bullets: [
      {
        bold: 'Eligibility :',
        body:
          ' You must be at least 18 years of age (or the legal age for gambling in your jurisdiction) to open an account and place bets or play games. You must not be resident in a jurisdiction where online betting or gaming is prohibited.',
      },
      {
        bold: 'One account :',
        body:
          ' Only one account per person, household, IP address, or device is permitted. Multiple accounts may be detected, closed, and balances withheld. You must provide accurate registration and KYC details; failure to do so may result in account closure and forfeiture of funds.',
      },
      {
        bold: 'Odds and stakes :',
        body:
          ' Odds at the time of bet placement are final. We reserve the right to limit stakes, refuse bets, or void bets placed in error (e.g. incorrect odds due to technical fault, obvious pricing error). Maximum payouts may apply as stated in our Terms.',
      },
      {
        bold: 'Responsible gaming :',
        body:
          ' We promote responsible gaming. You can set deposit limits, loss limits, and session time limits from your account. Self-exclusion is available. If you need help, please use the responsible gaming tools or contact support.',
      },
      {
        bold: 'Agreement :',
        body:
          ' By placing a bet or playing a game, you agree to these Game Rules and our Terms & Conditions. We reserve the right to amend these rules; continued use of the service constitutes acceptance of the updated rules.',
      },
    ],
  },
  {
    id: 'settlement',
    title: 'Settlement, Void & Fair Play',
    bullets: [
      {
        bold: 'Official result :',
        body:
          ' All settlements are based on the official result, statistics, and rules of the relevant governing body or game provider. We do not accept responsibility for incorrect data from third-party feeds; we will correct settlements when the official result is confirmed.',
      },
      {
        bold: 'Dead heat :',
        body:
          ' Where two or more selections tie for a position (e.g. top batsman tie), dead heat rules apply: payout is (stake × (odds ÷ number of tied selections)). Stake is not multiplied by the number of ties.',
      },
      {
        bold: 'Void bets :',
        body:
          ' Bets may be voided if the event is cancelled, abandoned, or declared void; if the market was offered in error; or if there is evidence of fraud, manipulation, or breach of terms. Stakes will be returned for void bets.',
      },
      {
        bold: 'Fair play :',
        body:
          ' Our games and RNG are tested for fairness. Any attempt to cheat, collude, use bots, or abuse promotions will result in account closure, forfeiture of funds, and we may report to authorities. If you have a dispute, contact support with your username and bet/transaction ID; we will investigate and respond in line with our dispute policy.',
      },
    ],
  },
]
