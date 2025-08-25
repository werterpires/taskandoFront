export interface UserFromJwt {
  userId: number
  userName: string
  userEmail: string
  userRoles: number[]
  userActive: boolean
}
