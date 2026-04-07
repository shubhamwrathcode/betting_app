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
import MyProfileScreen from '../screens/home/MyProfileScreen'
import AddAccountScreen from '../screens/home/AddAccountScreen'
import MenuScreen from '../screens/home/MenuScreen'
import MatchDetailScreen from '../screens/home/MatchDetailScreen'
import { BottomTab } from '../components/common/BottomTab'
import { View, ActivityIndicator } from 'react-native'
import { useAuth } from '../hooks/useAuth'

import GameRulesScreen from '../screens/home/GameRulesScreen'
import ReferralRewardsScreen from '../screens/home/ReferralRewardsScreen'
import TransactionsScreen from '../screens/home/TransactionsScreen'
import MyBetsScreen from '../screens/home/MyBetsScreen'
import BetHistoryScreen from '../screens/home/BetHistoryScreen'
import GameHistoryScreen from '../screens/home/GameHistoryScreen'
import MyWalletScreen from '../screens/home/MyWalletScreen'
import AccountStatementScreen from '../screens/home/AccountStatementScreen'
import SupportScreen from '../screens/home/SupportScreen'
import DepositScreen from '../screens/home/DepositScreen'
import WithdrawalScreen from '../screens/home/WithdrawalScreen'

type RootStackParamList = {
  MainTabs: { screen?: string }
  Login: { initialTab?: 'login' | 'signup' }
  ForgotPassword: undefined
  Game: { url: string; title: string }
  Search: undefined
  MyProfile: undefined
  AddAccount: undefined
  AuthenticatedHome: undefined
  MatchDetail: {
    sportName?: string
    gameId?: string
    eventId?: string
    eventName?: string
    seriesName?: string
  }
  GameRules: undefined
  ReferralRewards: undefined
  Transactions: undefined
  MyBets: undefined
  BetHistory: undefined
  GameHistory: undefined
  MyWallet: undefined
  AccountStatement: undefined
  Support: undefined
  Deposit: undefined
  Withdrawal: undefined
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
            navigation.dispatch(DrawerActions.toggleDrawer())
          },
        })}
      />
      <Tab.Screen name="Casino" component={CasinoScreen} />
      <Tab.Screen 
        name="Home" 
        component={(navProps: any) => (
          <LandingPage 
            onOpenLogin={() => navProps.navigation.navigate('Login')}
            onOpenSignup={() => navProps.navigation.navigate('Login', { initialTab: 'signup' })}
            onOpenHome={() => navProps.navigation.navigate('Login')}
          />
        )}
      />
      <Tab.Screen name="InPlay" component={InPlayScreen} />
      <Tab.Screen name="SportsBook" component={SportsbookScreen} />
    </Tab.Navigator>
  )
}

const MainAppWithDrawer = (props: any) => (
  <Drawer.Navigator
    screenOptions={{
      headerShown: false,
      drawerPosition: 'left',
      drawerType: 'front',
      overlayColor: 'rgba(0,0,0,0.5)', // Now using a proper overlay since it's on top
      drawerStyle: { width: '80%', backgroundColor: '#132238' },
    }}
    drawerContent={({ navigation }) => <MenuScreen navigation={navigation} />}
  >
    <Drawer.Screen name="Tabs">
      {(drawerProps) => <TabsNavigator {...drawerProps} />}
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
      <Stack.Screen name="MainTabs" component={MainAppWithDrawer} />
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
      <Stack.Screen name="MyProfile" component={MyProfileScreen} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <Stack.Screen name="GameRules" component={GameRulesScreen} />
      <Stack.Screen name="ReferralRewards" component={ReferralRewardsScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="MyBets" component={MyBetsScreen} />
      <Stack.Screen name="BetHistory" component={BetHistoryScreen} />
      <Stack.Screen name="GameHistory" component={GameHistoryScreen} />
      <Stack.Screen name="MyWallet" component={MyWalletScreen} />
      <Stack.Screen name="AccountStatement" component={AccountStatementScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Deposit" component={DepositScreen} />
      <Stack.Screen name="Withdrawal" component={WithdrawalScreen} />
    </Stack.Navigator>
  )
}
