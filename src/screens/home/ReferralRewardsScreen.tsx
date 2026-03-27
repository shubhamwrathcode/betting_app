import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import Toast from 'react-native-toast-message'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import LinearGradient from 'react-native-linear-gradient'
import { apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { ImageAssets } from '../../components/ImageAssets'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'
import TotalProfitSvg from '../../../assets/AppImages/total_profit.svg'
import TotalReferralsSvg from '../../../assets/AppImages/total_referrals.svg'

type ReferralRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

const REFERRALS_PAGE_SIZE = 20
const REWARDS_PAGE_SIZE = 20
const PROFIT_PAGE_SIZE = 20

const firstOf = (...vals: any[]) => vals.find(v => v !== undefined && v !== null && v !== '')

const money = (v: any) => {
  const n = Number(v ?? 0)
  return `₹ ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`
}

const dateFmt = (v: any) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const Pagination = ({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}) => (
  <View style={styles.pagination}>
    <Pressable style={[styles.pgBtn, page <= 1 && styles.pgBtnDisabled]} onPress={onPrev} disabled={page <= 1}>
      <Text style={styles.pgBtnText}>Prev</Text>
    </Pressable>
    <Text style={styles.pgInfo}>Page {page} of {Math.max(1, totalPages)}</Text>
    <Pressable
      style={[styles.pgBtn, page >= totalPages && styles.pgBtnDisabled]}
      onPress={onNext}
      disabled={page >= totalPages}
    >
      <Text style={styles.pgBtnText}>Next</Text>
    </Pressable>
  </View>
)

const ReferralRewardsScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ ReferralRewards: ReferralRouteParams }, 'ReferralRewards'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'referrals'>('dashboard')
  const [serviceEnabled, setServiceEnabled] = useState(true)

  const [dashboard, setDashboard] = useState<AnyObj>({})
  const [balanceInfo, setBalanceInfo] = useState<AnyObj>({})
  const [referralCode, setReferralCode] = useState('')
  const [referralLink, setReferralLink] = useState('')
  const [applyCodeInput, setApplyCodeInput] = useState('')
  const [isApplying, setIsApplying] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [profitSearchQuery, setProfitSearchQuery] = useState('')
  const [profitList, setProfitList] = useState<AnyObj[]>([])
  const [profitPage, setProfitPage] = useState(1)
  const [profitTotalPages, setProfitTotalPages] = useState(1)

  const [rewardsFrom, setRewardsFrom] = useState('')
  const [rewardsTo, setRewardsTo] = useState('')
  const [rewardSearchQuery, setRewardSearchQuery] = useState('')
  const [rewardsHistory, setRewardsHistory] = useState<AnyObj[]>([])
  const [rewardsPage, setRewardsPage] = useState(1)
  const [rewardsTotalPages, setRewardsTotalPages] = useState(1)

  const [referralFrom, setReferralFrom] = useState('')
  const [referralTo, setReferralTo] = useState('')
  const [referralSearchQuery, setReferralSearchQuery] = useState('')
  const [referralList, setReferralList] = useState<AnyObj[]>([])
  const [refPage, setRefPage] = useState(1)
  const [refTotalPages, setRefTotalPages] = useState(1)

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  const call = useCallback(async (endpoint: string, query?: AnyObj) => {
    const qs = query
      ? `?${new URLSearchParams(
          Object.entries(query).reduce((acc, [k, v]) => {
            if (v !== undefined && v !== null && String(v).trim() !== '') acc[k] = String(v)
            return acc
          }, {} as Record<string, string>),
        ).toString()}`
      : ''
    const url = `${endpoint}${qs}`
    console.log('[ReferralRewards][API][GET][REQUEST]', { url, query })
    try {
      const res = await apiClient<any>(url, { method: 'GET' })
      console.log('[ReferralRewards][API][GET][SUCCESS]', {
        url,
        success: res?.success,
        message: res?.message,
        keys: res && typeof res === 'object' ? Object.keys(res) : [],
      })
      return res
    } catch (error: any) {
      console.log('[ReferralRewards][API][GET][ERROR]', {
        url,
        message: error?.message,
        error,
      })
      throw error
    }
  }, [])

  const setCodeAndLink = useCallback((data: AnyObj, balance?: AnyObj) => {
    const nested = data?.data && typeof data.data === 'object' ? data.data : {}
    const user = data?.user && typeof data.user === 'object' ? data.user : {}
    const nestedUser = nested?.user && typeof nested.user === 'object' ? nested.user : {}

    const code = String(
      firstOf(
        data?.referralCode,
        data?.referral_code,
        data?.code,
        data?.user_code,
        nested?.referralCode,
        nested?.referral_code,
        nested?.code,
        nested?.user_code,
        user?.referralCode,
        user?.referral_code,
        user?.code,
        user?.user_code,
        nestedUser?.referralCode,
        nestedUser?.referral_code,
        nestedUser?.code,
        nestedUser?.user_code,
        balance?.referralCode,
        balance?.referral_code,
        balance?.code,
        balance?.user_code,
      ) || '',
    )

    const link = String(
      firstOf(
        data?.referralLink,
        data?.referral_link,
        nested?.referralLink,
        nested?.referral_link,
        user?.referralLink,
        user?.referral_link,
        nestedUser?.referralLink,
        nestedUser?.referral_link,
        balance?.referralLink,
        balance?.referral_link,
      ) || '',
    )

    setReferralCode(code)
    setReferralLink(link || (code ? `https://gaming.wrathcode.com/signup?r=${encodeURIComponent(code)}` : ''))
  }, [])
  const loadPlatformConfig = useCallback(async () => {
    try {
      const res = await call(API_ENDPOINTS.platformConfig)
      const data = res?.data?.data ?? res?.data ?? res
      if (typeof data?.referralServiceStatus === 'boolean') setServiceEnabled(data.referralServiceStatus)
    } catch (error: any) {
      console.log('[ReferralRewards][loadPlatformConfig][ERROR]', error?.message || error)
      setServiceEnabled(true)
    }
  }, [call])

  const loadDashboard = useCallback(async () => {
    const res = await call(API_ENDPOINTS.referralDashboard)
    const data = res?.data ?? res
    console.log('[ReferralRewards][loadDashboard][DATA]', data)
    setDashboard(data && typeof data === 'object' ? data : {})
    setCodeAndLink(data)
  }, [call, setCodeAndLink])

  const loadBalance = useCallback(async () => {
    const res = await call(API_ENDPOINTS.referralBalance)
    const data = res?.data ?? res
    console.log('[ReferralRewards][loadBalance][DATA]', data)
    const obj = data && typeof data === 'object' ? data : {}
    setBalanceInfo(obj)
    setCodeAndLink({}, obj)
  }, [call, setCodeAndLink])

  const loadProfit = useCallback(
    async (page = 1) => {
      const res = await call(API_ENDPOINTS.referralProfit, { page, limit: PROFIT_PAGE_SIZE, search: profitSearchQuery.trim() || undefined })
      const data = res?.data ?? res
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.profit) ? data.profit : Array.isArray(data) ? data : []
      setProfitList(list)
      const total = Number(firstOf(data?.total, data?.totalCount, data?.pagination?.totalRecords, list.length) || 0)
      const pages = Number(firstOf(data?.totalPages, data?.pagination?.totalPages, Math.max(1, Math.ceil(total / PROFIT_PAGE_SIZE))) || 1)
      setProfitPage(page)
      setProfitTotalPages(Math.max(1, pages))
    },
    [call, profitSearchQuery],
  )

  const loadRewardsHistory = useCallback(
    async (page = 1) => {
      const res = await call(API_ENDPOINTS.referralRewardsHistory, {
        page,
        limit: REWARDS_PAGE_SIZE,
        from: rewardsFrom || undefined,
        to: rewardsTo || undefined,
        search: rewardSearchQuery.trim() || undefined,
      })
      const data = res?.data ?? res
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.rewards) ? data.rewards : Array.isArray(data) ? data : []
      setRewardsHistory(list)
      const pag = data?.pagination ?? data
      const total = Number(firstOf(pag?.totalRecords, data?.total, data?.totalCount, list.length) || 0)
      const pages = Number(firstOf(pag?.totalPages, data?.totalPages, Math.max(1, Math.ceil(total / REWARDS_PAGE_SIZE))) || 1)
      setRewardsPage(page)
      setRewardsTotalPages(Math.max(1, pages))
    },
    [call, rewardSearchQuery, rewardsFrom, rewardsTo],
  )

  const loadReferralList = useCallback(
    async (page = 1) => {
      const res = await call(API_ENDPOINTS.referralList, {
        page,
        limit: REFERRALS_PAGE_SIZE,
        from: referralFrom || undefined,
        to: referralTo || undefined,
        search: referralSearchQuery.trim() || undefined,
      })
      const data = res?.data ?? res
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.referrals) ? data.referrals : Array.isArray(data) ? data : []
      setReferralList(list)
      const total = Number(firstOf(data?.total, data?.totalCount, data?.pagination?.totalRecords, list.length) || 0)
      const pages = Number(firstOf(data?.totalPages, data?.pagination?.totalPages, Math.max(1, Math.ceil(total / REFERRALS_PAGE_SIZE))) || 1)
      setRefPage(page)
      setRefTotalPages(Math.max(1, pages))
    },
    [call, referralFrom, referralSearchQuery, referralTo],
  )

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        setLoading(true)
        await loadPlatformConfig()
        await Promise.all([loadDashboard(), loadBalance(), loadProfit(1), loadRewardsHistory(1)])
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'Failed to load referral program.' })
      } finally {
        setLoading(false)
      }
    })()
    // Intentionally run once on screen mount/auth ready.
    // Avoid re-fetch loop from changing filter/search callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    if (activeTab === 'referrals') loadReferralList(1)
  }, [activeTab, isAuthenticated, loadReferralList])

  const onCopy = useCallback((text: string, successText: string) => {
    if (!text) return
    Clipboard.setString(text)
    Toast.show({ type: 'success', text1: successText })
  }, [])

  const handleApplyCode = useCallback(async () => {
    const code = applyCodeInput.trim()
    if (!code) {
      Toast.show({ type: 'error', text1: 'Please enter a referral code.' })
      return
    }
    if (code.length !== 8 || !/^[A-Za-z0-9]+$/.test(code)) {
      Toast.show({ type: 'error', text1: 'Referral code must be 8 alphanumeric characters.' })
      return
    }
    try {
      setIsApplying(true)
      console.log('[ReferralRewards][API][POST][REQUEST]', { endpoint: API_ENDPOINTS.referralApply, code })
      const res = await apiClient<any>(API_ENDPOINTS.referralApply, { method: 'POST', body: { code } })
      console.log('[ReferralRewards][API][POST][SUCCESS]', {
        endpoint: API_ENDPOINTS.referralApply,
        success: res?.success,
        message: res?.message,
      })
      const ok = res?.success !== false
      if (!ok) throw new Error(res?.message || 'Could not apply referral code.')
      Toast.show({ type: 'success', text1: res?.message || 'Referral code applied successfully.' })
      setApplyCodeInput('')
      await Promise.all([loadDashboard(), loadBalance()])
    } catch (e: any) {
      console.log('[ReferralRewards][API][POST][ERROR]', { endpoint: API_ENDPOINTS.referralApply, message: e?.message, error: e })
      Toast.show({ type: 'error', text1: e?.message || 'Could not apply referral code.' })
    } finally {
      setIsApplying(false)
    }
  }, [applyCodeInput, loadBalance, loadDashboard])

  const handleClaim = useCallback(async () => {
    try {
      setIsClaiming(true)
      console.log('[ReferralRewards][API][POST][REQUEST]', { endpoint: API_ENDPOINTS.referralClaim })
      const res = await apiClient<any>(API_ENDPOINTS.referralClaim, { method: 'POST' })
      console.log('[ReferralRewards][API][POST][SUCCESS]', {
        endpoint: API_ENDPOINTS.referralClaim,
        success: res?.success,
        message: res?.message,
      })
      const ok = res?.success !== false
      if (!ok) throw new Error(res?.message || 'Unable to claim.')
      Toast.show({ type: 'success', text1: res?.message || 'Amount claimed successfully.' })
      await Promise.all([loadDashboard(), loadBalance()])
    } catch (e: any) {
      console.log('[ReferralRewards][API][POST][ERROR]', { endpoint: API_ENDPOINTS.referralClaim, message: e?.message, error: e })
      Toast.show({ type: 'error', text1: e?.message || 'Unable to claim.' })
    } finally {
      setIsClaiming(false)
    }
  }, [loadBalance, loadDashboard])

  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true)
      const res = await call(API_ENDPOINTS.referralExport, {
        from: referralFrom || undefined,
        to: referralTo || undefined,
      })
      const url = firstOf(res?.data?.url, res?.url, res?.data?.downloadUrl)
      if (url) {
        Clipboard.setString(String(url))
        Toast.show({ type: 'success', text1: 'Export link copied to clipboard.' })
      } else {
        Toast.show({ type: 'success', text1: 'Export requested successfully.' })
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Export failed.' })
    } finally {
      setIsExporting(false)
    }
  }, [call, referralFrom, referralTo])

  const availableBalance = Number(firstOf(balanceInfo?.available, balanceInfo?.availableBalance, dashboard?.balance?.available, 0) || 0)
  const minClaim = Number(firstOf(balanceInfo?.minClaim, balanceInfo?.min_claim, dashboard?.minClaimAmount, dashboard?.min_claim_amount, 0) || 0)
  const totalProfit = Number(firstOf(dashboard?.totalProfit, dashboard?.total_profit, 0) || 0)
  const totalReferrals = Number(firstOf(dashboard?.totalReferrals, dashboard?.total_referrals, refTotalPages > 0 ? refTotalPages : 0) || 0)
  const claimDisabled = availableBalance <= 0 || (minClaim > 0 && availableBalance < minClaim) || isClaiming

  const topCard = (
    <View style={styles.pageTop}>
      {!serviceEnabled ? (
        <View style={styles.disabledBanner}>
          <Text style={styles.disabledBannerText}>Referral program is temporarily unavailable. Please try again later.</Text>
        </View>
      ) : null}
      <Text style={styles.pageTitle}>Referral Program</Text>
      <View style={styles.tabsWrap}>
        <Pressable style={[styles.tabBtn, activeTab === 'dashboard' && styles.tabBtnActive]} onPress={() => setActiveTab('dashboard')}>
          <Text style={[styles.tabBtnText, activeTab === 'dashboard' && styles.tabBtnTextActive]}>Dashboard</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, activeTab === 'referrals' && styles.tabBtnActive]} onPress={() => setActiveTab('referrals')}>
          <Text style={[styles.tabBtnText, activeTab === 'referrals' && styles.tabBtnTextActive]}>Referrals</Text>
        </Pressable>
      </View>
    </View>
  )

  const dashboardView = (
    <View style={styles.panel}>
      <View style={styles.statCard}>
        <View style={styles.statIcon}><TotalProfitSvg width={28} height={28} /></View>
        <View>
          <Text style={styles.statLabel}>Total Profit</Text>
          <Text style={styles.statValue}>{money(totalProfit)}</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={styles.statIcon}><TotalReferralsSvg width={28} height={28} /></View>
        <View>
          <Text style={styles.statLabel}>Total Referrals</Text>
          <Text style={styles.statValue}>{totalReferrals}</Text>
        </View>
      </View>

      <View style={styles.inviteCardOuter}>
        <LinearGradient
          colors={['#142d40', '#162e46', '#192f4f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inviteCard}
        >
          <Text style={styles.inviteTitle}>Invite & Earn</Text>
          <Text style={styles.inviteLine}>★ Your friend gets a bonus when they join</Text>
          <Text style={styles.inviteLine}>★ Earn commission on every game your friends play</Text>
        </LinearGradient>
        <Image source={ImageAssets.notificationIconPng} style={styles.inviteImg} resizeMode="contain" />
      </View>

      <Text style={styles.sectionTitle}>My Referral Code</Text>
      <Text style={styles.fieldLabel}>Web Referral link</Text>
      <View style={styles.copyRow}>
        <Text style={styles.copyText} numberOfLines={1}>{referralLink}</Text>
        <Pressable style={styles.copyBtn} onPress={() => onCopy(referralLink, 'Link copied')}>
          <Text style={styles.copyBtnText}>Copy</Text>
        </Pressable>
      </View>
      <Text style={styles.fieldLabel}>Your referral code</Text>
      <View style={styles.copyRow}>
        <Text style={styles.copyText} numberOfLines={1}>{referralCode}</Text>
        <Pressable style={styles.copyBtn} onPress={() => onCopy(referralCode, 'Code copied')}>
          <Text style={styles.copyBtnText}>Copy</Text>
        </Pressable>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.fieldLabel}>Available Commission</Text>
        <Text style={styles.balanceValue}>{money(availableBalance)}</Text>
        {minClaim > 0 ? <Text style={styles.minClaim}>Min claim: ₹ {minClaim.toFixed(2)}</Text> : null}
        <Pressable style={[styles.claimBtn, claimDisabled && styles.claimBtnDisabled]} disabled={claimDisabled} onPress={handleClaim}>
          <Text style={styles.claimBtnText}>{isClaiming ? 'Claiming...' : 'Claim Now'}</Text>
        </Pressable>
      </View>

      <View style={styles.applyCard}>
        <Text style={styles.sectionTitleSmall}>Apply Referral Code</Text>
        <View style={styles.applyRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter referral code"
            placeholderTextColor="#7f8ca0"
            value={applyCodeInput}
            onChangeText={setApplyCodeInput}
            autoCapitalize="characters"
          />
          <Pressable style={[styles.applyBtn, isApplying && styles.claimBtnDisabled]} disabled={isApplying} onPress={handleApplyCode}>
            <Text style={styles.applyBtnText}>{isApplying ? 'Applying...' : 'Apply'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableTitle}>Recent Commission / Profit</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name..."
              placeholderTextColor="#7f8ca0"
              value={profitSearchQuery}
              onChangeText={setProfitSearchQuery}
            />
            <Pressable style={styles.filterBtn} onPress={() => loadProfit(1)}>
              <Text style={styles.filterBtnText}>Search</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.tableHeadRow}>
          <Text style={styles.colHash}>#</Text>
          <Text style={styles.colFlex}>Name</Text>
          <Text style={styles.colAmt}>Amount</Text>
        </View>
        <View style={styles.tableBody}>
          {profitList.length === 0 ? (
            <Text style={styles.noDataText}>No data</Text>
          ) : (
            profitList.map((row, idx) => (
              <View key={String(row?.id ?? row?._id ?? idx)} style={styles.tableRow}>
                <Text style={styles.colHash}>{(profitPage - 1) * PROFIT_PAGE_SIZE + idx + 1}</Text>
                <Text style={styles.colFlex}>{String(firstOf(row?.name, row?.username, row?.userId?.fullName, row?.fullName, '—')).toUpperCase()}</Text>
                <Text style={styles.colAmt}>{money(firstOf(row?.amount, row?.totalProfit, row?.profit, row?.commissionAmount, 0))}</Text>
              </View>
            ))
          )}
        </View>
        {profitTotalPages > 1 ? <Pagination page={profitPage} totalPages={profitTotalPages} onPrev={() => loadProfit(profitPage - 1)} onNext={() => loadProfit(profitPage + 1)} /> : null}
      </View>

      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableTitle}>Rewards History</Text>
          <View style={styles.filtersWrap}>
            <TextInput style={styles.dateInput} placeholder="dd/mm/yyyy" placeholderTextColor="#a2b0c5" value={rewardsFrom} onChangeText={setRewardsFrom} />
            <TextInput style={styles.dateInput} placeholder="dd/mm/yyyy" placeholderTextColor="#a2b0c5" value={rewardsTo} onChangeText={setRewardsTo} />
            <View style={styles.searchRow}>
              <Pressable style={styles.filterBtn} onPress={() => loadRewardsHistory(1)}>
                <Text style={styles.filterBtnText}>Apply</Text>
              </Pressable>
              <TextInput style={styles.searchInput} placeholder="Search..." placeholderTextColor="#7f8ca0" value={rewardSearchQuery} onChangeText={setRewardSearchQuery} />
            </View>
          </View>
        </View>
        <View style={styles.tableHeadRowRewards}>
          <Text style={styles.colHash}>#</Text>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colUser}>User</Text>
          <Text style={styles.colAmt}>Amount</Text>
          <Text style={styles.colStatus}>Status</Text>
        </View>
        <View style={styles.tableBodyLarge}>
          {rewardsHistory.length === 0 ? (
            <Text style={styles.noDataText}>No data</Text>
          ) : (
            rewardsHistory.map((row, idx) => (
              <View key={String(row?.id ?? row?._id ?? idx)} style={styles.tableRowRewards}>
                <Text style={styles.colHash}>{(rewardsPage - 1) * REWARDS_PAGE_SIZE + idx + 1}</Text>
                <Text style={styles.colDate}>{dateFmt(firstOf(row?.date, row?.createdAt, row?.created_at))}</Text>
                <Text style={styles.colUser}>{String(firstOf(row?.user, row?.username, row?.userId?.fullName, row?.userName, '—')).toUpperCase()}</Text>
                <Text style={styles.colAmt}>{money(firstOf(row?.amount, row?.bonusAmount, row?.commissionAmount, 0))}</Text>
                <Text style={styles.colStatus}>{String(firstOf(row?.status, '—'))}</Text>
              </View>
            ))
          )}
        </View>
        {rewardsTotalPages > 1 ? <Pagination page={rewardsPage} totalPages={rewardsTotalPages} onPrev={() => loadRewardsHistory(rewardsPage - 1)} onNext={() => loadRewardsHistory(rewardsPage + 1)} /> : null}
      </View>
    </View>
  )

  const referralsView = (
    <View style={styles.panel}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableTitle}>Referrals History</Text>
        <View style={styles.filtersWrap}>
          <TextInput style={styles.dateInput} placeholder="dd/mm/yyyy" placeholderTextColor="#a2b0c5" value={referralFrom} onChangeText={setReferralFrom} />
          <TextInput style={styles.dateInput} placeholder="dd/mm/yyyy" placeholderTextColor="#a2b0c5" value={referralTo} onChangeText={setReferralTo} />
          <TextInput style={styles.searchInputWide} placeholder="Search by name, mobile..." placeholderTextColor="#7f8ca0" value={referralSearchQuery} onChangeText={setReferralSearchQuery} />
          <Pressable style={styles.filterBtn} onPress={() => loadReferralList(1)}><Text style={styles.filterBtnText}>Apply</Text></Pressable>
          <Pressable style={[styles.exportBtn, isExporting && styles.claimBtnDisabled]} onPress={handleExport} disabled={isExporting}>
            <Text style={styles.exportBtnText}>{isExporting ? 'Exporting...' : 'Export CSV'}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.tableHeadRowReferral}>
        <Text style={styles.colHash}>#</Text>
        <Text style={styles.colDate}>Date & Time</Text>
        <Text style={styles.colUser}>User Name</Text>
        <Text style={styles.colMobile}>Mobile</Text>
        <Text style={styles.colStatus}>Status</Text>
        <Text style={styles.colEarn}>Total Earnings</Text>
      </View>
      <View style={styles.tableBodyLarge}>
        {referralList.length === 0 ? (
          <Text style={styles.noDataText}>No referrals yet</Text>
        ) : (
          referralList.map((row, idx) => {
            const user = row?.user ?? row
            return (
              <View key={String(row?.id ?? row?._id ?? idx)} style={styles.tableRowReferral}>
                <Text style={styles.colHash}>{(refPage - 1) * REFERRALS_PAGE_SIZE + idx + 1}</Text>
                <Text style={styles.colDate}>{dateFmt(firstOf(row?.dateTime, row?.joinedAt, user?.createdAt, user?.created_at, row?.createdAt))}</Text>
                <Text style={styles.colUser}>{String(firstOf(row?.userName, user?.fullName, user?.full_name, '—')).toUpperCase()}</Text>
                <Text style={styles.colMobile}>{String(firstOf(row?.mobile, user?.mobile, user?.mobileNumber, '—'))}</Text>
                <Text style={styles.colStatus}>{String(firstOf(row?.status, '—'))}</Text>
                <Text style={styles.colEarn}>{money(firstOf(row?.totalEarnings, row?.total_earnings, 0))}</Text>
              </View>
            )
          })
        )}
      </View>
      {refTotalPages > 1 ? <Pagination page={refPage} totalPages={refTotalPages} onPrev={() => loadReferralList(refPage - 1)} onNext={() => loadReferralList(refPage + 1)} /> : null}
    </View>
  )

  if (!isAuthenticated) {
    return (
      <View style={styles.screen}>
        <LandingHeader
          onBackPress={goBack}
          onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
          onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
          onSearchPress={() => navigation.navigate('Search')}
        />
        <View style={styles.loginHintBlock}>
          <Text style={styles.loginHintText}>Log in to use referral program.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color="#F97A31" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          {topCard}
          {activeTab === 'dashboard' ? dashboardView : referralsView}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040f21' },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 14, paddingTop: 12 },
  pageTop: { marginBottom: 12 },
  disabledBanner: { backgroundColor: 'rgba(220,53,69,0.2)', borderColor: 'rgba(220,53,69,0.5)', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  disabledBannerText: { color: '#f8d7da', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  pageTitle: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 34 / 2, marginBottom: 12, alignSelf: 'center' },
  tabsWrap: { flexDirection: 'row', backgroundColor: '#161f2c', borderRadius: 10, padding: 8, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#F97A31', shadowColor: '#5A2304', shadowOpacity: 0.35, shadowRadius: 2, elevation: 3 },
  tabBtnText: { color: 'rgba(255,255,255,0.75)', fontFamily: AppFonts.montserratSemiBold, fontSize: 15 },
  tabBtnTextActive: { color: '#FFF' },
  panel: { backgroundColor: '#161f2c', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 10 },
  statCard: { backgroundColor: '#0f1b2b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  statIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  statValue: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 17 },
  inviteCardOuter: { marginTop: 4, marginBottom: 12, position: 'relative', overflow: 'visible' },
  inviteCard: { borderRadius: 14, padding: 14, paddingRight: 100, borderWidth: 1, borderColor: '#2f5b8a' },
  inviteTitle: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 15, marginBottom: 8 },
  inviteLine: { color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 13, lineHeight: 22 },
  inviteImg: { width: 86, height: 86, position: 'absolute', right: -8, top: -14 },
  sectionTitle: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 17, marginBottom: 8, marginTop: 4 },
  sectionTitleSmall: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 16, marginBottom: 10 },
  fieldLabel: { color: '#8fa0b8', fontFamily: AppFonts.montserratMedium, fontSize: 12, marginBottom: 6, marginTop: 4 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', padding: 6, marginBottom: 8 },
  copyText: { flex: 1, color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 12, paddingHorizontal: 8 },
  copyBtn: { backgroundColor: '#F97A31', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  copyBtnText: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 13 },
  balanceCard: { marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: '#314157', backgroundColor: '#111c2a', padding: 14, marginBottom: 12 },
  balanceValue: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 38 / 2, marginTop: 4 },
  minClaim: { color: '#8fa0b8', fontFamily: AppFonts.montserratMedium, fontSize: 12, marginTop: 8 },
  claimBtn: { marginTop: 12, backgroundColor: '#F97A31', alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnText: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 15 },
  applyCard: { borderRadius: 14, borderWidth: 1, borderColor: '#314157', backgroundColor: '#111c2a', padding: 12, marginBottom: 12 },
  applyRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  applyBtn: { backgroundColor: '#F97A31', borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  applyBtnText: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 14 },
  tableCard: { borderRadius: 14, borderWidth: 1, borderColor: '#314157', backgroundColor: '#111c2a', padding: 12, marginBottom: 12 },
  tableHeader: { marginBottom: 10 },
  tableTitle: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 17, marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  filtersWrap: { gap: 8 },
  searchInput: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  searchInputWide: { borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  dateInput: { borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#1a2433', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  filterBtn: { backgroundColor: '#F97A31', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  filterBtnText: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 14 },
  exportBtn: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  exportBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 13 },
  tableHeadRow: { flexDirection: 'row', backgroundColor: '#0d1724', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, paddingHorizontal: 8 },
  tableHeadRowRewards: { flexDirection: 'row', backgroundColor: '#0d1724', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, paddingHorizontal: 6 },
  tableHeadRowReferral: { flexDirection: 'row', backgroundColor: '#0d1724', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, paddingHorizontal: 6 },
  tableBody: { minHeight: 200, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center' },
  tableBodyLarge: { minHeight: 240, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tableRowRewards: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tableRowReferral: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  colHash: { width: 24, color: '#AFC7C7', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  colFlex: { flex: 1, color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  colAmt: { width: 78, color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'right' },
  colDate: { width: 88, color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 11 },
  colUser: { flex: 1, color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 11, paddingHorizontal: 6 },
  colStatus: { width: 58, color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 11, textAlign: 'right' },
  colMobile: { width: 84, color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 11, textAlign: 'right' },
  colEarn: { width: 78, color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 11, textAlign: 'right' },
  noDataText: { color: 'rgba(255,255,255,0.45)', fontFamily: AppFonts.montserratMedium, fontSize: 22 / 2, textAlign: 'center' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 },
  pgBtn: { backgroundColor: '#F97A31', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  pgBtnDisabled: { opacity: 0.45 },
  pgBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  pgInfo: { color: 'rgba(255,255,255,0.82)', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  loginHintBlock: { padding: 16 },
  loginHintText: { color: '#fff', fontFamily: AppFonts.montserratMedium },
})

export default ReferralRewardsScreen
