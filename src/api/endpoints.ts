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

  // Wallet
  balance: '/api/v1/wallet/balance',

  // Games
  gamesLanding: '/api/v1/games/landing',
  gamesList: '/api/v1/games',
  gamesProviders: '/api/v1/games/providers',
  gamesCategories: '/api/v1/games/categories',
  gamesLaunch: '/api/v1/games/launch',

  // Sportsbook
  sportsbookCricketMatches: '/api/v1/sportsbook/cricket/matches',
  sportsbookTennisMatches: '/api/v1/sportsbook/tennis/matches',
  sportsbookSoccerMatches: '/api/v1/sportsbook/soccer/matches',
}
