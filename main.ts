import express from 'express';
import morgan from 'morgan';
import { engine } from 'express-handlebars';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { captureException } from '@sentry/node';
import * as Tracing from '@sentry/tracing';

import { hashPassword } from './lib/hashPassword';
import { getJwt, getUserFromJwt } from './lib/getJwt';

console.log('🏖 Starting server...');

const app = express();

// Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],
  tracesSampleRate: 0.5,
});

// Middleware
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static('public'));
app.use(cookieParser());
if (process.env.NODE_ENV === 'development') {
  // small logs for development
  app.use(morgan('dev'));
} else {
  // large logs for production
  app.use(morgan('combined'));
}

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
    captureException(e);
    res.sendStatus(400);
  }
});

app.get('/links', async (req, res) => {
  try {
    const cookie = req.cookies['poppin-tk'];

    if (!cookie) {
      res.redirect('/');
    } else {
      const user = getUserFromJwt(cookie);

      const links = await prisma.shortLink.findMany({
        where: {
          ownerId: user.id,
        },
      });

      res.render('links', { links });
    }
  } catch (e) {
    console.error(e);
    captureException(e);
    res.sendStatus(400);
  }
});

// Error handlers (must be after all routes)
app.use(Sentry.Handlers.errorHandler());

const port = process.env.PORT || 5000;
app.listen(Number(port), '0.0.0.0', () => {
  console.log('☁️ App listening on port ' + port);
});
