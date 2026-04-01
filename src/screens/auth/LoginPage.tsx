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
  ActivityIndicator,
} from 'react-native'
import Toast from 'react-native-toast-message'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppFonts } from '../../components/AppFonts'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { authService } from '../../services/authService'
import { useAuth } from '../../hooks/useAuth'
import { useNavigation, RouteProp } from '@react-navigation/native'

// Logo path from LandingPage
const Logo = require('../../../assets/AppImages/logo.png')

type RootStackParamList = {
  Login: { initialTab?: 'login' | 'signup' }
}

type LoginPageProps = {
  navigation: any
  route: RouteProp<RootStackParamList, 'Login'>
}

export const LoginPage = ({ navigation, route }: LoginPageProps) => {
  const { login: setAuthenticated } = useAuth()
  const initialTab = route.params?.initialTab || 'login'
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialTab)
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)

  // Update activeTab when route parameters change
  React.useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab)
    }
  }, [route.params?.initialTab])

  const handleSendOtp = async () => {
    setLoading(true)
    try {
      const res = await authService.sendOtp(mobile)
      if (res.status === 'success' || res.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: res.message || 'OTP sent successfully'
        })
        setOtpSent(true)
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: res.message || 'Failed to send OTP'
        })
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Something went wrong' })
    }
    setLoading(false)
  }

  const handleAction = async () => {
    if (activeTab === 'login') {
      setLoading(true)
      console.log('[Auth][Login] Request started for mobile:', mobile);
      try {
        const res = await authService.login({ mobile, password })
        console.log('[Auth][Login] Response received:', JSON.stringify(res, null, 2));

        if (res.status === 'success' || res.success) {
          Toast.show({
            type: 'success',
            text1: 'Welcome',
            text2: res.message || 'Login successful'
          })
          const resAny = res as any
          const userData = resAny.data?.user || resAny.data
          const token = resAny.token || resAny.data?.token || resAny.accessToken || resAny.data?.accessToken
          await setAuthenticated(userData, token)
          navigation.replace('MainTabs', { screen: 'Home' })
        } else {
          console.warn('[Auth][Login] Failed with message:', res.message);
          Toast.show({
            type: 'error',
            text1: 'Login Failed',
            text2: res.message || 'Invalid credentials'
          })
        }
      } catch (err: any) {
        console.error('[Auth][Login] Catch block error:', err);
        let errorText = 'Login failed';
        if (err.message) {
          // Attempt to extract JSON from error string like "API request failed: 401 - {JSON}"
          const jsonMatch = err.message.match(/\{.*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              errorText = parsed.message || errorText;
            } catch (e) { errorText = err.message; }
          } else {
            errorText = err.message;
          }
        }
        Toast.show({ type: 'error', text1: 'Login Error', text2: errorText })
      }
    } else {
      if (!agreeTerms) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Please agree to the Terms and Privacy Policy' })
        return
      }
      setLoading(true)
      console.log('[Auth][Signup] Request started for mobile:', mobile);
      try {
        const payload = {
          mobile,
          otp,
          password,
          confirmPassword,
          referralCode
        };
        console.log('[Auth][Signup] Sending payload:', JSON.stringify(payload, null, 2));
        
        const res = await authService.register(payload)
        console.log('[Auth][Signup] Response received:', JSON.stringify(res, null, 2));

        if (res.status === 'success' || res.success) {
          Toast.show({
            type: 'success',
            text1: 'Account Created',
            text2: res.message || 'Registration successful'
          })
          setActiveTab('login')
        } else {
          console.warn('[Auth][Signup] Failed with message:', res.message);
          Toast.show({
            type: 'error',
            text1: 'Registration Failed',
            text2: res.message || 'Registration failed'
          })
        }
      } catch (err: any) {
        console.error('[Auth][Signup] Catch block error:', err);
        let errorText = 'Registration failed';
        if (err.message) {
          const jsonMatch = err.message.match(/\{.*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              errorText = parsed.message || errorText;
            } catch (e) { errorText = err.message; }
          } else {
            errorText = err.message;
          }
        }
        Toast.show({ type: 'error', text1: 'Registration Error', text2: errorText })
      }
    }
    setLoading(false)
  }


  const handleDemoLogin = async () => {
    setLoading(true)
    try {
      const res = await authService.demoLogin()
      if (res.status === 'success' || res.success) {
        Toast.show({
          type: 'success',
          text1: 'Demo Access',
          text2: res.message || 'Demo Login successful'
        })
        const resAny = res as any
        const userData = resAny.data?.user || resAny.data
        const token = resAny.token || resAny.data?.token || resAny.accessToken || resAny.data?.accessToken
        await setAuthenticated(userData, token)
        navigation.replace('MainTabs', { screen: 'Home' })
      } else {
        Toast.show({
          type: 'error',
          text1: 'Demo Error',
          text2: res.message || 'Demo login failed'
        })
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Demo login failed' })
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
            <Text style={styles.title}>
              {activeTab === 'login' ? 'Log in' : 'Create account'}
            </Text>

            <View style={styles.tabWrapper}>
              <TouchableOpacity
                onPress={() => setActiveTab('login')}
                style={[styles.tab, activeTab === 'login' && styles.activeTab]}
                disabled={loading}
              >
                <Text style={[styles.tabText, activeTab === 'login' && styles.activeTabText]}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('signup')}
                style={[styles.tab, activeTab === 'signup' && styles.activeTab]}
                disabled={loading}
              >
                <Text style={[styles.tabText, activeTab === 'signup' && styles.activeTabText]}>Sign up</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              {/* Mobile Input Group */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mobile number</Text>
                <View style={styles.otpInputWrapper}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: 'transparent' }]}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    value={mobile}
                    onChangeText={(val) => setMobile(val.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                  />
                </View>
              </View>

              {/* OTP Input Group (Signup) */}
              {activeTab === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    OTP Verification
                  </Text>
                  <View style={styles.otpInputWrapper}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: 'transparent' }]}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#64748b"
                      keyboardType="number-pad"
                      value={otp}
                      onChangeText={(val) => setOtp(val.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                    />
                    {activeTab === 'signup' && (
                      <PrimaryButton
                        title={otpSent ? 'Resend' : 'Send OTP'}
                        onPress={handleSendOtp}
                        style={styles.otpActionBtn}
                        textStyle={{ fontSize: 13 }}
                        loading={loading && !otpSent}
                      />
                    )}
                  </View>
                </View>
              )}

              {/* Password Input Group */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }]}
                    placeholder="Enter password"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Text style={[styles.passwordToggle, { marginLeft: 8 }]}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input Group */}
              {activeTab === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }]}
                      placeholder="Confirm your password"
                      placeholderTextColor="#64748b"
                      secureTextEntry={!showForgotConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity onPress={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}>
                      <Text style={[styles.passwordToggle, { marginLeft: 8 }]}>
                        {showForgotConfirmPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Referral Code (Signup only) */}
              {activeTab === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Referral / Promo code (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter code"
                    placeholderTextColor="#64748b"
                    value={referralCode}
                    onChangeText={setReferralCode}
                  />
                </View>
              )}

              {/* Terms Agreement (Signup only) */}
              {activeTab === 'signup' && (
                <TouchableOpacity
                  style={styles.checkboxWrapper}
                  onPress={() => setAgreeTerms(!agreeTerms)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
                    {agreeTerms && <Text style={styles.checkboxInner}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxText}>
                    I agree to the <Text style={styles.linkText}>Terms</Text> and <Text style={styles.linkText}>Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>
              )}

              {/* Footer Links (Forgot password?) */}
              {activeTab === 'login' && (
                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => navigation.navigate('ForgotPassword')}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              <PrimaryButton
                title={activeTab === 'login' ? 'Log in' : 'Sign up & play'}
                onPress={handleAction}
                loading={loading}
                style={styles.mainBtn}
              />

              {activeTab === 'login' && (
                <>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity style={styles.demoBtn} onPress={handleDemoLogin}>
                    <Text style={styles.demoBtnText}>Demo account login</Text>
                  </TouchableOpacity>
                </>
              )}
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
  logo: { width: 140, height: 40 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: AppFonts.montserratBold,
    marginBottom: 24,
  },
  tabWrapper: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 2,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#3e414c',
  },
  tabText: {
    color: '#94a3b8',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 16,
  },
  activeTabText: {
    color: '#FFFFFF',
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
  mainBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: AppFonts.montserratBold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 14,
    fontFamily: AppFonts.montserratMedium,
  },
  demoBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: AppFonts.montserratBold,
  },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#334155',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: '#F97316',
    backgroundColor: '#F97316',
  },
  checkboxInner: {
    color: '#000000',
    fontSize: 14,
    fontFamily: AppFonts.montserratBold,
    lineHeight: 18,
  },
  checkboxText: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: AppFonts.montserratMedium,
    flex: 1,
  },
  linkText: {
    color: '#F97316',
    fontFamily: AppFonts.montserratSemiBold,
  },
})
