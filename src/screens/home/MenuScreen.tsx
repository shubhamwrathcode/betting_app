import React from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigationState } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppFonts } from '../../components/AppFonts'
import { ImageAssets } from '../../components/ImageAssets'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { useAuth } from '../../hooks/useAuth'

type MenuItem = {
  key: string
  label: string
  icon: any
  onPress: () => void
}

const TAB_NAME_TO_MENU_KEY: Record<string, string> = {
  Casino: 'casino',
  InPlay: 'inplay',
  SportsBook: 'sportsbook',
  Transactions: 'transactions',
  MyBets: 'mybets',
  BetHistory: 'bethistory',
  GameHistory: 'gamehistory',
  MyWallet: 'wallet',
  BettingProfitLoss: 'pl',
  AccountStatement: 'statement',
  Support: 'support',
  Deposit: 'deposit',
  Withdrawal: 'withdrawal',
}

function getFocusedTabScreenName(drawerState: any): string | undefined {
  const tabsRoute = drawerState?.routes?.find((r: any) => r.name === 'Tabs')
  const tabState = tabsRoute?.state
  if (!tabState?.routes?.length) return undefined
  const idx = typeof tabState.index === 'number' ? tabState.index : 0
  return tabState.routes[idx]?.name
}

/** Tab to restore when leaving Game Rules / Promotions (hidden tab bar routes). */
function getReturnTabNameForAuxScreens(navState: any): string {
  const name = getFocusedTabScreenName(navState)
  if (!name || name === 'Menu' || name === 'GameRules' || name === 'Promotions' || name === 'ReferralRewards' || name === 'Transactions' || name === 'MyBets' || name === 'BetHistory' || name === 'GameHistory' || name === 'MyWallet' || name === 'BettingProfitLoss' || name === 'AccountStatement' || name === 'Support' || name === 'Deposit' || name === 'Withdrawal')
    return 'Home'
  return name
}

const MenuScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const activeMenuKey = useNavigationState(state => {
    const tabName = getFocusedTabScreenName(state)
    return tabName ? TAB_NAME_TO_MENU_KEY[tabName] : null
  })

  const goToTab = (screen: string) => {
    navigation.navigate('Tabs', { screen })
    navigation.closeDrawer()
  }

  const openGameRules = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'GameRules', params: { returnToTab } })
  }

  const openPromotions = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'Promotions', params: { returnToTab } })
  }

  const openReferralRewards = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'ReferralRewards', params: { returnToTab } })
  }

  const openTransactions = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'Transactions', params: { returnToTab } })
  }

  const openMyBets = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'MyBets', params: { returnToTab } })
  }

  const openBetHistory = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'BetHistory', params: { returnToTab } })
  }

  const openGameHistory = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'GameHistory', params: { returnToTab } })
  }

  const openMyWallet = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'MyWallet', params: { returnToTab } })
  }

  const openBettingProfitLoss = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'BettingProfitLoss', params: { returnToTab } })
  }

  const openAccountStatement = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'AccountStatement', params: { returnToTab } })
  }

  const openSupport = () => {
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'Support', params: { returnToTab } })
  }

  const openDeposit = () => {
    if (!isAuthenticated) {
      navigation.closeDrawer()
      navigation.navigate('Login', { initialTab: 'login' })
      return
    }
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'Deposit', params: { returnToTab } })
  }

  const openWithdrawal = () => {
    if (!isAuthenticated) {
      navigation.closeDrawer()
      navigation.navigate('Login', { initialTab: 'login' })
      return
    }
    const returnToTab = getReturnTabNameForAuxScreens(navigation.getState())
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: 'Withdrawal', params: { returnToTab } })
  }

  const openAddAccount = () => {
    if (!isAuthenticated) {
      navigation.closeDrawer()
      navigation.navigate('Login', { initialTab: 'login' })
      return
    }
    navigation.closeDrawer()
    navigation.navigate('AddAccount')
  }

  const allMenuItems: (MenuItem & { authOnly?: boolean })[] = [
    { key: 'casino', label: 'Casino', icon: ImageAssets.spade, onPress: () => goToTab('Casino') },
    { key: 'inplay', label: 'InPlay', icon: ImageAssets.gamepad, onPress: () => goToTab('InPlay') },
    { key: 'sportsbook', label: 'SportsBook', icon: ImageAssets.basketballFill, onPress: () => goToTab('SportsBook') },
    { key: 'rules', label: 'Game Rules', icon: ImageAssets.bookopenfill, onPress: openGameRules },
    { key: 'promotions', label: 'Promotions', icon: ImageAssets.promotion, onPress: openPromotions },
    { key: 'referral', label: 'Referral', icon: ImageAssets.Referal, onPress: openReferralRewards, authOnly: true },
    { key: 'transactions', label: 'Transactions', icon: ImageAssets.transactionMenu, onPress: openTransactions, authOnly: true },
    { key: 'mybets', label: 'My Bets', icon: ImageAssets.flagBets, onPress: openMyBets, authOnly: true },
    { key: 'bethistory', label: 'Bet History', icon: ImageAssets.bethistory, onPress: openBetHistory, authOnly: true },
    { key: 'gamehistory', label: 'Game History', icon: ImageAssets.gamepad, onPress: openGameHistory, authOnly: true },
    { key: 'wallet', label: 'My Wallet', icon: ImageAssets.walletfill, onPress: openMyWallet, authOnly: true },
    { key: 'bankaccounts', label: 'Bank accounts', icon: ImageAssets.bankfill, onPress: openAddAccount, authOnly: true },
    { key: 'pl', label: 'Betting P&L', icon: ImageAssets.linechart, onPress: openBettingProfitLoss, authOnly: true },
    { key: 'statement', label: 'Account Statement', icon: ImageAssets.bankfill, onPress: openAccountStatement, authOnly: true },
    { key: 'support', label: 'Live Support', icon: ImageAssets.customerSupport, onPress: openSupport, authOnly: true },
  ]
  const menuItems = allMenuItems

  return (
    <View style={styles.screen}>
      <View style={[styles.drawer, { paddingTop: insets.top + 8 }]}>
        <View style={styles.ctaRow}>
          <PrimaryButton
            title="Deposit"
            onPress={openDeposit}
            colors={['#2B9454', '#1F7E46']}
            style={StyleSheet.flatten([styles.ctaBtn, styles.depositBtn])}
            textStyle={styles.ctaText}
            leftIcon={<Image source={ImageAssets.walletfill} tintColor={'#FFFFFF'} style={{width: 16, height: 16}} />}
          />
          <PrimaryButton
            title="Withdraw"
            onPress={openWithdrawal}
            colors={['#F17B31', '#CD6828']}
            style={StyleSheet.flatten([styles.ctaBtn, styles.withdrawBtn])}
            textStyle={styles.ctaText}
            leftIcon={<Image source={ImageAssets.bankfill} tintColor={'#FFFFFF'} style={{width: 16, height: 16}} />}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuList}>
          {menuItems.map(item => {
            const active = item.key === activeMenuKey
            return (
              <Pressable
                key={item.key}
                style={[styles.menuItem, active && styles.menuItemActive]}
                onPress={() => {
                  if (item.authOnly && !isAuthenticated) {
                    navigation.closeDrawer()
                    navigation.navigate('Login', { initialTab: 'login' })
                    return
                  }
                  item.onPress()
                }}
              >
                <View style={styles.iconBox}>
                  <Image source={item.icon} style={[styles.menuIcon, active && styles.menuIconActive]} />
                </View>
                <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{item.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>
      <Pressable style={styles.overlayRight} onPress={() => navigation.closeDrawer()} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingBottom: 74,
  },
  drawer: {
    width: '78%',
    backgroundColor: '#132238',
    borderRightWidth: 1,
    borderRightColor: '#1C2F4A',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  overlayRight: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  ctaRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  ctaBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    marginBottom: 0,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    overflow: 'hidden',
  },
  depositBtn: { borderColor: '#4BB978' },
  withdrawBtn: { borderColor: '#F09D62' },
  ctaText: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 13 },
  menuList: { paddingBottom: 24 },
  menuItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  menuItemActive: { backgroundColor: '#2A2E40' },
  iconBox: { width: 22, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { width: 18, height: 18, tintColor: '#C3CEDF', resizeMode: 'contain' },
  menuIconActive: { tintColor: '#FF8E40' },
  menuLabel: { color: '#EEF3FA', fontFamily: AppFonts.montserratMedium, fontSize: 15 },
  menuLabelActive: { color: '#FF8E40', fontFamily: AppFonts.montserratSemiBold },
})

export default MenuScreen

