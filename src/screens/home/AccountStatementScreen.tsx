import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'

type AccountStatementRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

const PAGE_SIZE = 10
const EXPORT_FILENAME = 'account-statement'

const COLUMNS: { key: string; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'credit', label: 'Credit' },
  { key: 'debit', label: 'Debit' },
  { key: 'balance', label: 'Balance' },
]

const formatDate = (val: any) => {
  if (!val) return '—'
  try {
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) return String(val)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return String(val)
  }
}

const formatAmount = (amount: any) => {
  if (amount == null) return '—'
  const n = Number(amount)
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const mapStatementToRow = (item: AnyObj, index: number) => {
  const id = item._id ?? item.id ?? index
  const date = formatDate(item.date ?? item.createdAt ?? item.transactionDate)
  const description = item.description ?? item.remarks ?? item.reference ?? item.type ?? '—'
  const credit =
    item.credit != null
      ? formatAmount(item.credit)
      : item.type === 'credit' && item.amount != null
        ? formatAmount(item.amount)
        : '—'
  const debit =
    item.debit != null
      ? formatAmount(item.debit)
      : item.type === 'debit' && item.amount != null
        ? formatAmount(item.amount)
        : '—'
  const balance =
    item.balance != null
      ? formatAmount(item.balance)
      : item.balanceAfter != null
        ? formatAmount(item.balanceAfter)
        : '—'
  return {
    id: String(id),
    date,
    description,
    credit,
    debit,
    balance,
    cardTitle: description,
  }
}

const csvEscape = (val: any) => {
  const s = val == null ? '' : String(val).trim()
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

const buildCSV = (rows: AnyObj[]) => {
  const headers = COLUMNS.map(c => c.label)
  const headerLine = headers.map(csvEscape).join(',')
  const dataLines = rows.map(row => COLUMNS.map(col => csvEscape(row[col.key])).join(','))
  return [headerLine, ...dataLines].join('\r\n')
}

const buildPDFLikeText = (title: string, rows: AnyObj[]) => {
  const lines = [title, '', ...rows.map((row, i) => `#${i + 1}: ${row.date} | ${row.description} | C:${row.credit} D:${row.debit} Bal:${row.balance}`)]
  return lines.join('\n')
}

const AnchoredDropdown = ({
  label,
  options,
  disabled,
  onSelect,
}: {
  label: string
  options: { value: string; label: string }[]
  disabled?: boolean
  onSelect?: (value: string) => void
}) => {
  const fieldRef = useRef<View>(null)
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 })

  const openDropdown = useCallback(() => {
    if (disabled) return
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setMenuRect({ top: y + height + 4, left: x, width })
      setOpen(true)
    })
  }, [disabled])

  return (
    <View style={styles.dropdownWrap}>
      <Pressable ref={fieldRef} style={[styles.orangeField, disabled && styles.orangeFieldDisabled]} onPress={openDropdown} disabled={disabled}>
        <Text style={styles.orangeFieldText}>{label}</Text>
        <Text style={styles.orangeFieldChevron}>⌄</Text>
      </Pressable>
      {open ? (
        <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.dropdownModalRoot}>
            <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
            <View style={[styles.dropdownSheet, { top: menuRect.top, left: menuRect.left, width: menuRect.width }]}>
              {options.map(opt => (
                <Pressable
                  key={opt.value}
                  style={styles.dropdownRow}
                  onPress={() => {
                    onSelect?.(opt.value)
                    setOpen(false)
                  }}
                >
                  <Text style={styles.dropdownRowText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

const AccountStatementScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ AccountStatement: AccountStatementRouteParams }, 'AccountStatement'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [data, setData] = useState<AnyObj[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  const fetchStatement = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: '1', limit: '100' }).toString()
      const res = await apiClient<any>(`${API_ENDPOINTS.accountStatement}?${qs}`, { method: 'GET' })
      if (res?.success === false) {
        setData([])
        const msg = res?.message || 'Failed to load account statement.'
        Toast.show({ type: 'error', text1: msg })
        return
      }
      const raw = res?.data ?? res
      const list = Array.isArray(raw) ? raw : (raw?.statement ?? raw?.transactions ?? raw?.data ?? raw?.records ?? [])
      setData(Array.isArray(list) ? list.map(mapStatementToRow) : [])
    } catch (e: any) {
      setData([])
      const msg = e?.message || 'Failed to load account statement.'
      Toast.show({ type: 'error', text1: msg })
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void fetchStatement()
  }, [fetchStatement])

  const searchLower = (search || '').trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!searchLower) return data
    return data.filter(row =>
      COLUMNS.some(col => {
        const val = row[col.key]
        if (val == null) return false
        return String(val).toLowerCase().includes(searchLower)
      }),
    )
  }, [data, searchLower])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const pageData = useMemo(() => filtered.slice(start, start + PAGE_SIZE), [filtered, start])

  useEffect(() => {
    setPage(1)
  }, [search])

  const onExportCSV = useCallback(async () => {
    if (filtered.length === 0) {
      Toast.show({ type: 'info', text1: 'Nothing to export.' })
      return
    }
    const csv = buildCSV(filtered)
    try {
      await Share.share({ title: `${EXPORT_FILENAME}.csv`, message: csv })
    } catch {
      Toast.show({ type: 'error', text1: 'Could not share CSV.' })
    }
  }, [filtered])

  const onExportPDF = useCallback(async () => {
    if (filtered.length === 0) {
      Toast.show({ type: 'info', text1: 'Nothing to export.' })
      return
    }
    const text = buildPDFLikeText('Account Statement', filtered)
    try {
      await Share.share({ title: `${EXPORT_FILENAME}.pdf`, message: text })
    } catch {
      Toast.show({ type: 'error', text1: 'Could not share export.' })
    }
  }, [filtered])

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Account Statement</Text>

        <View style={styles.filtersRow}>
          <AnchoredDropdown label="All" options={[{ value: 'all', label: 'All' }]} onSelect={() => {}} />
          <ExportDropdown onCSV={onExportCSV} onPDF={onExportPDF} disabled={loading || filtered.length === 0} />
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#7f8ca0"
          value={search}
          onChangeText={setSearch}
        />

        {loading && data.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#F97A31" />
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : data.length === 0 ? (
          <Text style={styles.emptyText}>No account statement entries yet.</Text>
        ) : pageData.length === 0 ? (
          <Text style={styles.emptyText}>No matches for your search.</Text>
        ) : (
          <View style={styles.listWrap}>
            {pageData.map(row => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.cardTitle} numberOfLines={3}>
                  {row.cardTitle}
                </Text>
                <View style={styles.separator} />
                <View style={styles.row}>
                  <Text style={styles.key}>Date</Text>
                  <Text style={styles.val}>{row.date}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Description</Text>
                  <Text style={styles.val}>{row.description}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Credit</Text>
                  <Text style={styles.amountVal}>{row.credit}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Debit</Text>
                  <Text style={styles.amountVal}>{row.debit}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Balance</Text>
                  <Text style={styles.balanceVal}>{row.balance}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {!loading && filtered.length > 0 ? (
          <View style={styles.pagination}>
            <Pressable style={[styles.pgBtn, currentPage <= 1 && styles.pgBtnDisabled]} onPress={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
              <Text style={styles.pgText}>Previous</Text>
            </Pressable>
            <Text style={styles.pgInfo}>
              Page {currentPage} of {totalPages} ({filtered.length} total)
            </Text>
            <Pressable style={[styles.pgBtn, currentPage >= totalPages && styles.pgBtnDisabled]} onPress={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
              <Text style={styles.pgText}>Next</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

function ExportDropdown({ onCSV, onPDF, disabled }: { onCSV: () => void; onPDF: () => void; disabled: boolean }) {
  const fieldRef = useRef<View>(null)
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 })

  const openDropdown = useCallback(() => {
    if (disabled) return
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setMenuRect({ top: y + height + 4, left: x, width })
      setOpen(true)
    })
  }, [disabled])

  return (
    <View style={styles.dropdownWrap}>
      <Pressable ref={fieldRef} style={[styles.orangeField, disabled && styles.orangeFieldDisabled]} onPress={openDropdown} disabled={disabled}>
        <Text style={styles.orangeFieldText}>Export</Text>
        <Text style={styles.orangeFieldChevron}>⌄</Text>
      </Pressable>
      {open ? (
        <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.dropdownModalRoot}>
            <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
            <View style={[styles.dropdownSheet, { top: menuRect.top, left: menuRect.left, width: menuRect.width }]}>
              <Pressable
                style={styles.dropdownRow}
                onPress={() => {
                  setOpen(false)
                  onCSV()
                }}
              >
                <Text style={styles.dropdownRowText}>Download CSV</Text>
              </Pressable>
              <Pressable
                style={styles.dropdownRow}
                onPress={() => {
                  setOpen(false)
                  onPDF()
                }}
              >
                <Text style={styles.dropdownRowText}>Download PDF</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 14, paddingTop: 12 },
  title: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 33 / 2, marginBottom: 12 },
  filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dropdownWrap: { flex: 1 },
  orangeField: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C45F24',
    backgroundColor: '#D56E2A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orangeFieldDisabled: { opacity: 0.5 },
  orangeFieldText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
  orangeFieldChevron: { color: '#fff', fontSize: 14, marginTop: -2 },
  searchInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#314157',
    backgroundColor: '#1a2433',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: AppFonts.montserratMedium,
    fontSize: 14,
    marginBottom: 12,
  },
  loadingWrap: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.55)', fontFamily: AppFonts.montserratMedium, fontSize: 14, marginTop: 8 },
  listWrap: { gap: 10 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#111f32', padding: 12 },
  cardTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 14 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  key: { color: '#9CB0C9', fontFamily: AppFonts.montserratMedium, fontSize: 12, flex: 1 },
  val: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  amountVal: { color: '#F3A56E', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  balanceVal: { color: '#F3A56E', fontFamily: AppFonts.montserratBold, fontSize: 13, textAlign: 'right', flexShrink: 1 },
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
  dropdownRowText: { color: '#DDE8F7', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
})

export default AccountStatementScreen
