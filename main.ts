import express from 'express';
import { engine } from 'express-handlebars';

import { PrismaClient } from '@prisma/client';
import { hashPassword } from './lib/hashPassword';
import { getJwt } from './lib/getJwt';

console.log('🏖 Starting server...');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded());

// Handlebars engine
app.engine(
  '.hbs',
  engine({
    extname: '.hbs',
  })
);
app.set('view engine', '.hbs');
app.set('views', './views');

// global setup
const prisma = new PrismaClient();

// Routes
app.get('/', (req, res) => {
  res.render('landing');
});

app.post('/users/new', async (req, res) => {
  try {
    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        password: await hashPassword(req.body.password),
      },
    });

    res
      .cookie('poppin-tk', getJwt(user), {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
        httpOnly: true,
      })
      .redirect('/links');
  } catch (e) {
    console.error(e);
    res.sendStatus(400);
  }
});

app.get('/links', async (req, res) => {
  // const prisma = new PrismaClient();

  res.send('ok!');
});

const port = process.env.PORT || 5000;
app.listen(Number(port), '0.0.0.0', () => {
  console.log('☁️ App listening on port ' + port);
});
