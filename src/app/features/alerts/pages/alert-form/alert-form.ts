import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AlertService } from '../../services/alert.service';
import { CreateAlertRequest } from '../../models/alert.interface';

@Component({
  selector: 'app-alert-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alert-form.html',
  styleUrl: './alert-form.scss',
})
export class AlertForm {

  private alertService = inject(AlertService);
  private router = inject(Router);

  type = signal(1);
  description = signal('');
  resourceId = signal<string | null>(null);
  spaceId = signal<string | null>(null);

  loading = signal(false);
  error = signal<string | null>(null);

  save(): void {
    this.error.set(null);

    if (!this.description().trim()) {
      this.error.set('La descripción es obligatoria.');
      return;
    }

    if (!this.resourceId() && !this.spaceId()) {
      this.error.set('Debe seleccionar un recurso o un espacio.');
      return;
    }

    const request: CreateAlertRequest = {
      type: this.type(),
      description: this.description().trim(),
      resourceId: this.resourceId(),
      spaceId: this.spaceId()
    };

    this.loading.set(true);

    this.alertService.create(request).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/alerts']);
      },
      error: (err) => {
        console.error('Error al crear alerta:', err);
        this.error.set('No se pudo crear la alerta.');
        this.loading.set(false);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/alerts']);
  }
}