import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { API_BASE_URL, apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'

type TransactionsRouteParams = { returnToTab?: string }
type Tx = Record<string, any>

const PAGE_SIZE = 10
const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
]
const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
]

const moneyOrDash = (v: any) => {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const capitalizeFirst = (v: any) => {
  const s = String(v ?? '').trim()
  if (!s) return '—'
  return `${s.charAt(0).toUpperCase()}${s.slice(1).toLowerCase()}`
}
const statusLabel = (v: any) => capitalizeFirst(v)
const formatTime = (dateStr: any) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}
const formatPaymentMethod = (pm: any) => {
  if (!pm) return '—'
  const s = String(pm).toUpperCase()
  if (s === 'BANK' || s === 'BANK_TRANSFER') return 'Bank Transfer'
  return s
}
const paymentProofUrl = (url: any) => {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('http')) return url
  return `${API_BASE_URL.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`
}

const SelectField = ({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (next: string) => void
}) => {
  const fieldRef = useRef<View>(null)
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 })
  const label = options.find(o => o.value === value)?.label ?? options[0]?.label ?? 'Select'

  const openDropdown = useCallback(() => {
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setMenuRect({ top: y + height + 4, left: x, width })
      setOpen(true)
    })
  }, [])

  return (
    <View style={styles.selectWrap}>
      <Pressable ref={fieldRef} style={styles.selectField} onPress={openDropdown}>
        <Text style={styles.selectLabel}>{label}</Text>
        <Text style={styles.selectChevron}>⌄</Text>
      </Pressable>
      {open ? (
        <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.dropdownModalRoot}>
            <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
            <View style={[styles.dropdownSheet, { top: menuRect.top, left: menuRect.left, width: menuRect.width }]}>
              {options.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[styles.modalItem, value === opt.value && styles.modalItemActive]}
                  onPress={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <Text style={[styles.modalItemText, value === opt.value && styles.modalItemTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

const TransactionsScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ Transactions: TransactionsRouteParams }, 'Transactions'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [openProofId, setOpenProofId] = useState<string | null>(null)

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  const loadTransactions = useCallback(async (nextPage = 1, nextType?: string) => {
    const type = nextType ?? typeFilter
    try {
      setLoading(true)
      const params: Record<string, string> = { page: String(nextPage), limit: String(PAGE_SIZE) }
      if (type !== 'all') params.type = type
      const qs = `?${new URLSearchParams(params).toString()}`
      const res = await apiClient<any>(`${API_ENDPOINTS.walletTransactions}${qs}`, { method: 'GET' })

      // Robust parsing matching BetHistory logic
      let list: any[] = []
      let pagData = { page: nextPage, limit: PAGE_SIZE, total: 0, totalPages: 1 }

      if (res) {
        const data = res.data ?? res
        if (Array.isArray(data)) {
          list = data
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.transactions)) list = data.transactions
          else if (Array.isArray(data.data)) list = data.data
          else if (Array.isArray(data.records)) list = data.records

          const p = data.pagination || res.pagination
          if (p) {
            pagData = {
              page: Number(p.page ?? nextPage),
              limit: Number(p.limit ?? PAGE_SIZE),
              total: Number(p.total ?? p.totalRecords ?? list.length),
              totalPages: Math.max(1, Number(p.totalPages ?? 1)),
            }
          }
        }
      }

      setTransactions(list)
      setPage(pagData.page)
      setTotalPages(pagData.totalPages)
      setTotal(pagData.total)
    } catch (e: any) {
      setTransactions([])
      setPage(1)
      setTotalPages(1)
      setTotal(0)
      Toast.show({ type: 'error', text1: e?.message || 'Failed to load transactions.' })
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    loadTransactions(1, typeFilter)
  }, [isAuthenticated, loadTransactions, typeFilter])

  const filtered = useMemo(() => {
    const byStatus = statusFilter === 'all'
      ? transactions
      : transactions.filter(t => String(t?.status ?? '').toLowerCase() === statusFilter)
    const q = search.trim().toLowerCase()
    if (!q) return byStatus
    const searched = byStatus.filter(t => {
      const arr = [
        String(t?.id ?? ''),
        String(t?.type ?? ''),
        String(t?.amount ?? ''),
        String(t?.status ?? ''),
        String(formatTime(t?.createdAt)),
        String(formatPaymentMethod(t?.type === 'deposit' ? (t?.depositToDetail?.type ?? t?.paymentMethod) : t?.type === 'withdrawal' ? (t?.withdrawalToDetail?.type ?? t?.paymentMethod) : t?.paymentMethod)),
        String(t?.adminRemarks ?? t?.remarks ?? ''),
      ]
      return arr.some(v => v.toLowerCase().includes(q))
    })
    return searched.map((t, idx) => ({
      ...t, // Include all raw fields to avoid missing data like createdAt
      id: String(t?.id ?? idx),
      transactionTime: formatTime(t?.createdAt),
      typeDisplay: t?.type === 'deposit' ? 'Deposit' : t?.type === 'withdrawal' ? 'Withdrawal' : capitalizeFirst(t?.type),
      amountDisplay: moneyOrDash(t?.amount),
      approvedAmountDisplay: String(t?.status).toLowerCase() === 'approved' || String(t?.status).toLowerCase() === 'completed' ? moneyOrDash(t?.amount) : '—',
      statusDisplay: statusLabel(t?.status),
      statusRaw: String(t?.status ?? '').toLowerCase(),
      balanceBeforeDisplay: moneyOrDash(t?.balanceBefore),
      balanceAfterDisplay: moneyOrDash(t?.balanceAfter),
      paymentMethodDisplay: formatPaymentMethod(
        t?.type === 'deposit' ? (t?.depositToDetail?.type ?? t?.paymentMethod) : t?.type === 'withdrawal' ? (t?.withdrawalToDetail?.type ?? t?.paymentMethod) : t?.paymentMethod,
      ),
      notesDisplay: t?.adminRemarks || t?.remarks || '—',
      proofUrl: t?.type === 'deposit' ? paymentProofUrl(t?.paymentProofUrl) : null,
    }))
  }, [search, statusFilter, transactions])
  const formatDateTime = (date: any) => {
    if (!date) return '-';

    const d: any = new Date(date);
    if (isNaN(d)) return '-';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${day}/${month}/${year}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };



  const capitalize = (text: any) => {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '-';
  };

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Transactions</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search ID, type, amount..."
          placeholderTextColor="#7f8ca0"
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filtersRow}>
          <SelectField
            value={typeFilter}
            options={TYPE_FILTER_OPTIONS}
            onChange={next => {
              setTypeFilter(next)
              setPage(1)
            }}
          />
          <SelectField value={statusFilter} options={STATUS_FILTER_OPTIONS} onChange={setStatusFilter} />
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No deposit or withdrawal transactions yet.</Text>
        ) : (
          <View style={styles.listWrap}>
            {filtered.map((tx: any) => {
              console.log('[Transactions][transactionTime]', { id: tx?.id, transactionTime: tx?.transactionTime, raw: tx })

              return (
                <View key={tx?.id || Math.random()} style={styles.txCard}>

                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>
                      {capitalize(tx?.typeDisplay)}
                    </Text>

                    <View style={[
                      styles.statusBadge,
                      tx?.statusRaw === 'pending' && styles.badgePending,
                      (tx?.statusRaw === 'approved' || tx?.statusRaw === 'completed') && styles.badgeApproved,
                      tx?.statusRaw === 'rejected' && styles.badgeRejected
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        
                        tx?.statusRaw === 'pending' && { color: '#ffc108' },
                        tx?.statusRaw === 'rejected' && { color: 'red' },
                        (tx?.statusRaw === 'approved' || tx?.statusRaw === 'completed') && { color: 'green' }
                      ]}>
                        {capitalize(tx?.statusDisplay)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.row}>
                    <Text style={styles.key}>Transaction Time</Text>
                    <Text style={styles.val}>
                      {formatDateTime(tx?.createdAt)}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.key}>Transaction ID</Text>
                    <Text style={styles.val}>
                      {tx?.id ? `Transaction #${tx.id}` : '-'}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.key}>Amount</Text>
                    <Text style={[styles.val, styles.amountValue]}>
                      {tx?.amountDisplay}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.key}>Balance Before</Text>
                    <Text style={[styles.val, styles.amountValue]}>
                      {tx?.balanceBeforeDisplay}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.key}>Balance After</Text>
                    <Text style={[styles.val, styles.amountValue]}>
                      {tx?.balanceAfterDisplay}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.key}>Approved Amount</Text>
                    <Text style={styles.val}>
                      {tx?.approvedAmountDisplay}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.key}>Payment Method</Text>
                    <Text style={styles.val}>
                      {tx?.paymentMethodDisplay}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.key}>Admin / Notes</Text>
                    <Text style={styles.val}>
                      {tx?.notesDisplay}
                    </Text>
                  </View>

                  {tx?.proofUrl ? (
                    <View style={styles.proofWrap}>
                      <Pressable
                        style={styles.proofHeader}
                        onPress={() =>
                          setOpenProofId(prev => (prev === tx?.id ? null : tx?.id))
                        }
                      >
                        <Text style={styles.proofHeaderText}>Payment Proof</Text>
                        <Text style={styles.proofHeaderText}>
                          {openProofId === tx?.id ? '▲' : '▼'}
                        </Text>
                      </Pressable>

                      {openProofId === tx?.id ? (
                        <Pressable
                          style={styles.proofBody}
                          onPress={() => Linking.openURL(tx?.proofUrl)}
                        >
                          <Image source={{ uri: tx?.proofUrl }} style={styles.proofImg} />
                          <Text style={styles.proofOpenText}>Tap to open</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                </View>
              )
            })}
          </View>
        )}

        {!loading && totalPages > 1 ? (
          <View style={styles.pagination}>
            <Pressable style={[styles.pgBtn, page <= 1 && styles.pgBtnDisabled]} onPress={() => loadTransactions(page - 1)} disabled={page <= 1}>
              <Text style={styles.pgText}>Previous</Text>
            </Pressable>
            <Text style={styles.pgInfo}>Page {page} of {totalPages} ({total})</Text>
            <Pressable style={[styles.pgBtn, page >= totalPages && styles.pgBtnDisabled]} onPress={() => loadTransactions(page + 1)} disabled={page >= totalPages}>
              <Text style={styles.pgText}>Next</Text>
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
  title: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 33 / 2, marginBottom: 14 },
  searchInput: { borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14, marginBottom: 12 },
  filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  selectWrap: { flex: 1, position: 'relative', zIndex: 20 },
  selectField: { flex: 1, borderRadius: 10, backgroundColor: '#F97A31', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectLabel: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
  selectChevron: { color: '#fff', fontSize: 14, marginTop: -2 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  listWrap: { gap: 10 },
  txCard: { borderWidth: 1, borderColor: '#314157', backgroundColor: '#111c2a', borderRadius: 12, padding: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 32 / 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#334155' },
  badgePending: { backgroundColor: 'rgba(255, 193, 8, 0.15)', borderWidth: 1, borderColor: '#ffc108' },
  badgeApproved: { backgroundColor: 'rgba(34, 197, 94, 0.24)' },
  badgeRejected: { backgroundColor: 'rgba(239, 68, 68, 0.24)' },
  statusBadgeText: {  fontFamily: AppFonts.montserratSemiBold, fontSize: 11 },
  statusBadgeTextPending: { color: '#ffc108' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 5 },
  key: { color: '#8fa0b8', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  val: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, flexShrink: 1, textAlign: 'right' },
  amountValue: { color: '#F3A56E' },
  proofWrap: { marginTop: 10 },
  proofHeader: { borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proofHeaderText: { color: '#D6E2F3', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  proofBody: { marginTop: 8, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#314157' },
  proofImg: { width: '100%', height: 180, backgroundColor: '#0f172a' },
  proofOpenText: { color: '#C9D5E6', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'center', paddingVertical: 8, backgroundColor: '#111c2a' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, marginBottom: 12 },
  pgBtn: { backgroundColor: '#F97A31', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pgBtnDisabled: { opacity: 0.45 },
  pgText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  pgInfo: { color: 'rgba(255,255,255,0.82)', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  dropdownModalRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dropdownSheet: {
    position: 'absolute',
    backgroundColor: '#15243B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a3a52',
    overflow: 'hidden',
  },
  modalItem: { paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modalItemActive: { backgroundColor: 'rgba(249,122,49,0.14)' },
  modalItemText: { color: '#DDE8F7', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  modalItemTextActive: { color: '#F97A31', fontFamily: AppFonts.montserratSemiBold },
})

export default TransactionsScreen
