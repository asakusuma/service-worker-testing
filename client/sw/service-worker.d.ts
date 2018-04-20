// This declaration file is a stop gap measure until
// https://github.com/Microsoft/TypeScript/issues/11781
// is resolved

declare interface FetchEvent extends ExtendableEvent {
  respondWith(promise: PromiseLike<Response>): void;
  request: Request;
}

declare interface ExtendableEvent {
  waitUntil(promise: PromiseLike<any>): void;
}

declare interface PushMessageData {
  blob: () => Blob;
  arrayBuffer: () => ArrayBuffer;
  json(): () => JSON;
  text(): () => string;
}

declare interface  NotificationExtended extends Notification {
  data: {
    [key: string]: string;
    default: string;
  }
}

declare interface NotificationEvent extends ExtendableEvent {
  notification: NotificationExtended;
  action?: string;
}

declare interface PushEvent extends ExtendableEvent {
  data: PushMessageData;
}

declare interface ServiceWorkerEventMap {
    'activate': ExtendableEvent;
    'fetch': FetchEvent;
    'install': InstallEvent;
    'message': MessageEvent;
    'unhandledrejection': PromiseRejectionEvent;
    'push': PushEvent;
    'notificationclick': NotificationEvent;
    'pushsubscriptionchange': ExtendableEvent;
}

declare interface InstallEvent extends ExtendableEvent {}


declare interface Client {
  frameType: ClientFrameType;
  id: string;
  url: string;
}

declare interface Clients {
  claim(): PromiseLike<any>;
  get(id: string): PromiseLike<Client>;
  matchAll(options?: ClientMatchOptions): PromiseLike<Array<Client>>;
  openWindow(url: string): PromiseLike<WindowClient>;
}

declare interface ClientMatchOptions {
  includeUncontrolled?: boolean;
  type?: ClientMatchTypes;
}

declare interface WindowClient extends Client {
  postMessage: (d: any, ports?: MessagePort[]) => void;
  focused: boolean;
  visibilityState: WindowClientState;
  focus(): PromiseLike<WindowClient>;
  navigate(url: string): PromiseLike<WindowClient>;
}

declare type ClientFrameType = 'auxiliary' | 'top-level' | 'nested' | 'none';
declare type ClientMatchTypes = 'window' | 'worker' | 'sharedworker' | 'all';
declare type WindowClientState = 'hidden' | 'visible' | 'prerender' | 'unloaded';


declare interface ServiceWorkerGlobalScope extends Window {
  /**
   * Contains the CacheStorage object associated with the service worker.
   */
  readonly caches: CacheStorage;

  /**
   * Contains the ServiceWorkerRegistration object that represents the
   * service worker's registration.
   */
  readonly registration: ServiceWorkerRegistration;

  readonly clients: Clients;

  /**
   * An event handler fired whenever an activate event occurs — when a
   * ServiceWorkerRegistration acquires a new ServiceWorkerRegistration.active
   * worker.
   */
  onactivate: (activateevent: ExtendableEvent) => void;

  /**
   * An event handler fired whenever a fetch event occurs — when a fetch()
   * is called.
   */
  onfetch: (fetchevent: FetchEvent) => void;

  /**
   * An event handler fired whenever an install event occurs — when a
   * ServiceWorkerRegistration acquires a new
   * ServiceWorkerRegistration.installing worker.
   */
  oninstall: (installevent: InstallEvent) => void;

  /**
   * An event handler fired whenever a message event occurs — when incoming
   * messages are received. Controlled pages can use the
   * MessagePort.postMessage() method to send messages to service workers.
   * The service worker can optionally send a response back via the
   * MessagePort exposed in event.data.port, corresponding to the controlled
   * page.
   *
   * `onmessage` is actually fired with `ExtendableMessageEvent`, but
   * since we are merging the declare interface into `Window`, we should
   * make sure it's compatible with `window.onmessage`
   */
  // onmessage: (messageevent: ExtendableMessageEvent) => void;
  onmessage: (messageevent: MessageEvent) => void;


  /**
   * Allows the current service worker registration to progress from waiting
   * to active state while service worker clients are using it.
   */
  skipWaiting(): PromiseLike<void>;

  addEventListener<K extends keyof ServiceWorkerEventMap>(
      type: K,
      listener: (event: ServiceWorkerEventMap[K]) => any,
      useCapture?: boolean
  ): void;
}