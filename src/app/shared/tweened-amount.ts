import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  Signal,
  computed,
  inject,
  input,
  runInInjectionContext,
} from '@angular/core';
import { formatAmount } from './format/price';
import { tweenedNumber } from './tween';

// A money amount that counts to each new value. Create it only once the real amount is known,
// so it starts on that value instead of counting up from zero
@Component({
  selector: 'app-tweened-amount',
  template: '{{ text() }}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TweenedAmount implements OnInit {
  readonly amountMinor = input.required<number>();
  readonly currency = input.required<string>();

  private readonly injector = inject(Injector);

  protected text!: Signal<string>;

  // The tween reads its source on creation and required inputs only exist from ngOnInit on
  ngOnInit(): void {
    const shown = runInInjectionContext(this.injector, () =>
      tweenedNumber(computed(() => this.amountMinor())),
    );
    this.text = computed(() => formatAmount(shown(), this.currency()));
  }
}
