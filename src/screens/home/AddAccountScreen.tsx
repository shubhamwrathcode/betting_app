import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import LinearGradient from 'react-native-linear-gradient'
import Toast from 'react-native-toast-message'
import { bankAccountsService } from '../../services/bankAccountsService'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'
import { ImageAssets } from '../../components/ImageAssets'

const MAX_ACCOUNTS = 3

const ADD_ACCOUNT_SUBTITLE =
  'Add up to 3 bank accounts. OTP will be sent to your registered mobile. Select one for withdrawal.'
const FOOTER_NOTE =
  'Select one account above to use for withdrawal requests. You can add up to 3 bank accounts and remove any time.'

const maskAccountNumber = (num: unknown) => {
  const s = String(num || '')
  if (!s || s.length < 4) return '****'
  return `****${s.slice(-4)}`
}

const parseAccounts = (res: any): any[] => {
  const list = res?.data?.accounts ?? res?.accounts ?? res?.data ?? []
  return Array.isArray(list) ? list : []
}

const extractErr = (e: any, fallback: string) => {
  const raw = String(e?.message || '')
  const i = raw.indexOf('{')
  if (i >= 0) {
    try {
      const p = JSON.parse(raw.slice(i))
      if (p?.message) return String(p.message)
    } catch {
      // ignore
    }
  }
  return raw || fallback
}

const AddAccountScreen = () => {
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const { isAuthenticated, user } = useAuth()
  const isDemoUser = (user as any)?.role === 'demo' || (user as any)?.isDemo === true
  const winW = Dimensions.get('window').width
  const cardWidth = Math.min(300, Math.max(260, winW - 56))

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('MainTabs')
  }, [navigation])

  const [accounts, setAccounts] = useState<any[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [showBankForm, setShowBankForm] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)

  const [form, setForm] = useState({
    accountHolderName: '',
    accountNumber: '',
    bankName: '',
    branchName: '',
    ifscCode: '',
    otp: '',
  })

  const fetchAccounts = useCallback(async () => {
    if (!isAuthenticated) {
      setListLoading(false)
      setAccounts([])
      return
    }
    setListLoading(true)
    try {
      const res = await bankAccountsService.list()
      if (res?.success !== false) setAccounts(parseAccounts(res))
      else setAccounts([])
    } catch {
      setAccounts([])
      Toast.show({ type: 'error', text1: 'Could not load bank accounts' })
    } finally {
      setListLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    if (!showBankForm) return
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200)
    return () => clearTimeout(t)
  }, [showBankForm])

  const selectAccount = async (accountId: string) => {
    try {
      const res = await bankAccountsService.setDefault(accountId)
      if (res?.success !== false) await fetchAccounts()
      else Toast.show({ type: 'error', text1: res?.message || 'Failed to set default account' })
    } catch (e: any) {
      Toast.show({ type: 'error', text1: extractErr(e, 'Failed to set default account') })
    }
  }

  const removeAccount = (accountId: string) => {
    Alert.alert(
      'Remove bank account?',
      'This account will be removed from your saved accounts. You can add it again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, remove it',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await bankAccountsService.delete(accountId)
              if (res?.success !== false) {
                Toast.show({ type: 'success', text1: 'Bank account has been removed successfully.' })
                await fetchAccounts()
              } else {
                Toast.show({ type: 'error', text1: res?.message || 'Failed to delete' })
              }
            } catch (e: any) {
              Toast.show({ type: 'error', text1: extractErr(e, 'Failed to delete') })
            }
          },
        },
      ],
    )
  }

  const openBankForm = () => {
    if (accounts.length >= MAX_ACCOUNTS) {
      Toast.show({ type: 'error', text1: `You can add at most ${MAX_ACCOUNTS} bank accounts` })
      return
    }
    setShowBankForm(true)
    setOtpSent(false)
    setForm({
      accountHolderName: '',
      accountNumber: '',
      bankName: '',
      branchName: '',
      ifscCode: '',
      otp: '',
    })
  }

  const handleSendOtp = async () => {
    const { accountHolderName, accountNumber, bankName, branchName, ifscCode } = form
    if (
      !accountHolderName?.trim() ||
      !accountNumber?.trim() ||
      !bankName?.trim() ||
      !branchName?.trim() ||
      !ifscCode?.trim()
    ) {
      Toast.show({
        type: 'error',
        text1: 'Please fill Account Holder, Account Number, Bank Name, Branch Name and IFSC',
      })
      return
    }
    if (ifscCode.trim().length !== 11) {
      Toast.show({ type: 'error', text1: 'IFSC must be 11 characters' })
      return
    }
    setOtpLoading(true)
    try {
      const res = await bankAccountsService.sendOtp()
      if (res?.success !== false) {
        Toast.show({ type: 'success', text1: 'OTP sent to your registered mobile' })
        setOtpSent(true)
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Failed to send OTP' })
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: extractErr(e, 'Failed to send OTP') })
    } finally {
      setOtpLoading(false)
    }
  }

  const handleAddAccount = async () => {
    const { accountHolderName, accountNumber, bankName, branchName, ifscCode, otp } = form
    if (!branchName?.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter Branch Name' })
      return
    }
    if (!otp || otp.length !== 6) {
      Toast.show({ type: 'error', text1: 'Enter 6-digit OTP' })
      return
    }
    setAddLoading(true)
    try {
      const res = await bankAccountsService.add({
        accountHolderName: accountHolderName?.trim(),
        accountNumber: accountNumber?.trim(),
        bankName: bankName?.trim(),
        branchName: branchName?.trim(),
        ifscCode: ifscCode?.trim(),
        otp,
      })
      if (res?.success !== false) {
        Toast.show({ type: 'success', text1: 'Bank account added successfully' })
        setShowBankForm(false)
        setOtpSent(false)
        setForm({
          accountHolderName: '',
          accountNumber: '',
          bankName: '',
          branchName: '',
          ifscCode: '',
          otp: '',
        })
        await fetchAccounts()
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Failed to add account' })
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: extractErr(e, 'Failed to add account') })
    } finally {
      setAddLoading(false)
    }
  }

  const headerProps = {
    onLoginPress: () => navigation.navigate('Login', { initialTab: 'login' }),
    onSignupPress: () => navigation.navigate('Login', { initialTab: 'signup' }),
    onSearchPress: () => navigation.navigate('Search'),
  }

  const titleBlock = (
    <>
      <View style={styles.pageTitleCard}>
        <Text style={styles.pageTitle}>Add Account</Text>
        <Text style={styles.pageSubtitle}>{ADD_ACCOUNT_SUBTITLE}</Text>
      </View>
      <Pressable style={styles.pillBackBtn} onPress={goBack}>
        <Text style={styles.pillBackBtnText}>Back</Text>
      </Pressable>
    </>
  )

  if (!isAuthenticated) {
    return (
      <View style={styles.screen}>
        <LandingHeader {...headerProps} />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, styles.scrollGrow, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {titleBlock}
          <Text style={styles.guestText}>Please log in to manage bank accounts.</Text>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <LandingHeader {...headerProps} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      >
        {titleBlock}

        {isDemoUser ? (
          <View style={styles.demoOnlyContainer}>
            <View style={styles.demoBanner}>
              <Text style={styles.demoBannerText}>Demo user can only explore the platform.</Text>
            </View>
            <View style={styles.pageTitleCard}>
              <Text style={styles.pageTitle}>Account Management Disabled</Text>
              <Text style={styles.pageSubtitle}>Adding or removing bank accounts is not available for demo accounts. Please create a real account to start playing.</Text>
            </View>
            <Pressable style={styles.pillBackBtn} onPress={goBack}>
              <Text style={styles.pillBackBtnText}>Go Back</Text>
            </Pressable>
          </View>
        ) : (
          <>

            {/* <View style={styles.bankPillWrap}>
          <LinearGradient
            colors={['#AC5422', '#F97A31']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bankPill}
          >
            <Text style={styles.bankPillText}>Bank</Text>
          </LinearGradient>
        </View> */}

            <Text style={styles.sectionHeading}>Your bank accounts</Text>

            {listLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#F97A31" />
                <Text style={styles.loadingText}>Loading bank accounts...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardsRow}
              >
                {accounts.map(acc => (
                  <Pressable
                    key={String(acc._id)}
                    style={[
                      styles.accountCard,
                      { width: cardWidth },
                      acc.isDefaultForWithdrawal && styles.accountCardSelected,
                    ]}
                    onPress={() => void selectAccount(String(acc._id))}
                  >
                    <Pressable
                      style={styles.deleteBtn}
                      hitSlop={8}
                      onPress={() => removeAccount(String(acc._id))}
                    >

                      <Image source={ImageAssets.bin} tintColor={'#fff'} style={{ width: 18, height: 18, resizeMode: "contain" }} />
                    </Pressable>
                    <View style={styles.accountCardInner}>
                      <Text style={styles.bankName}>{acc.bankName}</Text>
                      <Text style={styles.holder}>{String(acc.accountHolderName || '').toUpperCase()}</Text>
                      <Text style={styles.acctNum}>{maskAccountNumber(acc.accountNumber)}</Text>
                      <Text style={styles.ifsc}>IFSC: {acc.ifscCode}</Text>
                      {acc.isDefaultForWithdrawal ? (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Use for withdrawal</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
                {accounts.length < MAX_ACCOUNTS ? (
                  <Pressable
                    style={[styles.addCard, { width: cardWidth }]}
                    onPress={openBankForm}
                  >
                    <View style={styles.addCircle}>
                      <Text style={styles.addPlus}>+</Text>
                    </View>
                    <Text style={styles.addLabel}>Add Account</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            )}

            {showBankForm ? (
              <View style={styles.formSection}>
                <Text style={styles.formTitle}>Add bank details</Text>
                <Text style={styles.formHint}>OTP will be sent to your registered mobile number.</Text>

                <Text style={styles.label}>Account Holder Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Account Holder Name"
                  placeholderTextColor="#7f8ca0"
                  value={form.accountHolderName}
                  onChangeText={v => setForm(p => ({ ...p, accountHolderName: v }))}
                />

                <Text style={styles.label}>Account Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Account Number"
                  placeholderTextColor="#7f8ca0"
                  keyboardType="number-pad"
                  value={form.accountNumber}
                  onChangeText={v => setForm(p => ({ ...p, accountNumber: v }))}
                />

                <Text style={styles.label}>Bank Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Bank Name"
                  placeholderTextColor="#7f8ca0"
                  value={form.bankName}
                  onChangeText={v => setForm(p => ({ ...p, bankName: v }))}
                />

                <Text style={styles.label}>Branch Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Branch Name"
                  placeholderTextColor="#7f8ca0"
                  value={form.branchName}
                  onChangeText={v => setForm(p => ({ ...p, branchName: v }))}
                />

                <Text style={styles.label}>IFSC Code (11 characters)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="IFSC Code"
                  placeholderTextColor="#7f8ca0"
                  autoCapitalize="characters"
                  maxLength={11}
                  value={form.ifscCode}
                  onChangeText={v => setForm(p => ({ ...p, ifscCode: v.toUpperCase() }))}
                />

                <Text style={styles.label}>OTP (sent to your registered mobile)</Text>
                <View style={styles.otpRow}>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor="#7f8ca0"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={form.otp}
                    onChangeText={v =>
                      setForm(p => ({ ...p, otp: v.replace(/\D/g, '').slice(0, 6) }))
                    }
                  />
                  <Pressable onPress={() => void handleSendOtp()} disabled={otpLoading}>
                    <LinearGradient
                      colors={['#AC5422', '#F97A31']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.otpBtn, otpLoading && styles.btnDisabled]}
                    >
                      <Text style={styles.otpBtnText}>{otpLoading ? 'Sending...' : 'Send OTP'}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>

                <View style={styles.formActions}>
                  <Pressable
                    onPress={() => void handleAddAccount()}
                    disabled={addLoading || !otpSent}
                    style={[styles.submitWrap, (!otpSent || addLoading) && styles.btnDisabled]}
                  >
                    <LinearGradient
                      colors={['#AC5422', '#F97A31']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.submitGradient}
                    >
                      <Text style={styles.submitText}>{addLoading ? 'Adding...' : 'Add Account'}</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => {
                      setShowBankForm(false)
                      setOtpSent(false)
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Text style={styles.footerNote}>{FOOTER_NOTE}</Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 14, paddingTop: 12 },
  scrollGrow: { flexGrow: 1 },
  pageTitleCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263b58',
    backgroundColor: '#15243B',
    padding: 14,
    marginBottom: 10,
  },
  pageTitle: {
    color: '#fff',
    fontFamily: AppFonts.montserratBold,
    fontSize: 30 / 2,
  },
  pageSubtitle: {
    marginTop: 4,
    color: '#d7e3f5',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  pillBackBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#314157',
    backgroundColor: '#1a2433',
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 14,
  },
  pillBackBtnText: {
    color: '#DDE8F7',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 13,
  },
  guestText: {
    marginTop: 24,
    color: '#ffffff75',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 15,
    textAlign: 'center',
  },
  bankPillWrap: { marginBottom: 8 },
  bankPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
  },
  bankPillText: {
    color: '#fff',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 14,
  },
  sectionHeading: {
    color: '#fff',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: { color: '#9bb1ca', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
    paddingRight: 4,
  },
  accountCard: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#111f32',
    minHeight: 140,
    position: 'relative',
    overflow: 'hidden',
  },
  accountCardSelected: {
    borderColor: '#f97a31',
    shadowColor: '#f97a31',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  deleteBtnText: { fontSize: 14, color: '#fff' },
  accountCardInner: {
    padding: 16,
    paddingTop: 14,
    gap: 4,
  },
  bankName: {
    color: '#f97a31',
    fontFamily: AppFonts.montserratBold,
    fontSize: 14,
    marginRight: 36,
  },
  holder: {
    color: '#EAF2FF',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 13,
  },
  acctNum: {
    color: '#EAF2FF',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 13,
    letterSpacing: 1,
  },
  ifsc: {
    color: 'rgba(234,242,255,0.85)',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 12,
  },
  defaultBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  defaultBadgeText: {
    color: '#4CAF50',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 11,
  },
  addCard: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.45)',
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  addCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { color: '#fff', fontSize: 22, fontFamily: AppFonts.montserratBold, marginTop: -2 },
  addLabel: {
    color: '#fff',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 13,
  },
  formSection: {
    marginTop: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253a59',
    backgroundColor: '#111f32',
    padding: 14,
  },
  formTitle: {
    color: '#fff',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 17,
    marginBottom: 6,
  },
  formHint: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 12,
    marginBottom: 12,
  },
  label: {
    color: '#c5d4e8',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#314157',
    backgroundColor: '#1a2433',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: AppFonts.montserratMedium,
    fontSize: 14,
  },
  otpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  otpInput: { flex: 1 },
  otpBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  otpBtnText: {
    color: '#fff',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 13,
  },
  btnDisabled: { opacity: 0.55 },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    flexWrap: 'wrap',
  },
  submitWrap: { borderRadius: 12, overflow: 'hidden' },
  submitGradient: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  submitText: {
    color: '#fff',
    fontFamily: AppFonts.montserratBold,
    fontSize: 14,
  },
  cancelBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4a5568',
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: '#1a2433',
  },
  cancelBtnText: {
    color: '#DDE8F7',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 14,
  },
  footerNote: {
    marginTop: 16,
    color: '#f2a36e',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 12,
    lineHeight: 18,
  },
  demoBanner: {
    backgroundColor: 'rgba(213,110,42,0.15)',
    borderColor: '#D56E2A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  demoBannerText: {
    color: '#D56E2A',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 13,
  },
  demoOnlyContainer: {
    marginTop: 10,
    gap: 15,
  },
})

export default AddAccountScreen
