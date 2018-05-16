import { expect } from 'chai';
import { TestSession, ApplicationEnvironment } from './runner';
import { createServer } from './utils';

const session = new TestSession(createServer());

after(async () => {
  await session.close();
});

describe('Service Worker', () => {
  it('should have a version', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      await app.navigate();
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

  it('should add a meta tag', async () => {
    await session.run(async (app: ApplicationEnvironment) => {
      await app.navigate();

      await app.evaluate(function() {
        return navigator.serviceWorker.ready.then(() => {
          return navigator.serviceWorker.getRegistration();
        });
      });

      const { body, networkResult } = await app.navigate();

      expect(networkResult.response.fromServiceWorker).to.be.true;
      expect(body.body.indexOf('from-service-worker') > 0).to.be.true;
    });
  });
});