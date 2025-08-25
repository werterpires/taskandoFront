import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeeOrganizationComponent } from './see-organization.component';

describe('SeeOrganizationComponent', () => {
  let component: SeeOrganizationComponent;
  let fixture: ComponentFixture<SeeOrganizationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeeOrganizationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeeOrganizationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
