import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Career } from '../../careers/models/career.interface';
import { CareerService } from '../../careers/services/career.service';
import { RESERVATION_STATUS_LABELS, ReservationStatus, SpaceOption, ResourceOption } from '../../reservations/models/reservation.interface';
import { OptionsService } from '../../reservations/services/options.service';
import { UserListItem } from '../../users/models/user-summary.model';
import { UserService } from '../../users/user.service';
import { ADMIN_ALL_TYPE, ReportType, ReportPreview, ReportFilters } from '../models/report.model';
import { ReportService } from '../services/report.service';
import { DatePipe } from '@angular/common';
import { apiErrorMessage, apiErrorMessageFromBlob } from '../../reservations/utils/api-error';





@Component({
    selector: 'app-report-page',
    standalone: true,
    imports: [ReactiveFormsModule, DatePipe],
    templateUrl: './report-page.html',
    styleUrl: './report-page.scss',
})
export class ReportPageComponent implements OnInit {
    private readonly fb = inject(FormBuilder);
    private readonly reportService = inject(ReportService);
    private readonly optionsService = inject(OptionsService);
    private readonly careerService = inject(CareerService);
    private readonly userService = inject(UserService);
    readonly isExporting = signal(false);
    readonly exportError = signal<string | null>(null);

    readonly statuses = (Object.keys(RESERVATION_STATUS_LABELS) as ReservationStatus[]).map(
        (code) => ({ code, label: RESERVATION_STATUS_LABELS[code] })
    );

    readonly form = this.fb.nonNullable.group({
        type: '',
        from: '',
        to: '',
        status: '',
        spaceId: '',
        resourceId: '',
        userId: '',
        careerId: '',
    });

    private readonly selectedType = toSignal(this.form.controls.type.valueChanges, {
        initialValue: this.form.controls.type.value,
    });
    readonly isAdminAll = computed(() => this.selectedType() === ADMIN_ALL_TYPE);

    // ---------- catálogos ----------
    readonly types = signal<ReportType[]>([]);
    readonly typesLoading = signal(true);
    readonly typesError = signal<string | null>(null);
    readonly spaces = signal<SpaceOption[]>([]);
    readonly resources = signal<ResourceOption[]>([]);
    readonly careers = signal<Career[]>([]);
    readonly users = signal<{ id: string; label: string }[]>([]);
    readonly listsError = signal<string | null>(null);
    private adminListsLoaded = false;

    // ---------- vista previa ----------
    readonly isLoading = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly result = signal<ReportPreview | null>(null);

    constructor() {
        this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
            this.exportError.set(null);
            this.result.set(null);
            this.errorMessage.set(null);
            if (type === ADMIN_ALL_TYPE) this.loadAdminLists();
            else this.form.patchValue({ userId: '', careerId: '' });
        });
    }

    ngOnInit(): void {
        this.reportService.getTypes().subscribe({
            next: (types) => {
                this.types.set(types);
                this.typesLoading.set(false);
                if (types.length === 1) this.form.controls.type.setValue(types[0].code);
            },
            error: (err) => {
                this.typesError.set(apiErrorMessage(err, 'No se pudieron cargar los tipos de reporte.'));
                this.typesLoading.set(false);
            },
        });

        this.optionsService.getAvailableSpaces().subscribe({
            next: (rows) => this.spaces.set(rows),
            error: () => this.listsError.set('No se pudieron cargar todos los filtros.'),
        });
        this.optionsService.getAvailableResources().subscribe({
            next: (rows) => this.resources.set(rows),
            error: () => this.listsError.set('No se pudieron cargar todos los filtros.'),
        });
    }

    private loadAdminLists(): void {
        if (this.adminListsLoaded) return;
        this.adminListsLoaded = true;

        this.careerService.getAll().subscribe({
            next: (rows) => this.careers.set(rows),
            error: () => this.listsError.set('No se pudieron cargar todos los filtros.'),
        });
        this.userService.listForAdmin().subscribe({
            next: (rows: UserListItem[]) =>
                this.users.set(
                    rows
                        .map((u) => ({ id: u.id, label: `${u.name} ${u.lastName} (${u.email})` }))
                        .sort((a, b) => a.label.localeCompare(b.label))
                ),
            error: () => this.listsError.set('No se pudieron cargar todos los filtros.'),
        });
    }

    rangeError(): string | null {
        const { from, to } = this.form.getRawValue();
        return from && to && from > to ? 'La fecha inicial no puede ser mayor que la final.' : null;
    }

    formatDay(iso: string): string {
        const [y, m, d] = iso.slice(0, 10).split('-');
        return `${d}/${m}/${y}`;
    }

    buildFilters(): ReportFilters {
        const { from, to, status, spaceId, resourceId, userId, careerId } = this.form.getRawValue();
        return {
            from, to, status, spaceId, resourceId,
            ...(this.isAdminAll() ? { userId, careerId } : {}),
        };
    }

    generate(): void {
        const type = this.form.controls.type.value;
        if (!type || this.rangeError()) return;

        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.exportError.set(null);

        this.reportService.preview(type, this.buildFilters()).subscribe({
            next: (preview) => {
                this.result.set(preview);
                this.isLoading.set(false);
            },
            error: (err) => {
                this.result.set(null);
                this.errorMessage.set(apiErrorMessage(err, 'No se pudo generar la vista previa.'));
                this.isLoading.set(false);
            },
        });
    }

      // Descarga el .xlsx con los MISMOS filtros que la vista previa (incluye todas las filas).
  exportExcel(): void {
    const type = this.form.controls.type.value;
    if (!type || this.rangeError() || this.isExporting()) return;

    this.isExporting.set(true);
    this.exportError.set(null);

    this.reportService.export(type, this.buildFilters()).subscribe({
      next: (file) => {
        this.reportService.save(file);
        this.isExporting.set(false);
      },
      // El cuerpo del error llega como Blob: se lee para recuperar el `description`.
      error: async (err) => {
        this.exportError.set(await apiErrorMessageFromBlob(err, 'No se pudo exportar el reporte.'));
        this.isExporting.set(false);
      },
    });
  }
}