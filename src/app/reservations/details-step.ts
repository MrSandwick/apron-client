import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MAX_PARTY_SIZE, formatTimeLabel, guestsLabel } from './reservation.format';
import { Slot } from './reservation.models';

// Where the slot list is in its load
export type SlotsState = 'idle' | 'loading' | 'ready' | 'error';

// Step one: party size, date, the grid of times, and the Reserve Now button.
// Presentational: the page owns the data and reacts to the outputs.
@Component({
  selector: 'app-details-step',
  templateUrl: './details-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class DetailsStep {
  readonly partySize = input.required<number>();
  readonly date = input.required<string>();
  // Earliest date the guest may pick (today)
  readonly minDate = input.required<string>();
  readonly slots = input<Slot[]>([]);
  readonly slotsState = input<SlotsState>('idle');
  readonly slotsError = input('');
  readonly selectedTime = input<string | null>(null);
  // True while the hold request is in flight
  readonly holding = input(false);
  // Why the hold failed, if it did
  readonly error = input('');
  // Shown when the guest was sent back here, for example after a hold expired
  readonly notice = input('');

  readonly partySizeChange = output<number>();
  readonly dateChange = output<string>();
  // The date input got focus, so the page can refresh what "today" is
  readonly dateFocus = output<void>();
  readonly slotSelect = output<string>();
  readonly reserveNow = output<void>();
  readonly retrySlots = output<void>();

  protected readonly partyOptions = Array.from({ length: MAX_PARTY_SIZE }, (_, i) => i + 1);
  protected readonly skeletonCells = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly guestsLabel = guestsLabel;
  protected readonly timeLabel = formatTimeLabel;

  // A date typed before today gets its own message rather than an empty grid
  protected readonly datePast = computed(() => !!this.date() && this.date() < this.minDate());
  protected readonly anyManual = computed(() => this.slots().some((s) => s.manualApproval));

  protected onParty(event: Event): void {
    this.partySizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }

  protected onDate(event: Event): void {
    this.dateChange.emit((event.target as HTMLInputElement).value);
  }

  // Unique per slot: the daylight-saving fall-back hour lists 01:30 twice, so time alone repeats
  protected slotKey(slot: Slot): string {
    return `${slot.startDate ?? ''}|${slot.time}`;
  }

  protected pick(slot: Slot): void {
    if (slot.available) {
      this.slotSelect.emit(slot.time);
    }
  }

  // Selected is amber, free is outlined, taken is dimmed with a strike-through
  protected slotClass(slot: Slot): string {
    if (!slot.available) {
      return 'border-brand-cream/10 bg-transparent text-brand-muted line-through opacity-60 cursor-not-allowed';
    }
    return slot.time === this.selectedTime()
      ? 'border-brand-amber bg-brand-amber text-brand-bg cursor-pointer'
      : 'border-brand-cream/25 bg-brand-raised text-brand-cream hover:border-brand-amber/70 cursor-pointer';
  }
}
