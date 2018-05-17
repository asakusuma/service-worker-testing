import { Server } from 'http';
import boot, { IServerApi } from '../server/server';

export class ExpressTestServer implements IServerApi {
  public rootUrl: string;
  private server: Server;
  private version: number;
  constructor() {
    this.version = 0;
  }
  attach(server: Server, port: number) {
    this.server = server;
    this.rootUrl = `http://localhost:${port}`;
    return this;
  }
  close() {
    this.server.close();
  }
  reset() {
    return Promise.resolve();
  }

  incrementVersion() {
    this.version++;
  }

  getWorkerVersion() {
    return String(this.version);
  }
}

export function createServer(): Promise<IServerApi> {
  const EXPRESS_PORT = 5000;
  const serverApi = new ExpressTestServer();
  const server = boot(serverApi);

  return new Promise((resolve) => {
    const handle = server.listen(EXPRESS_PORT, () => {
      resolve(serverApi.attach(handle, EXPRESS_PORT));
    });
  });
}