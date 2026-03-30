import { apiClient } from '../api/client'
import { API_ENDPOINTS } from '../api/endpoints'

export type BankAccountPayload = {
  accountHolderName: string
  accountNumber: string
  bankName: string
  branchName: string
  ifscCode: string
  otp: string
}

export const bankAccountsService = {
  list: () => apiClient<any>(API_ENDPOINTS.bankAccounts, { method: 'GET' }),

  sendOtp: () =>
    apiClient<any>(API_ENDPOINTS.bankAccountsSendOtp, {
      method: 'POST',
      body: {},
    }),

  add: (payload: BankAccountPayload) =>
    apiClient<any>(API_ENDPOINTS.bankAccounts, {
      method: 'POST',
      body: payload,
    }),

  delete: (accountId: string) =>
    apiClient<any>(`${API_ENDPOINTS.bankAccounts}/${encodeURIComponent(accountId)}`, {
      method: 'DELETE',
    }),

  setDefault: (accountId: string) =>
    apiClient<any>(`${API_ENDPOINTS.bankAccounts}/${encodeURIComponent(accountId)}/default`, {
      method: 'PATCH',
      body: {},
    }),
}
