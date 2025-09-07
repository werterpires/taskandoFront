import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateOrganizationMemberComponent } from './create-organization-member.component';

describe('CreateOrganizationMemberComponent', () => {
  let component: CreateOrganizationMemberComponent;
  let fixture: ComponentFixture<CreateOrganizationMemberComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateOrganizationMemberComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateOrganizationMemberComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
