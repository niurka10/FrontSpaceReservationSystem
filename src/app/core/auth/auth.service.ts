import { computed, Injectable, signal } from "@angular/core";
import { AuthUser, DecodedToken,  JWT_CLAIMS,   LoginRequest,  RawAuthResponse, RegisterRequest } from "./models/auth.model";
import { Observable, tap } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { UserService } from "../../features/users/user.service";

const ACCESS_TOKEN_KEY = 'srs_access_token';
const REFRESH_TOKEN_KEY = 'srs_refresh_token';
const API_BASE = '/api/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly _currentUser = signal<AuthUser | null>(this.restoreUserFromLocalStorage());

    readonly currentUser = this._currentUser.asReadonly();
    readonly isAuthenticated = computed(() => this._currentUser() !== null);
    readonly role = computed(() => this._currentUser()?.role ?? null);

    constructor(private http: HttpClient, private router: Router, private userService: UserService) { }

    login(request: LoginRequest): Observable<RawAuthResponse> {
        return this.http.post<RawAuthResponse>(`${API_BASE}/login`, request).pipe(
            tap((response) => this.handleAuthSuccess(response))
        );
    }

    register(request: RegisterRequest): Observable<RawAuthResponse> {
        return this.http.post<RawAuthResponse>(`${API_BASE}/register`, request).pipe(
            tap((response) => this.handleAuthSuccess(response))
        );
    }

    logout(): void {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        this._currentUser.set(null);
        this.userService.clearCache();
        this.router.navigate(['/login']);
    }

    getAccessToken(): string | null {
        return localStorage.getItem(ACCESS_TOKEN_KEY);
    }

    hasRole(...roles: string[]): boolean {
        const current = this.role();
        return current !== null && roles.includes(current);
    }

    private handleAuthSuccess(response: RawAuthResponse): void {
        localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
        this.userService.clearCache();
        this._currentUser.set(this.decodeUserFromToken(response.accessToken));
    }

    private restoreUserFromLocalStorage(): AuthUser | null {
        const token = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (!token) return null;

        const user = this.decodeUserFromToken(token);
        if (!user || this.isTokenExpired(token)) {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
            return null;
        }
        return user;
    }

    private decodeUserFromToken(token: string): AuthUser | null {
        const payload = this.decodeJwtPayload(token);
        if (!payload) return null;

        return {
            id: payload[JWT_CLAIMS.sub],
            email: payload[JWT_CLAIMS.email],
            role: payload[JWT_CLAIMS.role],
        };
    }

    private isTokenExpired(token: string): boolean {
        const payload = this.decodeJwtPayload(token);
        if (!payload?.exp) return true;
        return Date.now() >= payload.exp * 1000;
    }

    // Decodificación manual: evita depender de la librería jwt-decode para algo tan simple.
    private decodeJwtPayload(token: string): DecodedToken | null {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
                    .join('')
            );
            return JSON.parse(json) as DecodedToken;
        } catch {
            return null;
        }
    }


}