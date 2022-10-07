import express from 'express';
import { engine } from 'express-handlebars';

import { PrismaClient } from '@prisma/client';

console.log('🏖 Starting server...');

const app = express();

app.engine(
  '.hbs',
  engine({
    extname: '.hbs',
  })
);
app.set('view engine', '.hbs');
app.set('views', './views');

app.get('/', (req, res) => {
  res.render('landing');
});

app.get('/links', async (req, res) => {
  res.send('ok!');
});

const port = process.env.PORT || 5000;
app.listen(Number(port), '0.0.0.0', () => {
  console.log('☁️ App listening on port ' + port);
});
