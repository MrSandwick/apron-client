import { InjectionToken } from '@angular/core';
import { IntroPalette, PrinterIntroScene, PrinterIntroSceneOptions } from './intro-contract';
import { createPrinterIntroScene, readIntroPalette } from './printer-intro-scene';
import { CardTexture, createCardTexture } from './receipt-texture';

export type Three = typeof import('three');
type RoundedBoxModule = typeof import('three/addons/geometries/RoundedBoxGeometry.js');
export type RoundedBox = RoundedBoxModule['RoundedBoxGeometry'];
export type Gsap = typeof import('gsap').gsap;

// The libraries fetched on demand, so they stay out of the page's main bundle
export interface IntroLibs {
  three: Three;
  roundedBox: RoundedBox;
  gsap: Gsap;
}

// Everything the overlay needs from outside itself; tests provide stand-ins for these
export interface PrinterIntroDeps {
  loadLibs(): Promise<IntroLibs>;
  createScene(
    three: Three,
    roundedBox: RoundedBox,
    canvas: HTMLCanvasElement,
    options: PrinterIntroSceneOptions,
  ): PrinterIntroScene;
  readPalette(): IntroPalette;
  createCardTexture(card: HTMLElement, edge: HTMLElement | null): Promise<CardTexture>;
}

async function loadLibs(): Promise<IntroLibs> {
  const [three, rounded, gsapModule] = await Promise.all([
    import('three'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('gsap'),
  ]);
  return { three, roundedBox: rounded.RoundedBoxGeometry, gsap: gsapModule.gsap };
}

export const PRINTER_INTRO_DEPS = new InjectionToken<PrinterIntroDeps>('PRINTER_INTRO_DEPS', {
  providedIn: 'root',
  factory: () => ({
    loadLibs,
    createScene: createPrinterIntroScene,
    readPalette: readIntroPalette,
    createCardTexture,
  }),
});
