import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import ImageCropPicker from 'react-native-image-crop-picker'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import Clipboard from '@react-native-clipboard/clipboard'
import { apiClient, apiClientMultipart } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'

type DepositRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

const AMOUNT_OPTIONS = [500, 1000, 5000, 10000, 25000, 50000, 100000, 500000]
const MIN_AMOUNT = 100
const MAX_AMOUNT = 1000000
const MIN_UTR_LENGTH = 6
const BANK_TRANSFER_OPTIONS = [
  { value: 'imps', label: 'IMPS' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
]
const FALLBACK_BANK_ACCOUNTS = [
  { _id: 'fallback-1', type: 'bank', bankName: 'State Bank of India', accountHolderName: 'Admin Account', accountNumber: '1234567890123456', ifscCode: 'SBIN0001234', minDeposit: MIN_AMOUNT, maxDeposit: MAX_AMOUNT },
  { _id: 'fallback-2', type: 'bank', bankName: 'HDFC Bank', accountHolderName: 'Admin Account', accountNumber: '9876543210987654', ifscCode: 'HDFC0000567', minDeposit: MIN_AMOUNT, maxDeposit: MAX_AMOUNT },
  { _id: 'fallback-3', type: 'bank', bankName: 'ICICI Bank', accountHolderName: 'Admin Account', accountNumber: '5555666677778888', ifscCode: 'ICIC0000890', minDeposit: MIN_AMOUNT, maxDeposit: MAX_AMOUNT },
]

const buildUpiUri = (upiId: string, upiName = '', amount = '') => {
  if (!upiId) return ''
  const pa = encodeURIComponent(upiId.trim())
  const pn = encodeURIComponent((upiName || '').trim() || 'Pay')
  const am = amount && Number(amount) > 0 ? `&am=${Number(amount)}` : ''
  return `upi://pay?pa=${pa}&pn=${pn}${am}&cu=INR`
}

const makeQrUrl = (value: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(value)}`

const cleanAmount = (v: string) => v.replace(/[^\d]/g, '')

const DepositScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ Deposit: DepositRouteParams }, 'Deposit'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [masterAccounts, setMasterAccounts] = useState<AnyObj[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [selectedPayment, setSelectedPayment] = useState('bank')
  const [selectedCryptoCurrency, setSelectedCryptoCurrency] = useState('USDT')
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0)
  const [bankTransferMethod, setBankTransferMethod] = useState('imps')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [utrInput, setUtrInput] = useState('')
  const [cryptoDepositAddress, setCryptoDepositAddress] = useState('')
  const [cryptoAddressLoading, setCryptoAddressLoading] = useState(false)
  const [paymentProofFile, setPaymentProofFile] = useState<any>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [transactionLimits, setTransactionLimits] = useState<AnyObj | null>(null)
  const [platformConfig, setPlatformConfig] = useState<AnyObj | null>(null)
  const typeRef = useRef<View>(null)
  const [typeOpen, setTypeOpen] = useState(false)
  const [typeMenuRect, setTypeMenuRect] = useState({ top: 0, left: 0, width: 0 })
  const transferRef = useRef<View>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferMenuRect, setTransferMenuRect] = useState({ top: 0, left: 0, width: 0 })
  const [uploadSourceOpen, setUploadSourceOpen] = useState(false)

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  useEffect(() => {
    if (!isAuthenticated) return
    const load = async () => {
      try {
        const [accRes, limitsRes, configRes] = await Promise.all([
          apiClient<any>(API_ENDPOINTS.depositAccountsMaster, { method: 'GET' }),
          apiClient<any>(API_ENDPOINTS.transactionLimits, { method: 'GET' }),
          apiClient<any>(API_ENDPOINTS.platformConfig, { method: 'GET' }),
        ])
        const accounts = accRes?.data?.accounts ?? accRes?.accounts ?? []
        setMasterAccounts(Array.isArray(accounts) ? accounts : [])
        if (Array.isArray(accounts) && accounts.length > 0) {
          const types = [...new Set(accounts.map((a: AnyObj) => a?.type).filter(Boolean))]
          if (types.length > 0 && !types.includes('bank')) setSelectedPayment(String(types[0]))
          else if (accounts.filter((a: AnyObj) => a?.type === 'bank').length === 0 && accounts.filter((a: AnyObj) => a?.type === 'upi').length > 0) setSelectedPayment('upi')
        }
        const lim = limitsRes?.data ?? limitsRes
        if (lim && typeof lim === 'object') setTransactionLimits(lim)
        const conf = configRes?.data ?? configRes
        if (conf && typeof conf === 'object') setPlatformConfig(conf)
      } catch (e: any) {
        Toast.show({ type: 'error', text1: e?.message || 'Failed to load deposit data.' })
      } finally {
        setOptionsLoading(false)
      }
    }
    void load()
  }, [isAuthenticated])

  const bankAccounts = useMemo(() => masterAccounts.filter(a => a?.type === 'bank'), [masterAccounts])
  const paymentTypesFromBackend = useMemo(() => {
    const types = [...new Set(masterAccounts.map(a => a?.type).filter(Boolean))]
    return types.length > 0 ? types : ['bank']
  }, [masterAccounts])
  const typeToLabel = (type: string) => (type === 'bank' ? 'Bank' : type === 'upi' ? 'UPI' : `${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()}`)

  useEffect(() => {
    if (paymentTypesFromBackend.length > 0 && !paymentTypesFromBackend.includes(selectedPayment)) {
      setSelectedPayment(String(paymentTypesFromBackend[0]))
      setSelectedOptionIndex(0)
    }
  }, [paymentTypesFromBackend, selectedPayment])

  const currentOptionList = useMemo(
    () => (selectedPayment === 'bank' ? (bankAccounts.length > 0 ? bankAccounts : FALLBACK_BANK_ACCOUNTS) : masterAccounts.filter(a => a?.type === selectedPayment)),
    [bankAccounts, masterAccounts, selectedPayment],
  )
  const currentOptionListAny = currentOptionList as AnyObj[]
  const safeOptionIndex = currentOptionList.length > 0 && selectedOptionIndex >= currentOptionList.length ? 0 : selectedOptionIndex
  const selectedAccount: AnyObj | null = currentOptionListAny[safeOptionIndex] || currentOptionListAny[0] || null
  const usingFallback = selectedPayment === 'bank' && bankAccounts.length === 0 && FALLBACK_BANK_ACCOUNTS.length > 0
  const currentDetailId = usingFallback ? null : (selectedAccount?._id || null)

  const limitMin = transactionLimits?.minDepositLimit != null ? Number(transactionLimits.minDepositLimit) : null
  const limitMax = transactionLimits?.maxDepositLimit != null ? Number(transactionLimits.maxDepositLimit) : null
  const accountMin = selectedAccount?.minDeposit != null ? Number(selectedAccount.minDeposit) : MIN_AMOUNT
  const accountMax = selectedAccount?.maxDeposit != null ? Number(selectedAccount.maxDeposit) : MAX_AMOUNT
  const minAllowed = limitMin != null ? limitMin : accountMin
  const maxAllowed = limitMax != null ? limitMax : accountMax

  const ensureCameraPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      Toast.show({ type: 'error', text1: 'Camera permission denied' })
      return false
    }
    return true
  }, [])

  const ensureGalleryPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true
    const permission =
      Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    const granted = await PermissionsAndroid.request(permission)
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      Toast.show({ type: 'error', text1: 'Gallery permission denied' })
      return false
    }
    return true
  }, [])

  const setPickedFile = useCallback((image: any) => {
    if (!image?.path) return
    const file = {
      uri: image.path,
      type: image.mime || 'image/jpeg',
      name: `proof-${Date.now()}.${String(image.mime || 'image/jpeg').split('/')[1] || 'jpg'}`,
    }
    setPaymentProofFile(file)
    setSelectedFileName(file.name)
  }, [])

  const onPickFromGallery = useCallback(async () => {
    setUploadSourceOpen(false)
    const ok = await ensureGalleryPermission()
    if (!ok) return
    try {
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.8,
      })
      setPickedFile(image)
    } catch (e: any) {
      if (String(e?.message || '').toLowerCase().includes('cancel')) return
      Toast.show({ type: 'error', text1: 'Could not pick image from gallery' })
    }
  }, [ensureGalleryPermission, setPickedFile])

  const onPickFromCamera = useCallback(async () => {
    setUploadSourceOpen(false)
    const ok = await ensureCameraPermission()
    if (!ok) return
    try {
      const image = await ImageCropPicker.openCamera({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.8,
      })
      setPickedFile(image)
    } catch (e: any) {
      if (String(e?.message || '').toLowerCase().includes('cancel')) return
      Toast.show({ type: 'error', text1: 'Could not capture image' })
    }
  }, [ensureCameraPermission, setPickedFile])

  const handleNext = useCallback(async () => {
    if (platformConfig?.depositServiceStatus === false) return
    const amount = Number(cleanAmount(amountInput)) || 0
    if (amount < minAllowed) return Toast.show({ type: 'error', text1: `Minimum deposit amount is ₹${minAllowed}` })
    if (amount > maxAllowed) return Toast.show({ type: 'error', text1: `Maximum deposit amount is ₹${maxAllowed.toLocaleString('en-IN')}` })
    if (selectedPayment === 'crypto') {
      setCryptoAddressLoading(true)
      try {
        const res = await apiClient<any>(API_ENDPOINTS.walletGenerateAddress, { method: 'GET' })
        const address = typeof res?.data === 'string' ? res.data : (res?.data?.address ?? res?.address ?? '')
        if (!address) {
          Toast.show({ type: 'error', text1: res?.message || 'Failed to fetch address' })
          return
        }
        setCryptoDepositAddress(String(address))
      } finally {
        setCryptoAddressLoading(false)
      }
    }
    setStep(2)
  }, [amountInput, maxAllowed, minAllowed, platformConfig?.depositServiceStatus, selectedPayment])

  const handleConfirmPayment = useCallback(async () => {
    if (platformConfig?.depositServiceStatus === false) return
    const amount = Number(cleanAmount(amountInput)) || 0
    const utr = String(utrInput || '').trim()
    if (amount < minAllowed) return Toast.show({ type: 'error', text1: `Minimum deposit amount is ₹${minAllowed}` })
    if (amount > maxAllowed) return Toast.show({ type: 'error', text1: `Maximum deposit amount is ₹${maxAllowed.toLocaleString('en-IN')}` })
    if (selectedPayment !== 'crypto' && utr.length < MIN_UTR_LENGTH) return Toast.show({ type: 'error', text1: 'Please enter UTR / Reference ID (at least 6 characters)' })

    if (selectedPayment === 'crypto') {
      setSubmitLoading(true)
      try {
        const result = await apiClient<any>(API_ENDPOINTS.walletVerifyUsdtDeposit, { method: 'GET' })
        if (result?.success) Toast.show({ type: 'success', text1: result?.message || 'USDT deposit verification completed' })
        else Toast.show({ type: 'error', text1: result?.message || 'Failed to verify USDT deposit' })
      } catch (e: any) {
        Toast.show({ type: 'error', text1: e?.message || 'Failed to verify USDT deposit' })
      } finally {
        setSubmitLoading(false)
      }
      return
    }

    const paymentMethod = selectedAccount?.type === 'bank' ? bankTransferMethod : selectedPayment
    const payload = {
      amount,
      utrNumber: selectedPayment === 'crypto' ? '' : utr,
      paymentMethod,
      adminDetailId: currentDetailId || null,
    }
    setSubmitLoading(true)
    try {
      let result: any
      if (paymentProofFile) {
        const formData = new FormData()
        formData.append('amount', String(payload.amount))
        formData.append('utrNumber', String(payload.utrNumber))
        formData.append('paymentMethod', String(payload.paymentMethod))
        if (payload.adminDetailId) formData.append('adminDetailId', String(payload.adminDetailId))
        formData.append('paymentProof', paymentProofFile as any)
        result = await apiClientMultipart<any>(API_ENDPOINTS.walletDeposit, formData, { method: 'POST' })
      } else {
        result = await apiClient<any>(API_ENDPOINTS.walletDeposit, { method: 'POST', body: payload })
      }
      if (result?.success) {
        Toast.show({ type: 'success', text1: result?.message || 'Deposit request submitted successfully' })
        setAmountInput('')
        setSelectedAmount(null)
        setUtrInput('')
        setPaymentProofFile(null)
        setSelectedFileName('')
        setStep(1)
      } else {
        Toast.show({ type: 'error', text1: result?.message || 'Failed to submit deposit request' })
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Failed to submit deposit request' })
    } finally {
      setSubmitLoading(false)
    }
  }, [amountInput, bankTransferMethod, currentDetailId, maxAllowed, minAllowed, paymentProofFile, platformConfig?.depositServiceStatus, selectedAccount?.type, selectedPayment, utrInput])

  const qrValue = useMemo(() => {
    if (selectedPayment === 'crypto') return cryptoDepositAddress
    if (selectedAccount?.type === 'upi' && selectedAccount?.upiId) return buildUpiUri(selectedAccount.upiId, selectedAccount.upiName, cleanAmount(amountInput))
    return ''
  }, [amountInput, cryptoDepositAddress, selectedAccount?.type, selectedAccount?.upiId, selectedAccount?.upiName, selectedPayment])

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {platformConfig?.depositServiceStatus === false ? <Text style={styles.banner}>Deposits are temporarily unavailable. Please try again later.</Text> : null}
        <View style={styles.topCard}>
          <Text style={styles.topTitle}>Deposit</Text>
          <Text style={styles.topDesc}>{step === 1 ? 'Select payment method, choose or enter amount, then click Next.' : 'Pay to the account below and enter your payment details.'}</Text>
        </View>

        {step === 1 ? (
          <>
            <Pressable
              ref={typeRef}
              style={styles.typeDropdown}
              onPress={() => {
                typeRef.current?.measureInWindow((x, y, width, height) => {
                  setTypeMenuRect({ top: y + height + 4, left: x, width })
                  setTypeOpen(true)
                })
              }}
            >
              <Text style={styles.dropdownLabel}>{typeToLabel(selectedPayment)}</Text>
              <Text style={styles.dropdownChevron}>⌄</Text>
            </Pressable>
            {typeOpen ? (
              <Modal transparent visible={typeOpen} animationType="fade" onRequestClose={() => setTypeOpen(false)}>
                <View style={styles.dropdownModalRoot}>
                  <Pressable style={styles.dropdownBackdrop} onPress={() => setTypeOpen(false)} />
                  <View style={[styles.dropdownSheet, { top: typeMenuRect.top, left: typeMenuRect.left, width: typeMenuRect.width }]}>
                    {paymentTypesFromBackend.map(type => (
                      <Pressable
                        key={String(type)}
                        style={[styles.dropdownRow, selectedPayment === type && styles.dropdownRowActive]}
                        onPress={() => {
                          setSelectedPayment(String(type))
                          setSelectedOptionIndex(0)
                          setTypeOpen(false)
                        }}
                      >
                        <Text style={[styles.dropdownRowText, selectedPayment === type && styles.dropdownRowTextActive]}>
                          {typeToLabel(String(type))}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </Modal>
            ) : null}

            {selectedPayment === 'crypto' ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Select Currency</Text>
                <Pressable style={styles.input}><Text style={styles.inputText}>{selectedCryptoCurrency}</Text></Pressable>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {currentOptionList.map((acc, idx) => (
                  <Pressable key={String(acc?._id || idx)} style={[styles.optBtn, safeOptionIndex === idx && styles.optBtnActive]} onPress={() => setSelectedOptionIndex(idx)}>
                    <Text style={[styles.optBtnText, safeOptionIndex === idx && styles.optBtnTextActive]}>Option {idx + 1}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={styles.amountGridCard}>
              <View style={styles.amountGrid}>
                {AMOUNT_OPTIONS.map(value => (
                  <Pressable key={value} style={[styles.amountChip, selectedAmount === value && styles.amountChipActive]} onPress={() => { setSelectedAmount(value); setAmountInput(String(value)) }}>
                    <Text style={[styles.amountChipText, selectedAmount === value && styles.amountChipTextActive]}>+{value.toLocaleString('en-IN')}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Enter Amount (INR)</Text>
              <Text style={styles.limitText}>Limit: ₹{minAllowed.toLocaleString('en-IN')} - ₹{maxAllowed.toLocaleString('en-IN')}.{transactionLimits?.bonusPercentage != null ? ` Bonus: ${Number(transactionLimits.bonusPercentage)}%.` : ''}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Enter Amount To Be Deposited"
                  placeholderTextColor="#7f8ca0"
                  value={amountInput}
                  keyboardType="number-pad"
                  onChangeText={txt => setAmountInput(cleanAmount(txt))}
                />
                <Pressable style={styles.clearBtn} onPress={() => { setAmountInput(''); setSelectedAmount(null) }}>
                  <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
              </View>
            </View>

            <Pressable style={[styles.nextBtn, (optionsLoading || cryptoAddressLoading) && styles.disabledBtn]} disabled={optionsLoading || cryptoAddressLoading} onPress={() => void handleNext()}>
              <Text style={styles.nextBtnText}>{cryptoAddressLoading ? 'Fetching address...' : 'Next'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={styles.backBtn} onPress={() => setStep(1)}>
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
            <Text style={styles.stepTitle}>{selectedPayment === 'crypto' ? 'Deposit to this crypto address' : `Pay to this ${selectedAccount?.type === 'bank' ? 'bank' : 'UPI'} account`}</Text>

            {(selectedAccount?.type === 'upi' || selectedPayment === 'crypto') && qrValue ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: makeQrUrl(qrValue) }} style={styles.qrImage} />
              </View>
            ) : null}

            {selectedAccount?.type === 'bank' ? (
              <View style={styles.block}>
                <View style={styles.row}><Text style={styles.key}>Bank name</Text><Text style={styles.val}>{selectedAccount?.bankName || '—'}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Account Holder Name</Text><Text style={styles.val}>{selectedAccount?.accountHolderName || '—'}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Account Number</Text><Text style={styles.val}>{selectedAccount?.accountNumber || '—'}</Text></View>
                <View style={styles.row}><Text style={styles.key}>IFSC Code</Text><Text style={styles.val}>{selectedAccount?.ifscCode || '—'}</Text></View>
              </View>
            ) : null}

            {selectedAccount?.type === 'bank' ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Transfer type</Text>
                <Pressable
                  ref={transferRef}
                  style={styles.selectLike}
                  onPress={() => {
                    transferRef.current?.measureInWindow((x, y, width, height) => {
                      setTransferMenuRect({ top: y + height + 4, left: x, width })
                      setTransferOpen(true)
                    })
                  }}
                >
                  <Text style={styles.selectLikeText}>
                    {BANK_TRANSFER_OPTIONS.find(opt => opt.value === bankTransferMethod)?.label || 'IMPS'}
                  </Text>
                  <Text style={styles.selectLikeChevron}>⌄</Text>
                </Pressable>
                {transferOpen ? (
                  <Modal transparent visible={transferOpen} animationType="fade" onRequestClose={() => setTransferOpen(false)}>
                    <View style={styles.dropdownModalRoot}>
                      <Pressable style={styles.dropdownBackdrop} onPress={() => setTransferOpen(false)} />
                      <View style={[styles.dropdownSheet, { top: transferMenuRect.top, left: transferMenuRect.left, width: transferMenuRect.width }]}>
                        {BANK_TRANSFER_OPTIONS.map(opt => (
                          <Pressable
                            key={opt.value}
                            style={[styles.dropdownRow, bankTransferMethod === opt.value && styles.dropdownRowActive]}
                            onPress={() => {
                              setBankTransferMethod(opt.value)
                              setTransferOpen(false)
                            }}
                          >
                            <Text style={[styles.dropdownRowText, bankTransferMethod === opt.value && styles.dropdownRowTextActive]}>{opt.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </Modal>
                ) : null}
              </View>
            ) : null}

            {selectedAccount?.type === 'upi' ? (
              <View style={styles.upiCard}>
                <Text style={styles.key}>UPI ID :</Text>
                <Text style={styles.val}>{selectedAccount?.upiId || '—'}</Text>
                <Text style={styles.val}>{selectedAccount?.upiName || ''}</Text>
              </View>
            ) : null}

            {selectedPayment === 'crypto' ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Deposit Address (BEP20)</Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} editable={false} value={cryptoDepositAddress || '—'} />
                  <Pressable style={styles.clearBtn} onPress={() => { if (cryptoDepositAddress) { Clipboard.setString(cryptoDepositAddress); Toast.show({ type: 'success', text1: 'Address copied' }) } }}>
                    <Text style={styles.clearBtnText}>Copy</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>UTR Number / Reference ID (from your payment)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Enter UTR / Reference ID"
                      placeholderTextColor="#7f8ca0"
                      value={utrInput}
                      onChangeText={setUtrInput}
                    />
                    <Pressable style={styles.clearBtn} onPress={() => setUtrInput('')}>
                      <Text style={styles.clearBtnText}>Clear</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.block}>
                  <Text style={styles.blockTitle}>Screenshot (payment proof)</Text>
                  <Pressable style={styles.uploadBox} onPress={() => setUploadSourceOpen(true)}>
                    <Text style={styles.uploadIcon}>⇪</Text>
                    <Text style={styles.uploadText}>{selectedFileName || 'Choose screenshot (optional)'}</Text>
                  </Pressable>
                </View>
              </>
            )}

            <Text style={styles.noteText}>Note: Please allow up to 30 mins for deposit to credit. For delay, contact support.</Text>
            <Pressable style={[styles.nextBtn, submitLoading && styles.disabledBtn]} disabled={submitLoading} onPress={() => void handleConfirmPayment()}>
              <Text style={styles.nextBtnText}>{submitLoading ? 'Submitting...' : 'Confirm Payment'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {uploadSourceOpen ? (
        <Modal transparent visible={uploadSourceOpen} animationType="fade" onRequestClose={() => setUploadSourceOpen(false)}>
          <Pressable style={styles.sourceOverlay} onPress={() => setUploadSourceOpen(false)}>
            <View style={styles.sourceCard}>
              <Text style={styles.sourceTitle}>Upload Screenshot</Text>
              <Pressable style={styles.sourceBtn} onPress={() => void onPickFromCamera()}>
                <Text style={styles.sourceBtnText}>Camera</Text>
              </Pressable>
              <Pressable style={styles.sourceBtn} onPress={() => void onPickFromGallery()}>
                <Text style={styles.sourceBtnText}>Gallery</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 14, paddingTop: 12 },
  banner: { borderRadius: 10, borderWidth: 1, borderColor: '#5a2d2d', backgroundColor: '#2a1616', color: '#f3b4b4', padding: 10, marginBottom: 10, fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  topCard: { borderRadius: 10, borderWidth: 1, borderColor: '#263b58', backgroundColor: '#15243B', padding: 14, marginBottom: 10 },
  topTitle: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 30 / 2 },
  topDesc: { marginTop: 4, color: '#d7e3f5', fontFamily: AppFonts.montserratMedium, fontSize: 13 },
  typeDropdown: { borderRadius: 10, borderWidth: 1, borderColor: '#C45F24', backgroundColor: '#D56E2A', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10 },
  dropdownLabel: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
  dropdownChevron: { color: '#fff', fontSize: 14, position: 'absolute', right: 12, top: 10 },
  optionRow: { gap: 8, paddingVertical: 8 },
  selectLike: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#314157',
    backgroundColor: '#1a2433',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectLikeText: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  selectLikeChevron: { color: '#EAF2FF', fontSize: 14, marginTop: -2 },
  optBtn: { borderRadius: 999, borderWidth: 1, borderColor: '#3c4f67', backgroundColor: '#1a2433', paddingHorizontal: 16, paddingVertical: 8 },
  optBtnActive: { borderColor: '#c45f24', backgroundColor: '#D56E2A' },
  optBtnText: { color: '#cfe0f7', fontFamily: AppFonts.montserratSemiBold, fontSize: 13 },
  optBtnTextActive: { color: '#fff' },
  amountGridCard: { borderRadius: 12, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#111f32', padding: 12, marginTop: 2 },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountChip: { width: '48%', borderRadius: 8, borderWidth: 1, borderColor: '#2f435e', backgroundColor: '#1d2c42', alignItems: 'center', paddingVertical: 10 },
  amountChipActive: { borderColor: '#d56e2a', backgroundColor: 'rgba(213,110,42,0.22)' },
  amountChipText: { color: '#d6e3f6', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
  amountChipTextActive: { color: '#fff' },
  block: { borderRadius: 12, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#111f32', padding: 12, marginTop: 12 },
  blockTitle: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 14, marginBottom: 8 },
  limitText: { color: '#9bb1ca', fontFamily: AppFonts.montserratMedium, fontSize: 12, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { borderRadius: 8, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  inputText: { color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  clearBtn: { borderRadius: 8, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', paddingHorizontal: 12, paddingVertical: 10 },
  clearBtnText: { color: '#dce8f8', fontFamily: AppFonts.montserratSemiBold, fontSize: 13 },
  nextBtn: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#C45F24', backgroundColor: '#D56E2A', alignItems: 'center', paddingVertical: 12 },
  nextBtnText: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 16 / 1.2 },
  disabledBtn: { opacity: 0.6 },
  backBtn: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', paddingHorizontal: 18, paddingVertical: 8, marginTop: 4 },
  backBtnText: { color: '#DDE8F7', fontFamily: AppFonts.montserratSemiBold, fontSize: 13 },
  stepTitle: { marginTop: 12, marginBottom: 10, color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 16 / 1.1 },
  qrWrap: {
    alignSelf: 'center',
    width: '78%',
    maxWidth: 330,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 14,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrImage: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 3 },
  key: { color: '#9CB0C9', fontFamily: AppFonts.montserratMedium, fontSize: 12, flex: 1 },
  val: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  upiCard: { borderRadius: 10, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#1a2740', padding: 12, marginBottom: 8 },
  uploadBox: { borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadIcon: { color: '#dce8f8', fontSize: 30 },
  uploadText: { color: '#dce8f8', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  noteText: { marginTop: 12, color: '#f2a36e', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  dropdownModalRoot: { ...StyleSheet.absoluteFillObject },
  dropdownBackdrop: { ...StyleSheet.absoluteFillObject },
  dropdownSheet: { position: 'absolute', backgroundColor: '#15243B', borderRadius: 10, borderWidth: 1, borderColor: '#2a3a52', overflow: 'hidden' },
  dropdownRow: { paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  dropdownRowActive: { backgroundColor: 'rgba(249,122,49,0.14)' },
  dropdownRowText: { color: '#DDE8F7', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  dropdownRowTextActive: { color: '#F97A31', fontFamily: AppFonts.montserratSemiBold },
  sourceOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  sourceCard: { backgroundColor: '#111f32', borderWidth: 1, borderColor: '#253a59', borderRadius: 12, padding: 14, gap: 10 },
  sourceTitle: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 16 },
  sourceBtn: { borderRadius: 8, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', paddingVertical: 11, alignItems: 'center' },
  sourceBtnText: { color: '#EAF2FF', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
})

export default DepositScreen
