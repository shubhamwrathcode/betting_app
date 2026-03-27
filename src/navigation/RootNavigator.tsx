import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack'
import { createDrawerNavigator } from '@react-navigation/drawer'
import { DrawerActions } from '@react-navigation/native'
import { LoginPage } from '../screens/auth/LoginPage'
import { ForgotPasswordPage } from '../screens/auth/ForgotPasswordPage'
import LandingPage from '../screens/auth/LandingPage'
import GameScreen from '../screens/home/GameScreen'
import CasinoScreen from '../screens/home/CasinoScreen'
import InPlayScreen from '../screens/home/InPlayScreen'
import SportsbookScreen from '../screens/home/SportsbookScreen'
import SearchScreen from '../screens/home/SearchScreen'
import GameRulesScreen from '../screens/home/GameRulesScreen'
import PromotionsScreen from '../screens/home/PromotionsScreen'
import ReferralRewardsScreen from '../screens/home/ReferralRewardsScreen'
import TransactionsScreen from '../screens/home/TransactionsScreen'
import GameHistoryScreen from '../screens/home/GameHistoryScreen'
import MyWalletScreen from '../screens/home/MyWalletScreen'
import BettingProfitLossScreen from '../screens/home/BettingProfitLossScreen'
import AccountStatementScreen from '../screens/home/AccountStatementScreen'
import SupportScreen from '../screens/home/SupportScreen'
import MenuScreen from '../screens/home/MenuScreen'
import { BottomTab } from '../components/common/BottomTab'
import { View, ActivityIndicator } from 'react-native'
import { useAuth } from '../hooks/useAuth'

type RootStackParamList = {
  MainTabs: { screen?: string }
  Login: { initialTab?: 'login' | 'signup' }
  ForgotPassword: undefined
  Game: { url: string; title: string }
  Search: undefined
  AuthenticatedHome: undefined
}

const Tab = createBottomTabNavigator()
const Drawer = createDrawerNavigator()
const Stack = createStackNavigator<RootStackParamList>()
const MenuTriggerScreen = () => <View style={{ flex: 1, backgroundColor: '#040f21' }} />

const TabsNavigator = (props: any) => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={tabBarProps => <BottomTab {...tabBarProps} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Menu"
        component={MenuTriggerScreen}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault()
            navigation.dispatch(DrawerActions.openDrawer())
          },
        })}
      />
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
      <Tab.Screen name="GameRules" component={GameRulesScreen} />
      <Tab.Screen name="Promotions" component={PromotionsScreen} />
      <Tab.Screen name="ReferralRewards" component={ReferralRewardsScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="GameHistory" component={GameHistoryScreen} />
      <Tab.Screen name="MyWallet" component={MyWalletScreen} />
      <Tab.Screen name="BettingProfitLoss" component={BettingProfitLossScreen} />
      <Tab.Screen name="AccountStatement" component={AccountStatementScreen} />
      <Tab.Screen name="Support" component={SupportScreen} />
    </Tab.Navigator>
  )
}

const MainTabs = (props: any) => (
  <Drawer.Navigator
    screenOptions={{
      headerShown: false,
      drawerPosition: 'left',
      drawerType: 'front',
      overlayColor: 'transparent',
      drawerStyle: { width: '100%', backgroundColor: 'transparent' },
    }}
    drawerContent={({ navigation }) => <MenuScreen navigation={navigation} />}
  >
    <Drawer.Screen name="Tabs">
      {() => <TabsNavigator {...props} />}
    </Drawer.Screen>
  </Drawer.Navigator>
)

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
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          gestureEnabled: true,
          ...TransitionPresets.ModalSlideFromBottomIOS,
        }}
      />
    </Stack.Navigator>
  )
}

