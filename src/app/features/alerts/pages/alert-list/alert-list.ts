import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AlertService } from '../../services/alert.service';
import { Alert } from '../../models/alert.interface';
import { AuthService } from '../../../../core/auth/auth.service';


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


    alerts = signal<Alert[]>([]);
    loading = signal(true);
    error = signal<string | null>(null);

    // Verifica si el usuario tiene permiso para resolver alertas
    canResolve(): boolean {
        return this.authService.hasRole('Bienes', 'Admin');
    }

    ngOnInit(): void {
        this.loadAlerts();
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

    resolve(alert: Alert): void {
        this.alertService.resolve(alert.id).subscribe({
            next: () => {
                this.loadAlerts();
            },
            error: (err) => {
                console.error('Error al resolver alerta:', err);
                this.error.set('No se pudo resolver la alerta.');
            }
        });
    }
}