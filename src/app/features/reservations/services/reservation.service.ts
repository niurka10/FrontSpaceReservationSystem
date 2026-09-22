import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { CreateReservationRequest, Reservation } from "../models/reservation.interface";
import { Observable } from "rxjs";

const API_BASE = '/api/reservations';

@Injectable({ providedIn: 'root'})
export class ReservationService {
    constructor(private http: HttpClient) {}

    create(request: CreateReservationRequest): Observable<Reservation>{
        return this.http.post<Reservation>(API_BASE, request)
    }

    getById (id: string): Observable<Reservation>{
        return this.http.get<Reservation>(`${API_BASE}/${id}`)  
    }

    listMine(): Observable<Reservation[]>{
        return this.http.get<Reservation[]>(`${API_BASE}/mine`)
    }

    submit(id: string, justification: string): Observable<Reservation>{
        return this.http.post<Reservation>(`${API_BASE}/${id}/submit`, { justification })
    }

    // Backend: pendiente construir GET /api/reservations/career. A diferencia
    // de un simple "pendientes para mí", esta trae TODOS los estados de la
    // carrera del Coordinator logueado (filtrado por User.CareerId en el
    // backend) — las tabs de la pantalla filtran del lado del cliente.


    listForMyCareer(): Observable<Reservation[]>{
        return this.http.get<Reservation[]>(`${API_BASE}/career`)
    }

    elevate(id: string, justification: string): Observable<Reservation>{
        return this.http.post<Reservation>(`${API_BASE}/${id}/elevate`, { justification })
    }

    reject(id: string, justification: string): Observable<Reservation>{
        return this.http.post<Reservation>(`${API_BASE}/${id}/reject`, { justification })
    }
}