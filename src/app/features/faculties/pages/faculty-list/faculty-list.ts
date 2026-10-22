import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FacultyService } from '../../services/faculty.service';
import { Faculty } from '../../models/faculty.interface';

@Component({
  selector: 'app-faculty-list',
  imports: [RouterLink],
  templateUrl: './faculty-list.html',
  styleUrl: './faculty-list.scss',
})
export class FacultyList implements OnInit {

  private facultyService = inject(FacultyService);

  faculties = signal<Faculty[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.facultyService.getAll().subscribe({
      next: (data) => {
        this.faculties.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('No se pudieron cargar las facultades.');
        this.loading.set(false);
      }
    });
  }

  //Filtro 
  search = signal('');
  filterOpen = signal(false);

  filteredFaculties = computed(() => {
    const term = this.normalize(this.search());

    return this.faculties()
      .filter((f) => this.normalize(f.name).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });
  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  toggleFilter(): void {
    this.filterOpen.update((v) => !v);
    if (this.filterOpen()) {
      setTimeout(() => document.getElementById('faculty-filter-input')?.focus());
    }
  }

  clearFilter(): void {
    this.search.set('');
  }
}