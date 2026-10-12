import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ResourceService } from '../../services/resource.service';
import { CreateResourceRequest, UpdateResourceRequest } from '../../models/resource.interface';

// Rechaza textos formados solo por espacios
function notBlank(control: AbstractControl): ValidationErrors | null {
  return (control.value ?? '').trim() ? null : { blank: true };
}

@Component({
  selector: 'app-resource-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './resource-form.html',
  styleUrl: './resource-form.scss'
})
export class ResourceForm implements OnInit {
  private fb = inject(FormBuilder);
  private resourceService = inject(ResourceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  resourceId = '';

  resourceForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, notBlank, Validators.minLength(3), Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(500)]],
    availableQuantity: [1, [
      Validators.required,
      Validators.min(0),
      Validators.max(9999),
      Validators.pattern(/^\d+$/)
    ]]
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.resourceId = id;
      this.isEdit.set(true);
      this.loadResource(id);
    }
  }

  loadResource(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.resourceService.getById(id).subscribe({
      next: (resource) => {
        this.resourceForm.patchValue({
          name: resource.name,
          description: resource.description ?? '',
          availableQuantity: resource.availableQuantity
        });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar recurso:', err);
        this.error.set('No se pudo cargar el recurso.');
        this.loading.set(false);
      }
    });
  }

  save(): void {
    if (this.resourceForm.invalid) {
      this.resourceForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const form = this.resourceForm.getRawValue();

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      availableQuantity: form.availableQuantity
    };

    if (this.isEdit()) {
      const request: UpdateResourceRequest = payload;
      this.resourceService.update(this.resourceId, request).subscribe({
        next: () => this.router.navigate(['/resources']),
        error: (err) => {
          console.error('Error al actualizar recurso:', err);
          this.error.set('No se pudo actualizar el recurso.');
          this.saving.set(false);
        }
      });
    } else {
      const request: CreateResourceRequest = payload;
      this.resourceService.create(request).subscribe({
        next: () => this.router.navigate(['/resources']),
        error: (err) => {
          console.error('Error al crear recurso:', err);
          this.error.set('No se pudo crear el recurso.');
          this.saving.set(false);
        }
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/resources']);
  }
}