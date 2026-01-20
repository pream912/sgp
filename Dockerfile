# Use the official full Node.js 20 image.
FROM node:20

# Create and change to the app directory.
WORKDIR /app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
COPY package*.json ./

# Install production dependencies.
RUN npm install --omit=dev

# Install dependencies for the HTML Skeleton (Tailwind)
# We need to copy the skeleton package.json first to cache this layer
COPY templates/html-skeleton/package*.json ./templates/html-skeleton/
RUN cd templates/html-skeleton && npm install

# Copy local code to the container image.
COPY . .

# Run the web service on container startup.
CMD [ "node", "server.js" ]
