import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'

type MyWalletRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

const PAGE_SIZE = 10

const formatTime = (dateStr: any) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '—'
  }
}

const formatAmount = (amount: any) => {
  if (amount == null) return '—'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const capitalizeFirst = (v: any) => {
  const s = String(v ?? '').trim()
  if (!s) return '—'
  return `${s.charAt(0).toUpperCase()}${s.slice(1).toLowerCase()}`
}

const mapStatementToRow = (item: AnyObj, index: number) => {
  const id = item?.id ?? index
  const type = item?.type ?? item?.transactionType ?? '—'
  return {
    id: String(id),
    time: formatTime(item?.createdAt ?? item?.date ?? item?.transactionDate),
    txnId: item?.id ?? '—',
    type: capitalizeFirst(type),
    amount: item?.amount != null ? formatAmount(item.amount) : '—',
    balanceAfter: item?.balanceAfter != null ? formatAmount(item.balanceAfter) : '—',
    status: capitalizeFirst(item?.status),
    cardTitle: `Transaction #${item?.id != null ? item.id : index}`,
  }
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
  const label = options.find(o => o.value === value)?.label ?? 'All'

  const openDropdown = useCallback(() => {
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setMenuRect({ top: y + height + 4, left: x, width })
      setOpen(true)
    })
  }, [])

  return (
    <View style={styles.selectWrap}>
      <Pressable ref={fieldRef} style={styles.filterSelect} onPress={openDropdown}>
        <Text style={styles.filterSelectText}>{label}</Text>
        <Text style={styles.filterSelectChevron}>⌄</Text>
      </Pressable>
      {open ? (
        <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.dropdownModalRoot}>
            <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
            <View style={[styles.dropdownSheet, { top: menuRect.top, left: menuRect.left, width: menuRect.width }]}>
              {options.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[styles.dropdownRow, value === opt.value && styles.dropdownRowActive]}
                  onPress={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <Text style={[styles.dropdownRowText, value === opt.value && styles.dropdownRowTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

const MyWalletScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ MyWallet: MyWalletRouteParams }, 'MyWallet'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [rows, setRows] = useState<AnyObj[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterValue, setFilterValue] = useState('all')
  const [page, setPage] = useState(1)
  const [summary, setSummary] = useState<{ balance: any; totalWinnings: any } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  const fetchStatement = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const qs = new URLSearchParams({ page: '1', limit: '100' }).toString()
      let res: any
      try {
        res = await apiClient<any>(`${API_ENDPOINTS.walletStatement}?${qs}`, { method: 'GET' })
      } catch {
        // Fallback kept for environments where statement route is not enabled yet.
        res = await apiClient<any>(`${API_ENDPOINTS.walletTransactions}?${qs}`, { method: 'GET' })
      }
      const raw = res?.data ?? res
      const list = Array.isArray(raw) ? raw : (raw?.statement ?? raw?.transactions ?? raw?.data ?? [])
      if (!Array.isArray(list)) {
        setRows([])
        return
      }
      setRows(list.map(mapStatementToRow))
    } catch (e: any) {
      setRows([])
      Toast.show({ type: 'error', text1: e?.message || 'Failed to load wallet statement.' })
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const fetchSummary = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      setSummaryLoading(true)
      const res = await apiClient<any>(API_ENDPOINTS.balance, { method: 'GET' })
      const raw = res?.data ?? res
      const wallet = raw?.wallet && typeof raw.wallet === 'object' ? raw.wallet : raw
      if (!wallet || typeof wallet !== 'object') return
      setSummary({
        balance: wallet?.balance ?? 0,
        totalWinnings: wallet?.totalWinnings ?? 0,
      })
    } catch {
      // Ignore summary failure and keep screen usable.
    } finally {
      setSummaryLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void fetchStatement()
    void fetchSummary()
  }, [fetchStatement, fetchSummary])

  const typeOptions = useMemo(() => {
    const unique = new Set<string>()
    rows.forEach(row => {
      const val = String(row?.type ?? '').trim()
      if (val) unique.add(val)
    })
    const mapped = Array.from(unique).sort().map(v => ({ value: v, label: v }))
    return [{ value: 'all', label: 'All' }, ...mapped]
  }, [rows])

  const filtered = useMemo(() => {
    let list = rows
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(row =>
        [row?.time, row?.txnId, row?.type, row?.amount, row?.balanceAfter, row?.status]
          .some(v => String(v ?? '').toLowerCase().includes(q)),
      )
    }
    if (filterValue !== 'all') {
      list = list.filter(row => String(row?.type ?? '').trim() === filterValue)
    }
    return list
  }, [filterValue, rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [currentPage, filtered])

  useEffect(() => {
    setPage(1)
  }, [search, filterValue])

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Wallet</Text>

        {!summaryLoading ? (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Main Balance</Text>
              <Text style={styles.summaryValue}>{formatAmount(summary?.balance ?? 0)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Winnings</Text>
              <Text style={styles.summaryValue}>{formatAmount(summary?.totalWinnings ?? 0)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.filtersRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#7f8ca0"
            value={search}
            onChangeText={setSearch}
          />
          <SelectField value={filterValue} options={typeOptions} onChange={setFilterValue} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#F97A31" />
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : rows.length === 0 ? (
          <Text style={styles.emptyText}>No wallet transactions yet.</Text>
        ) : paged.length === 0 ? (
          <Text style={styles.emptyText}>No matches for your search.</Text>
        ) : (
          <View style={styles.listWrap}>
            {paged.map(row => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.cardTitle}>{row.cardTitle}</Text>
                <View style={styles.separator} />
                <View style={styles.row}><Text style={styles.key}>Time</Text><Text style={styles.val}>{row.time}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Transaction ID</Text><Text style={styles.val}>{row.txnId}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Type</Text><Text style={styles.val}>{row.type}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Amount</Text><Text style={styles.amountVal}>{row.amount}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Balance After</Text><Text style={styles.amountVal}>{row.balanceAfter}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Status</Text><Text style={styles.val}>{row.status}</Text></View>
              </View>
            ))}
          </View>
        )}

        {!loading && filtered.length > 0 && (
          <View style={styles.pagination}>
            <Pressable style={[styles.pgBtn, currentPage <= 1 && styles.pgBtnDisabled]} onPress={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
              <Text style={styles.pgText}>Previous</Text>
            </Pressable>
            <Text style={styles.pgInfo}>Page {currentPage} of {totalPages} ({filtered.length} total)</Text>
            <Pressable style={[styles.pgBtn, currentPage >= totalPages && styles.pgBtnDisabled]} onPress={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
              <Text style={styles.pgText}>Next</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 14, paddingTop: 12 },
  title: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 33 / 2, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', paddingHorizontal: 12, paddingVertical: 10 },
  summaryLabel: { color: '#A9BDD6', fontFamily: AppFonts.montserratMedium, fontSize: 12, marginBottom: 4 },
  summaryValue: { color: '#FFFFFF', fontFamily: AppFonts.montserratBold, fontSize: 16 },
  filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  selectWrap: { flex: 1, position: 'relative', zIndex: 20 },
  filterSelect: { borderRadius: 10, borderWidth: 1, borderColor: '#C45F24', backgroundColor: '#D56E2A', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterSelectText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
  filterSelectChevron: { color: '#fff', fontSize: 14, marginTop: -2 },
  listWrap: { gap: 10 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#111f32', padding: 12 },
  cardTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 28 / 2 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  key: { color: '#9CB0C9', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  val: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  amountVal: { color: '#F3A56E', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  loadingWrap: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.55)', fontFamily: AppFonts.montserratMedium, fontSize: 14, marginTop: 12 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, marginBottom: 12 },
  pgBtn: { backgroundColor: '#F97A31', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pgBtnDisabled: { opacity: 0.45 },
  pgText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  pgInfo: { color: 'rgba(255,255,255,0.82)', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  dropdownModalRoot: { ...StyleSheet.absoluteFillObject },
  dropdownBackdrop: { ...StyleSheet.absoluteFillObject },
  dropdownSheet: {
    position: 'absolute',
    backgroundColor: '#15243B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a3a52',
    overflow: 'hidden',
  },
  dropdownRow: { paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  dropdownRowActive: { backgroundColor: 'rgba(249,122,49,0.14)' },
  dropdownRowText: { color: '#DDE8F7', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  dropdownRowTextActive: { color: '#F97A31', fontFamily: AppFonts.montserratSemiBold },
})

export default MyWalletScreen
