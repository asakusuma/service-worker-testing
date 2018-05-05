import { createSession, IDebuggingProtocolClient } from 'chrome-debugging-client';
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


export interface ApplicationEnvironment {
  swState: ServiceWorkerState;
  page: Page;
  cacheStorage: CacheStorage;
  indexedDB: IndexedDB;
  network: Network;
  serviceWorker: ServiceWorker;
  rootUrl: string;
  evaluate: EvaluateFunction;
}

async function buildEnv(debuggerClient: IDebuggingProtocolClient, rootUrl: string): Promise<ApplicationEnvironment> {
  const serviceWorker = new ServiceWorker(debuggerClient);
  const page = new Page(debuggerClient);
  const indexedDB = new IndexedDB(debuggerClient);
  const cacheStorage = new CacheStorage(debuggerClient);
  const network = new Network(debuggerClient);
  await Promise.all([
    page.enable(),
    serviceWorker.enable(),
    indexedDB.enable(),
    network.enable({})
  ]);
  const swState = new ServiceWorkerState(serviceWorker);

  return {
    rootUrl,
    swState,
    page,
    serviceWorker,
    network,
    indexedDB,
    cacheStorage,
    evaluate: <T>(toEvaluate: () => T) => {
      return runtimeEvaluate(debuggerClient, toEvaluate);
    }
  };
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
      const appEnv = await buildEnv(dp, server.rootUrl);
      await test(appEnv);
    });
  }

  public async run(test: TestFunction) {
    const server = await this.testServerPromise;
    await this.runDebuggingSession(test, server);
    await server.reset();
  }
}