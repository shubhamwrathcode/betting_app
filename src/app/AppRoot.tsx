import React from 'react'
import { StatusBar } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { AuthProvider } from '../context/AuthContext'
import { RootNavigator } from '../navigation/RootNavigator'

import Toast from 'react-native-toast-message'

export const AppRoot = () => {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <Toast />
    </AuthProvider>
  )
}
