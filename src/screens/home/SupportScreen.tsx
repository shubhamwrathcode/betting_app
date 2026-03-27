import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { apiClient } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { AppFonts } from '../../components/AppFonts'
import { LandingHeader } from '../../components/common/LandingHeader'
import { useAuth } from '../../hooks/useAuth'

type SupportRouteParams = { returnToTab?: string }
type AnyObj = Record<string, any>

const TICKETS_PAGE_SIZE = 10
const SUPPORT_CATEGORIES = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'betting', label: 'Betting' },
  { value: 'casino', label: 'Casino' },
  { value: 'launchpad', label: 'Launchpad' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
]
const SUPPORT_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]
const SUPPORT_STATUSES = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const formatTicketDate = (dateStr: any) => {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'N/A'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const ticketIdFromRow = (row: AnyObj) => String(row?.id ?? row?._id ?? row?.ticketId ?? '')

const labelOf = (options: { value: string; label: string }[], value: string) =>
  options.find(o => o.value === value)?.label ?? options[0]?.label ?? 'Select'

const SelectField = ({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (next: string) => void
  placeholder?: string
}) => {
  const fieldRef = useRef<View>(null)
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 })
  const label = value ? labelOf(options, value) : (placeholder || 'Select')

  const openDropdown = useCallback(() => {
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setMenuRect({ top: y + height + 4, left: x, width })
      setOpen(true)
    })
  }, [])

  return (
    <View>
      <Pressable ref={fieldRef} style={styles.selectField} onPress={openDropdown}>
        <Text style={styles.selectText}>{label}</Text>
        <Text style={styles.selectChevron}>⌄</Text>
      </Pressable>
      {open ? (
        <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.dropdownModalRoot}>
            <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
            <View style={[styles.dropdownSheet, { top: menuRect.top, left: menuRect.left, width: menuRect.width }]}>
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

const SupportScreen = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<{ Support: SupportRouteParams }, 'Support'>>()
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()
  const returnToTab = route.params?.returnToTab ?? 'Home'

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [issueList, setIssueList] = useState<AnyObj[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [ticketPage, setTicketPage] = useState(1)
  const [ticketTotalPages, setTicketTotalPages] = useState(1)
  const [loadingList, setLoadingList] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedCreatedAt, setSelectedCreatedAt] = useState('')
  const [selectedDescription, setSelectedDescription] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('')
  const [status, setStatus] = useState('')
  const [messageReply, setMessageReply] = useState('')
  const [messageQuery, setMessageQuery] = useState<AnyObj[]>([])
  const [isClosing, setIsClosing] = useState(false)

  const goBack = useCallback(() => navigation.navigate(returnToTab), [navigation, returnToTab])

  const getIssueList = useCallback(
    async (page = 1) => {
      if (!isAuthenticated) return
      setLoadingList(true)
      try {
        const params: Record<string, string> = { page: String(page), limit: String(TICKETS_PAGE_SIZE) }
        if (searchQuery.trim()) params.search = searchQuery.trim()
        if (statusFilter) params.status = statusFilter
        const qs = `?${new URLSearchParams(params).toString()}`
        const result = await apiClient<any>(`${API_ENDPOINTS.supportTickets}${qs}`, { method: 'GET' })
        if (result?.success === false) {
          setIssueList([])
          setTicketTotalPages(1)
          setTicketPage(1)
          Toast.show({ type: 'error', text1: result?.message || 'Failed to fetch tickets.' })
          return
        }
        const raw = result?.data ?? result
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.tickets) ? raw.tickets : Array.isArray(raw?.data) ? raw.data : []
        setIssueList(list)
        const total = Number(raw?.total ?? raw?.totalCount ?? raw?.pagination?.totalRecords ?? list.length)
        setTicketTotalPages(Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE)))
        setTicketPage(page)
      } catch (err: any) {
        setIssueList([])
        Toast.show({ type: 'error', text1: err?.message || 'Failed to fetch tickets.' })
      } finally {
        setLoadingList(false)
      }
    },
    [isAuthenticated, searchQuery, statusFilter],
  )

  useEffect(() => {
    void getIssueList(1)
  }, [getIssueList])

  const resetForm = useCallback(() => {
    setSubject('')
    setDescription('')
    setCategory('')
    setPriority('medium')
  }, [])

  const handleSupport = useCallback(async () => {
    if (isSubmitting) return
    if (!subject.trim()) return Toast.show({ type: 'error', text1: 'Please enter a subject' })
    if (!category) return Toast.show({ type: 'error', text1: 'Please select a category' })
    if (!description.trim()) return Toast.show({ type: 'error', text1: 'Please enter a description' })

    try {
      setIsSubmitting(true)
      const body = {
        subject: subject.trim(),
        category,
        priority: priority || 'medium',
        description: description.trim(),
      }
      const result = await apiClient<any>(API_ENDPOINTS.supportTickets, { method: 'POST', body })
      const ok = result?.success !== false && !String(result?.message || '').toLowerCase().includes('fail')
      if (ok) {
        Toast.show({ type: 'success', text1: result?.message || 'Ticket submitted successfully' })
        resetForm()
        await getIssueList(1)
      } else {
        Toast.show({ type: 'error', text1: result?.message || 'Failed to submit ticket' })
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'An error occurred while submitting ticket' })
    } finally {
      setIsSubmitting(false)
    }
  }, [category, description, getIssueList, isSubmitting, priority, resetForm, subject])

  const handleViewTicket = useCallback(async (row: AnyObj) => {
    const id = ticketIdFromRow(row)
    if (!id) return
    setSelectedTicketId(id)
    setSelectedSubject(row?.subject || '')
    setSelectedCreatedAt(row?.createdAt ?? row?.created_at ?? '')
    setSelectedDescription(row?.description || '')
    setSelectedCategory(row?.category || '')
    setSelectedPriority(row?.priority || '')
    setStatus(row?.status || '')
    setMessageReply('')
    setMessageQuery([])
    setModalOpen(true)
    try {
      const res = await apiClient<any>(`${API_ENDPOINTS.supportTickets}/${encodeURIComponent(id)}`, { method: 'GET' })
      const d = res?.data ?? res
      const raw = d?.data ?? d
      const msgs = Array.isArray(raw?.messages)
        ? raw.messages
        : Array.isArray(d?.messages)
          ? d.messages
          : Array.isArray(raw?.ticket)
            ? raw.ticket
            : Array.isArray(d?.ticket)
              ? d.ticket
              : []
      setMessageQuery(msgs)
      if (raw?.status != null) setStatus(raw.status)
      if (raw?.subject != null) setSelectedSubject(raw.subject)
      if (raw?.description != null) setSelectedDescription(raw.description)
      if (raw?.createdAt != null) setSelectedCreatedAt(raw.createdAt)
      if (raw?.created_at != null) setSelectedCreatedAt(raw.created_at)
    } catch {
      setMessageQuery([])
    }
  }, [])

  const handleCloseTicket = useCallback(async () => {
    if (!selectedTicketId || isClosing) return
    try {
      setIsClosing(true)
      const result = await apiClient<any>(`${API_ENDPOINTS.supportTickets}/${encodeURIComponent(selectedTicketId)}/close`, { method: 'PATCH', body: {} })
      const ok = result?.success !== false && !String(result?.message || '').toLowerCase().includes('fail')
      if (ok) {
        setStatus('closed')
        Toast.show({ type: 'success', text1: result?.message || 'Ticket closed.' })
        await getIssueList(ticketPage)
      } else {
        Toast.show({ type: 'error', text1: result?.message || 'Failed to close ticket' })
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'An error occurred' })
    } finally {
      setIsClosing(false)
    }
  }, [getIssueList, isClosing, selectedTicketId, ticketPage])

  const handleSendMessage = useCallback(async () => {
    if (isSubmitting) return
    const text = messageReply.trim()
    if (!text) return Toast.show({ type: 'error', text1: 'Please enter a message' })
    if (!selectedTicketId) return Toast.show({ type: 'error', text1: 'Invalid ticket' })
    try {
      setIsSubmitting(true)
      const result = await apiClient<any>(`${API_ENDPOINTS.supportTickets}/${encodeURIComponent(selectedTicketId)}/messages`, {
        method: 'POST',
        body: { message: text },
      })
      const ok = result?.success !== false && !String(result?.message || '').toLowerCase().includes('fail')
      if (!ok) {
        Toast.show({ type: 'error', text1: result?.message || 'Failed to send message' })
        return
      }
      setMessageReply('')
      const optimisticMsg = { message: text, query: text, replyBy: 1, _id: `opt-${Date.now()}` }
      setMessageQuery(prev => [...(Array.isArray(prev) ? prev : []), optimisticMsg])

      try {
        const detailRes = await apiClient<any>(`${API_ENDPOINTS.supportTickets}/${encodeURIComponent(selectedTicketId)}`, { method: 'GET' })
        const d = detailRes?.data ?? detailRes
        const raw = d?.data ?? d
        const msgs = Array.isArray(raw?.messages)
          ? raw.messages
          : Array.isArray(d?.messages)
            ? d.messages
            : Array.isArray(raw?.ticket)
              ? raw.ticket
              : Array.isArray(d?.ticket)
                ? d.ticket
                : []
        setMessageQuery(curr => (msgs.length >= curr.length ? msgs : curr))
      } catch {
        // keep optimistic list if refetch fails
      }
      await getIssueList(ticketPage)
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'An error occurred while sending message' })
    } finally {
      setIsSubmitting(false)
    }
  }, [getIssueList, isSubmitting, messageReply, selectedTicketId, ticketPage])

  const handleCopyTicketId = useCallback((id: string) => {
    if (!id) return
    Clipboard.setString(id)
    Toast.show({ type: 'success', text1: 'Ticket ID copied!' })
  }, [])

  const canReply = useMemo(() => ['open', 'in_progress', 'pending'].includes(String(status || '').toLowerCase()), [status])
  const canClose = canReply && !!selectedTicketId

  return (
    <View style={styles.screen}>
      <LandingHeader
        onBackPress={goBack}
        onLoginPress={() => navigation.navigate('Login', { initialTab: 'login' })}
        onSignupPress={() => navigation.navigate('Login', { initialTab: 'signup' })}
        onSearchPress={() => navigation.navigate('Search')}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Help / Support</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Raise a ticket</Text>
          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter subject"
            placeholderTextColor="#8ea2bb"
            value={subject}
            onChangeText={setSubject}
            maxLength={200}
          />
          <Text style={styles.label}>Category</Text>
          <SelectField value={category} options={SUPPORT_CATEGORIES} onChange={setCategory} placeholder="Select Category" />
          <Text style={styles.label}>Priority</Text>
          <SelectField value={priority} options={SUPPORT_PRIORITIES} onChange={setPriority} />
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your issue in detail"
            placeholderTextColor="#8ea2bb"
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.submitBtn, (isSubmitting || !subject.trim() || !category || !description.trim()) && styles.submitBtnDisabled]}
            onPress={() => void handleSupport()}
            disabled={isSubmitting || !subject.trim() || !category || !description.trim()}
          >
            <Text style={styles.submitBtnText}>{isSubmitting ? 'Submitting...' : 'Submit'}</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 10 }]}>Issue list</Text>
        <SelectField value={statusFilter} options={SUPPORT_STATUSES} onChange={setStatusFilter} />

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            placeholder="Search ticket ID, subject, status"
            placeholderTextColor="#8ea2bb"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Pressable style={styles.searchBtn} onPress={() => void getIssueList(1)}>
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
        </View>

        {loadingList ? (
          <Text style={styles.emptyText}>Loading tickets...</Text>
        ) : issueList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No data</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {issueList.map((item, index) => {
              const tid = ticketIdFromRow(item)
              return (
                <View key={tid || String(index)} style={styles.ticketCard}>
                  <View style={styles.ticketTop}>
                    <Text style={styles.ticketId}>#{(ticketPage - 1) * TICKETS_PAGE_SIZE + index + 1} · {tid || 'N/A'}</Text>
                    <Pressable onPress={() => handleCopyTicketId(tid)}><Text style={styles.copyText}>Copy</Text></Pressable>
                  </View>
                  <View style={styles.row}><Text style={styles.key}>Category</Text><Text style={styles.val}>{String(item?.category || 'N/A').replace(/_/g, ' ')}</Text></View>
                  <View style={styles.row}><Text style={styles.key}>Subject</Text><Text style={styles.val}>{item?.subject || 'N/A'}</Text></View>
                  <View style={styles.row}><Text style={styles.key}>Priority</Text><Text style={styles.val}>{item?.priority || 'N/A'}</Text></View>
                  <View style={styles.row}><Text style={styles.key}>Status</Text><Text style={styles.val}>{item?.status || 'N/A'}</Text></View>
                  <Pressable style={styles.viewBtn} onPress={() => void handleViewTicket(item)}>
                    <Text style={styles.viewBtnText}>View</Text>
                  </Pressable>
                </View>
              )
            })}
          </View>
        )}

        {ticketTotalPages > 1 ? (
          <View style={styles.pagination}>
            <Pressable style={[styles.pgBtn, ticketPage <= 1 && styles.pgBtnDisabled]} disabled={ticketPage <= 1} onPress={() => void getIssueList(ticketPage - 1)}>
              <Text style={styles.pgText}>Prev</Text>
            </Pressable>
            <Text style={styles.pgInfo}>Page {ticketPage} of {ticketTotalPages}</Text>
            <Pressable style={[styles.pgBtn, ticketPage >= ticketTotalPages && styles.pgBtnDisabled]} disabled={ticketPage >= ticketTotalPages} onPress={() => void getIssueList(ticketPage + 1)}>
              <Text style={styles.pgText}>Next</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {modalOpen ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setModalOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setModalOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Help / Support</Text>
                <Pressable onPress={() => setModalOpen(false)}><Text style={styles.modalClose}>✕</Text></Pressable>
              </View>
              <View style={styles.modalToolbar}>
                <Pressable style={styles.ticketChip} onPress={() => handleCopyTicketId(selectedTicketId)}>
                  <Text style={styles.ticketChipText}>{selectedTicketId || 'N/A'}</Text>
                </Pressable>
                {canClose ? (
                  <Pressable style={[styles.closeBtn, isClosing && styles.pgBtnDisabled]} onPress={() => void handleCloseTicket()} disabled={isClosing}>
                    <Text style={styles.closeBtnText}>{isClosing ? 'Closing...' : 'Close ticket'}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.ticketMeta}>
                <Text style={styles.metaText}>Ticket created: {formatTicketDate(selectedCreatedAt)}</Text>
                <Text style={styles.metaText}>Subject: {selectedSubject || 'N/A'}</Text>
                <Text style={styles.metaText}>Category: {String(selectedCategory || 'N/A').replace(/_/g, ' ')}  ·  Priority: {selectedPriority || 'N/A'}</Text>
                <Text style={styles.metaText}>Description: {selectedDescription || 'N/A'}</Text>
              </View>
              <ScrollView style={styles.chatBody} contentContainerStyle={{ gap: 8 }}>
                {messageQuery.length > 0 ? (
                  messageQuery.map((msg, idx) => {
                    const right = Number(msg?.replyBy) !== 0
                    return (
                      <View key={String(msg?._id ?? idx)} style={[styles.msgRow, right && styles.msgRowRight]}>
                        <View style={[styles.msgBubble, right && styles.msgBubbleRight]}>
                          <Text style={styles.msgText}>{String(msg?.query ?? msg?.message ?? '') || '—'}</Text>
                        </View>
                      </View>
                    )
                  })
                ) : (
                  <View style={styles.msgRow}>
                    <View style={styles.msgBubble}>
                      <Text style={styles.msgText}>No messages yet. Our support team will respond shortly.</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
              <View style={styles.chatFooter}>
                {canReply ? (
                  <>
                    <TextInput
                      style={[styles.input, styles.replyInput]}
                      placeholder="Write your message here..."
                      placeholderTextColor="#8ea2bb"
                      value={messageReply}
                      onChangeText={setMessageReply}
                      editable={!isSubmitting}
                      maxLength={1000}
                    />
                    <Pressable style={[styles.sendBtn, isSubmitting && styles.pgBtnDisabled]} onPress={() => void handleSendMessage()} disabled={isSubmitting}>
                      <Text style={styles.sendBtnText}>{isSubmitting ? '...' : '➤'}</Text>
                    </Pressable>
                  </>
                ) : (
                  <TextInput style={[styles.input, styles.replyInput]} value="This ticket has been resolved" editable={false} />
                )}
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
  title: { color: '#FFF', fontFamily: AppFonts.montserratBold, fontSize: 33 / 2, marginBottom: 12 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#111f32', padding: 14 },
  sectionTitle: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 16 },
  label: { color: '#d6e1f3', fontFamily: AppFonts.montserratMedium, fontSize: 12, marginTop: 12, marginBottom: 6 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#314157',
    backgroundColor: '#1f2a3b',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: AppFonts.montserratMedium,
    fontSize: 14,
  },
  textArea: { minHeight: 120 },
  selectField: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#314157',
    backgroundColor: '#1f2a3b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: { color: '#fff', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  selectChevron: { color: '#fff', fontSize: 14, marginTop: -2 },
  submitBtn: { marginTop: 14, alignSelf: 'flex-start', backgroundColor: '#D56E2A', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 10, borderWidth: 1, borderColor: '#C45F24' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 16 / 1.2 },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 8 },
  searchInput: { flex: 1 },
  searchBtn: { minWidth: 96, borderRadius: 10, borderWidth: 1, borderColor: '#C45F24', backgroundColor: '#D56E2A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  searchBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 14 },
  emptyCard: { borderRadius: 12, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#111f32', minHeight: 80, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  emptyText: { color: 'rgba(255,255,255,0.6)', fontFamily: AppFonts.montserratMedium, fontSize: 14, textAlign: 'center' },
  listWrap: { gap: 10, marginTop: 8 },
  ticketCard: { borderRadius: 12, borderWidth: 1, borderColor: '#253a59', backgroundColor: '#111f32', padding: 12 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ticketId: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  copyText: { color: '#F97A31', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  key: { color: '#9CB0C9', fontFamily: AppFonts.montserratMedium, fontSize: 12, flex: 1 },
  val: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  viewBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#1d2e47', borderWidth: 1, borderColor: '#314157', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  viewBtnText: { color: '#DDE8F7', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, marginBottom: 12 },
  pgBtn: { backgroundColor: '#F97A31', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pgBtnDisabled: { opacity: 0.45 },
  pgText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  pgInfo: { color: 'rgba(255,255,255,0.82)', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  dropdownModalRoot: { ...StyleSheet.absoluteFillObject },
  dropdownBackdrop: { ...StyleSheet.absoluteFillObject },
  dropdownSheet: { position: 'absolute', backgroundColor: '#15243B', borderRadius: 10, borderWidth: 1, borderColor: '#2a3a52', overflow: 'hidden' },
  dropdownRow: { paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  dropdownRowActive: { backgroundColor: 'rgba(249,122,49,0.14)' },
  dropdownRowText: { color: '#DDE8F7', fontFamily: AppFonts.montserratMedium, fontSize: 14 },
  dropdownRowTextActive: { color: '#F97A31', fontFamily: AppFonts.montserratSemiBold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 14 },
  modalCard: { maxHeight: '88%', backgroundColor: '#111c2a', borderRadius: 12, borderWidth: 1, borderColor: '#314157', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: '#fff', fontFamily: AppFonts.montserratBold, fontSize: 16 },
  modalClose: { color: '#fff', fontSize: 18 },
  modalToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, gap: 10 },
  ticketChip: { backgroundColor: '#1a2433', borderRadius: 8, borderWidth: 1, borderColor: '#314157', paddingHorizontal: 10, paddingVertical: 7 },
  ticketChipText: { color: '#DDE8F7', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  closeBtn: { backgroundColor: '#f87171', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  closeBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 12 },
  ticketMeta: { paddingHorizontal: 12, paddingTop: 10, gap: 4 },
  metaText: { color: '#C8D6EA', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  chatBody: { marginTop: 10, marginHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#314157', backgroundColor: '#0f1724', padding: 10, minHeight: 180, maxHeight: 260 },
  msgRow: { flexDirection: 'row' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgBubble: { maxWidth: '85%', backgroundColor: '#253246', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  msgBubbleRight: { backgroundColor: '#1e3a5f' },
  msgText: { color: '#EAF2FF', fontFamily: AppFonts.montserratMedium, fontSize: 12 },
  chatFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  replyInput: { flex: 1 },
  sendBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F97A31', alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontFamily: AppFonts.montserratSemiBold, fontSize: 18 },
})

export default SupportScreen
