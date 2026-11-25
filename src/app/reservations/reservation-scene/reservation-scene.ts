import { Component, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';
import { gsap } from 'gsap';
import { whenMotionAllowed } from '../../shared/motion';

// How far (px) the nearest layer shifts away from the cursor; far layers move less
const POINTER_SHIFT = 24;
// How far, as a fraction of the scene's height, a layer at depth 0 sinks while the page scrolls.
// Far layers sink the most so they seem to hang back; the table in front does not move
const SCROLL_SHIFT = 0.12;

// Korean soju-house dining room behind the booking card: bokeh, a blurred room of lamp-lit tables,
// brass pendant lights, and a walnut table with the RESERVED card, a rice bowl, a stew pot and soju.
// Each [data-layer] drifts with the scroll and the cursor by its data-depth. On entry the room
// settles, the lights pop on, the pendants drop in, the table rises and the setting pops up
// piece by piece. Then the stew steams, the pendants sway and the bokeh breathes. Only when the visitor allows motion; cursor parallax only on a mouse.
@Component({
  selector: 'app-reservation-scene',
  templateUrl: './reservation-scene.html',
  host: { class: 'pointer-events-none block overflow-hidden', 'aria-hidden': 'true' },
})
export class ReservationScene implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private media?: gsap.MatchMedia;
  private pointerMedia?: gsap.MatchMedia;

  // Bokeh discs on a 1600 by 1000 canvas; warm ones are amber, the rest pale lantern light
  protected readonly bokeh = [
    { x: 90, y: 260, r: 46, warm: true },
    { x: 240, y: 120, r: 28, warm: false },
    { x: 330, y: 420, r: 60, warm: true },
    { x: 470, y: 230, r: 22, warm: false },
    { x: 560, y: 560, r: 36, warm: true },
    { x: 640, y: 640, r: 52, warm: false },
    { x: 820, y: 720, r: 26, warm: true },
    { x: 980, y: 760, r: 40, warm: true },
    { x: 1010, y: 520, r: 58, warm: false },
    { x: 1160, y: 140, r: 30, warm: true },
    { x: 1230, y: 390, r: 48, warm: true },
    { x: 1340, y: 250, r: 24, warm: false },
    { x: 1450, y: 470, r: 64, warm: true },
    { x: 1540, y: 160, r: 34, warm: false },
    { x: 150, y: 600, r: 30, warm: false },
    { x: 1300, y: 620, r: 28, warm: false },
    { x: 420, y: 700, r: 42, warm: true },
    { x: 1180, y: 700, r: 38, warm: true },
  ];

  // Centres of the distant lamp-lit tables, on the room's 1600 wide canvas
  protected readonly roomTables = [110, 380, 650, 950, 1220, 1490];

  // Pendant positions and sizes; the inner two stay off phones so they never sit behind the title
  protected readonly pendants = [
    { cls: 'left-[5%] -top-[70px] w-[64px] blur-[1px] sm:-top-[110px] sm:w-[90px]' },
    { cls: 'left-[21%] -top-[150px] hidden w-[70px] blur-[2px] md:block' },
    { cls: 'right-[21%] -top-[165px] hidden w-[66px] blur-[2px] md:block' },
    { cls: 'right-[5%] -top-[60px] w-[70px] blur-[1px] sm:-top-[100px] sm:w-[100px]' },
  ];

  // Soju glass placements at the front of the right-hand setting; the second sits a little further back
  protected readonly glasses = ['translate(402 306) scale(1.45)', 'translate(482 294) scale(1.3)'];

  // Where each tabletop plank meets the front edge, on a 1600 wide canvas; they all run to one
  // vanishing point above the back edge, which is what makes the table recede
  protected readonly planks = Array.from({ length: 17 }, (_, i) => -800 + i * 200);

  constructor() {
    afterNextRender(() => {
      const el = this.host.nativeElement;

      this.media = whenMotionAllowed(() => {
        this.playIntro(el);
        this.startIdle(el);

        // Scroll: each layer travels by its depth, measured in scene heights and converted to a
        // percentage of its own height so layers of different sizes move alike
        gsap.utils.toArray<HTMLElement>('[data-layer]', el).forEach((layer) =>
          gsap.to(layer, {
            yPercent: () => ((1 - this.depth(layer)) * SCROLL_SHIFT * el.offsetHeight * 100) / layer.offsetHeight,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
              invalidateOnRefresh: true,
            },
          }),
        );
      });

      // Cursor parallax: fine pointers only, never under reduced motion
      this.pointerMedia = whenMotionAllowed(() => {
        const movers = gsap.utils.toArray<HTMLElement>('[data-layer]', el).map((layer) => ({
          // A layer marked x-only (the table) never moves up or down, so the room cannot show under it
          xOnly: layer.hasAttribute('data-pointer-x-only'),
          // Every layer keeps a floor of movement so even the far bokeh drifts a little
          k: 0.4 + this.depth(layer),
          x: gsap.quickTo(layer, 'x', { duration: 1.2, ease: 'power3' }),
          y: gsap.quickTo(layer, 'y', { duration: 1.2, ease: 'power3' }),
        }));
        let frame = 0;
        const onMove = (e: PointerEvent) => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            // -1..1 from the centre of the viewport; layers move away from the cursor
            const nx = (e.clientX / window.innerWidth) * 2 - 1;
            const ny = (e.clientY / window.innerHeight) * 2 - 1;
            movers.forEach((m) => {
              m.x(-nx * m.k * POINTER_SHIFT);
              if (!m.xOnly) m.y(-ny * m.k * POINTER_SHIFT * 0.5);
            });
          });
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => {
          window.removeEventListener('pointermove', onMove);
          cancelAnimationFrame(frame);
        };
      }, '(pointer: fine)');
    });
  }

  // Entrance of about 3.5 s: the room settles out of a slight zoom, the bokeh pops on, the pendants
  // drop in on their cords and light up, the table rises into place, and then the place settings
  // are put down one by one, back to front. Each piece drops from above, lands with a small squash
  // as its shadow spreads under it, and the utensils slide in from the side instead. The stew
  // steams and glows only once its pot has landed
  private playIntro(el: HTMLElement): void {
    const tl = gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .from(q(el, '[data-layer="room"] > [data-intro]'), { scale: 1.08, opacity: 0, duration: 1.4 }, 0)
      .from(
        q(el, '[data-bokeh] > circle'),
        {
          scale: 0,
          opacity: 0,
          transformOrigin: '50% 50%',
          duration: 0.9,
          ease: 'back.out(2)',
          stagger: { each: 0.04, from: 'random' },
        },
        0.1,
      )
      .from(q(el, '[data-pendant]'), { yPercent: -45, duration: 1.1, ease: 'back.out(1.5)', stagger: 0.12 }, 0.2)
      .from(q(el, '[data-pendant-glow]'), { opacity: 0, duration: 0.5, ease: 'power2.in', stagger: 0.12 }, 0.9)
      .from(q(el, '[data-layer="table"] > [data-intro]'), { yPercent: 35, opacity: 0, duration: 1 }, 0.4);

    // Back to front, so a nearer piece always lands over the ones behind it
    const props = gsap
      .utils.toArray<SVGGElement>('[data-prop]', el)
      .sort((a, b) => Number(a.dataset['order']) - Number(b.dataset['order']));
    const start = 1.3;
    const gap = 0.2;
    props.forEach((prop, i) => {
      const at = start + i * gap;
      if (prop.hasAttribute('data-slide')) {
        // Slid across the table from the right
        tl.from(prop, { x: 110, opacity: 0, duration: 0.6, ease: 'power2.out' }, at);
      } else {
        // Dropped from above, then a small squash as it lands
        tl.from(prop, { y: -90, opacity: 0, duration: 0.42, ease: 'power2.in' }, at).fromTo(
          prop,
          { scaleX: 1.05, scaleY: 0.93, transformOrigin: '50% 100%' },
          { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)', immediateRender: false },
          at + 0.42,
        );
        // Its shadow spreads under it just as it lands
        tl.from(
          prop.querySelectorAll('[data-shadow]'),
          { scale: 0.4, opacity: 0, transformOrigin: '50% 50%', duration: 0.35, ease: 'power2.out' },
          at + 0.3,
        );
      }
    });

    // The pot is fourth to land, so the stew glows once it is down
    tl.from(q(el, '[data-stew-glow], [data-pool]'), { opacity: 0, duration: 0.9 }, start + 3 * gap + 0.5);
  }

  // Idle loops: the stew steams and its light breathes, the pendants sway, the bokeh drifts
  private startIdle(el: HTMLElement): void {
    // Steam rises, thins and restarts; each wisp is offset so they never move as one
    gsap.utils.toArray<SVGPathElement>('[data-steam]', el).forEach((wisp, i) =>
      gsap
        .timeline({ repeat: -1, delay: 2.5 + i * 0.6 })
        .fromTo(wisp, { y: 0, opacity: 0 }, { y: -12, opacity: 0.75, duration: 1.2, ease: 'sine.out' })
        .to(wisp, { y: -30, x: i % 2 ? 5 : -5, opacity: 0, duration: 1.6, ease: 'sine.in' })
        .set(wisp, { x: 0 }),
    );
    // The stew's light and the pool on the wood breathe slowly
    gsap.to(q(el, '[data-glow]'), {
      opacity: 0.7,
      duration: 2.2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    gsap.utils.toArray<SVGGElement>('[data-sway]', el).forEach((sway, i) =>
      gsap.to(sway, {
        rotation: i % 2 ? -1.4 : 1.4,
        transformOrigin: '50% 0%',
        duration: 3.2 + i * 0.4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        // Start once the drop-in has settled
        delay: 1.6 + i * 0.15,
      }),
    );

    gsap.utils.toArray<SVGGElement>('[data-bokeh]', el).forEach((disc) =>
      gsap.to(disc, {
        opacity: 0.55,
        y: gsap.utils.random(-14, 14),
        duration: gsap.utils.random(3, 5.5),
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: gsap.utils.random(1, 3),
      }),
    );
  }

  // Layer depth from its data-depth attribute: 0 far, 1 nearest
  private depth(layer: HTMLElement): number {
    return Number(layer.dataset['depth'] ?? 0);
  }

  ngOnDestroy(): void {
    this.media?.revert();
    this.pointerMedia?.revert();
  }
}

// Every element in the scene matching a selector
function q(el: HTMLElement, selector: string): NodeListOf<Element> {
  return el.querySelectorAll(selector);
}
