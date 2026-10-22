import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateFacultyRequest, Faculty, UpdateFacultyRequest } from '../models/faculty.interface';

@Injectable({
    providedIn: 'root'
})

export class FacultyService {
    delete(id: string) {
      throw new Error('Method not implemented.');
    }
    private readonly http = inject(HttpClient);
    private readonly apiUrl = '/api/Faculty';

    //método para obtener todas las facultades
    getAll(): Observable<Faculty[]> {
    return this.http.get<Faculty[]>(this.apiUrl);
    }

    getById(id: string): Observable<Faculty> {
        return this.http.get<Faculty>(`${this.apiUrl}/${id}`);
    }

    create(request: CreateFacultyRequest): Observable<Faculty> {
        return this.http.post<Faculty>(this.apiUrl, request);
    }

    update(id: string, request: UpdateFacultyRequest): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${id}`, request);
    }
}