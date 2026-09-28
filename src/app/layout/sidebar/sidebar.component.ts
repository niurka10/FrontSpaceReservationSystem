import { Component, computed } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { email } from "@angular/forms/signals";
import { NAV_ITEMS } from "./nav-items";

@Component({
    selector: 'app-slidebar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss'
})

export class SlidebarComponent {

    constructor(public authService : AuthService){}


    private readonly visiblePaths = computed<Set<string>>(() => {
        const role = this.authService.role();
        if (!role) return new Set();

        const paths = new Set<string>();

        for (const item of NAV_ITEMS) {
            if (!item.roles.includes(role)) continue;

            if (item.path) paths.add(item.path);

            for (const child of item.children ?? []) {
                if (child.roles.includes(role) && child.path){
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


    initials(email: string | undefined) : string {
        if (!email) return '?';
        
        return email.slice(0, 2).toUpperCase();
    }
}