import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NewCartLine } from '../../../core/cart/cart.model';
import { DISH_TAG_LABELS, MenuDish, MenuOptionChoice, MenuOptionGroup } from '../menu.data';
import { formatExtraLabel, formatPrice } from '../menu.mapper';
import {
  MAX_QUANTITY,
  MIN_QUANTITY,
  Selection,
  blockedGroups,
  canPick,
  clampNote,
  clampQuantity,
  groupLegend,
  initialSelection,
  isGroupFull,
  isPicked,
  isRadio,
  lineTotalMinor,
  missingGroups,
  pickedChoices,
  toggle,
  unitMinor,
} from './item-dialog.rules';

// Modal for ordering one dish: option groups, a note, a quantity and an "Add to cart" button
// whose total follows every choice. A native <dialog> gives focus trapping, Escape and a backdrop.
@Component({
  selector: 'app-item-dialog',
  templateUrl: './item-dialog.html',
})
export class ItemDialog {
  // The dish being ordered; null keeps the dialog closed
  readonly dish = input<MenuDish | null>(null);
  readonly closed = output<void>();
  readonly added = output<NewCartLine>();

  protected readonly minQuantity = MIN_QUANTITY;
  protected readonly maxQuantity = MAX_QUANTITY;
  protected readonly groupLegend = groupLegend;
  protected readonly isPicked = isPicked;
  protected readonly isRadio = isRadio;
  protected readonly isGroupFull = isGroupFull;
  protected readonly canPick = canPick;

  protected readonly selection = signal<Selection>({});
  protected readonly quantity = signal(MIN_QUANTITY);
  protected readonly note = signal('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialogEl = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly groups = computed(() => this.dish()?.optionGroups ?? []);
  protected readonly tags = computed(() =>
    (this.dish()?.tags ?? []).map((tag) => DISH_TAG_LABELS[tag]),
  );
  protected readonly noteMax = computed(() => this.dish()?.noteMaxLength ?? 0);
  protected readonly currency = computed(() => this.dish()?.currency ?? 'USD');
  protected readonly missing = computed(() => {
    const dish = this.dish();
    return dish ? missingGroups(dish, this.selection()) : [];
  });
  // Say so when a required group cannot be filled because its choices are sold out
  protected readonly missingText = computed(() => {
    const dish = this.dish();
    const blocked = dish ? blockedGroups(dish).map((g) => g.name) : [];
    if (blocked.length) {
      return `Not available right now: ${blocked.join(', ')}`;
    }
    const names = this.missing().map((g) => g.name);
    return names.length ? `Choose: ${names.join(', ')}` : '';
  });
  protected readonly total = computed(() => {
    const dish = this.dish();
    return dish ? lineTotalMinor(unitMinor(dish, this.selection()), this.quantity()) : 0;
  });
  protected readonly totalText = computed(() => formatPrice(this.total(), this.currency()));
  // The visible "|" separator is read aloud, so screen readers get this label instead
  protected readonly addLabel = computed(() => `Add to cart, ${this.totalText()}`);
  // Changes only when a different dish opens, not when the same dish arrives again in a refetch
  private readonly dishId = computed(() => this.dish()?.id ?? null);

  constructor() {
    // A different dish starts from its pre-selected choices, an empty note and one portion
    effect(() => {
      this.dishId();
      untracked(() => {
        const dish = this.dish();
        this.selection.set(dish ? initialSelection(dish) : {});
        this.quantity.set(MIN_QUANTITY);
        this.note.set('');
      });
    });

    // Open and close the native dialog after the content has rendered (browser only)
    afterRenderEffect(() => {
      const el = this.dialogEl()?.nativeElement;
      if (!el) {
        return;
      }
      const wanted = this.dish() !== null;
      if (wanted && !el.open) {
        if (typeof el.showModal === 'function') {
          el.showModal();
        } else {
          el.setAttribute('open', '');
        }
      } else if (!wanted && el.open) {
        if (typeof el.close === 'function') {
          el.close();
        } else {
          el.removeAttribute('open');
        }
      }
    });
  }

  // Text for a choice's surcharge in one consistent format, "+ $0.00" when it is free
  protected extraText(choice: MenuOptionChoice): string {
    return formatExtraLabel(choice.extraMinor, this.currency());
  }

  // True once a pick-several group has all its picks, so the rest are locked
  protected limitReached(group: MenuOptionGroup): boolean {
    return group.max > 1 && isGroupFull(this.selection(), group);
  }

  protected pick(group: MenuOptionGroup, choice: MenuOptionChoice, input: HTMLInputElement): void {
    this.selection.update((s) => toggle(s, group, choice));
    // Keep the box in step with the rules if a tick was refused
    input.checked = isPicked(this.selection(), group, choice.id);
  }

  protected setNote(text: string): void {
    this.note.set(clampNote(text, this.noteMax()));
  }

  protected step(delta: number): void {
    this.quantity.update((q) => clampQuantity(q + delta));
  }

  protected add(): void {
    const dish = this.dish();
    if (!dish) {
      return;
    }
    const missing = this.missing();
    if (missing.length) {
      this.focusGroup(missing[0].id);
      return;
    }
    const selection = this.selection();
    this.added.emit({
      dishId: dish.id,
      code: dish.code,
      name: dish.name,
      quantity: this.quantity(),
      picks: pickedChoices(dish, selection).map(({ group, choice }) => ({
        groupId: group.id,
        groupName: group.name,
        choiceId: choice.id,
        choiceName: choice.name,
        extraMinor: choice.extraMinor,
      })),
      note: this.note().trim(),
      unitMinor: unitMinor(dish, selection),
      currency: this.currency(),
    });
  }

  // Moves focus to the first usable input of a group
  private focusGroup(groupId: string): void {
    const groups = this.host.nativeElement.querySelectorAll<HTMLElement>(
      '[data-testid="item-dialog-group"]',
    );
    const group = Array.from(groups).find((g) => g.dataset['group'] === groupId);
    group?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
  }

  // The native close event covers Escape and dialog.close(); only a guest-driven close is reported
  protected onNativeClose(): void {
    if (this.dish()) {
      this.closed.emit();
    }
  }

  // A click on the backdrop lands on the dialog element itself, not on the card inside
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
