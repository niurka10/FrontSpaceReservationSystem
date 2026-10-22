import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { NAV_ITEMS } from "./nav-items";

@Component({
    selector: 'app-slidebar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
    host: { '[class.is-expanded]': 'expanded()' }
})

export class SlidebarComponent {

    constructor(public authService: AuthService) {
        // NUEVO: avisa cuando la ventana cruza el límite de 768px (rotar el celular,
        // cambiar el tamaño de la ventana). Al cruzarlo, el menú vuelve a estado cerrado.
        const onChange = (e: MediaQueryListEvent) => {
            this.isNarrow.set(e.matches);
            this.expanded.set(false);
        };
        this.narrowQuery.addEventListener('change', onChange);
        this.destroyRef.onDestroy(() => this.narrowQuery.removeEventListener('change', onChange));
    }
    private readonly roleLabels: Record<string, string> = {
        Student: 'Estudiante',
        Teacher: 'Docente',
        Coordinator: 'Coordinador',
        Vicerrector: 'Vicerrector',
        Bienes: 'Bienes',
        Admin: 'Administrador',
    };

    private readonly destroyRef = inject(DestroyRef);

    // NUEVO: ¿la pantalla es estrecha? (mismo límite que el @media del .scss)
    private readonly narrowQuery = window.matchMedia('(max-width: 767.98px)');
    readonly isNarrow = signal(this.narrowQuery.matches);

    // Única fuente de verdad del estado del menú (true = expandido en escritorio,
    // cajón abierto en pantallas estrechas).
    readonly expanded = signal(false);

    // NUEVO: cajón cerrado = oculto fuera de pantalla. Se usa para marcarlo "inert":
    // sin eso, Tab pasaría por links invisibles.
    readonly drawerClosed = computed(() => this.isNarrow() && !this.expanded());

    private readonly menuBtn = viewChild<ElementRef<HTMLButtonElement>>('menuBtn');
    private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

    // --- Escritorio: hover y foco de teclado. En pantallas estrechas se ignoran, porque
    // un toque en el celular dispara mouseenter/mouseleave "falsos" y abriría y cerraría
    // el cajón solo. ---
    open(): void {
        if (!this.isNarrow()) this.expanded.set(true);
    }

    // Al sacar el mouse se cierra, salvo que haya foco de TECLADO dentro.
    onMouseLeave(sidebar: HTMLElement): void {
        if (this.isNarrow()) return;
        if (!sidebar.querySelector(':focus-visible')) this.expanded.set(false);
    }

    // Solo se expande con foco de teclado (:focus-visible). Con :focus-within puro, un
    // clic con el mouse deja el foco dentro y el menú se quedaría abierto.
    onFocusIn(event: FocusEvent): void {
        if (this.isNarrow()) return;
        if ((event.target as HTMLElement).matches(':focus-visible')) this.expanded.set(true);
    }

    // Se cierra cuando el foco sale del sidebar, salvo que el mouse siga encima.
    onFocusOut(event: FocusEvent, sidebar: HTMLElement): void {
        if (this.isNarrow()) return;
        const next = event.relatedTarget as Node | null;
        const leftSidebar = !next || !sidebar.contains(next);
        if (leftSidebar && !sidebar.matches(':hover')) this.expanded.set(false);
    }

    // --- Pantallas estrechas: cajón con botón. ---
    openDrawer(): void {
        this.expanded.set(true);
        // setTimeout: se espera a que Angular quite el "inert" antes de mover el foco.
        setTimeout(() => this.closeBtn()?.nativeElement.focus());
    }

    closeDrawer(returnFocus = true): void {
        this.expanded.set(false);
        if (returnFocus) setTimeout(() => this.menuBtn()?.nativeElement.focus());
    }

    // Al elegir un link, el cajón se cierra (la navegación ya ocurre por routerLink).
    onNavClick(event: Event): void {
        if (this.isNarrow() && (event.target as HTMLElement).closest('a')) this.closeDrawer(false);
    }

    onEscape(): void {
        if (this.isNarrow() && this.expanded()) this.closeDrawer();
    }


    private readonly visiblePaths = computed<Set<string>>(() => {
        const role = this.authService.role();
        if (!role) return new Set();

        const paths = new Set<string>();

        for (const item of NAV_ITEMS) {
            if (!item.roles.includes(role)) continue;

            if (item.path) paths.add(item.path);

            for (const child of item.children ?? []) {
                if (child.roles.includes(role) && child.path) {
                    paths.add(child.path);
                }
            }
        }
        return paths;
    });

    canSee(...paths: string[]): boolean {
        const visible = this.visiblePaths();
        return paths.some((p) => visible.has(p))
    }


    initials(email: string | undefined): string {
        if (!email) return '?';

        return email.slice(0, 2).toUpperCase();
    }



    roleLabel(role: string | undefined): string {
        return role ? (this.roleLabels[role] ?? role) : '';
    }
}