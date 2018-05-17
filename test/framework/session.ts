import { createSession } from 'chrome-debugging-client';
import { ApplicationEnvironment } from "./app-env";
import { TestServer } from "./test-server";

export type TestFunction = (appEnv: ApplicationEnvironment) => Promise<void>;

export class TestSession<S extends TestServer = TestServer> {
  public testServerPromise: Promise<S>;
  // private securityOrigin: string = 'http://localhost'; // TODO: make this dynamic
  constructor(testServerPromise: Promise<S>) {
    this.testServerPromise = testServerPromise;
  }
  public async close() {
    const server = await this.testServerPromise;
    return server.close();
  }

  private async runDebuggingSession(test: TestFunction, server: TestServer) {
    return createSession(async (session) => {
      const browser = await session.spawnBrowser('exact', {
        executablePath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome',
        additionalArguments: ['--headless', '--disable-gpu', '--hide-scrollbars', '--mute-audio'],
        windowSize: { width: 640, height: 320 }
      });

      const apiClient = session.createAPIClient('localhost', browser.remoteDebuggingPort);

      const appEnv = await ApplicationEnvironment.build(apiClient, session, server.rootUrl);
      await test(appEnv);
    });
  }

  public async run(test: TestFunction) {
    const server = await this.testServerPromise;
    await this.runDebuggingSession(test, server);
    await server.reset();
  }
}