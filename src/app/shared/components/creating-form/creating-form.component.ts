import {
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  Output,
  QueryList,
} from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { CustomInputComponent } from '../custom-input/custom-input.component';

@Component({
  selector: 'app-creating-form',
  imports: [ModalComponent],
  templateUrl: './creating-form.component.html',
  styleUrl: './creating-form.component.css',
})
export class CreatingFormComponent {
  @Output() closeEmitter: EventEmitter<void> = new EventEmitter();
  @Output() actionEmitter: EventEmitter<void> = new EventEmitter();
  @Input() title: string = 'Novo';

  @ContentChildren(CustomInputComponent, { descendants: true })
  inputs!: QueryList<CustomInputComponent>;

  cancel() {
    this.closeEmitter.emit();
  }

  action() {
    if (!this.validateForm) {
      return;
    }
    this.actionEmitter.emit();
  }

  validateForm(): boolean {
    let isValid = true;
    this.inputs.forEach((input) => {
      input.validate();
      if (input.errorMessages.length > 0) {
        isValid = false;
      }
    });
    return isValid;
  }
}
