export const API_ENDPOINTS = {
  // Auth
  login: '/api/v1/auth/login',
  register: '/api/v1/auth/register',
  sendOtp: '/api/v1/auth/send-otp',
  demoLogin: '/api/v1/auth/demo-login',
  refreshToken: '/api/v1/auth/refresh-token',
  forgotPasswordSendOtp: '/api/v1/auth/forgot-password/send-otp',
  forgotPasswordReset: '/api/v1/auth/forgot-password/reset',
  logout: '/api/v1/auth/logout',
  me: '/api/v1/auth/me',

  // User & Profile
  userProfile: '/api/v1/auth/profile',
  platformConfig: '/api/v1/user/platform-configuration',
  transactionLimits: '/api/v1/user/transaction-limits',
  depositAccountsMaster: '/api/v1/user/deposit-accounts/master',

  // Referral
  referralDashboard: '/api/v1/referral/dashboard',
  referralBalance: '/api/v1/referral/balance',
  referralList: '/api/v1/referral/referrals',
  referralProfit: '/api/v1/referral/profit',
  referralClaim: '/api/v1/referral/claim',
  referralApply: '/api/v1/referral/apply',
  referralExport: '/api/v1/referral/referrals/export',
  referralRewardsLive: '/api/v1/referral/rewards/live',
  referralRewardsHistory: '/api/v1/referral/rewards/history',

  // Wallet
  balance: '/api/v1/wallet/balance',
  walletStatement: '/api/v1/wallet/statement',
  walletTransactions: '/api/v1/wallet/transactions',
  walletDeposit: '/api/v1/wallet/deposit',
  walletGenerateAddress: '/api/v1/wallet/generate-address',
  walletVerifyUsdtDeposit: '/api/v1/wallet/verify-usdt-deposit',

  /** GET /api/v1/account/statement – same as web getAccountStatementFromAccount */
  accountStatement: '/api/v1/account/statement',

  // Games
  gamesLanding: '/api/v1/games/landing',
  gamesList: '/api/v1/games',
  gamesProviders: '/api/v1/games/providers',
  gamesCategories: '/api/v1/games/categories',
  gamesLaunch: '/api/v1/games/launch',
  gamesHistory: '/api/v1/games/history',
  gamesTransactions: '/api/v1/games/transactions',
  gamesTransactionHistory: '/api/v1/games/transaction-history',
  gamesSportsbookTransactions: '/api/v1/games/sportsbook/transactions',

  // Sportsbook
  sportsbookCricketMatches: '/api/v1/sportsbook/cricket/matches',
  sportsbookTennisMatches: '/api/v1/sportsbook/tennis/matches',
  sportsbookSoccerMatches: '/api/v1/sportsbook/soccer/matches',
  sportsbookBetOpen: '/api/v1/sportsbook/bet/open',
  sportsbookBetHistory: '/api/v1/sportsbook/bet/history',
  sportsbookBetCancel: '/api/v1/sportsbook/bet',
  sportsbookProfitLoss: '/api/v1/sportsbook/profit-loss',

  // Support
  supportTickets: '/api/v1/support/tickets',
}
