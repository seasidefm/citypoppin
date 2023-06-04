import express from 'express';
import morgan from 'morgan';
import { engine } from 'express-handlebars';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { captureException } from '@sentry/node';
import * as Tracing from '@sentry/tracing';

import { comparePassword, hashPassword } from './lib/hashPassword';
import { getJwt, getUserFromJwt } from './lib/getJwt';
import { getUrlId } from './lib/getUrlId';

import { config } from 'dotenv';

config();

console.log('🏖 Starting server...');

const app = express();

// Constants
const TOKEN_NAME = 'citypoppin-token';

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
    helpers: {
      // Helper to check if a value is equal to another
      eq: (a: string, b: string) => a === b,
    },
  })
);
app.set('view engine', '.hbs');
app.set('views', './views');

// Routes
app.get('/', async (req, res) => {
  try {
    if (req.cookies[TOKEN_NAME]) {
      const user = await getUserFromJwt(req.cookies[TOKEN_NAME]);
      res.redirect(307, '/links')
    } else {
      // If no user just render the login page
      res.render('landing', { error: req.query.error });
    }
  } catch (e) {
    // Always render landing in case something breaks
    res.render('landing', { error: req.query.error });
  }
});

app.get('/health', (req, res) => {
  res.send('ok');
});

app.get('/signup', (req, res) => {
  res.render('signup', { error: req.query.error });
});

app.post('/signup', async (req, res) => {
  const prisma = new PrismaClient();
  const { email, password, invitationCode } = req.body;
  const hashedPassword = await hashPassword(password);
  try {
    const invite = await prisma.invitationCode.findUnique({
      where: {
        code: invitationCode,
      },
    });

    // check if invitation code is valid
    if (!invite || invite?.isUsed) {
      res.redirect('/signup?error=invalid');
      return;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // Update invitation code
    await prisma.invitationCode.update({
      where: {
        code: invitationCode,
      },
      data: {
        isUsed: true,
      },
    });

    res.cookie(TOKEN_NAME, getJwt(user), {
      httpOnly: true,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
    });
    res.redirect('/links');
  } catch (e) {
    console.error(e);
    captureException(e);

    res.redirect('/signup?error=invalid');
  }
});

app.post('/login', async (req, res) => {
  const prisma = new PrismaClient();
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  // Check if user exists and password is correct
  const passwordMatch = await comparePassword(password, user?.password || '');
  if (!passwordMatch || !user) {
    res.redirect('/?error=login');
    return;
  }

  // User is authenticated
  const jwt = getJwt(user);
  res.cookie(TOKEN_NAME, jwt, {
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
    httpOnly: true,
  });

  res.redirect('/links');
});

app.post('/links', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    if (req.body.linkTo === '') {
      return res.redirect('/links?error=linkTo');
    }

    const user = await getUserFromJwt(req.cookies[TOKEN_NAME]);
    console.log(user);
    const link = await prisma.shortLink.create({
      data: {
        slug: req.body.slug || getUrlId(),
        linkTo: req.body.linkTo,
        owner: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    console.log('🔗 Created link ' + link.slug + ' for user ' + user.email);

    res.redirect('/links?success=' + link.slug);
  } catch (e) {
    console.error(e);
    captureException(e);
    if ((e as Error).message.includes('Unique constraint failed')) {
      return res.redirect('/links?error=slugInvalid');
    }

    // TODO: handle other errors
    res.sendStatus(400);
  }
});

app.get('/links', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const cookie = req.cookies[TOKEN_NAME];

    if (!cookie) {
      res.redirect('/');
    } else {
      const user = getUserFromJwt(cookie);

      const links = await prisma.shortLink.findMany({
        where: {
          ownerId: user.id,
        },
      });

      res.render('links', {
        links,
        error: req.query.error,
        success: req.query.success,
      });
    }
  } catch (e) {
    console.error(e);
    captureException(e);
    res.sendStatus(400);
  }
});

app.get('/:slug', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const link = await prisma.shortLink.update({
      where: {
        slug: req.params.slug,
      },
      select: {
        linkTo: true,
      },
      data: {
        clicks: {
          increment: 1,
        },
      },
    });

    if (!link) {
      res.sendStatus(404);
    } else {
      res.redirect(link.linkTo);
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
