import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BreakingNews } from './breaking-news';

describe('BreakingNews', () => {
  let component: BreakingNews;
  let fixture: ComponentFixture<BreakingNews>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreakingNews]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BreakingNews);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
