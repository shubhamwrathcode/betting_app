import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LandingHeader } from '../../components/common/LandingHeader'

const CasinoScreen = () => {
  return (
    <View style={styles.container}>
      <LandingHeader onLoginPress={() => {}} onSignupPress={() => {}} />
      <View style={styles.content}>
        <Text style={styles.title}>Casino Screen</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040f21' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
})

export default CasinoScreen
