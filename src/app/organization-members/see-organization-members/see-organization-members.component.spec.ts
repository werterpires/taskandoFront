import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeeOrganizationMembersComponent } from './see-organization-members.component';

describe('SeeOrganizationMembersComponent', () => {
  let component: SeeOrganizationMembersComponent;
  let fixture: ComponentFixture<SeeOrganizationMembersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeeOrganizationMembersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeeOrganizationMembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
