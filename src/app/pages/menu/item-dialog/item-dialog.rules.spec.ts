import { richDish } from './rich-dish.testing';
import {
  MAX_QUANTITY,
  Selection,
  blockedGroups,
  canPick,
  clampNote,
  clampQuantity,
  groupLegend,
  initialSelection,
  isRadio,
  lineTotalMinor,
  missingGroups,
  toggle,
  unitMinor,
} from './item-dialog.rules';

const [filling, sides, extras] = richDish.optionGroups!;
const c = (group: typeof filling, id: string) => group.choices.find((x) => x.id === id)!;

describe('item dialog rules', () => {
  // Pre-selected choices are ticked on open and others are not
  it('starts from the pre-selected choices', () => {
    expect(initialSelection(richDish)).toEqual({ filling: ['beef'], sides: [], extras: [] });
  });

  // A sold-out choice is never pre-ticked even if the data says so
  it('does not pre-select a sold-out choice', () => {
    const dish = {
      ...richDish,
      optionGroups: [
        { ...filling, choices: [{ ...c(filling, 'pork'), preSelected: true }, c(filling, 'tofu')] },
      ],
    };
    expect(initialSelection(dish)['filling']).toEqual([]);
  });

  // Max 1 acts as a radio: picking replaces, re-picking keeps
  it('replaces the pick in a max-1 group', () => {
    const start = initialSelection(richDish);
    const next = toggle(start, filling, c(filling, 'tofu'));
    expect(next['filling']).toEqual(['tofu']);
    expect(toggle(next, filling, c(filling, 'tofu'))['filling']).toEqual(['tofu']);
  });

  // Checkbox groups tick up to max, then refuse more, and unticking frees room
  it('stops ticking at max and allows unticking', () => {
    let s: Selection = initialSelection(richDish);
    s = toggle(s, extras, c(extras, 'shrimp'));
    s = toggle(s, extras, c(extras, 'cheese'));
    const refused = toggle(s, extras, c(extras, 'onion'));
    expect(refused['extras']).toEqual(['shrimp', 'cheese']);
    expect(canPick(s, extras, c(extras, 'onion'))).toBe(false);
    expect(canPick(s, extras, c(extras, 'cheese'))).toBe(true);
    s = toggle(s, extras, c(extras, 'shrimp'));
    expect(s['extras']).toEqual(['cheese']);
    expect(canPick(s, extras, c(extras, 'onion'))).toBe(true);
  });

  // Sold-out choices cannot be picked at all
  it('refuses a sold-out choice', () => {
    const s = initialSelection(richDish);
    expect(toggle(s, extras, c(extras, 'truffle'))).toBe(s);
    expect(toggle(s, filling, c(filling, 'pork'))).toBe(s);
    expect(canPick(s, extras, c(extras, 'truffle'))).toBe(false);
  });

  // Required groups with too few picks are listed
  it('lists required groups short of their minimum', () => {
    let s = initialSelection(richDish);
    expect(missingGroups(richDish, s).map((g) => g.id)).toEqual(['sides']);
    s = toggle(s, sides, c(sides, 'rice'));
    expect(missingGroups(richDish, s).map((g) => g.id)).toEqual(['sides']);
    s = toggle(s, sides, c(sides, 'egg'));
    expect(missingGroups(richDish, s)).toEqual([]);
  });

  // Unit price is the base plus every picked surcharge
  it('adds picked surcharges to the base price', () => {
    let s = initialSelection(richDish);
    expect(unitMinor(richDish, s)).toBe(1500);
    s = toggle(s, filling, c(filling, 'tofu'));
    s = toggle(s, extras, c(extras, 'shrimp'));
    expect(unitMinor(richDish, s)).toBe(1500 + 300 + 500);
  });

  // A dish with no price yet counts as zero
  it('treats a missing base price as zero', () => {
    expect(unitMinor({ ...richDish, priceMinor: undefined, optionGroups: [] }, {})).toBe(0);
  });

  // Line total multiplies the unit price by the quantity
  it('multiplies the unit price by the quantity', () => {
    expect(lineTotalMinor(1800, 3)).toBe(5400);
  });

  // Quantity stays between 1 and 20
  it('clamps quantity to 1 through 20', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-4)).toBe(1);
    expect(clampQuantity(7)).toBe(7);
    expect(clampQuantity(99)).toBe(MAX_QUANTITY);
    expect(clampQuantity(NaN)).toBe(1);
    expect(clampQuantity(2.9)).toBe(2);
  });

  // Notes are cut to the dish limit
  it('clamps a note to the maximum length', () => {
    expect(clampNote('abcdef', 3)).toBe('abc');
    expect(clampNote('ab', 3)).toBe('ab');
    expect(clampNote('ab', 0)).toBe('');
  });

  // Legend wording for each kind of group
  it('words the group legend', () => {
    expect(groupLegend(filling)).toBe('Required • Choose one');
    expect(groupLegend(sides)).toBe('Required • Choose 2');
    expect(groupLegend({ ...sides, min: 1, max: 3 })).toBe('Required • Choose 1 to 3');
    expect(groupLegend(extras)).toBe('Optional • Choose up to 2');
  });

  // An optional pick-one group lets the guest replace the pick and then clear it
  it('selects one and clears it in an optional max-1 group', () => {
    const group = { ...extras, max: 1 };
    const [a, b] = group.choices;
    let s: Selection = { extras: [] };
    s = toggle(s, group, a);
    expect(s['extras']).toEqual(['shrimp']);
    s = toggle(s, group, b);
    expect(s['extras']).toEqual(['cheese']);
    s = toggle(s, group, b);
    expect(s['extras']).toEqual([]);
    expect(canPick(s, group, a)).toBe(true);
  });

  // Only required pick-one groups are radios
  it('uses radios for required max-1 groups only', () => {
    expect(isRadio(filling)).toBe(true);
    expect(isRadio({ ...extras, max: 1 })).toBe(false);
    expect(isRadio(sides)).toBe(false);
  });

  // A required group can need several picks before it counts as filled
  it('needs every pick of a required min-2 group', () => {
    let s = initialSelection(richDish);
    s = toggle(s, sides, c(sides, 'rice'));
    expect(missingGroups(richDish, s).map((g) => g.id)).toContain('sides');
    s = toggle(s, sides, c(sides, 'kimchi'));
    expect(missingGroups(richDish, s)).toEqual([]);
    // A third tick is refused at max
    expect(toggle(s, sides, c(sides, 'egg'))).toBe(s);
  });

  // canPick follows sold-out, picked, radio and full states
  it('says what can be picked', () => {
    const s: Selection = { filling: ['beef'], sides: ['rice', 'egg'], extras: [] };
    expect(canPick(s, filling, c(filling, 'tofu'))).toBe(true);
    expect(canPick(s, filling, c(filling, 'pork'))).toBe(false);
    expect(canPick(s, sides, c(sides, 'kimchi'))).toBe(false);
    expect(canPick(s, sides, c(sides, 'rice'))).toBe(true);
    expect(canPick(s, extras, c(extras, 'onion'))).toBe(true);
  });

  // Data with more pre-selected choices than max starts at max
  it('caps pre-selected choices at the group maximum', () => {
    const dish = {
      ...richDish,
      optionGroups: [
        { ...extras, choices: extras.choices.map((x) => ({ ...x, preSelected: !x.soldOut })) },
      ],
    };
    expect(initialSelection(dish)['extras']).toEqual(['shrimp', 'cheese']);
  });

  // A required group with too few available choices cannot be filled
  it('flags a required group with too few available choices', () => {
    const tight = {
      ...richDish,
      optionGroups: [
        {
          ...sides,
          choices: [c(sides, 'rice'), { ...c(sides, 'egg'), soldOut: true }],
        },
      ],
    };
    expect(blockedGroups(tight).map((g) => g.id)).toEqual(['sides']);
    expect(blockedGroups(richDish)).toEqual([]);
  });

  // Cutting a note never leaves half of a surrogate pair
  it('does not split a surrogate pair when clamping a note', () => {
    const note = 'ab\u{1F600}cd';
    expect(clampNote(note, 3)).toBe('ab');
    expect(clampNote(note, 4)).toBe('ab\u{1F600}');
  });
});
