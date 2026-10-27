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
import { apiErrorMessage } from "../../utils/api-error";

interface ResourceRow {
  option: ResourceOption;
  selected: boolean;
  quantity: number;
}

const MAX_DURATION_MINUTES = 120;
const RESOURCE_IMAGE_EXTS = ['jpg', 'png', 'webp', 'jpeg'];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
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
  readonly candidatesError = signal<string | null>(null);
  readonly canCreateForOthers = computed(() =>
    this.authService.hasRole('Coordinator', 'Bienes', 'Admin')
  );
  readonly candidates = signal<UserSummaryResponse[]>([]);
  readonly isEditMode = signal(false);
  private editingId: string | null = null;

  readonly resourcesOnly = signal(false);
  readonly wantsResources = signal(false);

  readonly minDate = this.getTodayDate();
  private getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  readonly showResourcesSection = computed(() => this.resourcesOnly() || this.wantsResources());

  // ===== Buscador de espacios =====
  readonly spaceSearch = signal('');
  readonly spaceOpen = signal(false);
  readonly activeIndex = signal(0);

  // ===== Buscador de personas (para quién es la reserva) =====
  private readonly roleEs: Record<string, string> = {
    Student: 'Estudiante', Teacher: 'Docente', Coordinator: 'Coordinador',
    Vicerrector: 'Vicerrector', Bienes: 'Bienes', Admin: 'Administrador',
  };

  readonly personSearch = signal('');
  readonly personOpen = signal(false);
  readonly personActive = signal(0);
  readonly personRole = signal<string>('all');

  // Campos extra opcionales: ajusta los nombres a los de tu UserSummaryResponse.
  private personMeta(c: UserSummaryResponse): { email: string; doc: string; career: string } {
    const u = c as UserSummaryResponse & { email?: string; identification?: string; careerName?: string };
    return { email: u.email ?? '', doc: u.identification ?? '', career: u.careerName ?? '' };
  }

  // Pestañas de rol: solo si hay más de un rol en la lista.
  readonly personRoleTabs = computed(() => {
    const roles = [...new Set(this.candidates().map((c) => c.role))];
    if (roles.length < 2) return [];
    return [
      { value: 'all', label: 'Todos' },
      ...roles.map((r) => ({ value: r, label: this.rolePlural[r] ?? r })),
    ];
  });

  private readonly rolePlural: Record<string, string> = {
    Student: 'Estudiantes',
    Teacher: 'Docentes',
    Coordinator: 'Coordinadores',
    Vicerrector: 'Vicerrectores',
    Bienes: 'Bienes',
    Admin: 'Administradores',
  };

  readonly personOptions = computed(() => {
    const q = this.normalize(this.personSearch());
    const role = this.personRole();
    const list = this.candidates()
      .filter((c) => role === 'all' || c.role === role)
      .filter((c) => {
        if (!q) return true;
        const m = this.personMeta(c);
        return this.normalize(`${c.name} ${m.email} ${m.doc}`).includes(q);
      })
      .map((c) => {
        const m = this.personMeta(c);
        return {
          id: c.id,
          name: c.name,
          sub: [m.email, m.doc, m.career].filter(Boolean).join(' · '),
          role: this.roleEs[c.role] ?? c.role,
        };
      });

    return q || role !== 'all'
      ? list
      : [{ id: '', name: 'Para mí', sub: 'La reserva quedará a tu nombre', role: '' }, ...list];
  });

  selectedPersonLabel(): string {
    const id = this.form.controls.onBehalfOfUserId.value;
    if (!id) return 'Para mí';
    const c = this.candidates().find((x) => x.id === id);
    return c ? `${c.name} — ${this.roleEs[c.role] ?? c.role}` : 'Para mí';
  }

  openPeople(): void {
    this.personSearch.set('');
    this.personActive.set(0);
    this.personOpen.set(true);
  }
  closePeople(): void { this.personOpen.set(false); }

  onPersonSearch(value: string): void {
    this.personSearch.set(value);
    this.personActive.set(0);
    this.personOpen.set(true);
  }

  setPersonRole(value: string): void {
    this.personRole.set(value);
    this.personActive.set(0);
  }

  selectPerson(id: string): void {
    this.form.controls.onBehalfOfUserId.setValue(id);
    this.personOpen.set(false);
  }

  onPersonKeydown(event: KeyboardEvent): void {
    const options = this.personOptions();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.personOpen.set(true);
      this.personActive.set(Math.min(this.personActive() + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.personActive.set(Math.max(this.personActive() - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const opt = options[this.personActive()];
      if (opt) this.selectPerson(opt.id);
    } else if (event.key === 'Escape') {
      this.personOpen.set(false);
    }
  }

  private normalize(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  readonly spaceOptions = computed(() => {
    const q = this.normalize(this.spaceSearch());
    const filtered = this.spaces()
      .filter((s) => !q || this.normalize(`${s.name} ${SPACE_TYPE_LABELS[s.type]}`).includes(q))
      .map((s) => ({
        id: s.id,
        name: s.name,
        meta: `${SPACE_TYPE_LABELS[s.type]} · cap. ${s.capacity}`,
      }));

    return q ? filtered : [{ id: '', name: 'Sin espacio, solo recursos', meta: '' }, ...filtered];
  });

  selectedSpaceLabel(): string {
    const id = this.form.controls.spaceId.value;
    if (!id) return 'Sin espacio, solo recursos';
    return this.spaces().find((s) => s.id === id)?.name ?? '';
  }

  openSpaces(): void {
    this.spaceSearch.set('');
    this.activeIndex.set(0);
    this.spaceOpen.set(true);
  }

  closeSpaces(): void {
    this.spaceOpen.set(false);
    this.form.controls.spaceId.markAsTouched();
  }

  onSpaceSearch(value: string): void {
    this.spaceSearch.set(value);
    this.activeIndex.set(0);
    this.spaceOpen.set(true);
  }

  selectSpace(id: string): void {
    this.form.controls.spaceId.setValue(id);
    this.form.controls.spaceId.markAsTouched();
    this.spaceOpen.set(false);
  }

  onSpaceKeydown(event: KeyboardEvent): void {
    const options = this.spaceOptions();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.spaceOpen.set(true);
      this.activeIndex.set(Math.min(this.activeIndex() + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const opt = options[this.activeIndex()];
      if (opt) this.selectSpace(opt.id);
    } else if (event.key === 'Escape') {
      this.spaceOpen.set(false);
    }
  }

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

  scheduleError(): string | null {
    const { startTime, endTime } = this.form.getRawValue();
    if (!startTime || !endTime) return null;

    const duration = toMinutes(endTime) - toMinutes(startTime);

    if (duration <= 0) return 'La hora fin debe ser mayor que la hora inicio.';
    if (duration > MAX_DURATION_MINUTES) return 'La reserva no puede durar más de 2 horas.';
    return null;
  }

  // "Reservar espacios" exige espacio; "Reservar recursos" (resourcesOnly) no.
  // Se vuelve a aplicar al cargar un borrador, porque loadExisting() puede
  // cambiar resourcesOnly según si ese borrador tenía espacio o no.
  private applySpaceRequirement(): void {
    const ctrl = this.form.controls.spaceId;
    if (this.resourcesOnly()) {
      ctrl.clearValidators();
    } else {
      ctrl.setValidators([Validators.required]);
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
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
    this.applySpaceRequirement();
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
          startTime: detail.startTime.slice(0, 5),
          endTime: detail.endTime.slice(0, 5),
          reason: detail.reason,
        });

        if (!detail.spaceId) {
          this.resourcesOnly.set(true);
        }
        this.applySpaceRequirement();

        this.resourceRows.update((rows) =>
          rows.map((row) => {
            const match = detail.resources.find(
              (r) => r.resourceName === row.option.name
            );

            return match
              ? { ...row, selected: true, quantity: match.quantity }
              : { ...row, selected: false, quantity: 1 };
          })
        );

        // Si el borrador tiene recursos, mostrar la sección automáticamente.
        const hasResources = detail.resources.length > 0;
        this.wantsResources.set(hasResources);

        // Actualizar la disponibilidad para la fecha y horario cargados.
        this.checkResourceAvailability();
      },
      error: (err) =>
        this.errorMessage.set(apiErrorMessage(err, 'No se pudo cargar la reserva a editar.')),

    });
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

    if (!date || !startTime || !endTime || this.scheduleError()) {
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
    const selectedDate = this.form.controls.date.value;

    if (selectedDate && selectedDate < this.minDate) {
      this.errorMessage.set('No puedes reservar en una fecha que ya pasó.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.scheduleError()) {
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
    this.candidatesError.set(null);

    // Un solo manejador para las tres peticiones: muestra el `description` del backend
    // y, si no hay, un texto de respaldo.
    const onError = (err: unknown) =>
      this.candidatesError.set(
        apiErrorMessage(err, 'No se pudo cargar la lista de usuarios. Aun así puedes reservar para ti.')
      );

    this.userService.getMe().subscribe({
      next: (me) => {
        // Coordinator: solo Student/Teacher de SU carrera (regla del backend).
        if (this.authService.hasRole('Coordinator')) {
          if (!me.careerId) {
            this.candidatesError.set(
              'Tu usuario no tiene una carrera asignada, por eso no se puede listar a quién reservar.'
            );
            return;
          }

          forkJoin([
            this.userService.search('Student', me.careerId),
            this.userService.search('Teacher', me.careerId),
          ]).subscribe({
            next: ([students, teachers]) => this.candidates.set([...students, ...teachers]),
            error: onError,
          });
          return;
        }

        // Bienes y Admin: sin restricción de a quién. Se excluye
        // al propio usuario porque "Para mí" ya es la primera opción del select.
        this.userService.search().subscribe({
          next: (users) => this.candidates.set(users.filter((u) => u.id !== me.id)),
          error: onError,
        });
      },
      error: onError,
    });
  }

  //Convierte el nombre del recurso en nombre de archivo (minúsculas, sin tildes, espacios a guiones)
  private resourceSlug(name: string): string {
    return name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Arma la ruta de la imagen usando ese nombre
  resourceImage(name: string): string {
    return `/${this.resourceSlug(name)}.${RESOURCE_IMAGE_EXTS[0]}`;
  }

  // verifica la ruta
  onImageError(event: Event, name: string): void {
    const img = event.target as HTMLImageElement;
    const tried = Number(img.dataset['try'] ?? 0) + 1;

    if (tried < RESOURCE_IMAGE_EXTS.length) {
      img.dataset['try'] = String(tried);
      img.src = `/${this.resourceSlug(name)}.${RESOURCE_IMAGE_EXTS[tried]}`;
    } else {
      img.style.display = 'none';
    }
  }
}