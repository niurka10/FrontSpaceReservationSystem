import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Alert,
  CreateAlertRequest
} from '../models/alert.interface';

@Injectable({
  providedIn: 'root'
})
export class AlertService {
    private http = inject(HttpClient)
    private apiUrl = '/api/Alert';

    getAll(): Observable<Alert[]>{
        return this.http.get<Alert[]>(this.apiUrl);
    }

    getById(id:string): Observable<Alert> {
        return this.http.get<Alert>(`${this.apiUrl}/${id}`);
    }

    create(request: CreateAlertRequest): Observable<Alert> {
        return this.http.post<Alert>(this.apiUrl, request);
    }

    resolve(id: string): Observable<void> {
        return this.http.patch<void>(
        `${this.apiUrl}/${id}/resolve`,
        {}
        );
    }

}