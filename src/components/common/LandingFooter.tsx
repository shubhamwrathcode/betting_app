import React, { useState } from 'react'
import {
  Image,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  UIManager,
} from 'react-native'
import { ImageAssets } from '../ImageAssets'
import { AppFonts } from '../AppFonts'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const footerData: Record<string, string[]> = {
  'I-GAMING': ['Casino', 'Cricket', 'SportsBook', 'Live casino', 'Slots', 'Rank system'],
  FEATURES: ['Rank system', 'Referral', 'Transactions', 'My Bets', 'Bet History'],
  PROMO: ['Promotions'],
  'ABOUT US': ['Terms & Conditions', 'Game Rules'],
}

const footerSections = Object.keys(footerData)

export const LandingFooter = () => {
  const [openFooter, setOpenFooter] = useState<string>('')

  return (
    <View style={styles.footer}>
      {footerSections.map(title => {
        const isOpen = openFooter === title
        const isLast = footerSections.indexOf(title) === footerSections.length - 1
        return (
          <View key={title} style={[styles.footerSection, isLast && { borderBottomWidth: 0 }]}>
            <Pressable
              style={styles.footerHeading}
              onPress={() => {
                LayoutAnimation.configureNext({
                  duration: 300,
                  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
                  update: { type: LayoutAnimation.Types.easeInEaseOut },
                  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
                })
                setOpenFooter(isOpen ? '' : title)
              }}
            >
              <Text style={styles.footerHeadingText}>{title}</Text>
              <Image
                source={ImageAssets.down}
                style={{
                  width: 20,
                  height: 20,
                  tintColor: 'white',
                  transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
                }}
              />
            </Pressable>
            {isOpen && (
              <View style={styles.footerDetails}>
                {footerData[title].map(item => (
                  <Text key={item} style={styles.footerItem}>
                    {item}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  footer: {
    paddingVertical: 10,
    backgroundColor: '#17212c',
    paddingBottom: 74,
  },
  footerSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#263345',
  },
  footerHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  footerHeadingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: AppFonts.montserratBold,
    letterSpacing: 0.6,
  },
  footerDetails: {
    padding: 12,
    paddingBottom: 20,
  },
  footerItem: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: AppFonts.montserratRegular,
    paddingVertical: 6,
  },
})
