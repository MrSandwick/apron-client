import { ChangeDetectionStrategy, Component, model } from '@angular/core';

// How the guest wants to receive the order
export type FulfillmentMode = 'takeout' | 'delivery';

// Segmented takeout / delivery choice built from native radios, so arrow keys and grouping work
// without any script. The chosen mode is a two-way model the cart page can bind to.
@Component({
  selector: 'app-fulfillment-toggle',
  templateUrl: './fulfillment-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class FulfillmentToggle {
  readonly mode = model<FulfillmentMode>('takeout');

  // Options in display order
  protected readonly options: readonly { value: FulfillmentMode; label: string }[] = [
    { value: 'takeout', label: 'Takeout' },
    { value: 'delivery', label: 'Delivery' },
  ];
}
