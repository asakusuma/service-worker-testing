import { createSession, IDebuggingProtocolClient } from "chrome-debugging-client";
import { Page, ServiceWorker } from "chrome-debugging-client/dist/protocol/tot";

function runtimeEvaluate(client: IDebuggingProtocolClient, func: Function) {
  return client.send("Runtime.evaluate", {
    expression: `(${func.toString()}())`,
    awaitPromise: true
  });
}

class ServiceWorkerState {
  private versions: Map<number, ServiceWorker.ServiceWorkerVersion>;
  private active: ServiceWorker.ServiceWorkerVersion;
  private serviceWorker: ServiceWorker;
  constructor(serviceWorker: ServiceWorker) {
    this.versions = new Map();
    this.serviceWorker = serviceWorker;

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

createSession(async (session) => {
  // spawns a chrome instance with a tmp user data
  // and the debugger open to an ephemeral port
  const process = await session.spawnBrowser('exact', {
    executablePath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome',
    additionalArguments: ['--headless', '--disable-gpu', '--hide-scrollbars', '--mute-audio'],
    windowSize: { width: 640, height: 320 }
  });

  // open the REST API for tabs
  const client = session.createAPIClient("localhost", process.remoteDebuggingPort);

  const tabs = await client.listTabs();
  const tab = tabs[0];
  await client.activateTab(tab.id);

  const debuggerClient = await session.openDebuggingProtocol(tab.webSocketDebuggerUrl || '');

  const serviceWorker = new ServiceWorker(debuggerClient);
  const page = new Page(debuggerClient);
  await page.enable();
  await serviceWorker.enable();

  const serviceWorkerState = new ServiceWorkerState(serviceWorker);

  const url = 'http://localhost:3000';
  const { frameId, errorText } = await page.navigate({
    url
  });

  if (errorText) {
    throw new Error(`Failed to load ${url}: ${errorText}`);
  }

  const result = await page.getResourceContent({ 
    frameId,
    url
  });

  console.log(result.content);

  // Wait till the service worker is ready
  await runtimeEvaluate(debuggerClient, function() {
    return navigator.serviceWorker.ready.then(() => {
      return navigator.serviceWorker.getRegistration();
    });
  });

  const active = await serviceWorkerState.getActiveVersion();

  console.log('active worker', active);
}).catch((err) => {
  console.error(err);
});