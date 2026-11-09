import { MAX_QUANTITY, MIN_QUANTITY, clampQuantity } from '../../../core/cart/cart.model';
import { MenuDish, MenuOptionChoice, MenuOptionGroup } from '../menu.data';

// Quantity bounds live with the cart; re-exported so the dialog has one import
export { MAX_QUANTITY, MIN_QUANTITY, clampQuantity };

// Pure ordering rules for the item dialog, kept free of Angular so they are easy to test.

// Picked choice ids per option group id
export type Selection = Readonly<Record<string, readonly string[]>>;

function groupsOf(dish: MenuDish): MenuOptionGroup[] {
  return dish.optionGroups ?? [];
}

// Choices ticked when the dish opens; sold-out ones are never pre-picked, and a group never
// starts above its max
export function initialSelection(dish: MenuDish): Selection {
  const selection: Record<string, string[]> = {};
  for (const group of groupsOf(dish)) {
    selection[group.id] = group.choices
      .filter((c) => c.preSelected && !c.soldOut)
      .slice(0, Math.max(group.max, 0))
      .map((c) => c.id);
  }
  return selection;
}

export function isPicked(selection: Selection, group: MenuOptionGroup, choiceId: string): boolean {
  return (selection[group.id] ?? []).includes(choiceId);
}

// A group is full once it holds `max` picks
export function isGroupFull(selection: Selection, group: MenuOptionGroup): boolean {
  return (selection[group.id] ?? []).length >= group.max;
}

// Whether a guest can tick this choice now: not sold out, and either already picked (so it can
// be unticked), a radio (picking replaces), or the group still has room
export function canPick(
  selection: Selection,
  group: MenuOptionGroup,
  choice: MenuOptionChoice,
): boolean {
  if (choice.soldOut) {
    return false;
  }
  if (isPicked(selection, group, choice.id) || group.max === 1) {
    return true;
  }
  return !isGroupFull(selection, group);
}

// Radios are for required pick-one groups only; an optional pick-one group uses checkboxes so a
// guest can clear it
export function isRadio(group: MenuOptionGroup): boolean {
  return group.required && group.max === 1;
}

// Returns the selection after a guest toggles a choice. Max 1 is single-select: picking replaces
// the current pick, and re-picking keeps a required one but clears an optional one. Otherwise
// ticks stop at max and extra ticks are refused
export function toggle(
  selection: Selection,
  group: MenuOptionGroup,
  choice: MenuOptionChoice,
): Selection {
  if (choice.soldOut) {
    return selection;
  }
  const current = selection[group.id] ?? [];
  const picked = current.includes(choice.id);
  if (group.max === 1) {
    if (picked) {
      return group.required ? selection : { ...selection, [group.id]: [] };
    }
    return { ...selection, [group.id]: [choice.id] };
  }
  if (picked) {
    return { ...selection, [group.id]: current.filter((id) => id !== choice.id) };
  }
  if (current.length >= group.max) {
    return selection;
  }
  return { ...selection, [group.id]: [...current, choice.id] };
}

// Required groups that hold fewer than `min` picks (at least one pick for a required group)
export function missingGroups(dish: MenuDish, selection: Selection): MenuOptionGroup[] {
  return groupsOf(dish).filter(
    (group) => group.required && (selection[group.id] ?? []).length < Math.max(group.min, 1),
  );
}

// Choices currently picked, in group order then choice order
export function pickedChoices(
  dish: MenuDish,
  selection: Selection,
): { group: MenuOptionGroup; choice: MenuOptionChoice }[] {
  return groupsOf(dish).flatMap((group) =>
    group.choices
      .filter((choice) => isPicked(selection, group, choice.id))
      .map((choice) => ({ group, choice })),
  );
}

// Price of one portion: base price plus every picked surcharge, in minor units
export function unitMinor(dish: MenuDish, selection: Selection): number {
  const extras = pickedChoices(dish, selection).reduce((sum, p) => sum + p.choice.extraMinor, 0);
  return (dish.priceMinor ?? 0) + extras;
}

export function lineTotalMinor(unit: number, quantity: number): number {
  return unit * quantity;
}

// Cuts the note to `max` UTF-16 units (what the textarea maxlength counts) without leaving half
// of a surrogate pair behind
export function clampNote(text: string, max: number): string {
  const cut = text.slice(0, Math.max(max, 0));
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff && cut.length < text.length ? cut.slice(0, -1) : cut;
}

// Required groups that cannot be filled because too many of their choices are sold out
export function blockedGroups(dish: MenuDish): MenuOptionGroup[] {
  return groupsOf(dish).filter(
    (group) =>
      group.required && group.choices.filter((c) => !c.soldOut).length < Math.max(group.min, 1),
  );
}

// Heading line above a group, for example "Required • Choose one"
export function groupLegend(group: MenuOptionGroup): string {
  if (!group.required) {
    return `Optional • Choose up to ${group.max}`;
  }
  if (group.max === 1) {
    return 'Required • Choose one';
  }
  if (group.min === group.max) {
    return `Required • Choose ${group.max}`;
  }
  return `Required • Choose ${group.min} to ${group.max}`;
}
