export interface loginDto {
  userEmail: string
  password: string
  termsIds?: number[]
}

export interface UserToken {
  accessToken: string
}
