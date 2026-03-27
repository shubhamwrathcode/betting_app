import React, { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import Toast from 'react-native-toast-message'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { PROMO_CARDS, PromoCardModel } from './promotionsData'

type PlatformConfigResp = {
  data?: { bonusServiceStatus?: boolean }
  success?: boolean
}

const PromoCard = ({ item }: { item: PromoCardModel }) => {
  const imageBottom = item.variant === 'basketball' ? 18 : item.variant === 'cricket' ? 6 : 0
  const outerOverflow = item.variant === 'startbig' ? 'hidden' : 'visible'

  return (
    <View style={[styles.cardOuter, { overflow: outerOverflow }]}>
      <LinearGradient
        colors={[item.colors[0], item.colors[1]]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.cardGradient}
      >
        <LinearGradient
          colors={['rgba(29,34,43,0)', 'rgba(29,34,43,0.92)']}
          locations={[0, 1]}
          style={styles.cardBottomShade}
          pointerEvents="none"
        />
        <View style={styles.cardContent}>
          <View style={styles.textBlock}>
            <Text style={styles.cardTitle}>{item.titleLines[0]}</Text>
            <Text style={styles.cardTitle}>{item.titleLines[1]}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </View>
        </View>
      </LinearGradient>
      <View style={[styles.imgWrap, { bottom: imageBottom }]} pointerEvents="none">
        <Image source={item.image} style={styles.cardImage} resizeMode="contain" />
      </View>
    </View>
  )
}

type PromotionsRouteParams = { returnToTab?: string }

const PromotionsScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ Promotions: PromotionsRouteParams }, 'Promotions'>>()
  const insets = useSafeAreaInsets()
  const [bonusOk, setBonusOk] = useState(true)
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const goBack = useCallback(() => {
    navigation.navigate(returnToTab)
  }, [navigation, returnToTab])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await apiClient<PlatformConfigResp & Record<string, unknown>>(API_ENDPOINTS.platformConfig, {
          method: 'GET',
        })
        const raw = res as Record<string, unknown>
        const nested = raw?.data as Record<string, unknown> | undefined
        const data = (nested?.data as Record<string, unknown> | undefined) ?? nested
        const flag = data?.bonusServiceStatus as boolean | undefined
        if (cancelled) return
        if (typeof flag === 'boolean') {
          setBonusOk(flag)
          if (!flag) {
            Toast.show({
              type: 'error',
              text1: 'Promotions unavailable',
              text2: 'Promotions / Bonus is temporarily unavailable. Please try again later.',
            })
          }
        }
      } catch {
        if (!cancelled) setBonusOk(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 100 }]}
      >
        {!bonusOk ? (
          <View style={styles.disabledBanner}>
            <Text style={styles.disabledText}>
              Promotions / Bonus is temporarily unavailable. Please try again later.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.topHd}>
              <Text style={styles.topHdTitle}>Promotions</Text>
              <Text style={styles.topHdSub}>All promotions will be shown here.</Text>
            </View>
            {PROMO_CARDS.map(item => (
              <PromoCard key={item.id} item={item} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const CARD_H = 152
const SHADE_H = 88

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#040f21',
  },
  scrollInner: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topHd: {
    backgroundColor: '#16202C',
    padding: 20,
    borderRadius: 8,
    marginBottom: 24,
  },
  topHdTitle: {
    color: '#FFFFFF',
    fontFamily: AppFonts.montserratBold,
    fontSize: 20,
  },
  topHdSub: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 14,
  },
  disabledBanner: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  disabledText: {
    color: '#FCA5A5',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  cardOuter: {
    marginBottom: 48,
    borderRadius: 10,
    position: 'relative',
    minHeight: CARD_H,
  },
  cardGradient: {
    minHeight: CARD_H,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardBottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHADE_H,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  cardContent: {
    minHeight: CARD_H,
    paddingLeft: 20,
    paddingRight: 120,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  textBlock: {
    maxWidth: '58%',
    zIndex: 2,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontFamily: AppFonts.montserratBold,
    fontSize: 17,
    lineHeight: 22,
    // fontWeight: '800',
  },
  cardDesc: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.76)',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  imgWrap: {
    position: 'absolute',
    right: -8,
    bottom: 0,
    width: 150,
    height: CARD_H + 36,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    zIndex: 4,
  },
  cardImage: {
    width: 150,
    height: 150,
    marginBottom: -14,
    marginRight: -4,
  },
})

export default PromotionsScreen
