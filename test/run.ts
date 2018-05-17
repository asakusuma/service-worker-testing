import { expect } from 'chai';
import { TestSession } from './framework/session';
import { createServer } from './server';

const session = new TestSession(createServer());

after(async () => {
  await session.close();
});

describe('Service Worker', () => {
  it('should have a version', async () => {
    await session.run(async (app) => {
      const client = app.getActiveTabClient();
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
    await session.run(async (app) => {
      const client = app.getActiveTabClient();
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

  it('should intercept basepage request for tabs that were created before the worker was registered', async () => {
    await session.run(async (app) => {
      const client1 = app.getActiveTabClient();
      await client1.navigate();

      const client2 = await app.openAndActivateTab();

      await client2.navigate();

      await client2.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      await client2.waitForServiceWorkerRegistration();

      const navResult = await client2.navigate();

      expect(navResult.networkResult.response.fromServiceWorker, '2nd tab with registered service worker should intercept requests').to.be.true;
      expect(navResult.body.body.indexOf('from-service-worker') > 0, '2nd tab with registered service worker should add meta tag').to.be.true;

      // Go back to the first tab
      await app.openTabByIndex(0);

      const navResult2 = await client1.navigate();

      expect(navResult2.networkResult.response.fromServiceWorker).to.be.true;
      expect(navResult2.body.body.indexOf('from-service-worker') > 0).to.be.true;
    });
  });

  it('active version should not change even after a new worker version is deployed and page is refreshed', async () => {
    await session.run(async (app) => {
      const client = app.getActiveTabClient();
      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });
      await client.waitForServiceWorkerRegistration();

      const active1 = await client.swState.getActiveVersion();
      expect(active1.versionId).to.equal('0');

      app.getTestServer().incrementVersion();

      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });
      await client.waitForServiceWorkerRegistration();

      const active2 = await client.swState.getActiveVersion();
      expect(active2.versionId).to.equal('0');

      const client2 = await app.openAndActivateTab();

      await client2.navigate();

      await client2.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      await client2.waitForServiceWorkerRegistration();

      const active3 = await client2.swState.getActiveVersion();
      // Assert that version was actually incremented
      expect(active3.versionId).to.equal('1');
    });
  });
});