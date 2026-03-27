import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { AppDatePickerField } from '../../components/common/AppDatePickerField'
import { useAuth } from '../../hooks/useAuth'

type GameHistoryRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

const PAGE_SIZE = 20
const FILTER_CASINO = 'casino'
const FILTER_SPORTSBOOK = 'sportsbook'
const VIEW_SESSIONS = 'sessions'
const VIEW_TRANSACTIONS = 'transactions'
const VIEW_LEDGER = 'ledger'

const formatDateTime = (dateStr: any) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

const amount = (v: any) => `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signedAmount = (v: any) => {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const prefix = n >= 0 ? '+' : '-'
  return `${prefix}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const statusLabel = (v: any) => {
  const s = String(v ?? '').trim()
  if (!s) return '—'
  return `${s.charAt(0).toUpperCase()}${s.slice(1).toLowerCase()}`
}

const SelectField = ({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) => {
  const fieldRef = useRef<View>(null)
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 })
  const selected = options.find(o => o.value === value)?.label ?? options[0]?.label ?? 'Select'

  const openDropdown = useCallback(() => {
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setMenuRect({ top: y + height + 4, left: x, width })
      setOpen(true)
    })
  }, [])

  return (
    <View style={styles.selectWrap}>
      <Pressable ref={fieldRef} style={styles.selectField} onPress={openDropdown}>
        <Text style={styles.selectLabel}>{selected}</Text>
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

const GameHistoryScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ GameHistory: GameHistoryRouteParams }, 'GameHistory'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [filter, setFilter] = useState(FILTER_CASINO)
  const [casinoView, setCasinoView] = useState(VIEW_TRANSACTIONS)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<AnyObj[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<AnyObj | null>(null)

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  const call = useCallback(async (endpoint: string, query?: Record<string, string>) => {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
    return apiClient<any>(`${endpoint}${qs}`, { method: 'GET' })
  }, [])

  const fetchRows = useCallback(async (nextPage = 1) => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      let res: any
      if (filter === FILTER_CASINO) {
        if (casinoView === VIEW_SESSIONS) {
          res = await call(API_ENDPOINTS.gamesHistory, {
            page: String(nextPage),
            limit: String(PAGE_SIZE),
            ...(dateFrom ? { from: dateFrom } : {}),
            ...(dateTo ? { to: dateTo } : {}),
          })
        } else if (casinoView === VIEW_LEDGER) {
          res = await call(API_ENDPOINTS.gamesTransactionHistory, {
            page: String(nextPage),
            limit: String(PAGE_SIZE),
            ...(dateFrom ? { from: dateFrom } : {}),
            ...(dateTo ? { to: dateTo } : {}),
          })
        } else {
          res = await call(API_ENDPOINTS.gamesTransactions, { page: String(nextPage), limit: String(PAGE_SIZE) })
        }
      } else {
        res = await call(API_ENDPOINTS.gamesSportsbookTransactions, { page: String(nextPage), limit: String(PAGE_SIZE) })
      }

      const data = res?.data ?? res
      const list =
        filter === FILTER_SPORTSBOOK
          ? (data?.transactions ?? data?.sessions ?? data?.bets ?? [])
          : casinoView === VIEW_SESSIONS
            ? (data?.sessions ?? [])
            : (data?.transactions ?? data?.sessions ?? [])

      const p = data?.pagination ?? {}
      const safeList = Array.isArray(list) ? list : []
      setRows(safeList)
      setPage(Number(p.page ?? nextPage))
      setTotal(Number(p.total ?? safeList.length))
      setTotalPages(Math.max(1, Number(p.totalPages ?? 1)))
      setHasMore((p.page ?? nextPage) < (p.totalPages ?? 1))
    } catch (e: any) {
      setRows([])
      setPage(1)
      setTotal(0)
      setTotalPages(1)
      setHasMore(false)
      Toast.show({ type: 'error', text1: e?.message || 'Failed to load game history.' })
    } finally {
      setLoading(false)
    }
  }, [call, casinoView, dateFrom, dateTo, filter, isAuthenticated])

  useEffect(() => {
    setSelected(null)
    fetchRows(1)
  }, [fetchRows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(tx => {
      if (filter === FILTER_CASINO && casinoView === VIEW_LEDGER) {
        return String(tx?.remark ?? '').toLowerCase().includes(q) || String(tx?.id ?? tx?.transactionId ?? '').toLowerCase().includes(q)
      }
      if (filter === FILTER_CASINO && casinoView === VIEW_SESSIONS) {
        return [tx?.gameCode, tx?.sessionId, tx?.providerCode].some(v => String(v ?? '').toLowerCase().includes(q))
      }
      return [tx?.gameName, tx?.gameCode, tx?.providerRoundId, tx?.sessionId, tx?.providerCode].some(v => String(v ?? '').toLowerCase().includes(q))
    })
  }, [casinoView, filter, rows, search])

  const emptyMessage = search
    ? 'No matches for your search.'
    : filter === FILTER_CASINO
      ? casinoView === VIEW_SESSIONS
        ? 'No casino sessions yet.'
        : casinoView === VIEW_LEDGER
          ? 'No ledger entries yet.'
          : 'No casino transactions yet.'
      : 'No sportsbook transactions yet.'

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Game History</Text>
        <Text style={styles.inputLabel}>Type</Text>
        <SelectField
          value={filter}
          options={[{ value: FILTER_CASINO, label: 'Casino' }, { value: FILTER_SPORTSBOOK, label: 'SportsBook' }]}
          onChange={v => {
            setFilter(v)
            setSelected(null)
          }}
        />

        {filter === FILTER_CASINO ? (
          <>
            <Text style={styles.inputLabel}>View</Text>
            <SelectField
              value={casinoView}
              options={[
                { value: VIEW_SESSIONS, label: 'Sessions' },
                { value: VIEW_TRANSACTIONS, label: 'Transactions' },
                { value: VIEW_LEDGER, label: 'Ledger' },
              ]}
              onChange={v => {
                setCasinoView(v)
                setSelected(null)
              }}
            />
          </>
        ) : null}

        {filter === FILTER_CASINO && (casinoView === VIEW_SESSIONS || casinoView === VIEW_LEDGER) ? (
          <>
            <View style={styles.dateRow}>
              <AppDatePickerField value={dateFrom} onChange={setDateFrom} placeholder="From date (dd/mm/yyyy)" maximumDate={new Date()} />
              <AppDatePickerField value={dateTo} onChange={setDateTo} placeholder="To date (dd/mm/yyyy)" maximumDate={new Date()} />
            </View>
            <Pressable style={styles.applyBtn} onPress={() => fetchRows(1)}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </Pressable>
          </>
        ) : null}

        <TextInput
          style={styles.searchInput}
          placeholder={filter === FILTER_SPORTSBOOK ? 'Search sportsbook...' : 'Search game, round ID...'}
          placeholderTextColor="#7f8ca0"
          value={search}
          onChangeText={setSearch}
        />

        {loading ? (
          <Text style={styles.emptyText}>Loading game history...</Text>
        ) : filteredRows.length === 0 ? (
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        ) : (
          <View style={styles.listWrap}>
            {filteredRows.map((tx, idx) => {
              if (filter === FILTER_CASINO && casinoView === VIEW_LEDGER) {
                return (
                  <View key={`ledger-${String(tx?.id ?? tx?.transactionId ?? 'row')}-${idx}`} style={styles.card}>
                    <View style={styles.row}><Text style={styles.key}>Date</Text><Text style={styles.val}>{formatDateTime(tx?.date)}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Credit</Text><Text style={styles.positive}>{amount(tx?.credit)}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Debit</Text><Text style={styles.negative}>{amount(tx?.debit)}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Balance</Text><Text style={styles.val}>{amount(tx?.balance)}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Transaction ID</Text><Text style={styles.val}>{tx?.id != null ? `Transaction #${tx.id}` : (tx?.transactionId || '—')}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Remark</Text><Text style={styles.val}>{tx?.remark || '—'}</Text></View>
                  </View>
                )
              }
              if (filter === FILTER_CASINO && casinoView === VIEW_SESSIONS) {
                return (
                  <View key={`session-${String(tx?.sessionId ?? tx?._id ?? 'row')}-${idx}`} style={styles.card}>
                    <View style={styles.cardHeader}><Text style={styles.cardTitle}>{tx?.gameCode || 'Session'}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Session ID</Text><Text style={styles.val}>{tx?.sessionId || '—'}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Provider</Text><Text style={styles.val}>{tx?.providerCode || '—'}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Balance (Start → End)</Text><Text style={styles.val}>{amount(tx?.balanceAtStart)} → {amount(tx?.balanceAtEnd)}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Total Bets</Text><Text style={styles.val}>{Number(tx?.totalBets ?? 0)}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Total Stake</Text><Text style={styles.val}>{amount(tx?.totalStake)}</Text></View>
                    <View style={styles.row}><Text style={styles.key}>Total Winnings</Text><Text style={Number(tx?.totalWinnings ?? 0) >= 0 ? styles.positive : styles.negative}>{signedAmount(tx?.totalWinnings)}</Text></View>
                  </View>
                )
              }
              const status = String(tx?.status ?? '').toLowerCase()
              return (
                <Pressable key={`tx-${String(tx?.providerRoundId ?? tx?.sessionId ?? 'row')}-${idx}`} style={styles.card} onPress={() => setSelected(tx)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{tx?.gameName || tx?.gameCode || 'Game'}</Text>
                    <View style={[styles.statusBadge, status === 'win' ? styles.winBg : styles.lossBg]}>
                      <Text style={[styles.statusBadgeText, status === 'win' ? styles.winText : styles.lossText]}>{statusLabel(tx?.status)}</Text>
                    </View>
                  </View>
                  <View style={styles.separator} />
                  <View style={styles.row}><Text style={styles.key}>Date & Time</Text><Text style={styles.val}>{formatDateTime(tx?.dateTime)}</Text></View>
                  <View style={styles.row}><Text style={styles.key}>Provider</Text><Text style={styles.val}>{tx?.providerCode || '—'}</Text></View>
                  <View style={styles.row}><Text style={styles.key}>Bet Amount</Text><Text style={styles.amountOrange}>{amount(tx?.betAmount)}</Text></View>
                  <View style={styles.row}><Text style={styles.key}>Amount Won/Lost</Text><Text style={status === 'win' ? styles.positive : styles.negative}>{signedAmount(tx?.amountWonOrLost)}</Text></View>
                  <View style={styles.row}><Text style={styles.key}>Balance (Before → After)</Text><Text style={styles.val}>{amount(tx?.balanceAtBet)} → {amount(tx?.balanceAfter)}</Text></View>
                </Pressable>
              )
            })}
          </View>
        )}

        {!loading && totalPages > 1 ? (
          <View style={styles.pagination}>
            <Pressable style={[styles.pgBtn, page <= 1 && styles.pgBtnDisabled]} onPress={() => fetchRows(page - 1)} disabled={page <= 1}>
              <Text style={styles.pgText}>Previous</Text>
            </Pressable>
            <Text style={styles.pgInfo}>Page {page} of {totalPages} ({total} total)</Text>
            <Pressable style={[styles.pgBtn, !hasMore && styles.pgBtnDisabled]} onPress={() => fetchRows(page + 1)} disabled={!hasMore}>
              <Text style={styles.pgText}>Next</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {selected && !(filter === FILTER_CASINO && (casinoView === VIEW_LEDGER || casinoView === VIEW_SESSIONS)) ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setSelected(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>BET HISTORY</Text>
                <Pressable onPress={() => setSelected(null)}><Text style={styles.modalClose}>✕</Text></Pressable>
              </View>
              <Text style={styles.modalGameBar}>{selected?.gameName || selected?.gameCode || 'Game'}</Text>
              <View style={styles.modalBody}>
                <View style={styles.row}><Text style={styles.key}>Round ID</Text><Text style={styles.val}>{selected?.providerRoundId || '—'}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Side</Text><Text style={String(selected?.status).toLowerCase() === 'win' ? styles.positive : styles.negative}>{statusLabel(selected?.status)}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Game Code</Text><Text style={styles.val}>{selected?.gameCode || '—'}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Amount</Text><Text style={Number(selected?.amountWonOrLost) >= 0 ? styles.positive : styles.negative}>{signedAmount(selected?.amountWonOrLost)}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Placed Date</Text><Text style={styles.val}>{formatDateTime(selected?.dateTime)}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Bet Amount</Text><Text style={styles.val}>{amount(selected?.betAmount)}</Text></View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 14, paddingTop: 12 },
  title: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 33 / 2, marginBottom: 10 },
  inputLabel: { color: '#C8D6EA', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, marginBottom: 6, marginTop: 8 },
  selectWrap: { position: 'relative', zIndex: 20 },
  selectField: { borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectLabel: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  selectChevron: { color: '#EAF2FF', fontSize: 14, marginTop: -2 },
  searchInput: { marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  dateRow: { gap: 8, marginTop: 8 },
  applyBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#F97A31', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  applyBtnText: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 13 },
  emptyText: { color: 'rgba(255,255,255,0.52)', fontFamily: AppFonts.montserratMedium, fontSize: 14, marginTop: 12 },
  listWrap: { marginTop: 12, gap: 10 },
  card: { borderRadius: 12, borderWidth: 1, borderColor: '#314157', backgroundColor: '#111c2a', padding: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 16, flex: 1 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  winBg: { backgroundColor: 'rgba(34,197,94,0.2)' },
  lossBg: { backgroundColor: 'rgba(148,163,184,0.25)' },
  statusBadgeText: { fontFamily: AppFonts.montserratSemiBold, fontSize: 11 },
  winText: { color: '#4ADE80' },
  lossText: { color: '#CBD5E1' },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4 },
  key: { color: '#8fa0b8', fontFamily: AppFonts.montserratMedium, fontSize: 12, flex: 1 },
  val: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  amountOrange: { color: '#F3A56E', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  positive: { color: '#4ADE80', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  negative: { color: '#F59E0B', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 14 },
  modalCard: { backgroundColor: '#111c2a', borderRadius: 12, borderWidth: 1, borderColor: '#314157', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 16 },
  modalClose: { color: '#fff', fontSize: 18 },
  modalGameBar: { backgroundColor: '#1a2433', color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
  modalBody: { padding: 12 },
})

export default GameHistoryScreen
