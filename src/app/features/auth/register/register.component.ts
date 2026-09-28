import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RegisterRoleCode } from '../../../core/auth/models/auth.model';
import { FacultyService } from '../../faculties/services/faculty.service';
import { CareerService } from '../../careers/services/career.service';
import { Faculty } from '../../faculties/models/faculty.interface';
import { Career } from '../../careers/models/career.interface';
import { map } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly facultyService = inject(FacultyService);
  private readonly careerService = inject(CareerService);

  readonly faculties = signal<Faculty[]>([]);
  readonly careers = signal<Career[]>([]);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly roleOptions = [
    { label: 'Estudiante', value: RegisterRoleCode.Student },
    { label: 'Docente', value: RegisterRoleCode.Teacher },
  ];

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required]],
    requestedRole: [RegisterRoleCode.Student, [Validators.required]],
    facultyId: ['', [Validators.required]],
    careerId: [{ value: '', disabled: true }, [Validators.required]],
  });

  ngOnInit(): void {
    this.facultyService.getAll().subscribe({
      next: (data) => this.faculties.set(data),
      error: (err) => console.error('Error cargando facultades', err)
    })
  }

  // onFacultyChange(event: Event): void {
  //   const selectElement = event.target as HTMLSelectElement;
  //   const facultyId = selectElement.value;
  //   console.log('Id de la facultad', facultyId);

  //   this.form.get('careerId')?.reset('');

  //   if (facultyId) {
  //     this.form.get('careerId')?.enable();

  //     this.careerService.getByfacultyId(facultyId).subscribe({
  //       next: (data) => this.careers.set(data),
  //       error: (err) => console.error('Error al obtener carreras:', err)
  //     });
  //   } else {
  //     this.careers.set([]);
  //     this.form.get('careerId')?.disable();
  //   }
  // }

  onFacultyChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const facultyId = selectElement.value;

    this.form.get('careerId')?.reset('');

    if (facultyId) {
      this.form.get('careerId')?.enable();

      // Consultamos todas y filtramos por facultyId
      this.careerService.getAll().pipe(
        map((careers: Career[]) => careers.filter(c => c.facultyId === facultyId))
      ).subscribe({
        next: (filteredCareers) => this.careers.set(filteredCareers),
        error: (err) => console.error('Error al obtener carreras:', err)
      });
    } else {
      this.careers.set([]);
      this.form.get('careerId')?.disable();
    }
  }
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();

    this.authService
      .register({
        name: raw.name!,
        email: raw.email!,
        password: raw.password!,
        phone: raw.phone!,
        requestedRole: Number(raw.requestedRole),
        // facultyId: raw.facultyId,
        careerId: raw.careerId
      })
      .subscribe({
        next: () => this.router.navigate(['/reservations']),
        error: (err) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            err?.error?.description ?? 'No se pudo completar el registro. Intenta de nuevo.'
          );
        },
        complete: () => this.isLoading.set(false),
      });
  }
}