import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { LoginPage } from '../screens/auth/LoginPage'
import { ForgotPasswordPage } from '../screens/auth/ForgotPasswordPage'
import LandingPage from '../screens/auth/LandingPage'
import GameScreen from '../screens/home/GameScreen'
import CasinoScreen from '../screens/home/CasinoScreen'
import InPlayScreen from '../screens/home/InPlayScreen'
import SportsbookScreen from '../screens/home/SportsbookScreen'
import { BottomTab } from '../components/common/BottomTab'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useAuth } from '../hooks/useAuth'

type RootStackParamList = {
  MainTabs: { screen?: string }
  Login: { initialTab?: 'login' | 'signup' }
  ForgotPassword: undefined
  Game: { url: string; title: string }
  AuthenticatedHome: undefined
}

const Tab = createBottomTabNavigator()
const Stack = createStackNavigator<RootStackParamList>()

const MenuScreen = () => (
  <View style={styles.menuContainer}>
    <Text style={styles.menuText}>Menu Screen Placeholder</Text>
  </View>
)

const MainTabs = (props: any) => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={tabBarProps => <BottomTab {...tabBarProps} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Casino" component={CasinoScreen} />
      <Tab.Screen
        name="Home"
        children={() => (
          <LandingPage
            onOpenLogin={() => props.navigation.navigate('Login', { initialTab: 'login' })}
            onOpenSignup={() => props.navigation.navigate('Login', { initialTab: 'signup' })}
            onOpenHome={() => props.navigation.navigate('Login', { initialTab: 'login' })}
          />
        )}
      />
      <Tab.Screen name="InPlay" component={InPlayScreen} />
      <Tab.Screen name="SportsBook" component={SportsbookScreen} />
    </Tab.Navigator>
  )
}

export const RootNavigator = () => {
  const { loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#040f21', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#D5702A" />
      </View>
    )
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Login" component={LoginPage} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordPage} />
      <Stack.Screen name="Game" component={GameScreen} />
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  menuContainer: { flex: 1, backgroundColor: '#040f21', justifyContent: 'center', alignItems: 'center' },
  menuText: { color: '#FFF', fontSize: 20 },
})
