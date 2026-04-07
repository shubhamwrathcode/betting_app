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
  Home: 'home',
  Casino: 'casino',
  InPlay: 'inplay',
  SportsBook: 'sportsbook',
  Transactions: 'transactions',
  MyBets: 'mybets',
  BetHistory: 'bethistory',
  GameHistory: 'gamehistory',
  MyWallet: 'wallet',
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

const MenuScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const activeMenuKey = useNavigationState(state => {
    const tabName = getFocusedTabScreenName(state)
    return tabName ? TAB_NAME_TO_MENU_KEY[tabName] : 'home'
  })

  const goToTab = (screen: string) => {
    navigation.navigate('Tabs', { screen })
    navigation.closeDrawer()
  }

  const openAction = (screen: string) => {
    navigation.closeDrawer()
    navigation.navigate('Tabs', { screen: screen })
  }

  const menuItems: (MenuItem & { authOnly?: boolean })[] = [
    { key: 'home', label: 'Home', icon: ImageAssets.homeline, onPress: () => goToTab('Home') },
    { key: 'casino', label: 'Casino', icon: ImageAssets.spade, onPress: () => goToTab('Casino') },
    { key: 'inplay', label: 'InPlay', icon: ImageAssets.gamepad, onPress: () => goToTab('InPlay') },
    { key: 'sportsbook', label: 'SportsBook', icon: ImageAssets.basketballFill, onPress: () => goToTab('SportsBook') },
    { key: 'rules', label: 'Game Rules', icon: ImageAssets.bookopenfill, onPress: () => openAction('GameRules') },
    { key: 'referral', label: 'Referral', icon: ImageAssets.Referal, onPress: () => openAction('ReferralRewards'), authOnly: true },
    { key: 'transactions', label: 'Transactions', icon: ImageAssets.transactionMenu, onPress: () => openAction('Transactions'), authOnly: true },
    { key: 'mybets', label: 'My Bets', icon: ImageAssets.flagBets, onPress: () => openAction('MyBets'), authOnly: true },
    { key: 'bethistory', label: 'Bet History', icon: ImageAssets.bethistory, onPress: () => openAction('BetHistory'), authOnly: true },
    { key: 'gamehistory', label: 'Game History', icon: ImageAssets.gamepad, onPress: () => openAction('GameHistory'), authOnly: true },
    { key: 'wallet', label: 'My Wallet', icon: ImageAssets.walletfill, onPress: () => openAction('MyWallet'), authOnly: true },
    { key: 'statement', label: 'Account Statement', icon: ImageAssets.bankfill, onPress: () => openAction('AccountStatement'), authOnly: true },
    { key: 'support', label: 'Live Support', icon: ImageAssets.customerSupport, onPress: () => openAction('Support'), authOnly: true },
    { key: 'notifications', label: 'Notifications', icon: ImageAssets.promotion, onPress: () => { }, authOnly: true },
  ]

  return (
    <View style={styles.screen}>
      <View style={[styles.drawer, { paddingTop: insets.top + 16 }]}>
        {/* Buttons Row */}
        <View style={styles.ctaRow}>
          <PrimaryButton
            title="Deposit"
            onPress={() => openAction('Deposit')}
            colors={['#2B9454', '#1F7E46']}
            style={styles.ctaBtn}
            textStyle={styles.ctaText}
            leftIcon={<Image source={ImageAssets.walletfill} tintColor={'#FFFFFF'} style={styles.btnIcon} />}
          />
          <PrimaryButton
            title="Withdraw"
            onPress={() => openAction('Withdrawal')}
            colors={['#F17B31', '#CD6828']}
            style={styles.ctaBtn}
            textStyle={styles.ctaText}
            leftIcon={<Image source={ImageAssets.bankfill} tintColor={'#FFFFFF'} style={styles.btnIcon} />}
          />
        </View>

        {/* Menu List */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
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
                  } else {
                    item.onPress()
                  }
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
      <Pressable style={styles.overlay} onPress={() => navigation.closeDrawer()} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row' },
  drawer: {
    width: '100%',
    backgroundColor: '#0B1624',
    paddingHorizontal: 12,
  },
  overlay: { width: '20%', backgroundColor: '#0B1624', },
  ctaRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  ctaBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  btnIcon: { width: 14, height: 14 },
  ctaText: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 13 },
  listContainer: { paddingBottom: 60 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 1,
  },
  menuItemActive: { backgroundColor: '#FF8B2D' },
  iconBox: { width: 30, alignItems: 'flex-start' },
  menuIcon: { width: 18, height: 18, tintColor: '#8E9BAC', resizeMode: 'contain' },
  menuIconActive: { tintColor: '#FFFFFF' },
  menuLabel: { color: '#D1DAE6', fontFamily: AppFonts.montserratMedium, fontSize: 14.5, marginLeft: 2 },
  menuLabelActive: { color: '#FFFFFF', fontFamily: AppFonts.montserratSemiBold },
})

export default MenuScreen
