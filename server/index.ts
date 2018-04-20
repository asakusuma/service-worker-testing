import express, { Request, Response } from "express";

const app = express();

/*
app.get('/', (req: Request, res: Response) => {
  res.send('Hello worldz');
});
*/

app.use('/', express.static('./client/static'));

const EXPRESS_PORT = 3000;

app.listen(EXPRESS_PORT, () => {
  console.log(`App listening on port ${EXPRESS_PORT}`);
});