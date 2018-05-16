import { TestServer } from './framework/runner';

import { Server } from 'http';
import boot from '../server/server';

export class ExpressTestServer implements TestServer {
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

export function createServer(): Promise<TestServer> {
  const EXPRESS_PORT = 5000;
  const server = boot();

  return new Promise((resolve) => {
    const handle = server.listen(EXPRESS_PORT, () => {
      resolve(new ExpressTestServer(handle, EXPRESS_PORT));
    });
  });
}