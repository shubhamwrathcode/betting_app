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

type MyBetsRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

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

const parseOpenBetsList = (res: any) => {
  const raw = res?.data ?? res
  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw?.bets)) return raw.bets
  if (Array.isArray(raw?.data)) return raw.data
  if (Array.isArray(raw?.openBets)) return raw.openBets
  if (Array.isArray(raw?.records)) return raw.records
  return []
}

const pickBetId = (b: AnyObj) => {
  const v = b?._id ?? b?.id ?? b?.betId ?? b?.bet_id
  if (v == null || v === '') return null
  return String(v)
}

const normalizeCancelBetResponse = (res: AnyObj) => {
  if (!res || typeof res !== 'object') return { ok: false, message: 'Invalid response' }
  if (res.success === false) return { ok: false, message: res.message || res.msg || res.error || 'Failed to cancel bet' }
  if (res.success === true) return { ok: true, message: res.message || res.msg || 'Bet cancelled' }
  const inner = res.data
  if (inner && typeof inner === 'object') {
    if (inner.success === false) return { ok: false, message: inner.message || inner.msg || res.message || 'Failed to cancel bet' }
    if (inner.success === true) return { ok: true, message: inner.message || inner.msg || res.message || 'Bet cancelled' }
  }
  const st = String(res.status ?? '').toLowerCase()
  if (st === 'success' || st === 'ok') return { ok: true, message: res.message || res.msg || 'Bet cancelled' }
  if (res.error || res.errorCode) return { ok: false, message: res.message || res.msg || 'Failed to cancel bet' }
  const msg = res.message || res.msg
  if (msg && typeof msg === 'string') {
    if (/\b(cannot|fail|invalid|denied|error|unable|not allowed)\b/i.test(msg) && res.success !== true) return { ok: false, message: msg }
    return { ok: true, message: msg }
  }
  return { ok: true, message: 'Bet cancelled' }
}

const isBetCancellableStatus = (statusRaw: any) => {
  const s = String(statusRaw || '').toLowerCase().trim()
  return s === 'open' || s === 'matched' || s === 'pending' || s === 'active'
}

const mapBetToRow = (b: AnyObj) => {
  const betId = pickBetId(b)
  const statusRaw = String(b?.status || 'open').toLowerCase()
  return {
    id: betId,
    betId: (betId && String(betId).slice(-8)) || '—',
    time: formatDate(b?.createdAt),
    event: b?.eventName || '—',
    market: b?.marketName || b?.marketType || '—',
    selection: b?.selectionName || '—',
    betType: b?.betType || '—',
    odds: b?.odds != null ? Number(b.odds) : b?.executedOdds != null ? Number(b.executedOdds) : '—',
    stake: b?.stake != null ? `₹${Number(b.stake).toLocaleString('en-IN')}` : '—',
    liability: b?.liability != null ? `₹${Number(b.liability).toLocaleString('en-IN')}` : '—',
    status: b?.status || 'open',
    statusRaw,
    potentialWin: b?.potentialProfit != null ? `₹${Number(b.potentialProfit).toLocaleString('en-IN')}` : '—',
    cardTitle: b?.eventName || betId,
  }
}

const MyBetsScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ MyBets: MyBetsRouteParams }, 'MyBets'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [bets, setBets] = useState<AnyObj[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])
  const goToOpenBets = useCallback(() => navigation.navigate('SportsBook'), [navigation])

  const fetchOpen = useCallback(async (page = 1) => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '20' }).toString()
      const res = await apiClient<any>(`${API_ENDPOINTS.sportsbookBetOpen}?${qs}`, { method: 'GET' })
      const list = parseOpenBetsList(res)
      const pag = res?.pagination ?? res?.data?.pagination ?? (res?.data && typeof res.data === 'object' ? res.data.pagination : null)
      const rows = list.map(mapBetToRow).filter((row: AnyObj) => row.id)
      setBets(rows)
      setPagination({
        page: Number(pag?.page ?? 1),
        limit: Number(pag?.limit ?? 20),
        total: Number(pag?.total ?? pag?.totalRecords ?? list.length),
        totalPages: Number(pag?.totalPages ?? 1),
      })
    } catch {
      setBets([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void fetchOpen(1)
  }, [fetchOpen])

  const handleCancelBet = useCallback(async (betId: any) => {
    const id = betId != null && betId !== '' ? String(betId) : ''
    if (!id) {
      Toast.show({ type: 'error', text1: 'Missing bet id — refresh and try again.' })
      return
    }
    setCancellingId(id)
    try {
      const res = await apiClient<any>(`${API_ENDPOINTS.sportsbookBetCancel}/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} })
      const { ok, message } = normalizeCancelBetResponse(res)
      if (ok) {
        Toast.show({ type: 'success', text1: message || 'Bet cancelled' })
        await fetchOpen(pagination.page)
      } else {
        Toast.show({ type: 'error', text1: message || 'Failed to cancel bet' })
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Failed to cancel bet' })
    } finally {
      setCancellingId(null)
    }
  }, [fetchOpen, pagination.page])

  const filteredBets = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bets
    return bets.filter(row => {
      const event = String(row.event || '').toLowerCase()
      const betId = String(row.betId || '').toLowerCase()
      const market = String(row.market || '').toLowerCase()
      const selection = String(row.selection || '').toLowerCase()
      const betType = String(row.betType || '').toLowerCase()
      return event.includes(q) || betId.includes(q) || market.includes(q) || selection.includes(q) || betType.includes(q)
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
        <Text style={styles.title}>My Bets (Open)</Text>
        <View style={styles.topRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search event, bet ID, market..."
            placeholderTextColor="#7f8ca0"
            value={search}
            onChangeText={setSearch}
          />
          {/* <Pressable style={styles.cashoutBtn} onPress={goToOpenBets}>
            <Text style={styles.cashoutBtnText}>Cash Out</Text>
          </Pressable> */}
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : bets.length === 0 ? (
          <Text style={styles.emptyText}>No open bets.</Text>
        ) : filteredBets.length === 0 ? (
          <Text style={styles.emptyText}>No matches for your search.</Text>
        ) : (
          <View style={styles.listWrap}>
            {filteredBets.map(row => (
              <View key={String(row.id)} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{row.cardTitle || 'Bet'}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{row.status}</Text>
                  </View>
                </View>
                <View style={styles.row}><Text style={styles.key}>Time</Text><Text style={styles.val}>{row.time}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Bet ID</Text><Text style={styles.val}>{row.betId}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Event</Text><Text style={styles.val}>{row.event}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Market</Text><Text style={styles.val}>{row.market}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Selection</Text><Text style={styles.val}>{row.selection}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Type</Text><Text style={styles.val}>{row.betType}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Odds</Text><Text style={styles.val}>{String(row.odds)}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Stake</Text><Text style={styles.amountVal}>{row.stake}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Liability</Text><Text style={styles.amountVal}>{row.liability}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Potential Win</Text><Text style={styles.amountVal}>{row.potentialWin}</Text></View>
                {isBetCancellableStatus(row.statusRaw) ? (
                  <View style={styles.actionsRow}>
                    <Pressable style={styles.cardCashoutBtn} onPress={goToOpenBets}>
                      <Text style={styles.cardCashoutBtnText}>Cash Out</Text>
                    </Pressable>
                    <Pressable style={[styles.cardCancelBtn, cancellingId === String(row.id) && styles.disabledBtn]} onPress={() => void handleCancelBet(row.id)} disabled={cancellingId === String(row.id)}>
                      <Text style={styles.cardCancelBtnText}>{cancellingId === String(row.id) ? 'Cancelling...' : 'Cancel'}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.closedText}>BET CLOSED</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {filteredBets.length > 0 ? (
          <View style={styles.pagination}>
            <Pressable style={[styles.pgBtn, pagination.page <= 1 && styles.disabledBtn]} disabled={pagination.page <= 1} onPress={() => void fetchOpen(pagination.page - 1)}>
              <Text style={styles.pgText}>Previous</Text>
            </Pressable>
            <Text style={styles.pgInfo}>
              Page {pagination.page} of {pagination.totalPages || 1} ({search ? `${filteredBets.length} of ${bets.length}` : (pagination.total || bets.length)} total)
            </Text>
            <Pressable style={[styles.pgBtn, pagination.page >= (pagination.totalPages || 1) && styles.disabledBtn]} disabled={pagination.page >= (pagination.totalPages || 1)} onPress={() => void fetchOpen(pagination.page + 1)}>
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
  title: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 16, marginBottom: 12 },
  topRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  cashoutBtn: { borderRadius: 10, borderWidth: 1, borderColor: '#C45F24', backgroundColor: '#D56E2A', paddingHorizontal: 14, justifyContent: 'center' },
  cashoutBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 13 },
  emptyText: { color: 'rgba(255,255,255,0.55)', fontFamily: AppFonts.montserratMedium, fontSize: 14, marginTop: 12 },
  listWrap: { gap: 10 },
  card: { borderWidth: 1, borderColor: '#314157', backgroundColor: '#111c2a', borderRadius: 12, padding: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 14, flex: 1, paddingRight: 8 },
  statusBadge: { backgroundColor: 'rgba(148,163,184,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: '#CBD5E1', fontFamily: AppFonts.montserratSemiBold, fontSize: 11 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 3 },
  key: { color: '#8fa0b8', fontFamily: AppFonts.montserratMedium, fontSize: 12, flex: 1 },
  val: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  amountVal: { color: '#F3A56E', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  actionsRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  cardCashoutBtn: { borderRadius: 8, borderWidth: 1, borderColor: '#c45f24', backgroundColor: '#d56e2a', paddingHorizontal: 12, paddingVertical: 8 },
  cardCashoutBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  cardCancelBtn: { borderRadius: 8, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', paddingHorizontal: 12, paddingVertical: 8 },
  cardCancelBtnText: { color: '#DDE8F7', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  closedText: { marginTop: 8, color: '#93a4bc', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, marginBottom: 12 },
  pgBtn: { backgroundColor: '#F97A31', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  disabledBtn: { opacity: 0.45 },
  pgText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  pgInfo: { color: 'rgba(255,255,255,0.82)', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
})

export default MyBetsScreen
