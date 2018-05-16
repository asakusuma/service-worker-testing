import { createSession, IDebuggingProtocolClient, IAPIClient } from 'chrome-debugging-client';
import {
  Page,
  ServiceWorker,
  IndexedDB,
  CacheStorage,
  Network
} from 'chrome-debugging-client/dist/protocol/tot';

function runtimeEvaluate<T>(client: IDebuggingProtocolClient, func: () => T) {
  return client.send<T>('Runtime.evaluate', {
    expression: `(${func.toString()}())`,
    awaitPromise: true
  });
}

export class ServiceWorkerState {
  private versions: Map<number, ServiceWorker.ServiceWorkerVersion>;
  private active: ServiceWorker.ServiceWorkerVersion;
  constructor(serviceWorker: ServiceWorker) {
    this.versions = new Map();
    serviceWorker.workerVersionUpdated = ({ versions }) => {
      for (let version of versions) {
        this.recordVersion(version);
      }
    };

    serviceWorker.workerErrorReported = (err) => {
      console.error('Service worker error:', err.errorMessage);
    };
  }
  private recordVersion(version: ServiceWorker.ServiceWorkerVersion) {
    this.versions.set(Number(version.versionId), version);
    if (version.status === 'activated') {
      this.active = version;
    }
  }
  public getActiveVersion() {
    return this.active;
  }
}

export interface TestServer {
  rootUrl: string;
  close: () => void;
  reset: () => Promise<void>;
}

export interface EvaluateFunction {
  <T>(toEvaluate: () => T): Promise<T>;
}

class FrameNavigation {
  private response: Network.ResponseReceivedParameters;
  private resolve: (res: PageNavigateResult) => void;
  private promise: Promise<PageNavigateResult>;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 10000);
      this.resolve = (res) => {
        clearTimeout(timeout);
        resolve(res);
      };
    });
  }
  onNetworkResponse(res: Network.ResponseReceivedParameters) {
    this.response = res;
  }
  onNavigationComplete({ frame }: Page.FrameNavigatedParameters) {
    this.resolve({
      frame,
      networkResult: this.response
    });
  }
  getPromise(): Promise<PageNavigateResult> {
    return this.promise;
  }
}

class FrameStore {
  private frames: { [frameId: string]: FrameNavigation };
  
  constructor() {
    this.frames = {};
  }
  start(frameId: string) {
    const nav = new FrameNavigation();
    this.frames[frameId] = nav;
    return nav.getPromise();
  }
  onNetworkResponse(res: Network.ResponseReceivedParameters) {
    if (res.frameId) {
      const nav = this.frames[res.frameId];
      if (nav) {
        nav.onNetworkResponse(res);
      }
    } else {
      throw new Error('Received network response without frameId');
    }
  }
  onNavigationComplete(result: Page.FrameNavigatedParameters) {
    const nav = this.frames[result.frame.id];
    if (nav) {
      nav.onNavigationComplete(result);
    }
  }
}

export interface PageNavigateResult {
  networkResult: Network.ResponseReceivedParameters;
  frame: Page.Frame;
};

export interface NavigateResult extends PageNavigateResult {
  body: Network.GetResponseBodyReturn;
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

export type TestFunction = (appEnv: ApplicationEnvironment) => Promise<void>;

export class TestSession<S extends TestServer = TestServer> {
  public testServerPromise: Promise<S>;
  // private securityOrigin: string = 'http://localhost'; // TODO: make this dynamic
  constructor(testServerPromise: Promise<S>) {
    this.testServerPromise = testServerPromise;
  }
  public async close() {
    const server = await this.testServerPromise;
    return server.close();
  }

  private async runDebuggingSession(test: TestFunction, server: TestServer) {
    return createSession(async (session) => {
      const process = await session.spawnBrowser('exact', {
        executablePath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome',
        additionalArguments: ['--headless', '--disable-gpu', '--hide-scrollbars', '--mute-audio'],
        windowSize: { width: 640, height: 320 }
      });

      // open the REST API for tabs
      const client = session.createAPIClient('localhost', process.remoteDebuggingPort);

      const tabs = await client.listTabs();
      const tab = tabs[0];
      await client.activateTab(tab.id);

      const dp = await session.openDebuggingProtocol(tab.webSocketDebuggerUrl || '');
      const appEnv = await ApplicationEnvironment.build(dp, client, server.rootUrl);
      await test(appEnv);
    });
  }

  public async run(test: TestFunction) {
    const server = await this.testServerPromise;
    await this.runDebuggingSession(test, server);
    await server.reset();
  }
}