import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppRoot } from './src/app/AppRoot'

import { AuthProvider } from './src/context/AuthContext'

const App = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </SafeAreaProvider>
  )
}

export default App