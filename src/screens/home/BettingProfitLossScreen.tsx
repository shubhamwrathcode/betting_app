import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'

type BettingProfitLossRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

const formatAmount = (n: any) => {
  if (n == null || n === '') return '—'
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  if (num >= 0) return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `−₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatCount = (n: any) => {
  if (n == null || n === '') return '—'
  const num = Number(n)
  return Number.isFinite(num) ? num.toLocaleString('en-IN') : '—'
}

const normalizeData = (res: AnyObj | null) => {
  if (!res || typeof res !== 'object') return null
  let raw: AnyObj = (res?.data ?? res?.result ?? res) as AnyObj
  if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') raw = raw.data as AnyObj
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return {
    totalProfitLoss: raw.totalProfitLoss ?? raw.total_profit_loss ?? null,
    totalBets: raw.totalBets ?? raw.total_bets ?? null,
    totalStake: raw.totalStake ?? raw.total_stake ?? null,
    totalWon: raw.totalWon ?? raw.total_won ?? null,
    totalLost: raw.totalLost ?? raw.total_lost ?? null,
    grossProfit: raw.grossProfit ?? raw.gross_profit ?? null,
    grossLoss: raw.grossLoss ?? raw.gross_loss ?? null,
  }
}

const BettingProfitLossScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ BettingProfitLoss: BettingProfitLossRouteParams }, 'BettingProfitLoss'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [data, setData] = useState<AnyObj | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  const fetchPnL = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const sportVal = search.trim().toLowerCase()
      const qs = sportVal ? `?${new URLSearchParams({ sport: sportVal }).toString()}` : ''
      const res = await apiClient<any>(`${API_ENDPOINTS.sportsbookProfitLoss}${qs}`, { method: 'GET' })
      if (res == null) {
        setError('Could not load P&L. Please try again.')
        setData(null)
        return
      }
      if (res?.success === false) {
        setError(res?.message || 'Failed to load P&L data.')
        setData(null)
        return
      }
      const normalized = normalizeData(res)
      setData(normalized)
      if (!normalized) setError('No P&L data in response.')
    } catch (e: any) {
      const msg = e?.message || 'Failed to load P&L data.'
      setError(msg)
      setData(null)
      Toast.show({ type: 'error', text1: msg })
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, search])

  useEffect(() => {
    void fetchPnL()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const netProfitPositive = useMemo(() => Number(data?.totalProfitLoss) >= 0, [data])

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Betting Profit &amp; Loss</Text>

        <View style={styles.filterRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by sport (e.g. cricket, football)..."
            placeholderTextColor="#7f8ca0"
            value={search}
            onChangeText={setSearch}
          />
          <Pressable style={[styles.searchBtn, loading && styles.searchBtnDisabled]} onPress={() => { void fetchPnL() }} disabled={loading}>
            <Text style={styles.searchBtnText}>{loading ? 'Loading...' : 'Search'}</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => { void fetchPnL() }}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !data ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#F97A31" />
            <Text style={styles.emptyText}>Loading P&amp;L...</Text>
          </View>
        ) : null}

        {!loading && !error && !data ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>No P&amp;L data for the selected period.</Text>
            <Text style={styles.hintText}>Place some bets and settle them to see profit &amp; loss here.</Text>
          </View>
        ) : null}

        {!loading && data != null ? (
          <View style={styles.cardsWrap}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Total P&amp;L</Text>
              <View style={styles.separator} />
              <View style={styles.row}>
                <Text style={styles.key}>Net Profit / Loss</Text>
                <Text style={[styles.netAmount, netProfitPositive ? styles.positive : styles.negative]}>
                  {formatAmount(data.totalProfitLoss)}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Summary</Text>
              <View style={styles.separator} />
              <View style={styles.row}><Text style={styles.key}>Total Bets</Text><Text style={styles.val}>{formatCount(data.totalBets)}</Text></View>
              <View style={styles.row}><Text style={styles.key}>Total Stake</Text><Text style={styles.amountVal}>{formatAmount(data.totalStake)}</Text></View>
              <View style={styles.row}><Text style={styles.key}>Won</Text><Text style={styles.val}>{formatCount(data.totalWon)}</Text></View>
              <View style={styles.row}><Text style={styles.key}>Lost</Text><Text style={styles.val}>{formatCount(data.totalLost)}</Text></View>
              <View style={styles.row}><Text style={styles.key}>Gross Profit</Text><Text style={[styles.amountVal, styles.positive]}>{formatAmount(data.grossProfit)}</Text></View>
              <View style={styles.row}><Text style={styles.key}>Gross Loss</Text><Text style={[styles.amountVal, styles.negative]}>{formatAmount(data.grossLoss)}</Text></View>
            </View>
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
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  searchBtn: { minWidth: 96, borderRadius: 10, borderWidth: 1, borderColor: '#C45F24', backgroundColor: '#D56E2A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  searchBtnDisabled: { opacity: 0.7 },
  searchBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
  loadingWrap: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.55)', fontFamily: AppFonts.montserratMedium, fontSize: 14, marginTop: 8 },
  cardsWrap: { gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#111f32', padding: 12 },
  cardTitle: { color: '#FFF', fontFamily: AppFonts.montserratSemiBold, fontSize: 30 / 2 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  key: { color: '#9CB0C9', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  val: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  amountVal: { color: '#F3A56E', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  netAmount: { fontFamily: AppFonts.montserratBold, fontSize: 34 / 2, textAlign: 'right', flexShrink: 1 },
  positive: { color: '#22C55E' },
  negative: { color: '#EF4444' },
  infoBox: { borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', padding: 12, marginBottom: 10 },
  infoText: { color: '#D7E3F5', fontFamily: AppFonts.montserratMedium, fontSize: 13, marginBottom: 8 },
  hintText: { color: '#9CB0C9', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  retryBtn: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: '#F97A31', paddingHorizontal: 12, paddingVertical: 8 },
  retryBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
})

export default BettingProfitLossScreen
