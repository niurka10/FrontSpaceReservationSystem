import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { CreateReservationRequest, Reservation, ReservationDetail } from "../models/reservation.interface";
import { Observable } from "rxjs";

const API_BASE = '/api/reservations';

@Injectable({ providedIn: 'root' })
export class ReservationService {
    constructor(private http: HttpClient) { }

    create(request: CreateReservationRequest): Observable<Reservation> {
        return this.http.post<Reservation>(API_BASE, request)
    }

    getById(id: string): Observable<ReservationDetail> {
        return this.http.get<ReservationDetail>(`${API_BASE}/${id}`)
    }

    listMine(): Observable<Reservation[]> {
        return this.http.get<Reservation[]>(`${API_BASE}/mine`)
    }

    submit(id: string, justification: string): Observable<Reservation> {
        return this.http.post<Reservation>(`${API_BASE}/${id}/submit`, { justification })
    }

    listForMyCareer(): Observable<Reservation[]> {
        return this.http.get<Reservation[]>(`${API_BASE}/career`)
    }

    elevate(id: string, justification: string): Observable<Reservation> {
        return this.http.post<Reservation>(`${API_BASE}/${id}/elevate`, { justification })
    }

    reject(id: string, justification: string): Observable<Reservation> {
        return this.http.post<Reservation>(`${API_BASE}/${id}/reject`, { justification })
    }

    listForVicerrector(): Observable<Reservation[]> {
        return this.http.get<Reservation[]>(`${API_BASE}/vicerrector`)
    }

    listForAssets(): Observable<Reservation[]> {
        return this.http.get<Reservation[]>(`${API_BASE}/assets`)
    }

    approve(id: string, justification: string): Observable<Reservation> {
        return this.http.post<Reservation>(`${API_BASE}/${id}/approve`, { justification })
    }

    assign(id: string, justification: string, spaceId: string | null): Observable<Reservation> {
        return this.http.post<Reservation>(`${API_BASE}/${id}/assign`, { justification, spaceId })
    }

    cancel(id: string, justification: string): Observable<Reservation> {
        return this.http.post<Reservation>(`${API_BASE}/${id}/cancel`, { justification })
    }

    edit(id: string, request: CreateReservationRequest): Observable<Reservation> {
        return this.http.put<Reservation>(`${API_BASE}/${id}`, request)
    }
}