FROM node:20-alpine

# Create app directory
WORKDIR /app

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
