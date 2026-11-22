import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

export interface VirtualViewportSize {
  width?: number;
  height?: number;
}

const DEFAULT_VIEWPORT_WIDTH = 1000;
const DEFAULT_VIEWPORT_HEIGHT = 600;

/**
 * jsdom does not perform CSS layout, so CDK virtual scroll viewports report 0x0.
 * Define configurable layout metrics on the viewport host element so CDK measures
 * a bounded viewport height and renders the expected virtualized slice.
 */
export function applyVirtualViewportSize(element: HTMLElement, size: VirtualViewportSize = {}): void {
  const width = size.width ?? DEFAULT_VIEWPORT_WIDTH;
  const height = size.height ?? DEFAULT_VIEWPORT_HEIGHT;

  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => height });
  Object.defineProperty(element, 'offsetHeight', { configurable: true, get: () => height });
  Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(element, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width,
      height,
      right: width,
      bottom: height,
      toJSON: () => ({}),
    }),
  });
}

/**
 * Applies synthetic dimensions to all `CdkVirtualScrollViewport` instances inside
 * the fixture and triggers `checkViewportSize()` so each viewport recalculates
 * its rendered range.
 */
export function measureVirtualViewports<T>(
  fixture: ComponentFixture<T>,
  size: VirtualViewportSize = {},
): CdkVirtualScrollViewport[] {
  const debugElements = fixture.debugElement.queryAll(By.directive(CdkVirtualScrollViewport));
  const viewports = debugElements.map(debugEl => debugEl.componentInstance as CdkVirtualScrollViewport);
  for (const viewport of viewports) {
    applyVirtualViewportSize(viewport.elementRef.nativeElement as HTMLElement, size);
    viewport.checkViewportSize();
  }
  return viewports;
}

async function flushMicrotasks(turns = 3): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await Promise.resolve();
  }
}

/**
 * Stabilizes Angular change detection and CDK virtual scroll microtask scheduling
 * under Vitest/jsdom so virtualized rows are rendered and measurable in DOM assertions.
 */
export async function flushVirtualScroll<T>(
  fixture: ComponentFixture<T>,
  size: VirtualViewportSize = {},
): Promise<CdkVirtualScrollViewport[]> {
  fixture.detectChanges();
  await flushMicrotasks();

  const viewports = measureVirtualViewports(fixture, size);
  await flushMicrotasks();
  fixture.detectChanges();

  // Re-check once more in case data arrived or conditional viewports mounted during the pass.
  const latestViewports = measureVirtualViewports(fixture, size);
  await flushMicrotasks();
  fixture.detectChanges();
  return latestViewports.length > 0 ? latestViewports : viewports;
}

/**
 * Scrolls a virtual scroll viewport in jsdom and waits for CDK's animationFrame
 * scroll audit + microtask change detection to render the updated slice.
 */
export async function scrollVirtualViewport<T>(
  fixture: ComponentFixture<T>,
  viewport: CdkVirtualScrollViewport,
  offset: number,
): Promise<void> {
  const element = viewport.elementRef.nativeElement as HTMLElement;
  if (viewport.orientation === 'horizontal') {
    element.scrollLeft = offset;
  } else {
    element.scrollTop = offset;
  }
  element.dispatchEvent(new Event('scroll'));

  await new Promise<void>(resolve => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 20);
    }
  });
  await flushMicrotasks();
  fixture.detectChanges();
}
