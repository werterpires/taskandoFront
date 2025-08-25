import { CommonModule } from '@angular/common'
import { ChangeDetectorRef, Component } from '@angular/core'
import { Message } from './types'
import { MessagesService } from './messages.service'

@Component({
  selector: 'app-messages',
  imports: [CommonModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css'
})
export class MessagesComponent {
  message: Message = {
    type: 'info',
    title: '',
    description: ['', ''],
    show: false
  }

  constructor(
    private readonly messagesService: MessagesService,
    private cdr: ChangeDetectorRef
  ) {
    this.messagesService.show$.subscribe((message: Message) => {
      this.message = message
      this.cdr.detectChanges()
    })
  }

  hide() {
    this.messagesService.hide()
  }
}
