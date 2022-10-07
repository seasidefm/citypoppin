import { User } from '@prisma/client';
import jwt from 'jsonwebtoken';

// generate a JWT token for the given user
export const getJwt = (user: User) => {
  const { id, email } = user;

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not set');
  }

  return jwt.sign({ id, email }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Validate the JWT token
export const validateJwt = (token: string) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not set');
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};

// Get the user from the JWT token
export const getUserFromJwt = (token: string) => {
  const decoded = validateJwt(token);
  return decoded as User;
};
