import { expect } from 'chai';
import { TestSession, ApplicationEnvironment } from './framework/runner';
import { createServer } from './server';

const session = new TestSession(createServer());

after(async () => {
  await session.close();
});

describe('Service Worker', () => {
  it('should have a version', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      await app.navigate();

      await app.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });
      await app.waitForServiceWorkerRegistration();

      const active = await app.swState.getActiveVersion();
      expect(active.versionId).to.equal('0');
    });
  });

  it('should intercept basepage request and add meta tag', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      await app.navigate();

      await app.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      await app.waitForServiceWorkerRegistration();

      const { body, networkResult } = await app.navigate();

      expect(networkResult.response.fromServiceWorker).to.be.true;
      expect(body.body.indexOf('from-service-worker') > 0).to.be.true;
    });
  });
});