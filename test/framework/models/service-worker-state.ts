import {
  ServiceWorker
} from 'chrome-debugging-client/dist/protocol/tot';

export class ServiceWorkerState {
  private versions: Map<number, ServiceWorker.ServiceWorkerVersion>;
  private active: ServiceWorker.ServiceWorkerVersion;
  constructor(serviceWorker: ServiceWorker) {
    this.versions = new Map();
    serviceWorker.workerVersionUpdated = ({ versions }) => {
      for (let version of versions) {
        this.recordVersion(version);
      }
    };

    serviceWorker.workerErrorReported = (err) => {
      console.error('Service worker error:', err.errorMessage);
    };
  }
  private recordVersion(version: ServiceWorker.ServiceWorkerVersion) {
    this.versions.set(Number(version.versionId), version);
    if (version.status === 'activated') {
      this.active = version;
    }
  }
  public getActiveVersion() {
    return this.active;
  }
}