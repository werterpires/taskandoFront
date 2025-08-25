import { Component, EventEmitter, Input, Output } from '@angular/core'
import { ModalComponent } from '../modal/modal.component'

@Component({
  selector: 'app-creating-form',
  imports: [ModalComponent],
  templateUrl: './creating-form.component.html',
  styleUrl: './creating-form.component.css'
})
export class CreatingFormComponent {
  @Output() closeEmitter: EventEmitter<void> = new EventEmitter()
  @Output() actionEmitter: EventEmitter<void> = new EventEmitter()
  @Input() title: string = 'Novo'

  cancel() {
    this.closeEmitter.emit()
  }

  action() {
    this.actionEmitter.emit()
  }
}
