import React from 'react'
import { StatusBar } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { AuthProvider } from '../context/AuthContext'
import { navigationRef } from '../navigation/navigationRef'
import { RootNavigator } from '../navigation/RootNavigator'

import Toast from 'react-native-toast-message'

export const AppRoot = () => {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
      <Toast />
    </AuthProvider>
  )
}
