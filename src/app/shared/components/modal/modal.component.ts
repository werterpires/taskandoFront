import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
import { ModalManagerService } from '../../services/modal-manager.service';

@Component({
  selector: 'app-modal',
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
})
export class ModalComponent implements OnInit, OnDestroy {
  @Input() zIndex = 0;
  @Output() closeEmitter = new EventEmitter<void>();

  dynamicZIndex = 0;

  constructor(private modalManager: ModalManagerService) {}

  ngOnInit() {
    this.dynamicZIndex = this.modalManager.openModal();
  }

  ngOnDestroy() {
    this.modalManager.closeModal();
  }

  close() {
    this.closeEmitter.emit();
  }
}
