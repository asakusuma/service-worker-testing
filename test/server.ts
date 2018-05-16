import { TestServer } from './runner';

import { Server } from 'http';

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