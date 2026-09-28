import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Route, Router, RouterLink, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ResourceOption, SPACE_TYPE_LABELS, SpaceOption, CreateReservationRequest } from "../../models/reservation.interface";
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
  readonly isLoadingOptions = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly canCreateForOthers = computed(() =>
    this.authService.hasRole('Coordinator', 'Vicerrector', 'Bienes', 'Admin')
  );
  readonly candidates = signal<UserSummaryResponse[]>([]);

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
    private router: Router
  ) { }

  ngOnInit(): void {
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
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los recursos disponibles.');
        this.isLoadingOptions.set(false);
      },
    });

    if (this.canCreateForOthers()) {
      this.loadCandidates();
    }
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

    this.reservationsService.create(request).subscribe({
      next: (created) => {
        //guardar borrador
        if (!shouldSubmit) {
          this.router.navigate(['/reservations']);
          return;
        }

        this.reservationsService.submit(created.id, raw.reason!).subscribe({
          next: () => this.router.navigate(['/reservations']),
          error: (err) => {
            this.isSubmitting.set(false);
            this.errorMessage.set(
              err?.error?.description ?? 'La reserva se guardo como borrador, pero no se envio. Intenta enviar desde Mis Solicitudes'
            );
          },
        })
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err?.error?.description ?? 'No se pudo crear la reserva. Verifica los datos'
        )
      }
    })
  }


  private loadCandidates(): void {
    if (!this.authService.hasRole('Coordinator')) return; // TODO: Vicerrector/Bienes/Admin, otro chat

    this.userService.ensureMeLoaded().subscribe((me) => {
      if (!me.careerId) return;

      forkJoin([
        this.userService.search('Student', me.careerId),
        this.userService.search('Teacher', me.careerId),
      ]).subscribe(([students, teachers]) => {
        this.candidates.set([...students, ...teachers]);
      });
    });
  }
}