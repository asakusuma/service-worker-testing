import { IAPIClient, ISession, ITabResponse } from 'chrome-debugging-client';
import { ClientEnvironment } from './models/client';

export class ApplicationEnvironment {
  private client: IAPIClient;
  private session: ISession;
  private testAppUrl: string;
  private activeClient: ClientEnvironment;

  private tabIdToClientEnv: {[tabId: string]: ClientEnvironment};

  private constructor(client: IAPIClient, session: ISession, testAppUrl: string) {
    this.client = client;
    this.session = session;
    this.testAppUrl = testAppUrl;
    this.tabIdToClientEnv = {};
  }

  public static async build(client: IAPIClient, session: ISession, testAppUrl: string) {
    const tabs = await client.listTabs();
    const initialTab = tabs[0];

    const appEnv = new ApplicationEnvironment(client, session, testAppUrl);
    await appEnv.buildClientEnv(initialTab);
    await appEnv.activateTab(initialTab.id);
    return appEnv;
  }

  public getActiveClient() {
    return this.activeClient;
  }

  private async buildClientEnv(tab: ITabResponse) {
    const dp = await this.session.openDebuggingProtocol(tab.webSocketDebuggerUrl || '');
    const client = await ClientEnvironment.build(dp, this.testAppUrl);
    this.tabIdToClientEnv[tab.id] = client;
    return client;
  }

  private async activateTab(tabId: string) {
    await this.client.activateTab(tabId);
    this.activeClient = this.tabIdToClientEnv[tabId];
  }

  public async newTab() {
    const tab = await this.client.newTab();
    return this.buildClientEnv(tab);
  }

  public openTabById(id: string) {
    return this.activateTab(id);
  }

  public async openAndActivateTab() {
    await this.newTab();
    await this.openLastTab();
    return this.getActiveClient();
  }

  public async openTabByIndex(index: number) {
    const tabs = await this.client.listTabs();
    const rawIndex = tabs.length - 1 - index;
    if (rawIndex >= 0) {
      return this.openTabById(tabs[rawIndex].id);
    }
  }

  public async openLastTab() {
    const tabs = await this.client.listTabs();
    if (tabs.length > 0) {
      const last = tabs[0];
      return this.openTabById(last.id);
    }
  }
}

