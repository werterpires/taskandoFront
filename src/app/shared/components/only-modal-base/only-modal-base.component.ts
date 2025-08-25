import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-only-modal-base',
  imports: [],
  templateUrl: './only-modal-base.component.html',
  styleUrl: './only-modal-base.component.css'
})
export class OnlyModalBaseComponent {
  @Input() title = ''
}
