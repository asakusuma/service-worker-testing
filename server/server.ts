import express, { Express } from 'express';

export {
  Express
};

export default function boot(): Express {
  const app = express();
  app.use('/', express.static('./client/static'));
  return app;
}