import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { UserSummaryResponse } from './models/user-summary.model';

const API_BASE = '/api/users';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private http: HttpClient) {}

  // Cache de "quién soy" (incluye mi careerId) — se llena una vez por sesión.
  private readonly _me = signal<UserSummaryResponse | null>(null);
  readonly me = this._me.asReadonly();

  // role y careerId son opcionales — el backend los usa como filtros si vienen.
  search(role?: string, careerId?: string): Observable<UserSummaryResponse[]> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    if (careerId) params = params.set('careerId', careerId);

    return this.http.get<UserSummaryResponse[]>(API_BASE, { params });
  }

  getMe(): Observable<UserSummaryResponse> {
    return this.http.get<UserSummaryResponse>(`${API_BASE}/me`);
  }

  //* Llama a getMe() solo si todavía no está cacheado. Los componentes deben
  //* usar esto (no getMe() directo) para no repetir el request cada vez que
  //* se navega a una pantalla que necesita el careerId propio.
  ensureMeLoaded(): Observable<UserSummaryResponse> {
    const cached = this._me();
    if (cached) return new Observable((sub) => { sub.next(cached); sub.complete(); });

    return this.getMe().pipe(tap((me) => this._me.set(me)));
  }
}