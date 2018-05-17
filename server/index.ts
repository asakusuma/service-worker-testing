import boot from './server';
import { ExpressTestServer } from './../test/server';

const serverApi = new ExpressTestServer();

const EXPRESS_PORT = 3000;

boot(serverApi).listen(EXPRESS_PORT, () => {
  console.log(`App listening on port ${EXPRESS_PORT}`);
});