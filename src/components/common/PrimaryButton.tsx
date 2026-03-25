import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
  ActivityIndicator,
  View,
} from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { AppFonts } from '../AppFonts'

type PrimaryButtonProps = {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  colors?: string[]
}

export const PrimaryButton = ({
  title,
  onPress,
  disabled,
  loading,
  style,
  textStyle,
  colors = ['#F97316', '#D9480F'], // Gradient from light to dark orange
}: PrimaryButtonProps) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.container, style]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={[styles.text, textStyle]}>{title}</Text>
        )}
      </LinearGradient>
      {/* 3D Bottom Shadow Effect */}
      <View style={styles.shadow} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    borderRadius: 12,
    overflow: 'visible', // Allow shadow to flow
    position: 'relative',
    marginBottom: 4, // Space for 3D shadow
  },
  gradient: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  text: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: AppFonts.montserratBold,
    textTransform: 'none',
  },
  shadow: {
    ...StyleSheet.absoluteFillObject,
    top: 3, // Offset for 3D effect
    backgroundColor: '#9A3412', // Darker shade for 3D depth
    borderRadius: 12,
    zIndex: 1,
  },
})

