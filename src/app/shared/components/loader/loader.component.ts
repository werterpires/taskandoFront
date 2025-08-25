import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { LoaderService } from './loader.service'

@Component({
  selector: 'app-loader',
  imports: [CommonModule],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.css'
})
export class LoaderComponent {
  showLoader: boolean = false

  constructor(private readonly loaderService: LoaderService) {
    this.loaderService.showLoader$.subscribe((value) => {
      this.showLoader = value
    })
  }
}
