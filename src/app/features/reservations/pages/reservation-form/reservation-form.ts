import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Route, Router, RouterLink, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ResourceOption, SPACE_TYPE_LABELS, SpaceOption, CreateReservationRequest, ResourceAvailability } from "../../models/reservation.interface";
import { OptionsService } from "../../services/options.service";
import { ReservationService } from "../../services/reservation.service";
import { UserSummaryResponse } from "../../../users/models/user-summary.model";
import { AuthService } from "../../../../core/auth/auth.service";
import { UserService } from "../../../users/user.service";
import { forkJoin } from "rxjs";

interface ResourceRow {
  option: ResourceOption;
  selected: boolean;
  quantity: number;
}

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reservation-form.html',
  styleUrl: './reservation-form.scss',
})
export class ReservationFormComponent implements OnInit {

  private readonly fb = inject(FormBuilder);

  readonly spaceTypeLabels = SPACE_TYPE_LABELS

  readonly spaces = signal<SpaceOption[]>([]);
  readonly resourceRows = signal<ResourceRow[]>([]);
  // Guarda la disponibilidad real de cada recurso para el horario seleccionado.
  readonly resourceAvailability = signal<ResourceAvailability[]>([]);
  readonly isLoadingOptions = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly canCreateForOthers = computed(() =>
    this.authService.hasRole('Coordinator', 'Vicerrector', 'Bienes', 'Admin')
  );
  readonly candidates = signal<UserSummaryResponse[]>([]);
  readonly isEditMode = signal(false);
  private editingId: string | null = null;

  readonly resourcesOnly = signal(false);
  readonly wantsResources = signal(false);
  readonly showResourcesSection = computed(() => this.resourcesOnly() || this.wantsResources());

  readonly form = this.fb.group({
    spaceId: [''],
    date: ['', [Validators.required]],
    startTime: ['', [Validators.required]],
    endTime: ['', [Validators.required]],
    reason: ['', [Validators.required, Validators.minLength(10)]],
    onBehalfOfUserId: [''],
  })

  hasSelectionError(): boolean {
    const hasSpace = !!this.form.controls.spaceId.value;
    const hasResources = this.resourceRows().some((r) => r.selected);
    return !hasSpace && !hasResources;
  }

  constructor(
    private optionsService: OptionsService,
    private reservationsService: ReservationService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.editingId = this.route.snapshot.paramMap.get('id');
    this.isEditMode.set(!!this.editingId);
    this.resourcesOnly.set(this.route.snapshot.data['resourcesOnly'] === true);
    this.loadCandidates();

    this.isLoadingOptions.set(true);

    this.optionsService.getAvailableSpaces().subscribe({
      next: (spaces) => this.spaces.set(spaces),
      error: () => this.errorMessage.set('No se pudieron cargar los espacios disponibles.'),
    });

    this.optionsService.getAvailableResources().subscribe({
      next: (resources) => {
        this.resourceRows.set(
          resources.map((option) => ({ option, selected: false, quantity: 1 }))
        );
        this.isLoadingOptions.set(false);

        if (this.editingId) {
          this.loadExisting(this.editingId);
        }
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los recursos disponibles.');
        this.isLoadingOptions.set(false);
      },
    });

  }

  private loadExisting(id: string): void {
    this.reservationsService.getById(id).subscribe({
      next: (detail) => {
        this.form.patchValue({
          spaceId: detail.spaceId ?? '',
          date: detail.date.slice(0, 10),
          startTime: detail.startTime.slice(0, 5), // "18:00:00" -> "18:00"
          endTime: detail.endTime.slice(0, 5),
          reason: detail.reason,
        });

        if (!detail.spaceId) {
          this.resourcesOnly.set(true);
        }

        this.resourceRows.update((rows) =>
          rows.map((row) => {
            const match = detail.resources.find((r) => r.resourceName === row.option.name);
            return match ? { ...row, selected: true, quantity: match.quantity } : row;
          })
        );
      },
      error: () => this.errorMessage.set('no se pudo cargar la reserva a editar.'),
    })
  }


  toggleResource(row: ResourceRow): void {
    this.resourceRows.update((rows) =>
      rows.map((r) => (r === row ? { ...r, selected: !r.selected } : r))
    );
  }

  updateQuantity(row: ResourceRow, value: string): void {
    const quantity = Math.max(1, parseInt(value, 10) || 1);
    this.resourceRows.update((rows) =>
      rows.map((r) => (r === row ? { ...r, quantity } : r))
    );
  }

  // Consulta al backend la disponibilidad de recursos para la fecha y horario elegidos.
  checkResourceAvailability(): void {
    const date = this.form.controls.date.value;
    const startTime = this.form.controls.startTime.value;
    const endTime = this.form.controls.endTime.value;

    if (!date || !startTime || !endTime) {
      this.resourceAvailability.set([]);
      return;
    }

    this.reservationsService
      .getResourceAvailability(date, `${startTime}:00`, `${endTime}:00`)
      .subscribe({
        next: (availability) => {
          this.resourceAvailability.set(availability);
        },
        error: () => {
          this.resourceAvailability.set([]);
        },
      });
  }

  // Obtiene la cantidad disponible del recurso según el horario seleccionado
  getResourceAvailable(resourceId: string, fallback: number): number {
    return this.resourceAvailability()
      .find((r) => r.resourceId === resourceId)
      ?.available ?? fallback;
  }

  private translateReservationError(message: string): string {
    const translations: Record<string, string> = {
      'The space is already reserved for that time slot.':
        'El espacio seleccionado ya está reservado para ese horario.',

      'The space is inactive and cannot be reserved.':
        'El espacio seleccionado está inactivo y no puede reservarse.',

      'The resource is inactive and cannot be reserved.':
        'El recurso seleccionado está inactivo y no puede reservarse.',

      'The reservation must include at least one Space or Resource.':
        'Debes seleccionar al menos un espacio o un recurso.',
    };

    return translations[message] ?? message;
  }

  save(shouldSubmit: boolean): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.hasSelectionError()) {
      this.errorMessage.set('Selecciona un espacio, al menos un recurso, o ambos.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();

    const request: CreateReservationRequest = {
      date: `${raw.date}T00:00:00`,
      startTime: `${raw.startTime}:00`,
      endTime: `${raw.endTime}:00`,
      reason: raw.reason!,
      spaceId: raw.spaceId || null,
      onBehalfOfUserId: raw.onBehalfOfUserId || null,
      resources: this.resourceRows()
        .filter((r) => r.selected)
        .map((r) => ({ resourceId: r.option.id, quantity: r.quantity })),
    };

    const write$ = this.isEditMode()
      ? this.reservationsService.edit(this.editingId!, request)
      : this.reservationsService.create(request);

    write$.subscribe({
      next: (saved) => {
        if (!shouldSubmit) {
          this.router.navigate(['/reservations']);
          return;
        }

        this.reservationsService.submit(saved.id, raw.reason!).subscribe({
          next: () => this.router.navigate(['/reservations']),
          error: (err) => {
            this.isSubmitting.set(false);

            const backendMessage = err?.error?.description;

            this.errorMessage.set(
              backendMessage
                ? this.translateReservationError(backendMessage)
                : 'La reserva se guardó como borrador, pero no se envió. Intenta enviar desde Mis Solicitudes.'
            );
          },
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);

        const backendMessage = err?.error?.description;

        this.errorMessage.set(
          backendMessage
            ? this.translateReservationError(backendMessage)
            : (this.isEditMode()
              ? 'No se pudo guardar la edición.'
              : 'No se pudo crear la reserva. Verifica los datos.')
        );
      },
    });
  }

  private loadCandidates(): void {
    if (!this.canCreateForOthers()) return;

    this.userService.ensureMeLoaded().subscribe((me) => {
      // Coordinator: solo Student/Teacher de SU carrera (regla del backend).
      if (this.authService.hasRole('Coordinator')) {
        if (!me.careerId) return;

        forkJoin([
          this.userService.search('Student', me.careerId),
          this.userService.search('Teacher', me.careerId),
        ]).subscribe(([students, teachers]) => {
          this.candidates.set([...students, ...teachers]);
        });
        return;
      }

      // Vicerrector, Bienes y Admin: sin restricción de a quién. Se excluye
      // al propio usuario porque "Para mí" ya es la primera opción del select.
      this.userService.search().subscribe((users) => {
        this.candidates.set(users.filter((u) => u.id !== me.id));
      });
    });
  }
}