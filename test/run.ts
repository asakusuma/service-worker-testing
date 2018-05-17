import { expect } from 'chai';
import { ApplicationEnvironment } from './framework/app-env';
import { TestSession } from './framework/session';
import { createServer } from './server';

const session = new TestSession(createServer());

after(async () => {
  await session.close();
});

describe('Service Worker', () => {
  it('should have a version', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      const client = app.getActiveClient();
      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });
      await client.waitForServiceWorkerRegistration();

      const active = await client.swState.getActiveVersion();
      expect(active.versionId).to.equal('0');
    });
  });

  it('should intercept basepage request and add meta tag', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      const client = app.getActiveClient();
      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      await client.waitForServiceWorkerRegistration();

      const { body, networkResult } = await client.navigate();

      expect(networkResult.response.fromServiceWorker).to.be.true;
      expect(body.body.indexOf('from-service-worker') > 0).to.be.true;
    });
  });

  it('should not intercept basepage request for tabs that were created before the worker was registered', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      const client1 = app.getActiveClient();
      await client1.navigate();

      const client2 = await app.openAndActivateTab();

      await client2.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      await client2.waitForServiceWorkerRegistration();

      // Go back to the first tab
      await app.openTabByIndex(0);

      const { body, networkResult } = await client1.navigate();

      expect(networkResult.response.fromServiceWorker).to.be.false;
      expect(body.body.indexOf('from-service-worker') > 0).to.be.false;
    });
  });
});