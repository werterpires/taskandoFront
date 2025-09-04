
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Organization } from '../types';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-see-organization',
  imports: [CommonModule, ModalComponent],
  templateUrl: './see-organization.component.html',
  styleUrl: './see-organization.component.css'
})
export class SeeOrganizationComponent {
  @Input() organization: Organization | null = null;
  @Output() closeEmitter = new EventEmitter<void>();

  close() {
    this.closeEmitter.emit();
  }
}
