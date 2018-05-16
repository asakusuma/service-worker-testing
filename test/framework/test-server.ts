export interface TestServer {
  rootUrl: string;
  close: () => void;
  reset: () => Promise<void>;
}