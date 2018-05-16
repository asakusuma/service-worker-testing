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

function wait(time: number) {
  return new Promise((r) => {
    setTimeout(r, time);
  });
}

const session = new TestSession(createServer());

after(async () => {
  await session.close();
});

describe('Service Worker', () => {
  /*
  it('should have a version', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      await app.page.navigate({
        url: app.rootUrl
      });
      await app.evaluate(function() {
        // TODO: Figure out how to evaluate browser code without having to add the 'dom'
        // typescript library in tsconfig
        return navigator.serviceWorker.ready.then(() => {
          return navigator.serviceWorker.getRegistration();
        });
      });
      const active = await app.swState.getActiveVersion();
      expect(active.versionId).to.equal('0');
    });
  });
  */

  it('should add a meta tag', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      const url = app.rootUrl;
      await wait(1);
      await app.navigate(url);

      await app.evaluate(function() {
        return navigator.serviceWorker.ready.then(() => {
          return navigator.serviceWorker.getRegistration();
        });
      });

      await wait(1000);

      const { body } = await app.navigate(url);

      expect(body.content.indexOf('from-service-worker') > 0).to.be.true;
    });
  }).timeout(5000);
});