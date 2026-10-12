import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, map, merge, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { Career } from '../../../careers/models/career.interface';
import { CareerService } from '../../../careers/services/career.service';
import { Faculty } from '../../../faculties/models/faculty.interface';
import { FacultyService } from '../../../faculties/services/faculty.service';
import { UserListItem } from '../../models/user-summary.model';
import { UserService } from '../../user.service';

@Component({
    selector: 'app-user-list',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './user-list.html',
    styleUrl: './user-list.scss',
})
export class UserListComponent {
    private readonly fb = inject(FormBuilder);
    private readonly userService = inject(UserService);
    private readonly careerService = inject(CareerService);
    private readonly authService = inject(AuthService);
    private readonly facultyService = inject(FacultyService);

    readonly users = signal<UserListItem[]>([]);
    readonly careers = signal<Career[]>([]);
    readonly isLoading = signal(true);
    readonly errorMessage = signal<string | null>(null);
    readonly statusTarget = signal<UserListItem | null>(null);
    readonly isChangingStatus = signal(false);
    readonly statusError = signal<string | null>(null);

    // value viaja como número porque el backend recibe RoleCode como int.
    readonly roleOptions = [
        { label: 'Estudiante', value: 1 },
        { label: 'Docente', value: 2 },
        { label: 'Coordinador', value: 3 },
        { label: 'Vicerrector', value: 4 },
        { label: 'Bienes', value: 5 },
        { label: 'Administrador', value: 6 },
    ];

    // El backend devuelve el nombre del rol en inglés ("Student"); este mapa
    // solo traduce lo que se ve en pantalla.
    readonly roleLabels: Record<string, string | undefined> = {
        Student: 'Estudiante',
        Teacher: 'Docente',
        Coordinator: 'Coordinador',
        Vicerrector: 'Vicerrector',
        Bienes: 'Bienes',
        Admin: 'Administrador',
    };

    readonly filters = this.fb.group({
        search: [''],
        role: [''],
        careerId: [''],
    });

    // ---------- estado del modal crear / editar ----------

    readonly faculties = signal<Faculty[]>([]);
    readonly emailDomain = '@unibe.com';

    // null = modal cerrado. "mode" distingue crear de editar, igual que el
    // isEditMode de reservation-form; userId solo existe al editar.
    readonly modal = signal<{ mode: 'create' | 'edit'; userId?: string } | null>(null);
    readonly isSaving = signal(false);
    readonly modalError = signal<string | null>(null);

    // La facultad NO se envía al backend: solo sirve para filtrar el select de
    // carreras. Por eso vive en un signal aparte y no en el body.
    readonly selectedFacultyId = signal('');
    readonly careersOfFaculty = computed(() =>
        this.careers().filter((c) => c.facultyId === this.selectedFacultyId())
    );

    // Traduce el nombre de rol que devuelve el backend ("Student") a su código.
    private readonly roleCodeByName: Record<string, number> = {
        Student: 1, Teacher: 2, Coordinator: 3, Vicerrector: 4, Bienes: 5, Admin: 6,
    };

    readonly userForm = this.fb.group({
        name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150),
        Validators.pattern(/^[\p{L}\s'.-]+$/u)]],
        emailUser: ['', [Validators.required, Validators.pattern(/^[a-z0-9.]+$/)]],
        password: ['', [Validators.required, Validators.minLength(8),
        Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)]],
        phone: ['', [Validators.required, Validators.pattern(/^\d{7,10}$/)]],
        role: [1, [Validators.required]],
        facultyId: [''],
        careerId: [{ value: '', disabled: true }],
    });

    // Los pasos siguientes (crear, editar, activar) llaman refresh$.next()
    // para recargar la tabla sin tocar los filtros.
    private readonly refresh$ = new Subject<void>();

    constructor() {
        this.careerService.getAll().subscribe({
            next: (careers) => this.careers.set(careers),
            error: (err) => console.error('Error cargando carreras', err),
        });

        this.facultyService.getAll().subscribe({
            next: (faculties) => this.faculties.set(faculties),
            error: (err) => console.error('Error cargando facultades', err),
        });

        merge(
            // debounceTime: espera 300 ms sin que el usuario teclee antes de pedir,
            // así no se dispara una consulta por cada letra del buscador.
            this.filters.valueChanges.pipe(debounceTime(300)),
            this.refresh$
        )
            .pipe(
                startWith(null), // carga inicial inmediata, sin esperar los 300 ms
                map(() => this.filters.getRawValue()),
                tap(() => {
                    this.isLoading.set(true);
                    this.errorMessage.set(null);
                }),
                // switchMap cancela la consulta anterior si llega una nueva: evita que
                // una respuesta lenta vieja pise a una más reciente.
                switchMap((f) =>
                    this.userService
                        .listForAdmin(
                            f.role ? Number(f.role) : undefined,
                            f.careerId || undefined,
                            f.search || undefined
                        )
                        .pipe(
                            catchError((err) => {
                                this.errorMessage.set(
                                    err?.error?.description ?? 'No se pudo cargar la lista de usuarios.'
                                );
                                return of([] as UserListItem[]);
                            })
                        )
                ),
                takeUntilDestroyed()
            )
            .subscribe((rows) => {
                this.users.set(rows);
                this.isLoading.set(false);
            });
    }

    // Para deshabilitar "Desactivar" en mi propia fila (el backend ya lo
    // rechaza, pero es mejor que ni aparezca como opción).
    isMe(user: UserListItem): boolean {
        return this.authService.currentUser()?.id === user.id;
    }

    reload(): void {
        this.refresh$.next();
    }

    // ---------- modal crear / editar ----------

    openCreate(): void {
        this.userForm.reset({ role: 1 });
        // Correo y contraseña solo existen al crear.
        this.userForm.controls.emailUser.enable();
        this.userForm.controls.password.enable();
        this.selectedFacultyId.set('');
        this.applyCareerRule();
        this.modalError.set(null);
        this.modal.set({ mode: 'create' });
    }

    openEdit(user: UserListItem): void {
        // El correo no se edita (decisión tomada) y la contraseña no se toca aquí.
        // Al deshabilitarlos, Angular los ignora al validar el formulario.
        this.userForm.controls.emailUser.disable();
        this.userForm.controls.password.disable();

        // El backend manda careerId pero no facultyId: se deduce buscando la
        // carrera en la lista que ya cargamos, para precargar la cascada.
        const facultyId = this.careers().find((c) => c.id === user.careerId)?.facultyId ?? '';
        this.selectedFacultyId.set(facultyId);

        this.userForm.patchValue({
            name: user.name,
            phone: user.phone,
            role: this.roleCodeByName[user.role],
            facultyId,
            careerId: user.careerId ?? '',
        });

        this.applyCareerRule();
        this.modalError.set(null);
        this.modal.set({ mode: 'edit', userId: user.id });
    }

    closeModal(): void {
        this.modal.set(null);
    }

    onFacultyChange(event: Event): void {
        this.selectedFacultyId.set((event.target as HTMLSelectElement).value);
        this.userForm.controls.careerId.reset('');
        this.applyCareerRule();
    }

    onRoleChange(): void {
        this.applyCareerRule();
    }

    // Misma limpieza que el registro: solo minúsculas, números y punto,
    // para que el correo siempre arme una dirección válida con el dominio.
    onEmailInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        const clean = input.value
            .split('@')[0]
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9.]/g, '');
        if (clean !== input.value) {
            input.value = clean;
            this.userForm.controls.emailUser.setValue(clean);
        }
    }

    // Mismo criterio que el backend: carrera obligatoria solo para
    // Student (1), Teacher (2) y Coordinator (3). Se aplica en vivo porque
    // el rol puede cambiar con el modal abierto.
    private applyCareerRule(): void {
        const c = this.userForm.controls;
        const required = [1, 2, 3].includes(Number(c.role.value));

        for (const ctrl of [c.facultyId, c.careerId]) {
            ctrl.setValidators(required ? [Validators.required] : []);
            ctrl.updateValueAndValidity({ emitEvent: false });
        }

        // La carrera se habilita solo cuando ya hay facultad elegida.
        if (this.selectedFacultyId()) c.careerId.enable({ emitEvent: false });
        else c.careerId.disable({ emitEvent: false });
    }

    save(): void {
        if (this.userForm.invalid) {
            this.userForm.markAllAsTouched();
            return;
        }

        const current = this.modal();
        if (!current) return;

        this.isSaving.set(true);
        this.modalError.set(null);

        const raw = this.userForm.getRawValue();
        const careerId = raw.careerId || null;

        // map(() => void 0) unifica los dos observables (create devuelve { id },
        // update devuelve el usuario) para poder suscribirse una sola vez.
        const request$ =
            current.mode === 'create'
                ? this.userService
                    .create({
                        name: raw.name!.trim(),
                        email: (raw.emailUser! + this.emailDomain).toLowerCase(),
                        password: raw.password!,
                        phone: raw.phone!,
                        requestedRole: Number(raw.role),
                        careerId,
                    })
                    .pipe(map(() => void 0))
                : this.userService
                    .update(current.userId!, {
                        name: raw.name!.trim(),
                        phone: raw.phone!,
                        role: Number(raw.role),
                        careerId,
                    })
                    .pipe(map(() => void 0));

        request$.subscribe({
            next: () => {
                this.isSaving.set(false);
                this.closeModal();
                this.reload(); // recarga la tabla manteniendo los filtros
            },
            error: (err) => {
                this.isSaving.set(false);
                this.modalError.set(err?.error?.description ?? 'No se pudo guardar el usuario.');
            },
        });
    }

    openStatusChange(user: UserListItem): void {
        this.statusError.set(null);
        this.statusTarget.set(user);
    }

    closeStatusChange(): void {
        this.statusTarget.set(null);
    }

    confirmStatusChange(): void {
        const user = this.statusTarget();
        if (!user) return;

        this.isChangingStatus.set(true);
        this.statusError.set(null);

        // Si hoy está activo, la acción es desactivar; si no, activar.
        this.userService.setStatus(user.id, !user.isActive).subscribe({
            next: () => {
                this.isChangingStatus.set(false);
                this.closeStatusChange();
                this.reload(); // recarga la tabla manteniendo los filtros
            },
            error: (err) => {
                this.isChangingStatus.set(false);
                this.statusError.set(
                    err?.error?.description ?? 'No se pudo cambiar el estado del usuario.'
                );
            },
        });
    }
}