import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  NotificationService,
  Notification
} from '../services/notification.service';

import { AlertService } from '../../alerts/services/alert.service';
import { Alert } from '../../alerts/models/alert.interface';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss'
})
export class NotificationBellComponent implements OnInit {

  private notificationService = inject(NotificationService);
  private alertService = inject(AlertService);
  private router = inject(Router);

  notifications = signal<Notification[]>([]);
  alerts = signal<Alert[]>([]);

  showNotifications = signal(false);

  // Solo muestra notificaciones de alertas que siguen pendientes.
  visibleNotifications = computed(() => {
    const alerts = this.alerts();

    return this.notifications().filter(notification => {

      if (!notification.alertId) {
        return true;
      }

      const alert = alerts.find(
        a => a.id === notification.alertId
      );

      return alert ? !alert.isResolved : false;
    });
  });

  unreadNotifications = computed(() =>
    this.visibleNotifications().filter(
      notification => !notification.isRead
    )
  );

  ngOnInit(): void {
    this.loadNotifications();
    this.loadAlerts();
  }

  loadNotifications(): void {
    this.notificationService.getMyNotifications().subscribe({
      next: (data) => {
        this.notifications.set(data);
      },
      error: (err) => {
        console.error(
          'Error al cargar notificaciones:',
          err
        );
      }
    });
  }

  loadAlerts(): void {
    this.alertService.getAll().subscribe({
      next: (data) => {
        this.alerts.set(data);
      },
      error: (err) => {
        console.error(
          'Error al cargar alertas para notificaciones:',
          err
        );
      }
    });
  }

  toggleNotifications(): void {
    this.showNotifications.update(
      value => !value
    );
  }

  markNotificationAsRead(
    notification: Notification
  ): void {

    const goToAlert = () => {

      if (notification.alertId) {

        this.router.navigate(['/alerts'], {
          queryParams: {
            alertId: notification.alertId
          }
        });

      }
    };

    // Si ya estaba leída, solamente ir a la alerta.
    if (notification.isRead) {
      goToAlert();
      return;
    }

    this.notificationService
      .markAsRead(notification.id)
      .subscribe({

        next: () => {

          this.notifications.update(
            notifications =>
              notifications.map(n =>
                n.id === notification.id
                  ? { ...n, isRead: true }
                  : n
              )
          );

          goToAlert();
        },

        error: (err) => {

          console.error(
            'Error al marcar notificación como leída:',
            err
          );

        }

      });
  }

  getNotificationMessage(
    notification: Notification
  ): string {

    if (!notification.alertId) {
      return notification.message;
    }

    const alert = this.alerts().find(
      a => a.id === notification.alertId
    );

    if (alert?.createdByName) {
      return `${alert.createdByName} reportó una alerta`;
    }

    return 'Se reportó una nueva alerta';
  }
}