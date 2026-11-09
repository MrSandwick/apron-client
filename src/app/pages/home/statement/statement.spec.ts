import { TestBed } from '@angular/core/testing';
import { HomeStatement } from './statement';

describe('HomeStatement', () => {
  it('renders the full statement as individual words', () => {
    const fixture = TestBed.createComponent(HomeStatement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-statement"]')).toBeTruthy();
    const words = el.querySelectorAll('[data-word]');
    expect(words.length).toBe(fixture.componentInstance.text.split(' ').length);
    // Static text stays fully readable without JS-driven motion
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('A Seoul night out,');
  });

  // The statement says the restaurant serves Chicago, not other cities
  it('mentions Chicago and no other city', () => {
    const fixture = TestBed.createComponent(HomeStatement);
    expect(fixture.componentInstance.text).toContain('served in Chicago');
    expect(fixture.componentInstance.text).not.toContain('New York');
    expect(fixture.componentInstance.text).not.toContain('Los Angeles');
  });
});
