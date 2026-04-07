import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import RNFS from 'react-native-fs'
import { generatePDF } from 'react-native-html-to-pdf'
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
  { key: 'createdAt', label: 'createdAt' },
  { key: 'type', label: 'Type' },
  { key: 'amount', label: 'Amount' },
  { key: 'balanceBefore', label: 'Balance Before' },
  { key: 'balanceAfter', label: 'Balance After' },
  { key: 'currency', label: 'Currency' },
  { key: 'referenceType', label: 'Reference Type' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'description', label: 'Description' },
]

function formatWalletTxnType(raw: any) {
  if (raw == null || raw === '') return '—'
  const norm = String(raw).trim().toLowerCase().replace(/\s+/g, '_')
  if (norm === 'bet_win') return 'Bet'
  if (norm.includes('_')) {
    return norm
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }
  const s = String(raw).trim()
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

const formatDateTime = (val: any) => {
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
      second: '2-digit',
      hour12: true,
    }).replace(/AM|PM/, (match) => match.toLowerCase())
  } catch {
    return String(val)
  }
}

function formatMoney(amount: any, currency = 'INR') {
  if (amount == null) return '—'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const c = String(currency || 'INR').toUpperCase()
  return c === 'INR' ? `₹${abs}` : `${c} ${abs}`
}

function formatSignedAmount(amount: any, currency = 'INR') {
  if (amount == null) return '—'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const c = String(currency || 'INR').toUpperCase()
  if (c === 'INR') {
    if (n > 0) return `+₹${abs}`
    if (n < 0) return `−₹${abs}`
    return `₹${abs}`
  }
  if (n > 0) return `+${c} ${abs}`
  if (n < 0) return `−${c} ${abs}`
  return `${c} ${abs}`
}

const mapStatementToRow = (item: AnyObj, index: number) => {
  const rowId = item._id ?? item.id ?? index
  const cur = item.currency ?? 'INR'

  return {
    id: String(rowId),
    type: item.type != null ? formatWalletTxnType(item.type) : '—',
    amount: item.amount != null && item.amount !== '' ? formatSignedAmount(item.amount, cur) : '—',
    balanceBefore: item.balanceBefore != null ? formatMoney(item.balanceBefore, cur) : '—',
    balanceAfter: item.balanceAfter != null ? formatMoney(item.balanceAfter, cur) : '—',
    createdAt: formatDateTime(item.createdAt),
    currency: item.currency != null ? String(item.currency) : '—',
    description: item.description != null && String(item.description).trim() !== '' ? String(item.description) : '—',
    referenceType: item.referenceType != null ? formatWalletTxnType(item.referenceType) : '—',
    updatedAt: formatDateTime(item.updatedAt),
    cardTitle: `${item.type != null ? formatWalletTxnType(item.type) : '—'} · ${formatDateTime(item.createdAt)}`,
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
  const dataLines = rows.map(row => COLUMNS.map(col => csvEscape(row[col.key as keyof typeof row])).join(','))
  return [headerLine, ...dataLines].join('\r\n')
}

const buildHTMLForPDF = (title: string, rows: AnyObj[]) => {
  let html = `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 20px; color: #333; }
          h1 { color: #000; font-size: 24px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
          th { background-color: #253a59; color: white; padding: 12px 8px; text-align: left; font-size: 11px; }
          td { padding: 10px 8px; border-bottom: 1px solid #ddd; font-size: 10px; word-wrap: break-word; }
          .amount-cell { color: #C45F24; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>
              ${COLUMNS.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${COLUMNS.map(col => {
                  const val = row[col.key] || '—';
                  const cellClass = (col.key === 'amount' || col.key === 'balanceBefore' || col.key === 'balanceAfter') ? 'amount-cell' : '';
                  return `<td class="${cellClass}">${val}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `
  return html
}

async function requestStoragePermission() {
  if (Platform.OS !== 'android') return true
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'App needs access to your storage to download the statement.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    )
    return granted === PermissionsAndroid.RESULTS.GRANTED
  } catch (err) {
    console.warn(err)
    return false
  }
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
      // Robust parsing matching BetHistory logic
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
    const hasPerm = await requestStoragePermission()
    if (!hasPerm) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Cannot save file without storage permission.' })
      return
    }

    const csvContent = buildCSV(filtered)
    try {
      const timestamp = new Date().getTime()
      const filename = `${EXPORT_FILENAME}_${timestamp}.csv`
      const path = Platform.OS === 'android' 
                   ? `${RNFS.DownloadDirectoryPath}/${filename}` 
                   : `${RNFS.DocumentDirectoryPath}/${filename}`
      
      await RNFS.writeFile(path, csvContent, 'utf8')
      Toast.show({ type: 'success', text1: 'Downloaded!', text2: `Saved to: ${filename}` })
    } catch (err: any) {
      console.error('[ExportCSV]', err)
      Toast.show({ type: 'error', text1: 'Download Failed', text2: err.message })
    }
  }, [filtered])

  const onExportPDF = useCallback(async () => {
    if (filtered.length === 0) {
      Toast.show({ type: 'info', text1: 'Nothing to export.' })
      return
    }
    const hasPerm = await requestStoragePermission()
    if (!hasPerm) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Cannot save file without storage permission.' })
      return
    }

    setLoading(true)
    try {
      const timestamp = new Date().getTime()
      const filename = `${EXPORT_FILENAME}_${timestamp}`
      const html = buildHTMLForPDF('Account Statement', filtered)
      
      const options = {
        html: html,
        fileName: filename,
        directory: Platform.OS === 'android' ? 'Download' : 'Documents',
      }

      const file = await generatePDF(options)
      
      if (Platform.OS === 'android' && file.filePath) {
        // Move to download directory if not already there
        const targetPath = `${RNFS.DownloadDirectoryPath}/${filename}.pdf`
        await RNFS.copyFile(file.filePath, targetPath)
      }

      Toast.show({ type: 'success', text1: 'Downloaded!', text2: `Saved as ${filename}.pdf` })
    } catch (err: any) {
      console.error('[ExportPDF]', err)
      Toast.show({ type: 'error', text1: 'PDF Export Failed', text2: err.message })
    } finally {
      setLoading(false)
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
                  <Text style={styles.key}>createdAt</Text>
                  <Text style={styles.val}>{row.createdAt}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Type</Text>
                  <Text style={styles.val}>{row.type}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Amount</Text>
                  <Text style={styles.amountVal}>{row.amount}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Balance Before</Text>
                  <Text style={styles.balanceVal}>{row.balanceBefore}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Balance After</Text>
                  <Text style={styles.balanceVal}>{row.balanceAfter}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Currency</Text>
                  <Text style={styles.val}>{row.currency}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Reference Type</Text>
                  <Text style={styles.val}>{row.referenceType}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.key}>Updated At</Text>
                  <Text style={styles.val}>{row.updatedAt}</Text>
                </View>
                <View style={[styles.row, { alignItems: 'flex-start' }]}>
                  <Text style={[styles.key, { flex: 0, minWidth: 90 }]}>Description</Text>
                  <Text style={[styles.val, { flex: 1, textAlign: 'right' }]}>{row.description}</Text>
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
