import { expect } from 'chai';
import { TestSession, TestServer, ApplicationEnvironment } from './runner';

import boot from '../server/server';
import { Server } from 'http';

class ExpressTestServer implements TestServer {
  public rootUrl: string;
  private server: Server;
  constructor(server: Server, port: number) {
    this.server = server;
    this.rootUrl = `http://localhost:${port}`;
  }
  close() {
    this.server.close();
  }
  reset() {
    return Promise.resolve();
  }
}

function createServer(): Promise<TestServer> {
  const EXPRESS_PORT = 5000;
  const server = boot();

  return new Promise((resolve) => {
    const handle = server.listen(EXPRESS_PORT, () => {
      resolve(new ExpressTestServer(handle, EXPRESS_PORT));
    });
  });
}

const session = new TestSession(createServer());

after(async () => {
  await session.close();
});

describe('Service Worker Core', () => {
  it('should have a version', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      await app.page.navigate({
        url: app.rootUrl
      });
      await app.evaluate(function() {
        return navigator.serviceWorker.ready.then(() => {
          return navigator.serviceWorker.getRegistration();
        });
      });
      const active = await app.swState.getActiveVersion();
      expect(active.versionId).to.equal('0');
    });
  });
});

/*
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
*/