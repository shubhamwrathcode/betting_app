import React, { useCallback, useEffect, useState } from 'react'
import { Image, ImageSourcePropType, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppFonts } from '../../components/AppFonts'
import { ImageAssets } from '../../components/ImageAssets'
import { LandingHeader } from '../../components/common/LandingHeader'
import { GAME_RULE_SECTIONS, RuleSectionModel } from './gameRulesData'

const COLORS = {
  card: '#18232f',
  accent: '#F2741F',
  text: '#FFFFFF',
  muted: '#9BA3AF',
  iconBox: '#141922',
  border: '#2A3140',
}

const SECTION_ICONS: Record<string, ImageSourcePropType> = {
  cricket: ImageAssets.cricket,
  football: ImageAssets.football,
  tennis: ImageAssets.trophy,
  casino: ImageAssets.spade,
  general: ImageAssets.document,
  settlement: ImageAssets.verified,
}

/** Full-color PNGs look wrong with orange tint */
const tintCategoryIcon = (id: string) => ['casino', 'general', 'football'].includes(id)

const TIMING = { duration: 320, easing: Easing.out(Easing.cubic) }

type RuleSectionCardProps = {
  section: RuleSectionModel
  open: boolean
  onToggle: () => void
  icon: ImageSourcePropType
}

const RuleSectionCard = ({ section, open, onToggle, icon }: RuleSectionCardProps) => {
  const bodyHeight = useSharedValue(0)
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, TIMING)
  }, [open, progress])

  const onBodyLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height
    if (h > 0) {
      bodyHeight.value = h
    }
  }, [])

  const animatedBodyStyle = useAnimatedStyle(() => {
    const h = bodyHeight.value * progress.value
    return {
      height: h,
      opacity: progress.value,
      overflow: 'hidden' as const,
    }
  })

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }))

  return (
    <View style={styles.ruleCard}>
      <Pressable
        style={styles.ruleCardHead}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.categoryIconBox}>
          <Image
            source={icon}
            style={tintCategoryIcon(section.id) ? styles.categoryIconTinted : styles.categoryIconPlain}
            resizeMode="contain"
            tintColor={COLORS.accent}
          />
        </View>
        <View style={styles.ruleHeadText}>
          <Text style={styles.ruleTitle}>{section.title}</Text>
          <View style={styles.readRow}>
            <Text style={styles.readLink}>Read rules</Text>
            <Text style={styles.readLinkIcon}> ↗</Text>
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Image source={ImageAssets.down} style={styles.chevron} resizeMode="contain" />
        </Animated.View>
      </Pressable>

      <Animated.View style={animatedBodyStyle}>
        <View style={styles.ruleBodyMeasure} onLayout={onBodyLayout}>
          <View style={styles.ruleBody}>
            {section.bullets.map((b, idx) => (
              <View key={`${section.id}-${idx}`} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  <Text style={styles.bulletBold}>{b.bold}</Text>
                  {b.body}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

type GameRulesRouteParams = { returnToTab?: string }

const GameRulesScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ GameRules: GameRulesRouteParams }, 'GameRules'>>()
  const insets = useSafeAreaInsets()
  const [openId, setOpenId] = useState<string | null>(null)
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const toggle = useCallback((id: string) => {
    setOpenId(prev => (prev === id ? null : id))
  }, [])

  const goBack = useCallback(() => {
    navigation.navigate(returnToTab)
  }, [navigation, returnToTab])

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        <View style={styles.introCard}>
          <View style={styles.introIconBox}>
            <Image source={ImageAssets.bookopenfill} style={styles.introIcon} resizeMode="contain" />
          </View>
          <Text style={styles.introTitle}>Game Rules</Text>
          <Text style={styles.introDesc}>
            Read these rules before placing bets or playing games. All activity on this platform is settled under these
            rules and the latest Terms & Conditions.
          </Text>
        </View>

        {GAME_RULE_SECTIONS.map(section => (
          <RuleSectionCard
            key={section.id}
            section={section}
            open={openId === section.id}
            onToggle={() => toggle(section.id)}
            icon={SECTION_ICONS[section.id] ?? ImageAssets.bookopenfill}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#040f21' 
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  introCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  introIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  introIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.accent,
  },
  introTitle: {
    color: COLORS.text,
    fontFamily: AppFonts.montserratBold,
    fontSize: 20,
    marginBottom: 8,
  },
  introDesc: {
    color: COLORS.muted,
    fontFamily: AppFonts.montserratRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  ruleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  ruleCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  categoryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconTinted: {
    width: 20,
    height: 20,
  },
  categoryIconPlain: {
    width: 20,
    height: 20,
  },
  ruleHeadText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  ruleTitle: {
    color: COLORS.text,
    fontFamily: AppFonts.montserratBold,
    fontSize: 15,
  },
  readRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readLink: {
    color: COLORS.accent,
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 13,
  },
  readLinkIcon: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: AppFonts.montserratSemiBold,
  },
  chevron: {
    width: 18,
    height: 18,
    tintColor: '#7D8A9C',
  },
  ruleBodyMeasure: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
  },
  ruleBody: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    color: COLORS.muted,
    fontFamily: AppFonts.montserratRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  bulletBold: {
    color: COLORS.text,
    fontFamily: AppFonts.montserratSemiBold,
  },
})

export default GameRulesScreen
