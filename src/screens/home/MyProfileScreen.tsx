import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LandingHeader } from '../../components/common/LandingHeader'
import LinearGradient from 'react-native-linear-gradient'
import Toast from 'react-native-toast-message'
import { launchImageLibrary, Asset } from 'react-native-image-picker'
import NotoTrophySvg from '../../../assets/AppImages/noto_trophy.svg'
import { API_BASE_URL } from '../../api/client'
import { authService } from '../../services/authService'
import { AppFonts } from '../../components/AppFonts'
import { ImageAssets } from '../../components/ImageAssets'
import { useAuth } from '../../hooks/useAuth'

type ProfileBundle = {
  user: Record<string, any>
  wallet: Record<string, any>
  referral: Record<string, any>
  session: Record<string, any>
  stats: Record<string, any>
  bettingStats: Record<string, any>
}

const mergeProfileFromApi = (raw: any): ProfileBundle => {
  const r = raw?.data ?? raw
  const userRoot = r?.user ?? r
  return {
    user: userRoot ?? {},
    wallet: r?.wallet ?? userRoot?.wallet ?? {},
    referral: r?.referral ?? userRoot?.referral ?? {},
    session: r?.session ?? userRoot?.session ?? {},
    stats: r?.stats ?? userRoot?.stats ?? {},
    bettingStats: r?.bettingStats ?? userRoot?.bettingStats ?? {},
  }
}

const rupeesInt = (v: unknown) =>
  `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const rupeesDec = (v: unknown) =>
  `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

const numIn = (v: unknown) => Number(v ?? 0).toLocaleString('en-IN')

const profileImageUrl = (user: Record<string, any> | undefined): string | null => {
  if (!user?.profileImage) return null
  const path = String(user.profileImage).trim()
  const base = API_BASE_URL.replace(/\/$/, '')
  let url: string
  if (path.startsWith('http://') || path.startsWith('https://')) {
    url = path
  } else if (path.startsWith('/')) {
    url = `${base}${path}`
  } else {
    url = `${base}/${path}`
  }
  if (user.updatedAt) {
    const t = new Date(user.updatedAt).getTime()
    if (!Number.isNaN(t)) url += `${url.includes('?') ? '&' : '?'}t=${t}`
  }
  return url
}

const StatCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
)

const StatRow = ({ children }: { children: React.ReactNode }) => <View style={styles.statRow}>{children}</View>

const MY_PROFILE_SUBTITLE =
  'Wallet, bonuses, betting activity, referral code and account info — all here.'
const PROFILE_GUEST_SUBTITLE =
  'Log in to view your details, wallet, betting stats and account summary.'

const MyProfileScreen = () => {
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated, updateUser } = useAuth()
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('MainTabs')
  }, [navigation])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileBundle | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)

  const fetchProfile = useCallback(async (keepPreviousExtra = false) => {
    if (!isAuthenticated) {
      setLoading(false)
      setProfile(null)
      return
    }
    setLoading(true)
    try {
      const result = await authService.getMe()
      const success = result?.success !== false && result !== null
      if (success) {
        const merged = mergeProfileFromApi(result)
        if (keepPreviousExtra) {
          setProfile(prev => {
            if (!prev) return merged
            const has = (o: Record<string, any>) => o && Object.keys(o).length > 0
            return {
              ...merged,
              wallet: has(merged.wallet) ? merged.wallet : prev.wallet,
              referral: has(merged.referral) ? merged.referral : prev.referral,
              session: has(merged.session) ? merged.session : prev.session,
              stats: has(merged.stats) ? merged.stats : prev.stats,
              bettingStats: has(merged.bettingStats) ? merged.bettingStats : prev.bettingStats,
            }
          })
        } else {
          setProfile(merged)
        }
      } else {
        setProfile(null)
      }
    } catch {
      setProfile(null)
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not load profile' })
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void fetchProfile(false)
  }, [isAuthenticated, fetchProfile])

  const data = profile
  const user = data?.user ?? {}
  const wallet = data?.wallet ?? {}
  const referral = data?.referral ?? {}
  const session = data?.session ?? {}
  const stats = data?.stats ?? {}
  const bettingStats = data?.bettingStats ?? {}

  const displayName = useMemo(
    () => String(user?.fullName || user?.username || 'User').toUpperCase(),
    [user?.fullName, user?.username],
  )

  const avatarUri = profileImageUrl(user)

  const openEdit = () => {
    setEditFullName(String(user?.fullName ?? ''))
    setEditEmail(String(user?.email ?? ''))
    setEditAsset(null)
    setEditOpen(true)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setEditAsset(null)
  }

  const pickImage = () => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1 },
      res => {
        if (res.didCancel || res.errorCode) return
        const a = res.assets?.[0]
        if (a) setEditAsset(a)
      },
    )
  }

  const handleSave = async () => {
    const hasName = editFullName.trim()
    const hasEmail = editEmail.trim()
    const safeUser = user ?? {}
    const nameChanged = hasName !== String(safeUser.fullName ?? '').trim()
    const emailChanged = hasEmail !== String(safeUser.email ?? '').trim()
    if (!nameChanged && !emailChanged && !editAsset?.uri) {
      Toast.show({
        type: 'error',
        text1: 'Validation',
        text2: 'Change at least one field or choose a profile image',
      })
      return
    }
    if (editAsset?.fileSize != null && editAsset.fileSize > 2 * 1024 * 1024) {
      Toast.show({ type: 'error', text1: 'File too large', text2: 'Max 2MB for profile image' })
      return
    }
    setSaveLoading(true)
    try {
      const fullName =
        editAsset?.uri != null ? hasName || String(safeUser.fullName || '') : hasName || String(safeUser.fullName || '')
      const email =
        editAsset?.uri != null ? hasEmail || String(safeUser.email || '') : hasEmail || String(safeUser.email || '')

      const filePart =
        editAsset?.uri != null
          ? {
              uri: editAsset.uri,
              type: editAsset.type || 'image/jpeg',
              name: editAsset.fileName || 'profile.jpg',
            }
          : undefined

      const result = await authService.updateProfile(fullName, email, filePart)
      const ok = result?.success !== false
      if (ok) {
        Toast.show({ type: 'success', text1: result?.message || 'Profile updated successfully' })
        const updatedUser = result?.data?.user ?? result?.user
        closeEdit()
        await fetchProfile(true)
        if (updatedUser && typeof updatedUser === 'object') {
          await updateUser({
            fullName: updatedUser.fullName ?? fullName,
            email: updatedUser.email ?? email,
            profileImage: updatedUser.profileImage ?? safeUser.profileImage,
            updatedAt: updatedUser.updatedAt,
          })
        } else if (fullName || email) {
          await updateUser({ fullName: fullName || undefined, email: email || undefined })
        }
      } else {
        Toast.show({ type: 'error', text1: result?.message || 'Failed to update profile' })
      }
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: e?.message ? String(e.message) : 'Try again',
      })
    } finally {
      setSaveLoading(false)
    }
  }

  const headerProps = {
    onLoginPress: () => navigation.navigate('Login', { initialTab: 'login' }),
    onSignupPress: () => navigation.navigate('Login', { initialTab: 'signup' }),
    onSearchPress: () => navigation.navigate('Search'),
  }

  const titleAndBack = (title: string, subtitle?: string) => (
    <>
      <View style={styles.pageTitleCard}>
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      <Pressable style={styles.pillBackBtn} onPress={goBack}>
        <Text style={styles.pillBackBtnText}>Back</Text>
      </Pressable>
    </>
  )

  if (!isAuthenticated && !loading) {
    return (
      <View style={styles.screen}>
        <LandingHeader {...headerProps} />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            styles.scrollGrow,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {titleAndBack('Profile', PROFILE_GUEST_SUBTITLE)}
          <View style={styles.centerMsg}>
            <Text style={styles.muted}>Please log in to view your profile.</Text>
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <LandingHeader {...headerProps} />

      {loading ? (
        <ScrollView
          contentContainerStyle={[styles.content, styles.centerMsgScroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* {titleAndBack('My Profile', MY_PROFILE_SUBTITLE)} */}
          <ActivityIndicator color="#F97A31" />
          <Text style={styles.muted}>Loading...</Text>
        </ScrollView>
      ) : !data ? (
        <ScrollView
          contentContainerStyle={[styles.content, styles.centerMsgScroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {titleAndBack('My Profile', MY_PROFILE_SUBTITLE)}
          <Text style={styles.muted}>Could not load profile.</Text>
          <Pressable style={styles.retryBtn} onPress={() => void fetchProfile(false)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        >
          {titleAndBack('My Profile', MY_PROFILE_SUBTITLE)}

          <View style={styles.bioRow}>
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <Image source={ImageAssets.userVectorPng} style={styles.avatar} />
              )}
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.bioText}>
              <Text style={styles.nameText}>{displayName}</Text>
              <Text style={styles.detailLine}>{user?.email || '—'}</Text>
              <Text style={styles.detailLine}>{user?.mobile || '—'}</Text>
              {user?.username ? (
                <Text style={styles.usernameLine}>@{user.username}</Text>
              ) : null}
              <View style={styles.riskEditRow}>
                {user?.riskLevel ? (
                  <View style={styles.riskRow}>
                    <NotoTrophySvg width={12} height={12} />
                    <Text style={styles.riskText}>Risk: {String(user.riskLevel)}</Text>
                  </View>
                ) : null}
                <Pressable onPress={openEdit} style={styles.editBtnWrap}>
                  <LinearGradient
                    colors={['#AC5422', '#F97A31']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.editGradient}
                  >
                    <Text style={styles.editIcon}>✎</Text>
                    <Text style={styles.editLabel}>Edit Profile</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wallet & Stats</Text>
            <StatRow>
              <StatCard label="Available Balance" value={rupeesInt(wallet?.balance)} />
              <StatCard label="Bonus Balance" value={rupeesInt(wallet?.bonusBalance)} />
            </StatRow>
            <StatRow>
              <StatCard label="Total Deposit" value={rupeesInt(wallet?.totalDeposited)} />
              <StatCard label="Total Withdrawn" value={rupeesInt(wallet?.totalWithdrawn)} />
            </StatRow>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Betting Stats</Text>
            <StatRow>
              <StatCard
                label="Total Wagered"
                value={rupeesDec(stats?.totalWagered ?? bettingStats?.totalStake)}
              />
              <StatCard label="Total Bets" value={numIn(stats?.totalBets ?? bettingStats?.totalBets)} />
            </StatRow>
            <StatRow>
              <StatCard
                label="Sports Bets"
                value={numIn(bettingStats?.totalSportsBets)}
                sub={`W: ${bettingStats?.sportsBetsWon ?? 0} / L: ${bettingStats?.sportsBetsLost ?? 0}`}
              />
              <StatCard label="Casino Bets" value={numIn(bettingStats?.totalCasinoBets)} />
            </StatRow>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <StatRow>
              <StatCard label="Referral Code" value={String(referral?.referralCode || '—')} />
              <StatCard label="Total Referrals" value={numIn(referral?.totalReferrals)} />
            </StatRow>
            <StatRow>
              <StatCard
                label="Last Login"
                value={
                  session?.lastLoginAt
                    ? new Date(session.lastLoginAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })
                    : '—'
                }
              />
              <StatCard label="Login Count" value={numIn(session?.loginCount)} />
            </StatRow>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Played</Text>
            <View style={styles.topPlayedRow}>
              <View style={styles.topPlayedCard}>
                <Image source={ImageAssets.cricketWorldImgPng} style={styles.topPlayedIcon} resizeMode="contain" />
                <Text style={styles.topPlayedText}>
                  Cricket
                  {Number(bettingStats?.totalSportsBets) > 0
                    ? ` (${Number(bettingStats.totalSportsBets)})`
                    : ''}
                </Text>
              </View>
              <View style={styles.topPlayedCard}>
                <Image source={ImageAssets.aviatorImgPng} style={styles.topPlayedIcon} resizeMode="contain" />
                <Text style={styles.topPlayedText}>
                  Casino
                  {Number(bettingStats?.totalCasinoBets) > 0
                    ? ` (${Number(bettingStats.totalCasinoBets)})`
                    : ''}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeEdit} />
          <View style={styles.modalCard}>
            <Pressable style={styles.modalClose} onPress={closeEdit} hitSlop={12}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter full name"
              placeholderTextColor="#8EA2BF"
              value={editFullName}
              onChangeText={setEditFullName}
            />
            <Text style={styles.modalHint}>If empty, username will be shown</Text>
            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Email</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter email"
              placeholderTextColor="#8EA2BF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={editEmail}
              onChangeText={setEditEmail}
            />
            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Profile Image</Text>
            <Pressable style={styles.pickBtn} onPress={pickImage}>
              <Text style={styles.pickBtnText}>{editAsset?.fileName || 'Choose image'}</Text>
            </Pressable>
            {editAsset?.uri ? (
              <Image source={{ uri: editAsset.uri }} style={styles.previewImg} />
            ) : null}
            <Text style={styles.modalHint}>JPG, PNG or WEBP. Max 2MB.</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeEdit}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saveLoading && styles.saveBtnDisabled]}
                onPress={() => void handleSave()}
                disabled={saveLoading}
              >
                <Text style={styles.saveBtnText}>{saveLoading ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040f21' },
  content: { paddingHorizontal: 14, paddingTop: 12 },
  scrollGrow: { flexGrow: 1 },
  pageTitleCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263b58',
    backgroundColor: '#15243B',
    padding: 14,
    marginBottom: 10,
  },
  pageTitle: {
    color: '#fff',
    fontFamily: AppFonts.montserratBold,
    fontSize: 30 / 2,
  },
  pageSubtitle: {
    marginTop: 4,
    color: '#d7e3f5',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  /** Same as DepositScreen step-2 pill Back */
  pillBackBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#314157',
    backgroundColor: '#1a2433',
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  pillBackBtnText: {
    color: '#DDE8F7',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 13,
  },
  centerMsgScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 24 },
  centerMsg: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 24 },
  muted: { color: '#ffffff75', fontFamily: AppFonts.montserratRegular, fontSize: 15, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#242a32',
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFF', fontFamily: AppFonts.montserratSemiBold },
  bioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#E784B4',
    backgroundColor: '#1a2840',
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 8,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#25B655',
    borderWidth: 2,
    borderColor: '#040f21',
  },
  bioText: { flex: 1, minWidth: 0 },
  nameText: {
    color: '#FFF',
    fontFamily: AppFonts.montserratBold,
    fontSize: 16,
    marginBottom: 4,
  },
  detailLine: {
    color: '#E8EEF5',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 12,
    marginBottom: 2,
  },
  usernameLine: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 12,
    marginTop: 2,
  },
  riskEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 6,
    marginTop: 8,
  },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  riskText: {
    color: '#CE6C0D',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 10,
  },
  editBtnWrap: { borderRadius: 8, overflow: 'hidden' },
  editGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  editIcon: { color: '#ffffffd4', fontSize: 11 },
  editLabel: { color: '#ffffffd4', fontFamily: AppFonts.montserratMedium, fontSize: 10 },
  section: { marginTop: 22 },
  sectionTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: AppFonts.montserratSemiBold,
    fontSize: 16,
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 64,
    backgroundColor: '#242a32',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: '#b6b6b6',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 4,
  },
  statValue: {
    color: '#FFF',
    fontFamily: AppFonts.montserratBold,
    fontSize: 14,
    textAlign: 'center',
  },
  statSub: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  topPlayedRow: { flexDirection: 'row', gap: 10 },
  topPlayedCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#242a32',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  topPlayedIcon: { width: 28, height: 28 },
  topPlayedText: {
    flex: 1,
    color: '#FFF',
    fontFamily: AppFonts.montserratBold,
    fontSize: 14,
  },
  modalRoot: { flex: 1, justifyContent: 'center', padding: 16 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: {
    backgroundColor: '#101A2E',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#273752',
  },
  modalClose: { position: 'absolute', top: 12, right: 12, zIndex: 2 },
  modalCloseText: { color: '#93A4C0', fontSize: 20, fontFamily: AppFonts.montserratSemiBold },
  modalTitle: {
    color: '#FFF',
    fontFamily: AppFonts.montserratBold,
    fontSize: 18,
    marginBottom: 16,
  },
  modalLabel: { color: '#C5D0E2', fontFamily: AppFonts.montserratSemiBold, fontSize: 12, marginBottom: 6 },
  modalInput: {
    backgroundColor: '#1C2A43',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3B58',
    paddingHorizontal: 12,
    height: 44,
    color: '#FFF',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 14,
  },
  modalHint: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: AppFonts.montserratRegular,
    fontSize: 11,
    marginTop: 4,
  },
  pickBtn: {
    backgroundColor: '#1C2A43',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3B58',
  },
  pickBtnText: { color: '#E8EEFB', fontFamily: AppFonts.montserratMedium, fontSize: 13 },
  previewImg: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#0F1B2F',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#26374C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#FFF', fontFamily: AppFonts.montserratSemiBold },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#D5702A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontFamily: AppFonts.montserratBold },
})

export default MyProfileScreen
