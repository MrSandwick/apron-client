import { TestBed } from '@angular/core/testing';
import { NewCartLine } from '../../../core/cart/cart.model';
import { ItemDialog } from './item-dialog';
import { richDish } from './rich-dish.testing';

// Opens the dialog on a dish and returns handles to its element and outputs
async function open(dish: typeof richDish | null = richDish) {
  await TestBed.configureTestingModule({ imports: [ItemDialog] }).compileComponents();
  const fixture = TestBed.createComponent(ItemDialog);
  const added: NewCartLine[] = [];
  let closed = 0;
  fixture.componentInstance.added.subscribe((l) => added.push(l));
  fixture.componentInstance.closed.subscribe(() => closed++);
  fixture.componentRef.setInput('dish', dish);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, el, added, closed: () => closed, settle };
}

const q = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const all = (el: HTMLElement, id: string) =>
  Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
// The input of the choice row whose text starts with the given name
const input = (el: HTMLElement, name: string) =>
  all(el, 'item-dialog-choice')
    .find((row) => row.textContent!.trim().startsWith(name))!
    .querySelector('input')!;

describe('ItemDialog', () => {
  // Nothing renders inside, and the dialog stays shut, without a dish
  it('stays closed without a dish', async () => {
    const { el } = await open(null);
    expect((q(el, 'item-dialog') as HTMLDialogElement).open).toBe(false);
    expect(all(el, 'item-dialog-group').length).toBe(0);
  });

  // Opening shows the heading, Korean name, description and tag pills
  it('opens with the dish heading and tags', async () => {
    const { el } = await open();
    expect((q(el, 'item-dialog') as HTMLDialogElement).open).toBe(true);
    const text = q(el, 'item-dialog').textContent!;
    expect(text).toContain('B7');
    expect(text).toContain('Rich bowl');
    expect(text).toContain('덮밥');
    expect(text).toContain('A bowl with everything.');
    expect(text).toContain('Mild');
    expect(text).toContain('Vegetarian');
  });

  // Each group is a fieldset with the right legend and the right input type
  it('renders groups with legends, radios and checkboxes', async () => {
    const { el } = await open();
    const groups = all(el, 'item-dialog-group');
    expect(groups.map((g) => g.tagName)).toEqual(['FIELDSET', 'FIELDSET', 'FIELDSET']);
    const legends = groups.map((g) => g.querySelector('legend')!.textContent!);
    expect(legends[0]).toContain('Required • Choose one');
    expect(legends[1]).toContain('Required • Choose 2');
    expect(legends[2]).toContain('Optional • Choose up to 2');
    expect(groups[0].querySelector('input')!.type).toBe('radio');
    expect(groups[2].querySelector('input')!.type).toBe('checkbox');
  });

  // The pre-selected choice is ticked on open, and surcharges read "+ $0.00" when free
  it('ticks pre-selected choices and shows prices', async () => {
    const { el } = await open();
    expect(input(el, 'BEEF').checked).toBe(true);
    expect(input(el, 'TOFU').checked).toBe(false);
    const rows = all(el, 'item-dialog-choice');
    expect(rows.find((r) => r.textContent!.includes('BEEF'))!.textContent).toContain('+ $0.00');
    expect(rows.find((r) => r.textContent!.includes('TOFU'))!.textContent).toContain('+ $3.00');
  });

  // A sold-out choice is disabled and labelled
  it('disables a sold-out choice', async () => {
    const { el } = await open();
    expect(input(el, 'PORK').disabled).toBe(true);
    const row = all(el, 'item-dialog-choice').find((r) => r.textContent!.includes('PORK'))!;
    expect(row.textContent).toContain('Sold out');
  });

  // Picking in the optional group stops at two and locks the rest with a polite hint
  it('stops an optional group at its limit', async () => {
    const { el, settle } = await open();
    input(el, 'SHRIMP').click();
    input(el, 'CHEESE').click();
    await settle();
    expect(input(el, 'ONION').disabled).toBe(true);
    expect(input(el, 'SHRIMP').disabled).toBe(false);
    // Each group has a hint; the optional one is last
    const hint = all(el, 'item-dialog-limit').at(-1)!;
    expect(hint.textContent).toContain('Limit reached');
    expect(hint.getAttribute('aria-live')).toBe('polite');
    input(el, 'SHRIMP').click();
    await settle();
    expect(input(el, 'ONION').disabled).toBe(false);
  });

  // The radio replaces its pick
  it('replaces the pick in a radio group', async () => {
    const { el, settle } = await open();
    input(el, 'TOFU').click();
    await settle();
    expect(input(el, 'TOFU').checked).toBe(true);
    expect(input(el, 'BEEF').checked).toBe(false);
  });

  // The note box has the dish limit and a live counter
  it('limits the note and counts characters', async () => {
    const { el, settle } = await open();
    const note = q(el, 'item-dialog-note') as HTMLTextAreaElement;
    expect(note.getAttribute('maxlength')).toBe('200');
    expect(note.placeholder).toBe('Add allergies or other notes...');
    expect(q(el, 'item-dialog-note-count').textContent!.trim()).toBe('0/200');
    note.value = 'no peanuts';
    note.dispatchEvent(new Event('input'));
    await settle();
    expect(q(el, 'item-dialog-note-count').textContent!.trim()).toBe('10/200');
    expect(el.textContent).toContain('Special request');
    expect(el.textContent).toContain('Important notes');
  });

  // A dish that takes no notes shows no note box
  it('hides the note box when the dish takes no notes', async () => {
    const { el } = await open({ ...richDish, noteMaxLength: 0 });
    expect(all(el, 'item-dialog-note').length).toBe(0);
  });

  // The stepper stays between 1 and 20
  it('keeps quantity between 1 and 20', async () => {
    const { el, settle } = await open();
    const dec = el.querySelector<HTMLElement>('[aria-label="Decrease quantity"]')!;
    const inc = el.querySelector<HTMLElement>('[aria-label="Increase quantity"]')!;
    dec.click();
    await settle();
    expect(q(el, 'item-dialog-qty').textContent!.trim()).toBe('1');
    for (let i = 0; i < 25; i++) {
      inc.click();
    }
    await settle();
    expect(q(el, 'item-dialog-qty').textContent!.trim()).toBe('20');
  });

  // The add button total follows surcharges and quantity
  it('updates the total live', async () => {
    const { el, settle } = await open();
    expect(q(el, 'item-dialog-add').textContent).toContain('$15');
    input(el, 'TOFU').click();
    input(el, 'SHRIMP').click();
    el.querySelector<HTMLElement>('[aria-label="Increase quantity"]')!.click();
    await settle();
    // (1500 + 300 + 500) x 2 = 4600
    expect(q(el, 'item-dialog-add').textContent).toContain('Add to cart | $46');
  });

  // With a required group unfilled, Add stays focusable but does nothing, and names what is missing
  it('blocks adding while a required group is missing', async () => {
    const { el, added, settle } = await open();
    const add = q(el, 'item-dialog-add');
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect((add as HTMLButtonElement).disabled).toBe(false);
    expect(q(el, 'item-dialog-missing').getAttribute('role')).toBe('status');
    expect(q(el, 'item-dialog-missing').textContent).toContain('Choose: Sides');
    add.click();
    await settle();
    expect(added.length).toBe(0);
    // Focus moves to the first missing group
    expect(el.ownerDocument.activeElement).toBe(input(el, 'RICE'));
  });

  // After the required picks, Add emits the full line
  it('emits the line once required groups are filled', async () => {
    const { el, added, settle } = await open();
    input(el, 'TOFU').click();
    input(el, 'RICE').click();
    input(el, 'EGG').click();
    input(el, 'CHEESE').click();
    const note = q(el, 'item-dialog-note') as HTMLTextAreaElement;
    note.value = '  no sesame ';
    note.dispatchEvent(new Event('input'));
    el.querySelector<HTMLElement>('[aria-label="Increase quantity"]')!.click();
    await settle();
    expect(q(el, 'item-dialog-add').getAttribute('aria-disabled')).toBe('false');
    expect(q(el, 'item-dialog-missing').textContent!.trim()).toBe('');
    q(el, 'item-dialog-add').click();
    expect(added.length).toBe(1);
    expect(added[0]).toEqual({
      dishId: 'rich',
      code: 'B7',
      name: 'Rich bowl',
      quantity: 2,
      picks: [
        {
          groupId: 'filling',
          groupName: 'Filling',
          choiceId: 'tofu',
          choiceName: 'TOFU',
          extraMinor: 300,
        },
        {
          groupId: 'sides',
          groupName: 'Sides',
          choiceId: 'rice',
          choiceName: 'RICE',
          extraMinor: 0,
        },
        { groupId: 'sides', groupName: 'Sides', choiceId: 'egg', choiceName: 'EGG', extraMinor: 0 },
        {
          groupId: 'extras',
          groupName: 'Extras',
          choiceId: 'cheese',
          choiceName: 'CHEESE',
          extraMinor: 200,
        },
      ],
      note: 'no sesame',
      unitMinor: 2000,
      currency: 'USD',
    });
  });

  // Both close buttons report a close
  it('reports closing from the close buttons', async () => {
    const { el, closed } = await open();
    q(el, 'item-dialog-close').click();
    q(el, 'item-dialog-close-x').click();
    expect(closed()).toBe(2);
  });

  // Escape closes a native dialog and fires its close event; the page must hear about it so the
  // ?item= link is cleared and the dialog does not reopen on reload
  it('reports a native close such as Escape', async () => {
    const { el, closed } = await open();
    el.querySelector('dialog')!.dispatchEvent(new Event('close'));
    expect(closed()).toBe(1);
  });

  // The backdrop click lands on the dialog element itself and closes it
  it('reports a click on the backdrop', async () => {
    const { el, closed } = await open();
    el.querySelector('dialog')!.click();
    expect(closed()).toBe(1);
  });

  // Reopening on another dish starts fresh
  it('resets when the dish changes', async () => {
    const { fixture, el, settle } = await open();
    input(el, 'TOFU').click();
    el.querySelector<HTMLElement>('[aria-label="Increase quantity"]')!.click();
    await settle();
    fixture.componentRef.setInput('dish', null);
    await settle();
    fixture.componentRef.setInput('dish', richDish);
    await settle();
    expect(input(el, 'BEEF').checked).toBe(true);
    expect(q(el, 'item-dialog-qty').textContent!.trim()).toBe('1');
  });

  // Refetched data for the same dish keeps the guest's picks and note
  it('keeps picks and note when the same dish arrives again', async () => {
    const { fixture, el, settle } = await open();
    input(el, 'TOFU').click();
    const note = q(el, 'item-dialog-note') as HTMLTextAreaElement;
    note.value = 'hello';
    note.dispatchEvent(new Event('input'));
    await settle();
    fixture.componentRef.setInput('dish', { ...richDish });
    await settle();
    expect(input(el, 'TOFU').checked).toBe(true);
    expect(q(el, 'item-dialog-note-count').textContent!.trim()).toBe('5/200');
  });

  // A different dish id does reset
  it('resets when another dish id arrives', async () => {
    const { fixture, el, settle } = await open();
    input(el, 'TOFU').click();
    await settle();
    fixture.componentRef.setInput('dish', { ...richDish, id: 'other' });
    await settle();
    expect(input(el, 'TOFU').checked).toBe(false);
  });

  // An optional pick-one group renders checkboxes and can be cleared
  it('renders an optional max-1 group as clearable checkboxes', async () => {
    const extras = { ...richDish.optionGroups![2], max: 1 };
    const { el, settle } = await open({ ...richDish, optionGroups: [extras] });
    expect(input(el, 'SHRIMP').type).toBe('checkbox');
    input(el, 'SHRIMP').click();
    await settle();
    input(el, 'CHEESE').click();
    await settle();
    expect(input(el, 'SHRIMP').checked).toBe(false);
    expect(input(el, 'CHEESE').checked).toBe(true);
    input(el, 'CHEESE').click();
    await settle();
    expect(input(el, 'CHEESE').checked).toBe(false);
  });

  // A required pick-several group also locks at its limit and explains why
  it('explains the limit for a required group', async () => {
    const { el, settle } = await open();
    input(el, 'RICE').click();
    input(el, 'EGG').click();
    await settle();
    expect(input(el, 'KIMCHI').disabled).toBe(true);
    expect(all(el, 'item-dialog-limit')[1].textContent).toContain('Limit reached');
  });

  // The live regions stay in the page when empty (only their text changes)
  it('keeps the status regions rendered', async () => {
    const { el, settle } = await open();
    input(el, 'RICE').click();
    input(el, 'EGG').click();
    await settle();
    const missing = q(el, 'item-dialog-missing');
    expect(missing.textContent!.trim()).toBe('');
    expect(missing.classList.contains('hidden')).toBe(false);
    expect(all(el, 'item-dialog-limit').length).toBe(3);
  });

  // The Add button has a spoken label without the bar and points at the missing text
  it('labels the add button and links it to the missing text', async () => {
    const { el, settle } = await open();
    const add = q(el, 'item-dialog-add');
    expect(add.getAttribute('aria-label')).toBe('Add to cart, $15');
    expect(add.getAttribute('aria-describedby')).toBe('item-dialog-missing');
    input(el, 'RICE').click();
    input(el, 'EGG').click();
    await settle();
    expect(add.getAttribute('aria-describedby')).toBeNull();
  });

  // A required group with every choice sold out says so instead of asking for a pick
  it('says when a required group is unavailable', async () => {
    const sides = richDish.optionGroups![1];
    const { el } = await open({
      ...richDish,
      optionGroups: [{ ...sides, choices: sides.choices.map((x) => ({ ...x, soldOut: true })) }],
    });
    expect(q(el, 'item-dialog-missing').textContent).toContain('Not available right now: Sides');
    expect(q(el, 'item-dialog-add').getAttribute('aria-disabled')).toBe('true');
  });
});
