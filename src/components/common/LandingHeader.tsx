import React from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { ImageAssets } from '../ImageAssets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppFonts } from '../AppFonts'
import { useAuth } from '../../hooks/useAuth'

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
  const { isAuthenticated, user } = useAuth()
  const walletBalance = Number(user?.wallet?.balance ?? 0)
  const walletLabel = `₹${walletBalance.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  if (isAuthenticated) {
    return (
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.leftCluster}>
          {/* {onBackPress ? (
            <Pressable onPress={onBackPress} style={styles.backBtn} hitSlop={10} accessibilityRole="button">
              <Text style={styles.backChevron}>‹</Text>
            </Pressable>
          ) : null} */}
          <Image source={ImageAssets.logoPng} style={styles.logoAuth} resizeMode="contain" />
        </View>

        <View style={styles.authActions}>
          <View style={styles.walletChip}>
            <Image source={ImageAssets.enPng} style={styles.flagIcon} resizeMode="contain" />
            <Text style={styles.walletText}>{walletLabel}</Text>
          </View>

          <Pressable style={[styles.iconBtn, styles.plusBtn]} onPress={() => {}}>
            <Text style={styles.plusText}>+</Text>
          </Pressable>

          <Pressable style={styles.iconBtn} onPress={onSearchPress}>
            <Image source={ImageAssets.search} style={{ width: 16, height: 16, tintColor: '#fff' }} resizeMode="contain" />
          </Pressable>

          <Pressable style={styles.profileBtn} onPress={() => {}}>
            <Image source={ImageAssets.userVectorPng} style={styles.profileImg} resizeMode="cover" />
            <Image source={ImageAssets.down} style={styles.profileDown} resizeMode="contain" />
          </Pressable>
        </View>
      </View>
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
