import { IDebuggingProtocolClient, IAPIClient } from 'chrome-debugging-client';

import {
  Page,
  ServiceWorker,
  IndexedDB,
  CacheStorage,
  Network
} from 'chrome-debugging-client/dist/protocol/tot';
import { ServiceWorkerState } from './models/service-worker-state';
import { FrameStore, NavigateResult } from './models/frame';

function runtimeEvaluate<T>(client: IDebuggingProtocolClient, func: () => T) {
  return client.send<T>('Runtime.evaluate', {
    expression: `(${func.toString()}())`,
    awaitPromise: true
  });
}

export interface EvaluateFunction {
  <T>(toEvaluate: () => T): Promise<T>;
}

export class ApplicationEnvironment {
  public swState: ServiceWorkerState;
  public page: Page;
  public cacheStorage: CacheStorage;
  public indexedDB: IndexedDB;
  public network: Network;
  public serviceWorker: ServiceWorker;
  public rootUrl: string;

  private debuggerClient: IDebuggingProtocolClient;
  private frameStore: FrameStore;
  private client: IAPIClient;

  private constructor(debuggerClient: IDebuggingProtocolClient, client: IAPIClient, rootUrl: string) {
    this.rootUrl = rootUrl;
    this.debuggerClient = debuggerClient;
    this.serviceWorker = new ServiceWorker(debuggerClient);
    this.page = new Page(debuggerClient);
    this.indexedDB = new IndexedDB(debuggerClient);
    this.cacheStorage = new CacheStorage(debuggerClient);
    this.network = new Network(debuggerClient);
    this.swState = new ServiceWorkerState(this.serviceWorker);
    this.client = client;

    this.frameStore = new FrameStore();

    this.network.responseReceived = this.frameStore.onNetworkResponse.bind(this.frameStore);
    this.page.frameNavigated = this.frameStore.onNavigationComplete.bind(this.frameStore);
  }

  public static async build(debuggerClient: IDebuggingProtocolClient, client: IAPIClient, rootUrl: string) {
    const instance = new ApplicationEnvironment(debuggerClient, client, rootUrl);
    await Promise.all([
      instance.page.enable(),
      instance.serviceWorker.enable(),
      instance.indexedDB.enable(),
      instance.network.enable({})
    ]);
    return instance;
  }

  public async close() {
    await Promise.all([
      this.page.disable(),
      this.serviceWorker.disable(),
      this.indexedDB.disable(),
      this.network.disable()
    ]);
  }

  public waitForServiceWorkerRegistration() {
    return this.evaluate(function() {
      // TODO: Figure out how to evaluate browser code without having to add the 'dom'
      // typescript library in tsconfig
      return navigator.serviceWorker.ready.then(() => {
        return navigator.serviceWorker.getRegistration();
      });
    });
  }

  public evaluate<T>(toEvaluate: () => T) {
    return runtimeEvaluate(this.debuggerClient, toEvaluate);
  }

  // TODO: Open new client for each tab
  public async newTab() {
    const { id } = await this.client.newTab();
    return id;
  }

  public openTabById(id: string) {
    return this.client.activateTab(id);
  }

  public async openAndActivateTab() {
    await this.newTab();
    await this.openLastTab();
  }

  public async openTabByIndex(index: number) {
    const tabs = await this.client.listTabs();
    const rawIndex = tabs.length - 1 - index;
    if (rawIndex >= 0) {
      return this.openTabById(tabs[rawIndex].id);
    }
  }

  public async openLastTab() {
    const tabs = await this.client.listTabs();
    if (tabs.length > 0) {
      const last = tabs[0];
      return this.openTabById(last.id);
    }
  }

  public async navigate(url?: string): Promise<NavigateResult> {
    url = url || this.rootUrl;

    const tree = await this.page.getFrameTree();
    const frameId = tree.frameTree.frame.id;

    const navPromise = this.frameStore.start(frameId);
    this.page.navigate({ url });

    const { networkResult, frame } = await navPromise;

    const body = await this.network.getResponseBody({
      requestId: networkResult.requestId
    });

    return {
      networkResult,
      frame,
      body
    };
  }
}

