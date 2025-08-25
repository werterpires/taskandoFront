import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatingFormComponent } from './creating-form.component';

describe('CreatingFormComponent', () => {
  let component: CreatingFormComponent;
  let fixture: ComponentFixture<CreatingFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatingFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatingFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
