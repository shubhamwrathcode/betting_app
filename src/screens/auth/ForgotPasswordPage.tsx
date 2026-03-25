import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native'
import Toast from 'react-native-toast-message'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppFonts } from '../../components/AppFonts'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { authService } from '../../services/authService'
import { useNavigation } from '@react-navigation/native'

const Logo = require('../../../assets/AppImages/logo.png')

export const ForgotPasswordPage = () => {
  const navigation = useNavigation<any>()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSendOtp = async () => {
    if (!mobile || mobile.length !== 10) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a valid 10-digit mobile number' })
      return
    }
    setLoading(true)
    try {
      const res = await authService.forgotPasswordSendOtp(mobile)
      if (res.status === 'success' || res.success) {
        Toast.show({ 
          type: 'success', 
          text1: 'OTP Sent', 
          text2: res.message || 'Verification code sent to your mobile' 
        })
        setOtpSent(true)
      } else {
        Toast.show({ 
          type: 'error', 
          text1: 'OTP Error', 
          text2: res.message || 'Failed to send verification code' 
        })
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Something went wrong' })
    }
    setLoading(false)
  }

  const handleResetPassword = async () => {
    if (!mobile || mobile.length !== 10) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a valid mobile number' })
      return
    }
    if (!otp || otp.length !== 6) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a valid 6-digit OTP' })
      return
    }
    if (!password) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a new password' })
      return
    }
    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Passwords do not match' })
      return
    }

    setLoading(true)
    try {
      const payload = {
        mobile,
        otp,
        password,
        confirmPassword,
      }
      const res = await authService.forgotPasswordReset(payload)
      if (res.status === 'success' || res.success) {
        Toast.show({ 
          type: 'success', 
          text1: 'Success', 
          text2: res.message || 'Your password has been reset successfully' 
        })
        navigation.navigate('Login', { initialTab: 'login' })
      } else {
        Toast.show({ 
          type: 'error', 
          text1: 'Reset Error', 
          text2: res.message || 'Unable to reset password' 
        })
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Something went wrong' })
    }
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
            <Image source={Logo} style={styles.logo} resizeMode="contain" />
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Forget Password</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mobile number</Text>
                <View style={styles.otpInputWrapper}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: 'transparent' }]}
                    placeholder="Enter Mobile Number"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    value={mobile}
                    onChangeText={(val) => setMobile(val.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                  />
                  <PrimaryButton
                    title={otpSent ? 'Sent' : 'Get OTP'}
                    onPress={handleSendOtp}
                    style={styles.otpActionBtn}
                    textStyle={{ fontSize: 13 }}
                    loading={loading && !otpSent}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>6-digit OTP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={(val) => setOtp(val.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }]}
                    placeholder="New Password"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.passwordToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }]}
                    placeholder="Confirm Password"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Text style={styles.passwordToggle}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => navigation.navigate('Login', { initialTab: 'login' })}
              >
                <Text style={styles.forgotText}>Login Now?</Text>
              </TouchableOpacity>

              <PrimaryButton
                title="Reset Password"
                onPress={handleResetPassword}
                loading={loading}
                style={styles.mainBtn}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 28,
    marginTop: -4,
  },
  logo: {
    width: 150,
    height: 40,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: AppFonts.montserratBold,
    marginBottom: 24,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: AppFonts.montserratSemiBold,
  },
  input: {
    backgroundColor: '#EDF2F7',
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#1e293b',
    fontSize: 16,
    fontFamily: AppFonts.montserratMedium,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  passwordToggle: {
    color: '#64748b',
    fontSize: 14,
    fontFamily: AppFonts.montserratSemiBold,
    marginLeft: 8,
  },
  otpInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF2F7',
    borderRadius: 12,
    paddingLeft: 4,
    paddingRight: 6,
    height: 58,
  },
  otpActionBtn: {
    width: 100,
    height: 44,
    borderRadius: 10,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: '#F97316',
    fontSize: 14,
    fontFamily: AppFonts.montserratSemiBold,
  },
  mainBtn: {
    marginTop: 10,
  },
})
