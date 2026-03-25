import { apiClient } from '../api/client'
import { API_ENDPOINTS } from '../api/endpoints'
import { ApiResponse, LoginPayload } from '../types/api'

type LoginResult = {
  token: string
}

export const authService = {
  login: (payload: any) =>
    apiClient<ApiResponse<any>>(API_ENDPOINTS.login, {
      method: 'POST',
      body: payload,
    }),
  register: (payload: any) =>
    apiClient<ApiResponse<any>>(API_ENDPOINTS.register, {
      method: 'POST',
      body: payload,
    }),
  sendOtp: (mobile: string) =>
    apiClient<ApiResponse<any>>(API_ENDPOINTS.sendOtp, {
      method: 'POST',
      body: { mobile },
    }),
  demoLogin: () =>
    apiClient<ApiResponse<any>>(API_ENDPOINTS.demoLogin, {
      method: 'POST',
      body: {},
    }),
  forgotPasswordSendOtp: (mobile: string) =>
    apiClient<ApiResponse<any>>(API_ENDPOINTS.forgotPasswordSendOtp, {
      method: 'POST',
      body: { mobile },
    }),
  forgotPasswordReset: ({ mobile, otp, password, confirmPassword }: any) =>
    apiClient<ApiResponse<any>>(API_ENDPOINTS.forgotPasswordReset, {
      method: 'POST',
      body: { 
        mobile, 
        otp, 
        newPassword: password, 
        confirmNewPassword: confirmPassword 
      },
    }),
}
