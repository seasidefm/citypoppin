FROM node:18-slim

# Create app directory
WORKDIR /app

# install openssl

RUN apt-get update && apt-get install -y openssl

# Install app dependencies
COPY package.json yarn.lock ./

RUN yarn install

# Bundle app source
COPY . .

# Run prisma generate
RUN yarn prisma generate

# Build the app
RUN yarn build

# Serve the app
CMD ["yarn", "start"]
