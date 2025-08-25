import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnlyModalBaseComponent } from './only-modal-base.component';

describe('OnlyModalBaseComponent', () => {
  let component: OnlyModalBaseComponent;
  let fixture: ComponentFixture<OnlyModalBaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnlyModalBaseComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OnlyModalBaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
