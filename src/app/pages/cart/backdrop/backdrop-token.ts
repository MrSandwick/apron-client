import { InjectionToken } from '@angular/core';
import { SceneFactory } from './backdrop-scene';
import { bokehScene } from './bokeh';

// The scene the backdrop draws; a test can provide a fake factory instead of the bokeh
export const BACKDROP_SCENE = new InjectionToken<SceneFactory>('BACKDROP_SCENE', {
  providedIn: 'root',
  factory: () => bokehScene,
});
