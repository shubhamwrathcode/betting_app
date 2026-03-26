import React from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppFonts } from '../../components/AppFonts'
import { ImageAssets } from '../../components/ImageAssets'
import { PrimaryButton } from '../../components/common/PrimaryButton'

type MenuItem = {
  key: string
  label: string
  icon: any
  onPress: () => void
}

const MenuScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets()
  const goToTab = (screen: string) => {
    navigation.navigate('Tabs', { screen })
    navigation.closeDrawer()
  }

  const menuItems: MenuItem[] = [
    { key: 'casino', label: 'Casino', icon: ImageAssets.spade, onPress: () => goToTab('Casino') },
    { key: 'inplay', label: 'InPlay', icon: ImageAssets.gamepad, onPress: () => goToTab('InPlay') },
    { key: 'sportsbook', label: 'SportsBook', icon: ImageAssets.basketballFill, onPress: () => goToTab('SportsBook') },
    { key: 'rules', label: 'Game Rules', icon: ImageAssets.bookopenfill, onPress: () => {} },
    { key: 'promotions', label: 'Promotions', icon: ImageAssets.promotion, onPress: () => {} },
    { key: 'referral', label: 'Referral', icon: ImageAssets.Referal, onPress: () => {} },
    { key: 'transactions', label: 'Transactions', icon: ImageAssets.transactionMenu, onPress: () => {} },
    { key: 'mybets', label: 'My Bets', icon: ImageAssets.flagBets, onPress: () => {} },
    { key: 'bethistory', label: 'Bet History', icon: ImageAssets.bethistory, onPress: () => {} },
    { key: 'gamehistory', label: 'Game History', icon: ImageAssets.gamepad, onPress: () => {} },
    { key: 'wallet', label: 'My Wallet', icon: ImageAssets.walletfill, onPress: () => {} },
    { key: 'pl', label: 'Betting P&L', icon: ImageAssets.linechart, onPress: () => {} },
    { key: 'statement', label: 'Account Statement', icon: ImageAssets.bankfill, onPress: () => {} },
    { key: 'support', label: 'Live Support', icon: ImageAssets.customerSupport, onPress: () => {} },
  ]

  return (
    <View style={styles.screen}>
      <View style={[styles.drawer, { paddingTop: insets.top + 8 }]}>
        <View style={styles.ctaRow}>
          <PrimaryButton
            title="Deposit"
            onPress={() => {}}
            colors={['#2B9454', '#1F7E46']}
            style={StyleSheet.flatten([styles.ctaBtn, styles.depositBtn])}
            textStyle={styles.ctaText}
            leftIcon={<Image source={ImageAssets.walletfill} tintColor={'#FFFFFF'} style={{width: 16, height: 16}} />}
          />
          <PrimaryButton
            title="Withdraw"
            onPress={() => {}}
            colors={['#F17B31', '#CD6828']}
            style={StyleSheet.flatten([styles.ctaBtn, styles.withdrawBtn])}
            textStyle={styles.ctaText}
            leftIcon={<Image source={ImageAssets.bankfill} tintColor={'#FFFFFF'} style={{width: 16, height: 16}} />}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuList}>
          {menuItems.map(item => {
            const active = item.key === 'sportsbook'
            return (
              <Pressable
                key={item.key}
                style={[styles.menuItem, active && styles.menuItemActive]}
                onPress={item.onPress}
              >
                <View style={styles.iconBox}>
                  <Image source={item.icon} style={[styles.menuIcon, active && styles.menuIconActive]} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
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
})

export default MenuScreen

