import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SpaceService } from '../../services/space.service';
import { Space } from '../../models/space.interface';
import { AuthService } from '../../../../core/auth/auth.service';

type StatusFilter = 'active' | 'inactive' | 'all';
type SortKey = 'name' | 'type' | 'capacity' | 'location';

@Component({
  selector: 'app-space-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './space-list.html',
  styleUrl: './space-list.scss'
})
export class SpaceListComponent implements OnInit {
  private spaceService = inject(SpaceService);
  private authService = inject(AuthService);

  readonly types = [
    { value: 1, label: 'Aula' },
    { value: 2, label: 'Laboratorio' },
    { value: 3, label: 'Auditorio' },
    { value: 4, label: 'Cafetería' },
    { value: 5, label: 'Otro' }
  ];

  spaces = signal<Space[]>([]);
  loading = signal(true);
  error = signal('');

  // Estado de la interfaz
  statusFilter = signal<StatusFilter>('active');
  search = signal('');
  typeFilter = signal(0); // 0 = todos
  sortKey = signal<SortKey>('name');
  sortDir = signal<'asc' | 'desc'>('asc');

  // Feedback visual
  busyId = signal<string | null>(null);
  highlightId = signal<string | null>(null);
  toast = signal<{ text: string; kind: 'ok' | 'err'; goTo?: StatusFilter } | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // Contadores de las tarjetas
  activeCount = computed(() => this.spaces().filter(s => s.isActive).length);
  inactiveCount = computed(() => this.spaces().filter(s => !s.isActive).length);
  totalCount = computed(() => this.spaces().length);

  // Lista final: filtro de estado + búsqueda + tipo + orden
  filtered = computed(() => {
    const status = this.statusFilter();
    const term = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    return this.spaces()
      .filter(s => status === 'all' || (status === 'active' ? s.isActive : !s.isActive))
      .filter(s => !type || s.type === type)
      .filter(s => !term ||
        s.name?.toLowerCase().includes(term) ||
        s.location?.toLowerCase().includes(term))
      .sort((a, b) => {
        const va = key === 'type' ? this.getSpaceType(a.type) : (a as any)[key];
        const vb = key === 'type' ? this.getSpaceType(b.type) : (b as any)[key];
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va ?? '').localeCompare(String(vb ?? ''), 'es') * dir;
      });
  });

  canManageSpaces(): boolean {
    return this.authService.hasRole('Admin');
  }

  ngOnInit(): void {
    this.loadSpaces();
  }

  loadSpaces(): void {
    this.loading.set(true);
    this.error.set('');
    this.spaceService.getAll().subscribe({
      next: (spaces) => { this.spaces.set(spaces); this.loading.set(false); },
      error: () => {
        this.error.set('No se pudieron cargar los espacios.');
        this.loading.set(false);
      }
    });
  }

  // ---------- Interfaz ----------
  setStatus(f: StatusFilter): void { this.statusFilter.set(f); }

  onSearch(e: Event): void {
    this.search.set((e.target as HTMLInputElement).value);
  }

  onTypeChange(e: Event): void {
    this.typeFilter.set(Number((e.target as HTMLSelectElement).value));
  }

  clearFilters(): void {
    this.search.set('');
    this.typeFilter.set(0);
  }

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey() !== key) return 'bi-arrow-down-up';
    return this.sortDir() === 'asc' ? 'bi-sort-up' : 'bi-sort-down';
  }

  getSpaceType(type: number): string {
    return this.types.find(t => t.value === type)?.label ?? 'Desconocido';
  }

  // ---------- Acciones ----------
  deactivate(space: Space): void {
    this.runAction(space.id, this.spaceService.deactivate(space.id), () => {
      this.patch(space.id, { isActive: false });
      this.flash(space.id);
      this.showToast(`"${space.name}" desactivado.`, 'ok', 'inactive');
    }, 'No se pudo desactivar el espacio.');
  }

  activate(space: Space): void {
    this.runAction(space.id, this.spaceService.activate(space.id), () => {
      this.patch(space.id, { isActive: true });
      this.flash(space.id);
      this.showToast(`"${space.name}" activado.`, 'ok', 'active');
    }, 'No se pudo activar el espacio.');
  }

  goToToast(): void {
    const t = this.toast();
    if (t?.goTo) this.statusFilter.set(t.goTo);
    this.toast.set(null);
  }

  // ---------- Utilidades ----------
  private runAction(id: string, obs: any, onOk: () => void, errMsg: string): void {
    this.busyId.set(id);
    obs.subscribe({
      next: () => { this.busyId.set(null); onOk(); },
      error: () => {
        this.busyId.set(null);
        this.showToast(errMsg, 'err');
      }
    });
  }

  private patch(id: string, changes: Partial<Space>): void {
    this.spaces.update(list => list.map(s => (s.id === id ? { ...s, ...changes } : s)));
  }

  private flash(id: string): void {
    this.highlightId.set(id);
    setTimeout(() => this.highlightId.set(null), 2200);
  }

  private showToast(text: string, kind: 'ok' | 'err', goTo?: StatusFilter): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ text, kind, goTo });
    this.toastTimer = setTimeout(() => this.toast.set(null), 5000);
  }
}