import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'
import { Message } from './types'

@Injectable({
  providedIn: 'root'
})
export class MessagesService {
  showSubsject: Subject<Message> = new Subject<Message>()
  show$ = this.showSubsject.asObservable()

  initialMessage: Message = {
    type: 'info',
    title: '',
    description: [],
    show: false
  }

  timeToClose: number = 30
  private closeTimeoutId: any = null

  closeInXSeconds() {
    this.clearCloseTimeout()
    this.closeTimeoutId = setTimeout(() => {
      this.hide()
    }, this.timeToClose * 1000)
  }
  show(alert: Message) {
    this.showSubsject.next(alert)
    this.closeInXSeconds()
  }

  hide() {
    this.clearCloseTimeout()
    this.showSubsject.next(this.initialMessage)
  }

  private clearCloseTimeout() {
    if (this.closeTimeoutId) {
      clearTimeout(this.closeTimeoutId)
      this.closeTimeoutId = null
    }
  }
}
