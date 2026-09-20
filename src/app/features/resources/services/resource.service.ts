import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  Resource,
  CreateResourceRequest,
  UpdateResourceRequest
} from '../models/resource.interface';

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
    private http = inject(HttpClient)
    private apiUrl = 'api/resource';

    getAll(): Observable<Resource[]> {
        return this.http.get<Resource[]>(this.apiUrl);
    }

    getById(id: string): Observable<Resource> {
        return this.http.get<Resource>(`${this.apiUrl}/${id}`);
    }

    create(request: CreateResourceRequest): Observable<Resource> {
        return this.http.post<Resource>(this.apiUrl, request);
    }

    update(id: string, request: UpdateResourceRequest): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${id}`, request);
    }

    activate(id: string): Observable<void> {
        return this.http.patch<void>(`${this.apiUrl}/${id}/activate`, {});
    }

    deactivate(id: string): Observable<void> {
        return this.http.patch<void>(`${this.apiUrl}/${id}/deactivate`, {});
    }
}