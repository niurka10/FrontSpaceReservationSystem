import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { SlidebarComponent } from "../sidebar/sidebar.component";
import { NotificationBellComponent } from "../../features/notifications/components/notification-bell";

@Component({
    selector: 'app-shell',
    standalone: true,
    imports: [
        RouterOutlet,
        SlidebarComponent,
        NotificationBellComponent
    ],
    templateUrl: './shell.component.html',
    styleUrl: './shell.component.scss'
})
export class ShellComponent {}