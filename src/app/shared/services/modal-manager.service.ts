
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ModalManagerService {
  private baseZIndex = 1000;
  private currentLevel = 0;
  private modalStack: number[] = [];

  openModal(): number {
    this.currentLevel++;
    const zIndex = this.baseZIndex + (this.currentLevel * 100);
    this.modalStack.push(zIndex);
    return zIndex;
  }

  closeModal(): void {
    if (this.modalStack.length > 0) {
      this.modalStack.pop();
      this.currentLevel = Math.max(0, this.currentLevel - 1);
    }
  }

  getCurrentZIndex(): number {
    return this.modalStack[this.modalStack.length - 1] || this.baseZIndex;
  }

  getModalCount(): number {
    return this.modalStack.length;
  }

  reset(): void {
    this.modalStack = [];
    this.currentLevel = 0;
  }
}
