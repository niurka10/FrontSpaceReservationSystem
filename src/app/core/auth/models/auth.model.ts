// Roles tal como los define el backend (Domain.Enums.RoleCode)
export type RoleCode =
  | 'Student'
  | 'Teacher'
  | 'Coordinator'
  | 'Vicerrector'
  | 'Bienes'
  | 'Admin';

export interface LoginRequest {
  email: string;
  password: string;
}

// El backend NO tiene JsonStringEnumConverter configurado, así que RoleCode
// viaja como número, no como string. Ver Domain.Enums.RoleCode.
export enum RegisterRoleCode {
  Student = 1,
  Teacher = 2,
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  identificationNumber: string;
  requestedRole: number;
  careerId?: string;
}

// Forma real que llega del backend en /api/auth/login y /api/auth/register.
// OJO: NO vienen envueltas en { data: ... }, llegan directas.
export interface RawAuthResponse {
  userId?: string; // presente en /register (UserId -> userId)
  userid?: string; // presente en /login (Userid -> userid, typo del backend)
  accessToken: string;
  refreshToken: string;
}

// Claim keys reales dentro del JWT (JwtTokenService usa ClaimTypes.Role,
// cuyo valor NO es "role" sino la URI larga de .NET).
export const JWT_CLAIMS = {
  sub: 'sub',
  email: 'email',
  role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
} as const;

export interface DecodedToken {
  [JWT_CLAIMS.sub]: string;
  [JWT_CLAIMS.email]: string;
  [JWT_CLAIMS.role]: RoleCode;
  exp: number;
  iss?: string;
  aud?: string;
  jti?: string;
}

// Modelo de usuario que consume el resto de la app (front-only, derivado del JWT)
export interface AuthUser {
  id: string;
  email: string;
  role: RoleCode;
}