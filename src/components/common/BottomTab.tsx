import React from 'react'
import { StyleSheet, Text, View, Pressable, Image, Platform } from 'react-native'
import { DrawerActions } from '@react-navigation/native'
import { ImageAssets } from '../ImageAssets'
import { AppFonts } from '../AppFonts'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'

const tabsConfig: Record<string, { label: string, Icon: any }> = {
  Menu: { label: 'Menu', Icon: ImageAssets.menuLine },
  Casino: { label: 'Casino', Icon: ImageAssets.spade },
  Home: { label: 'Home', Icon: ImageAssets.homeline },
  InPlay: { label: 'InPlay', Icon: ImageAssets.gamepad },
  SportsBook: { label: 'SportsBook', Icon: ImageAssets.basketballFill },
}

export const BottomTab = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const focusedRoute = state.routes[state.index]
  const focusedOptions = descriptors?.[focusedRoute.key]?.options
  const focusedTabStyle = focusedOptions?.tabBarStyle as { display?: string } | undefined
  if (focusedTabStyle?.display === 'none') return null

  const barRoutes = state.routes.filter(route => tabsConfig[route.name] != null)

  return (
    <View style={styles.container}>
      <View style={styles.navRow}>
        {barRoutes.map(route => {
          const index = state.routes.indexOf(route)
          const options = descriptors?.[route.key]?.options
          const label =
            options?.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options?.title !== undefined
                ? options.title
                : tabsConfig[route.name]?.label ?? route.name

          const isFocused = state.index === index

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })

            if (!event.defaultPrevented) {
              navigation.dispatch(DrawerActions.closeDrawer())
              if (!isFocused) {
                navigation.navigate(route.name)
              }
            }
          }

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            })
          }

          // Find the icon from our tabs config
          const tabConfig = tabsConfig[route.name]
          const iconSource = tabConfig?.Icon

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options?.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
            >
              <View style={styles.iconContainer}>
                {iconSource && (
                  <Image
                    source={iconSource}
                    style={[styles.icon, { tintColor: isFocused ? '#FFFFFF' : '#9DB0CC' }]}
                  />
                )}
              </View>
              <Text style={[styles.label, isFocused && styles.labelActive]}>
                {String(label)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#16202c',
    borderTopWidth: 1,
    borderTopColor: '#263345',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    height: 74,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  label: {
    fontSize: 10,
    fontFamily: AppFonts.montserratRegular,
    color: '#9DB0CC',
  },
  labelActive: {
    color: '#FFFFFF',
    fontFamily: AppFonts.montserratBold,
  },
})
