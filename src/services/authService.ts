import { apiClient, apiClientMultipart } from '../api/client'
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

  /** GET /api/v1/auth/me — full profile payload (user, wallet, stats, …). */
  getMe: () => apiClient<any>(API_ENDPOINTS.me),

  /**
   * PUT /api/v1/auth/profile — multipart FormData (same as web AuthService.bettingUpdateProfile).
   * Always sends fullName + email; optional profileImage file part.
   */
  updateProfile: (fullName: string, email: string, profileImage?: { uri: string; type?: string; name?: string }) => {
    const formData = new FormData()
    formData.append('fullName', fullName != null ? String(fullName).trim() : '')
    formData.append('email', email != null ? String(email).trim() : '')
    if (profileImage?.uri) {
      formData.append(
        'profileImage',
        {
          uri: profileImage.uri,
          type: profileImage.type || 'image/jpeg',
          name: profileImage.name || 'profile.jpg',
        } as any,
      )
    }
    return apiClientMultipart<any>(API_ENDPOINTS.userProfile, formData, { method: 'PUT' })
  },
}
