import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../users/user.service';
import { longDateEs } from '../utils/dashboard-utils';

@Component({
  selector: 'app-dashboard-greeting',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-greeting.html',
  styleUrl: './dashboard-greeting.scss',
})
export class DashboardGreetingComponent implements OnInit {
  private readonly userService = inject(UserService);

  // Nombre completo que llega de /users/me. Es local: no usamos el caché de
  // UserService porque logout() no lo limpia (otro usuario vería el nombre anterior).
  private readonly fullName = signal('');

  // Solo la primera palabra: "Dilan Pérez" → "Dilan". Si aún no cargó, queda ''.
  readonly firstName = computed(() => this.fullName().trim().split(/\s+/)[0] ?? '');

  // Se calcula una vez al crear el componente (fecha real de hoy, hora local).
  readonly today = longDateEs(new Date());

  ngOnInit(): void {
    this.userService.getMe().subscribe({
      next: (me) => this.fullName.set(me.name),
      error: () => { /* sin nombre: el saludo queda en "Hola", no es crítico */ },
    });
  }
}