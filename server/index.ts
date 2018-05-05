import boot from './server';

const EXPRESS_PORT = 3000;

boot().listen(EXPRESS_PORT, () => {
  console.log(`App listening on port ${EXPRESS_PORT}`);
});