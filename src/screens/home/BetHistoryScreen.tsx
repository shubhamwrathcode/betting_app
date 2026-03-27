import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'

type BetHistoryRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

const SPORT_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'soccer', label: 'Football' },
  { value: 'tennis', label: 'Tennis' },
]

const RESULT_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'void', label: 'Void' },
]

const formatDate = (iso: any) => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

const mapBetToRow = (b: AnyObj, index: number) => {
  const status = String(b?.status || '').toLowerCase()
  const result = String(b?.result || 'pending').toLowerCase()
  const pl = b?.profitLoss != null ? Number(b.profitLoss) : null
  const plStr = pl != null ? (pl >= 0 ? `₹${pl.toLocaleString('en-IN')}` : `−₹${Math.abs(pl).toLocaleString('en-IN')}`) : '—'
  const id = b?._id ?? b?.id ?? `row-${index}`
  return {
    id,
    betId: typeof id === 'string' && id.length >= 8 ? id.slice(-8) : '—',
    time: formatDate(b?.createdAt),
    createdAt: b?.createdAt,
    event: b?.eventName || '—',
    market: b?.marketType || '—',
    selection: b?.selectionName || '—',
    odds: b?.odds != null ? Number(b.odds) : '—',
    stake: b?.stake != null ? `₹${Number(b.stake).toLocaleString('en-IN')}` : '—',
    status: b?.status || '—',
    statusRaw: status,
    result: b?.result || '—',
    resultRaw: result,
    profitLoss: plStr,
    cardTitle: b?.eventName || String(id),
  }
}

const labelFor = (options: { value: string; label: string }[], value: string) =>
  options.find(o => o.value === value)?.label ?? 'All'

const SelectField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (next: string) => void
}) => {
  const fieldRef = useRef<View>(null)
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 })

  const openDropdown = useCallback(() => {
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setMenuRect({ top: y + height + 4, left: x, width })
      setOpen(true)
    })
  }, [])

  return (
    <View style={styles.selectBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable ref={fieldRef} style={styles.selectField} onPress={openDropdown}>
        <Text style={styles.selectText}>{labelFor(options, value)}</Text>
        <Text style={styles.selectChevron}>⌄</Text>
      </Pressable>
      {open ? (
        <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.dropdownModalRoot}>
            <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
            <View style={[styles.dropdownSheet, { top: menuRect.top, left: menuRect.left, width: Math.max(menuRect.width, 200) }]}>
              {options.map(opt => (
                <Pressable
                  key={opt.value || 'all'}
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

const BetHistoryScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ BetHistory: BetHistoryRouteParams }, 'BetHistory'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [bets, setBets] = useState<AnyObj[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('')
  const [result, setResult] = useState('')

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  const fetchHistory = useCallback(
    async (page = 1) => {
      if (!isAuthenticated) {
        setLoading(false)
        setBets([])
        return
      }
      setLoading(true)
      try {
        const params: Record<string, string> = { page: String(page), limit: '20' }
        if (sport) params.sport = sport
        if (result) params.result = result
        const qs = `?${new URLSearchParams(params).toString()}`
        const res = await apiClient<any>(`${API_ENDPOINTS.sportsbookBetHistory}${qs}`, { method: 'GET' })
        const data = res?.data ?? res
        const list = Array.isArray(data?.bets) ? data.bets : []
        setBets(list.map(mapBetToRow))
        setPagination(data?.pagination ?? { page: 1, limit: 20, total: list.length, totalPages: 1 })
      } catch (e: any) {
        setBets([])
        Toast.show({ type: 'error', text1: e?.message || 'Failed to load bet history.' })
      } finally {
        setLoading(false)
      }
    },
    [isAuthenticated, result, sport],
  )

  useEffect(() => {
    void fetchHistory(1)
  }, [fetchHistory])

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bets
    return bets.filter(row => {
      const event = String(row.event || '').toLowerCase()
      const betId = String(row.betId || '').toLowerCase()
      const market = String(row.market || '').toLowerCase()
      const selection = String(row.selection || '').toLowerCase()
      return event.includes(q) || betId.includes(q) || market.includes(q) || selection.includes(q)
    })
  }, [bets, search])

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Bet History</Text>

        <SelectField label="Sport" value={sport} options={SPORT_OPTIONS} onChange={setSport} />
        <SelectField label="Result" value={result} options={RESULT_OPTIONS} onChange={setResult} />

        <TextInput
          style={[styles.searchInput, { marginTop: 12 }]}
          placeholder="Search event, bet ID, market..."
          placeholderTextColor="#7f8ca0"
          value={search}
          onChangeText={setSearch}
        />

        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : filteredData.length === 0 ? (
          <Text style={styles.emptyText}>No history found.</Text>
        ) : (
          <View style={styles.listWrap}>
            {filteredData.map((row, idx) => (
              <View key={String(row.id ?? idx)} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {row.cardTitle}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{row.result || row.status}</Text>
                  </View>
                </View>
                <View style={styles.separator} />
                <View style={styles.row}><Text style={styles.key}>Time</Text><Text style={styles.val}>{row.time}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Bet ID</Text><Text style={styles.val}>{row.betId}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Event</Text><Text style={styles.val}>{row.event}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Market</Text><Text style={styles.val}>{row.market}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Selection</Text><Text style={styles.val}>{row.selection}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Odds</Text><Text style={styles.val}>{String(row.odds)}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Stake</Text><Text style={styles.amountVal}>{row.stake}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Status</Text><Text style={styles.val}>{row.status}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Result</Text><Text style={styles.val}>{row.result}</Text></View>
                <View style={styles.row}><Text style={styles.key}>P&L</Text><Text style={styles.amountVal}>{row.profitLoss}</Text></View>
              </View>
            ))}
          </View>
        )}

        {filteredData.length > 0 ? (
          <View style={styles.pagination}>
            <Pressable
              style={[styles.pgBtn, pagination.page <= 1 && styles.pgBtnDisabled]}
              disabled={pagination.page <= 1}
              onPress={() => void fetchHistory(pagination.page - 1)}
            >
              <Text style={styles.pgText}>Previous</Text>
            </Pressable>
            <Text style={styles.pgInfo}>
              Page {pagination.page} of {pagination.totalPages || 1} ({pagination.total ?? filteredData.length} total)
            </Text>
            <Pressable
              style={[styles.pgBtn, pagination.page >= (pagination.totalPages || 1) && styles.pgBtnDisabled]}
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onPress={() => void fetchHistory(pagination.page + 1)}
            >
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
  title: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 33 / 2, marginBottom: 12 },
  selectBlock: { marginBottom: 10 },
  fieldLabel: { color: '#C8D6EA', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, marginBottom: 6 },
  selectField: {
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
  selectText: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  selectChevron: { color: '#EAF2FF', fontSize: 14, marginTop: -2 },
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
  },
  emptyText: { color: 'rgba(255,255,255,0.52)', fontFamily: AppFonts.montserratMedium, fontSize: 14, marginTop: 24, textAlign: 'center' },
  listWrap: { marginTop: 14, gap: 10 },
  card: { borderRadius: 12, borderWidth: 1, borderColor: '#314157', backgroundColor: '#111c2a', padding: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 15, flex: 1 },
  statusBadge: { backgroundColor: 'rgba(148,163,184,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { color: '#CBD5E1', fontFamily: AppFonts.montserratSemiBold, fontSize: 11 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4 },
  key: { color: '#8fa0b8', fontFamily: AppFonts.montserratMedium, fontSize: 12, flex: 1 },
  val: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  amountVal: { color: '#F3A56E', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, marginBottom: 12 },
  pgBtn: { backgroundColor: '#314157', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#3d4f66' },
  pgBtnDisabled: { opacity: 0.45 },
  pgText: { color: '#EAF2FF', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
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

export default BetHistoryScreen
