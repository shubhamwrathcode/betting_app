import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer } from '../../components/common/ScreenContainer'
import { useAuth } from '../../hooks/useAuth'
import { colors } from '../../theme/colors'

export const HomeScreen = () => {
  const { logout } = useAuth()

  return (
    <ScreenContainer>
      <View style={styles.wrapper}>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.subtitle}>Feature modules will connect here</Text>
        <Pressable style={styles.button} onPress={logout}>
          <Text style={styles.buttonText}>Logout</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.danger,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
})
