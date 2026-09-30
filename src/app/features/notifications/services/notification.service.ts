import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Notification {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;

  // Alerta relacionada con esta notificación
  alertId: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private http = inject(HttpClient);
  private apiUrl = '/api/Notification';

  getMyNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.apiUrl);
  }

  markAsRead(id: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/read`, {});
  }
}