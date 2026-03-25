import React from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { ImageAssets } from '../ImageAssets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppFonts } from '../AppFonts'

type LandingHeaderProps = {
  onLoginPress: () => void
  onSignupPress: () => void
  onSearchPress?: () => void
}

export const LandingHeader = ({
  onLoginPress,
  onSignupPress,
  onSearchPress,
}: LandingHeaderProps) => {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <Image source={ImageAssets.logoPng} style={styles.logo} resizeMode="contain" />

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
  },
  logo: {
    width: 132,
    height: 34,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1B2740',
    justifyContent: 'center',
    alignItems: 'center',
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
