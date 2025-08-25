import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  //criar um behavior subject
  showLoader$ = new Subject<boolean>()
  _showLoader = this.showLoader$.asObservable()

  showLoader(value: boolean) {
    this.showLoader$.next(value)
  }
}
