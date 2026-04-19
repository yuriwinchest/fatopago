const DEFAULT_META_PIXEL_ID = '969425095600272';
const META_PIXEL_SCRIPT_ID = 'fatopago-meta-pixel';
const META_PIXEL_DEDUP_STORAGE_KEY = 'fatopago.meta_pixel.events';

let lastTrackedPath: string | null = null;

declare global {
    interface Window {
        fbq?: MetaPixelFunction;
        _fbq?: MetaPixelFunction;
    }
}

type MetaPixelFunction = ((action: string, ...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void;
    queue?: unknown[][];
    push?: (...args: unknown[]) => void;
    loaded?: boolean;
    version?: string;
};

type MetaPixelPrimitive = string | number | boolean | null | undefined;
type MetaPixelEventParams = Record<string, MetaPixelPrimitive | MetaPixelPrimitive[]>;

export function getMetaPixelId(): string {
    return import.meta.env.VITE_META_PIXEL_ID?.trim() || DEFAULT_META_PIXEL_ID;
}

export function isMetaPixelEnabled(): boolean {
    return import.meta.env.MODE !== 'test' && Boolean(getMetaPixelId());
}

export function initializeMetaPixel(): void {
    if (!isMetaPixelEnabled() || typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    const pixelId = getMetaPixelId();

    if (!window.fbq) {
        const fbq = function (...args: unknown[]) {
            if (fbq.callMethod) {
                fbq.callMethod(...args);
            } else {
                fbq.queue?.push(args);
            }
        } as MetaPixelFunction;

        fbq.queue = [];
        fbq.loaded = true;
        fbq.version = '2.0';
        fbq.push = (...args: unknown[]) => {
            fbq.queue?.push(args);
        };

        window.fbq = fbq;
        window._fbq = fbq;
    }

    if (!document.getElementById(META_PIXEL_SCRIPT_ID)) {
        const script = document.createElement('script');
        script.id = META_PIXEL_SCRIPT_ID;
        script.async = true;
        script.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(script);
    }

    window.fbq?.('init', pixelId);
}

export function normalizeMetaPixelPath(pathname: string, search = ''): string {
    const normalizedSearch = search.trim();
    return `${pathname}${normalizedSearch}`;
}

export function shouldTrackMetaPixelPageView(nextPath: string): boolean {
    if (!nextPath || nextPath === lastTrackedPath) {
        return false;
    }

    lastTrackedPath = nextPath;
    return true;
}

export function trackMetaPixelPageView(pathname: string, search = ''): void {
    if (!isMetaPixelEnabled() || typeof window === 'undefined' || !window.fbq) {
        return;
    }

    const path = normalizeMetaPixelPath(pathname, search);

    if (!shouldTrackMetaPixelPageView(path)) {
        return;
    }

    window.fbq('track', 'PageView');
}

export function resetMetaPixelTrackingState(): void {
    lastTrackedPath = null;
}

function readTrackedMetaPixelEvents(): string[] {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const raw = window.sessionStorage.getItem(META_PIXEL_DEDUP_STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

function writeTrackedMetaPixelEvents(events: string[]): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.setItem(META_PIXEL_DEDUP_STORAGE_KEY, JSON.stringify(events.slice(-50)));
}

export function trackMetaPixelEvent(
    eventName: string,
    params?: MetaPixelEventParams,
    dedupKey?: string
): void {
    if (!isMetaPixelEnabled() || typeof window === 'undefined' || !window.fbq) {
        return;
    }

    if (dedupKey) {
        const events = readTrackedMetaPixelEvents();
        if (events.includes(dedupKey)) {
            return;
        }

        events.push(dedupKey);
        writeTrackedMetaPixelEvents(events);
    }

    if (params && Object.keys(params).length > 0) {
        window.fbq('track', eventName, params);
        return;
    }

    window.fbq('track', eventName);
}

export function buildMetaPixelDedupKey(prefix: string, value: string | number): string {
    return `${prefix}:${String(value)}`;
}
