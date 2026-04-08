import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { ImageAssets } from '../ImageAssets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppFonts } from '../AppFonts'
import { useAuth } from '../../hooks/useAuth'
import { useNavigation } from '@react-navigation/native'

type LandingHeaderProps = {
  onLoginPress: () => void
  onSignupPress: () => void
  onSearchPress?: () => void
  onBackPress?: () => void
}

export const LandingHeader = ({
  onLoginPress,
  onSignupPress,
  onSearchPress,
  onBackPress,
}: LandingHeaderProps) => {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { isAuthenticated, user, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileAnchorRef = useRef<View>(null)
  const [profileMenuRect, setProfileMenuRect] = useState({ top: 0, left: 0 })
  const isDemo = useMemo(() => (user as any)?.role === 'demo' || (user as any)?.isDemo === true, [user])
  const walletBalance = isDemo ? 0 : Number(user?.wallet?.balance ?? 0)
  const walletLabel = `₹${walletBalance.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  const displayName = useMemo(() => {
    const fullName = String(user?.fullName ?? '').trim()
    if (fullName) return fullName.toUpperCase()
    const username = String(user?.username ?? '').trim()
    if (username) return username.toUpperCase()
    const mobile = String(user?.mobile ?? '').trim()
    if (mobile) return `USER ${mobile.slice(-4)}`
    return 'USER'
  }, [user?.fullName, user?.mobile, user?.username])


  const handleLogout = async () => {
    setProfileOpen(false)
    await logout()
    navigation.navigate('Login', { initialTab: 'login' })
  }

  const openProfileMenu = useCallback(() => {
    profileAnchorRef.current?.measureInWindow((x, y, width, height) => {
      setProfileMenuRect({
        top: y + height + 6,
        left: Math.max(8, x + width - 280),
      })
      setProfileOpen(true)
    })
  }, [])

  const TAB_SCREEN_NAMES = useMemo(
    () =>
      new Set([
        'Menu',
        'Casino',
        'Home',
        'InPlay',
        'SportsBook',
        'GameRules',
        'Promotions',
        'ReferralRewards',
        'Transactions',
        'MyBets',
        'BetHistory',
        'GameHistory',
        'MyWallet',
        'BettingProfitLoss',
        'AccountStatement',
        'Support',
        'Deposit',
        'Withdrawal',
      ]),
    [],
  )

  const deepestFocusedRouteName = useCallback((state: any): string | null => {
    if (!state?.routes || typeof state.index !== 'number') return null
    const route = state.routes[state.index]
    if (route?.state) return deepestFocusedRouteName(route.state) || route.name || null
    return route?.name ?? null
  }, [])

  /** Bottom-tab name for `returnToTab` (Transactions / Game History / Withdrawal / Deposit). */
  const getReturnTabName = useCallback((): string => {
    try {
      const root = typeof navigation.getRootState === 'function' ? navigation.getRootState() : navigation.getState()
      const leaf = deepestFocusedRouteName(root)
      if (typeof leaf === 'string' && TAB_SCREEN_NAMES.has(leaf)) {
        if (leaf === 'Menu') return 'Home'
        return leaf
      }
    } catch {
      // ignore
    }
    return 'Home'
  }, [navigation, deepestFocusedRouteName, TAB_SCREEN_NAMES])

  if (isAuthenticated) {
    return (
      <>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.leftCluster}>
            <Image source={ImageAssets.logoPng} style={styles.logoAuth} resizeMode="contain" />
          </View>

          <View style={styles.authActions}>
            {isDemo ? (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Demo Mode</Text>
              </View>
            ) : (
              <View style={styles.walletChip}>
                <Text>🇮🇳</Text>
                <Text style={styles.walletText}>{walletLabel}</Text>
              </View>
            )}

            {!isDemo && (
              <Pressable
                style={[styles.iconBtn, styles.plusBtn]}
                onPress={() => navigation.navigate('Deposit', { returnToTab: getReturnTabName() })}
              >
                <Text style={styles.plusText}>+</Text>
              </Pressable>
            )}

            <Pressable style={styles.iconBtn} onPress={onSearchPress}>
              <Image source={ImageAssets.search} style={{ width: 16, height: 16, tintColor: '#fff' }} resizeMode="contain" />
            </Pressable>

            <View ref={profileAnchorRef} collapsable={false}>
              <Pressable style={styles.profileBtn} onPress={openProfileMenu}>
                <Image source={ImageAssets.userVectorPng} style={styles.profileImg} resizeMode="cover" />
                <Image source={ImageAssets.down} style={styles.profileDown} resizeMode="contain" />
              </Pressable>
            </View>
          </View>
        </View>

        {profileOpen ? (
          <Modal transparent visible={profileOpen} animationType="fade" onRequestClose={() => setProfileOpen(false)}>
            <View style={styles.dropdownModalRoot}>
              <Pressable style={styles.dropdownBackdrop} onPress={() => setProfileOpen(false)} />
              <View style={[styles.dropdownCard, { top: profileMenuRect.top, left: profileMenuRect.left }]}>
                <View style={styles.dropdownHeader}>
                  <Image source={ImageAssets.userVectorPng} style={styles.dropdownUserImg} resizeMode="cover" />
                  <Text style={styles.dropdownUserName}>{displayName}</Text>
                </View>
                <Pressable style={styles.dropdownItem} onPress={() => { setProfileOpen(false); navigation.navigate('MyProfile') }}>
                  <Text style={styles.dropdownItemText}>My Profile</Text>
                </Pressable>
                <Pressable style={styles.dropdownItem} onPress={() => { setProfileOpen(false); navigation.navigate('AddAccount') }}>
                  <Text style={styles.dropdownItemText}>Account</Text>
                </Pressable>
                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileOpen(false)
                    navigation.navigate('Transactions', { returnToTab: getReturnTabName() })
                  }}
                >
                  <Text style={styles.dropdownItemText}>Transaction History</Text>
                </Pressable>
                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileOpen(false)
                    navigation.navigate('GameHistory', { returnToTab: getReturnTabName() })
                  }}
                >
                  <Text style={styles.dropdownItemText}>Game History</Text>
                </Pressable>
                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileOpen(false)
                    navigation.navigate('Withdrawal', { returnToTab: getReturnTabName() })
                  }}
                >
                  <Text style={styles.dropdownItemText}>Withdrawal</Text>
                </Pressable>
                <Pressable style={styles.logoutBtn} onPress={() => void handleLogout()}>
                  <Text style={styles.logoutBtnText}>Log out</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        ) : null}
      </>
    )
  }

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.leftCluster}>
        {onBackPress ? (
          <Pressable onPress={onBackPress} style={styles.backBtn} hitSlop={10} accessibilityRole="button">
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
        ) : null}
        <Image source={ImageAssets.logoPng} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.topActions}>
        <Pressable style={styles.iconBtn} onPress={onSearchPress}>
          {/* <Text style={styles.iconBtnText}>⌕</Text> */}
          <Image source={ImageAssets.search} style={{width:16,height:16,tintColor:'#fff'}} resizeMode="contain" />
        </Pressable>

        <Pressable style={styles.topBtn} onPress={onLoginPress}>
          <Text style={styles.topBtnText}>Login</Text>
        </Pressable>

        <Pressable style={[styles.topBtn, styles.topBtnPrimary]} onPress={onSignupPress}>
          <Text style={styles.topBtnPrimaryText}>Sign Up</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#0E1A32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 20,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  backBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 2,
    marginLeft: -4,
  },
  backChevron: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '300',
  },
  logo: {
    width: 120,
    height: 34,
    flexShrink: 1,
  },
  logoAuth: {
    width: 100,
    height: 34,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  authActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletChip: {
    minWidth: 116,
    height: 38,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,

    backgroundColor: '#1F2B45',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flagIcon: { width: 14, height: 14, borderRadius: 7 },
  walletText: {
    color: '#EAF2FF',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 13,
  },
  demoBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  demoBadgeText: {
    color: '#CBD5E1',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1B2740',
    justifyContent: 'center',
    alignItems: 'center',
    right:12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  plusBtn: {
    backgroundColor: '#D5702A',
    
  },
  plusText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 24,
    marginTop: -2,
  },
  profileBtn: {
    width: 42,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1B2740',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  profileImg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#273A57',
  },
  profileDown: {
    width: 10,
    height: 10,
    tintColor: '#FFFFFF',
  },
  dropdownModalRoot: {
    flex: 1,
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dropdownCard: {
    position: 'absolute',
    right: 10,
    width: 280,
    backgroundColor: '#12233A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#283A52',
    overflow: 'hidden',
  },
  dropdownHeader: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3C53',
    alignItems: 'center',
    gap: 10,
  },
  dropdownUserImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#F3F6FF',
  },
  dropdownUserName: {
    color: '#fff',
    fontFamily: AppFonts.montserratBold,
    fontSize: 14,
  },
  dropdownItem: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#22344B',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    color: '#F5F8FF',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 15,
  },
  logoutBtn: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#26374C',
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontFamily: AppFonts.montserratBold,
    fontSize: 16,
  },
  iconBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  topBtn: {
    backgroundColor: '#1F2B45',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  topBtnText: {
    color: '#FFFFFF',
    fontFamily: AppFonts.montserratSemiBold,
  },
  topBtnPrimary: {
    backgroundColor: '#D5702A',
  },
  topBtnPrimaryText: {
    color: '#FFF',
    fontFamily: AppFonts.montserratSemiBold,
  },
})
