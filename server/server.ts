import express, { Express } from 'express';
import { readFileSync } from 'fs';
import { TestServerApi } from './../test/framework/test-server-api';

export {
  Express
};

export interface IServerApi extends TestServerApi {
  getWorkerVersion: () => string;
  incrementVersion: () => void;
}

export default function boot(serverApi: IServerApi): Express {
  const app = express();

  const swFile = readFileSync('./client/static/sw.js', 'utf8');

  app.get('/sw.js', (req, res) => {
    res.contentType('text/javascript');
    res.setHeader('cache-control', ['no-cache', 'no-store', 'must-revalidate', 'max-age=0'])
    res.send(swFile.replace('%VERSION%', serverApi.getWorkerVersion()));
  });

  app.use('/', express.static('./client/static/'));

  return app;
}