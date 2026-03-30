import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'

type WithdrawalRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

const DEFAULT_MIN_WITHDRAWAL = 500
const DEFAULT_MAX_WITHDRAWAL = 50000

const maskAccountNumber = (num: any) => {
  const s = String(num || '')
  if (!s || s.length < 4) return '****'
  return `****${s.slice(-4)}`
}

const extractApiErrorMessage = (error: any, fallback: string) => {
  const raw = String(error?.message || '')
  const jsonStart = raw.indexOf('{')
  if (jsonStart >= 0) {
    const jsonPart = raw.slice(jsonStart)
    try {
      const parsed = JSON.parse(jsonPart)
      if (parsed?.message) return String(parsed.message)
    } catch {
      // ignore parse failure and use fallback/raw
    }
  }
  return raw || fallback
}

const WithdrawalScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ Withdrawal: WithdrawalRouteParams }, 'Withdrawal'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated, user } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [accounts, setAccounts] = useState<AnyObj[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [transactionLimits, setTransactionLimits] = useState<AnyObj | null>(null)
  const [balanceInfo, setBalanceInfo] = useState<AnyObj | null>(null)

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  const fetchAccounts = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiClient<any>(API_ENDPOINTS.bankAccounts, { method: 'GET' })
      const list = res?.data?.accounts ?? res?.accounts ?? res?.data ?? []
      setAccounts(Array.isArray(list) ? list : [])
    } catch {
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    if (!isAuthenticated) return
    void (async () => {
      try {
        const [limitsRes, balRes, cfg] = await Promise.all([
          apiClient<any>(API_ENDPOINTS.transactionLimits, { method: 'GET' }),
          apiClient<any>(API_ENDPOINTS.balance, { method: 'GET' }),
          apiClient<any>(API_ENDPOINTS.platformConfig, { method: 'GET' }),
        ])
        if ((cfg?.data?.withdrawalServiceStatus ?? cfg?.withdrawalServiceStatus) === false) {
          Toast.show({ type: 'error', text1: 'Withdrawals are temporarily unavailable. Please try again later.' })
        }
        const lim = limitsRes?.data ?? limitsRes
        if (lim && typeof lim === 'object') setTransactionLimits(lim)
        const b = balRes?.data ?? balRes
        if (b && typeof b === 'object') setBalanceInfo(b?.wallet ?? b)
      } catch {
        // ignore secondary load failures
      }
    })()
  }, [isAuthenticated])

  const selectAccount = useCallback(async (accountId: string) => {
    try {
      const res = await apiClient<any>(`${API_ENDPOINTS.bankAccounts}/${encodeURIComponent(accountId)}/default`, { method: 'PATCH', body: {} })
      if (res?.success) {
        await fetchAccounts()
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Failed to set default account' })
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Failed to set default account' })
    }
  }, [fetchAccounts])

  const defaultAccount = useMemo(() => accounts.find(a => a?.isDefaultForWithdrawal) || accounts[0], [accounts])
  const minWithdrawal = transactionLimits?.minWithdrawalLimit != null ? Number(transactionLimits.minWithdrawalLimit) : DEFAULT_MIN_WITHDRAWAL
  const maxWithdrawal = transactionLimits?.maxWithdrawalLimit != null ? Number(transactionLimits.maxWithdrawalLimit) : DEFAULT_MAX_WITHDRAWAL
  const cashable = Number(balanceInfo?.balance ?? user?.wallet?.balance ?? 0)

  const validateAmountAndAccount = useCallback(() => {
    if (!defaultAccount) {
      Toast.show({ type: 'error', text1: 'Please select a bank account for withdrawal.' })
      return null
    }
    const numAmount = Number(amount)
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount greater than 0.' })
      return null
    }
    if (numAmount < minWithdrawal) {
      Toast.show({ type: 'error', text1: `Minimum withdrawal amount is ₹${minWithdrawal}` })
      return null
    }
    if (numAmount > maxWithdrawal) {
      Toast.show({ type: 'error', text1: `Maximum withdrawal amount is ₹${maxWithdrawal.toLocaleString('en-IN')}` })
      return null
    }
    return numAmount
  }, [amount, defaultAccount, maxWithdrawal, minWithdrawal])

  const handleSendOtp = useCallback(async () => {
    const numAmount = validateAmountAndAccount()
    if (numAmount == null) return
    setOtpLoading(true)
    try {
      const res = await apiClient<any>(API_ENDPOINTS.walletSendWithdrawalOtp, { method: 'POST', body: {} })
      if (res?.success) {
        Toast.show({ type: 'success', text1: res?.message || 'OTP sent to your registered mobile.' })
        setOtpSent(true)
        setOtp('')
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Failed to send OTP.' })
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: extractApiErrorMessage(e, 'Failed to send OTP.') })
    } finally {
      setOtpLoading(false)
    }
  }, [validateAmountAndAccount])

  const handleWithdrawalSubmit = useCallback(async () => {
    const numAmount = validateAmountAndAccount()
    if (numAmount == null) return
    if (!otpSent) return Toast.show({ type: 'error', text1: 'Please send OTP first.' })
    const otpTrimmed = String(otp || '').replace(/\D/g, '').slice(0, 6)
    if (otpTrimmed.length !== 6) return Toast.show({ type: 'error', text1: 'Enter the 6-digit OTP.' })
    const noteTrimmed = String(note || '').trim().slice(0, 200)

    setSubmitLoading(true)
    try {
      const payload = {
        accountId: defaultAccount?._id,
        amount: numAmount,
        otp: otpTrimmed,
        note: noteTrimmed,
      }
     
      const res = await apiClient<any>(API_ENDPOINTS.walletWithdrawal, { method: 'POST', body: payload })
     
      if (res?.success) {
        Toast.show({ type: 'success', text1: res?.message || 'Withdrawal request submitted successfully.' })
        setAmount('')
        setNote('')
        setOtp('')
        setOtpSent(false)
      } else {
       
        Toast.show({ type: 'error', text1: res?.message || 'Withdrawal request failed.' })
      }
    } catch (e: any) {
     
      Toast.show({ type: 'error', text1: extractApiErrorMessage(e, 'Withdrawal request failed.') })
    } finally {
      setSubmitLoading(false)
    }
  }, [defaultAccount?._id, note, otp, otpSent, validateAmountAndAccount])

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topCard}>
          <Text style={styles.topTitle}>Withdrawal</Text>
          <Text style={styles.topDesc}>Following payment withdrawal information:: Cashable Amount : {cashable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>

        <View style={styles.modeRow}>
          <Pressable style={styles.modeBtn}><Text style={styles.modeBtnText}>Bank</Text></Pressable>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading bank accounts...</Text>
        ) : accounts.length === 0 ? (
          <View style={styles.block}>
            <Text style={styles.emptyText}>No bank account added yet. Add one to request withdrawal.</Text>
            <Pressable style={styles.addBankLink} onPress={() => navigation.navigate('AddAccount')}>
              <Text style={styles.addBankLinkText}>Add bank account</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.block}>
            <Text style={styles.blockHeading}>Your bank account</Text>
            <Text style={styles.smallNote}>Withdrawal will be sent to the selected account below.</Text>
            <View style={styles.cardsRow}>
              {accounts.map(acc => (
                <Pressable key={String(acc?._id)} style={[styles.accountCard, acc?.isDefaultForWithdrawal && styles.accountCardSelected]} onPress={() => void selectAccount(String(acc?._id))}>
                  <Text style={styles.bankName}>{acc?.bankName}</Text>
                  <Text style={styles.holder}>{String(acc?.accountHolderName || '').toUpperCase()}</Text>
                  <Text style={styles.number}>{maskAccountNumber(acc?.accountNumber)}</Text>
                  <Text style={styles.ifsc}>IFSC: {acc?.ifscCode}</Text>
                  {acc?.isDefaultForWithdrawal ? <Text style={styles.defaultBadge}>Use for withdrawal</Text> : null}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!loading && accounts.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.blockHeading}>Enter Details</Text>
            <Text style={styles.smallNote}>Min withdrawal: ₹{minWithdrawal.toLocaleString('en-IN')}. Max: ₹{maxWithdrawal.toLocaleString('en-IN')}.</Text>
            <Text style={styles.label}>Amount to withdraw</Text>
            <TextInput style={styles.input} keyboardType="number-pad" placeholder="Amount to withdraw" placeholderTextColor="#7f8ca0" value={amount} onChangeText={txt => setAmount(txt.replace(/[^\d.]/g, ''))} />

            <Text style={styles.label}>Note (optional, max 200 characters)</Text>
            <TextInput style={styles.input} placeholder="Note (optional)" placeholderTextColor="#7f8ca0" value={note} onChangeText={txt => setNote(txt.slice(0, 200))} />

            <Text style={styles.label}>OTP (sent to your registered mobile)</Text>
            <View style={styles.otpRow}>
              <TextInput style={[styles.input, { flex: 1 }]} keyboardType="number-pad" placeholder="Enter 6-digit OTP" placeholderTextColor="#7f8ca0" value={otp} onChangeText={txt => setOtp(txt.replace(/\D/g, '').slice(0, 6))} />
              <Pressable style={styles.otpBtn} onPress={() => void handleSendOtp()} disabled={otpLoading}>
                <Text style={styles.otpBtnText}>{otpLoading ? 'Sending...' : 'Send OTP'}</Text>
              </Pressable>
            </View>

            <Pressable style={[styles.submitBtn, (submitLoading || !otpSent) && styles.disabledBtn]} onPress={() => void handleWithdrawalSubmit()} disabled={submitLoading || !otpSent}>
              <Text style={styles.submitBtnText}>{submitLoading ? 'Submitting...' : 'Request Withdrawal'}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 14, paddingTop: 12 },
  topCard: { borderRadius: 10, borderWidth: 1, borderColor: '#263b58', backgroundColor: '#15243B', padding: 14, marginBottom: 12 },
  topTitle: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 30 / 2 },
  topDesc: { marginTop: 4, color: '#d7e3f5', fontFamily: AppFonts.montserratMedium, fontSize: 13 },
  modeRow: { marginBottom: 8 },
  modeBtn: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: '#C45F24', backgroundColor: '#D56E2A', paddingHorizontal: 18, paddingVertical: 8 },
  modeBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 13 },
  block: { borderRadius: 12, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#111f32', padding: 12, marginTop: 10 },
  blockHeading: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 32 / 2 },
  smallNote: { color: '#9bb1ca', fontFamily: AppFonts.montserratMedium, fontSize: 12, marginTop: 6, marginBottom: 8 },
  cardsRow: { gap: 10 },
  accountCard: { borderRadius: 12, borderWidth: 1, borderColor: '#314157', backgroundColor: '#122237', padding: 12 },
  accountCardSelected: { borderColor: '#D56E2A' },
  bankName: { color: '#f28b43', fontFamily: AppFonts.montserratBold, fontSize: 16 / 1.3 },
  holder: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 13, marginTop: 3 },
  number: { color: '#d6e3f6', fontFamily: AppFonts.montserratSemiBold, fontSize: 20 / 1.4, marginTop: 3 },
  ifsc: { color: '#d6e3f6', fontFamily: AppFonts.montserratMedium, fontSize: 13, marginTop: 3 },
  defaultBadge: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 999, backgroundColor: 'rgba(37,99,64,0.5)', color: '#7be495', paddingHorizontal: 12, paddingVertical: 6, fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  label: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 13, marginTop: 8, marginBottom: 5 },
  input: { borderRadius: 8, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  otpRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  otpBtn: { borderRadius: 999, borderWidth: 1, borderColor: '#C45F24', backgroundColor: '#D56E2A', paddingHorizontal: 14, paddingVertical: 10 },
  otpBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 13 },
  submitBtn: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#C45F24', backgroundColor: '#D56E2A', alignItems: 'center', paddingVertical: 12 },
  submitBtnText: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 16 / 1.2 },
  disabledBtn: { opacity: 0.6 },
  emptyText: { color: 'rgba(255,255,255,0.6)', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  addBankLink: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C45F24',
    backgroundColor: '#D56E2A',
  },
  addBankLinkText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 13 },
})

export default WithdrawalScreen
