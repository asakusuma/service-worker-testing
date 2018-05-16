import { TestServer } from './runner';
import boot from '../server/server';
import { ExpressTestServer } from './server';

export function createServer(): Promise<TestServer> {
  const EXPRESS_PORT = 5000;
  const server = boot();

  return new Promise((resolve) => {
    const handle = server.listen(EXPRESS_PORT, () => {
      resolve(new ExpressTestServer(handle, EXPRESS_PORT));
    });
  });
}

export function wait(time: number) {
  return new Promise((r) => {
    setTimeout(r, time);
  });
}