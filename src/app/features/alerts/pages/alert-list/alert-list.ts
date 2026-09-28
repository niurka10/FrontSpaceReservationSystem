import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AlertService } from '../../services/alert.service';
import { Alert } from '../../models/alert.interface';
import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService, Notification } from '../../../notifications/services/notification.service';


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
    private authService = inject(AuthService);
    private notificationService = inject(NotificationService);

    alerts = signal<Alert[]>([]);
    loading = signal(true);
    error = signal<string | null>(null);

    showResolveModal = signal(false);
    selectedAlert = signal<Alert | null>(null);
    resolutionObservation = signal('');
    notifications = signal<Notification[]>([]);
    showNotifications = signal(false);

    // Verifica si el usuario tiene permiso para resolver alertas
    canResolve(): boolean {
        return this.authService.hasRole('Bienes', 'Admin');
    }

    ngOnInit(): void {
        this.loadAlerts();
        this.loadNotifications();
    }

    loadAlerts(): void {
        this.loading.set(true);
        this.error.set(null);

        this.alertService.getAll().subscribe({
            next: (data) => {
                this.alerts.set(data);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error al cargar alertas:', err);
                this.error.set('No se pudieron cargar las alertas.');
                this.loading.set(false);
            }
        });
    }

    create(): void {
        this.router.navigate(['/alerts/new']);
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
                this.loadAlerts();
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

    toggleNotifications(): void {
        this.showNotifications.update(value => !value);
    }
}