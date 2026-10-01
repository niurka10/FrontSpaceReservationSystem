import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../services/alert.service';
import { Alert } from '../../models/alert.interface';
import { AuthService } from '../../../../core/auth/auth.service';
import {
    NotificationService,
    Notification
} from '../../../notifications/services/notification.service';

@Component({
    selector: 'app-alert-list',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './alert-list.html',
    styleUrl: './alert-list.scss'
})
export class AlertList implements OnInit {

    private alertService = inject(AlertService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private authService = inject(AuthService);
    private notificationService = inject(NotificationService);

    alerts = signal<Alert[]>([]);
    loading = signal(true);
    error = signal<string | null>(null);

    // Pestaña actual
    activeTab = signal<'pending' | 'resolved' | 'all'>('pending');

    // Alertas filtradas según la pestaña
    filteredAlerts = computed(() => {
        const alerts = this.alerts();

        switch (this.activeTab()) {
            case 'pending':
                return alerts.filter(alert => !alert.isResolved);

            case 'resolved':
                return alerts.filter(alert => alert.isResolved);

            case 'all':
                return alerts;

            default:
                return alerts;
        }
    });

    showResolveModal = signal(false);
    selectedAlert = signal<Alert | null>(null);
    selectedAlertId = signal<string | null>(null);
    resolutionObservation = signal('');
    showDetailModal = signal(false);
    detailAlert = signal<Alert | null>(null);

    notifications = signal<Notification[]>([]);

    unreadNotifications = computed(() =>
        this.notifications().filter(n => !n.isRead)
    );

    showNotifications = signal(false);

    // Verifica si el usuario tiene permiso para resolver alertas
    canResolve(): boolean {
        return this.authService.hasRole('Bienes', 'Admin');
    }

    ngOnInit(): void {

        this.route.queryParams.subscribe(params => {

            const alertId = params['alertId'] ?? null;

            this.selectedAlertId.set(alertId);

            this.loadAlerts();
            this.loadNotifications();
        });
    }

    loadAlerts(): void {
        this.loading.set(true);
        this.error.set(null);

        this.alertService.getAll().subscribe({
            next: (data) => {

                this.alerts.set(data);
                this.loading.set(false);

                const alertId = this.selectedAlertId();

                if (alertId) {

                    const alert = data.find(a => a.id === alertId);

                    if (alert) {
                        this.selectedAlert.set(alert);

                        console.log('Alerta seleccionada:', alert);
                    } else {
                        console.warn(
                            'No se encontró la alerta con ID:',
                            alertId
                        );
                    }
                }
            },

            error: (err) => {
                console.error('Error al cargar alertas:', err);
                this.error.set('No se pudieron cargar las alertas.');
                this.loading.set(false);
            }
        });
    }

    setTab(tab: 'pending' | 'resolved' | 'all'): void {
        this.activeTab.set(tab);
    }

    create(): void {
        this.router.navigate(['/alerts/new']);
    }

    openDetailModal(alert: Alert): void {
        this.detailAlert.set(alert);
        this.showDetailModal.set(true);
    }

    closeDetailModal(): void {
        this.showDetailModal.set(false);
        this.detailAlert.set(null);
    }
    openResolveModal(alert: Alert): void {
        this.selectedAlert.set(alert);
        this.resolutionObservation.set('');
        this.showResolveModal.set(true);
    }

    cancelResolve(): void {
        this.showResolveModal.set(false);
        this.selectedAlert.set(null);
        this.resolutionObservation.set('');
    }

    confirmResolve(): void {
        const alert = this.selectedAlert();
        const observation = this.resolutionObservation().trim();

        if (!alert) {
            return;
        }

        if (!observation) {
            this.error.set('La observación es obligatoria.');
            return;
        }

        this.alertService.resolve(alert.id, observation).subscribe({
            next: () => {
                this.showResolveModal.set(false);
                this.selectedAlert.set(null);
                this.resolutionObservation.set('');

                // Volver a cargar para que la alerta
                // salga de Pendientes y aparezca en Resueltas.
                this.loadAlerts();

                // Actualizar también las notificaciones.
                this.loadNotifications();
            },
            error: (err) => {
                console.error('Error al resolver alerta:', err);
                this.error.set('No se pudo resolver la alerta.');
            }
        });
    }

    loadNotifications(): void {
        this.notificationService.getMyNotifications().subscribe({
            next: (data) => {
                this.notifications.set(data);
            },
            error: (err) => {
                console.error('Error al cargar notificaciones:', err);
            }
        });
    }

    markNotificationAsRead(notification: Notification): void {

        const goToAlert = () => {
            if (notification.alertId) {
                this.router.navigate(['/alerts'], {
                    queryParams: {
                        alertId: notification.alertId
                    }
                });
            }
        };

        // Si ya estaba leída, igual podemos ir a la alerta.
        if (notification.isRead) {
            goToAlert();
            return;
        }

        this.notificationService.markAsRead(notification.id).subscribe({
            next: () => {

                this.notifications.update(notifications =>
                    notifications.map(n =>
                        n.id === notification.id
                            ? { ...n, isRead: true }
                            : n
                    )
                );

                // Después de marcar como leída,
                // ir exactamente a la alerta relacionada.
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
    toggleNotifications(): void {
        this.showNotifications.update(value => !value);
    }
}

