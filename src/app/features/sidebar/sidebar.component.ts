import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Item } from '../../api.service';
import { NavigationItem, navigation } from '../../navigation';

export interface SidebarNavigationRequest {
  section: string;
  scope: Item | null;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  readonly user = input.required<Item>();
  readonly section = input.required<string>();
  readonly scope = input<Item | null>(null);
  readonly organizations = input<Item[]>([]);
  readonly openCount = input<number>(0);
  readonly mobileOpen = input<boolean>(false);

  readonly navigate = output<SidebarNavigationRequest>();
  readonly createOrganization = output<void>();
  readonly logout = output<void>();
  readonly closeMobile = output<void>();

  readonly navigation = navigation;
  readonly userDisplayName = computed(() => String(this.user()['displayName'] ?? ''));
  readonly userInitial = computed(() => this.userDisplayName().slice(0, 1));

  isActive(item: NavigationItem): boolean {
    return this.section() === item.section && !this.scope();
  }

  navigateTo(section: string, scope: Item | null = null): void {
    this.navigate.emit({ section, scope });
  }

  selectOrganization(org: Item): void {
    this.navigateTo('Estrutura', { id: org.id, kind: 'organization', name: org.name });
  }
}
