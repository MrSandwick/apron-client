import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

// App navigation shell: brand, page links, and reservation/cart actions.
@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
})
export class Navbar {}
