import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DELIVERY_URL } from '../../core/config/ordering.config';

// Shown when the guest picks delivery: explains that Uber Eats is a separate menu and sends them there
@Component({
  selector: 'app-delivery-panel',
  templateUrl: './delivery-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class DeliveryPanel {
  protected readonly deliveryUrl = inject(DELIVERY_URL);
}
