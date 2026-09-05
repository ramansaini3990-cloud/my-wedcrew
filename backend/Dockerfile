# WedCrew API container.
#
# Runs as the unprivileged `node` user and installs production dependencies
# only. The image intentionally carries no secrets — every value comes from the
# environment at run time (see .env.example).

FROM node:24-alpine

ENV NODE_ENV=production

WORKDIR /app

# Copy manifests first so `npm ci` is cached independently of source changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Uploaded portfolio media lives here. Created before dropping privileges so
# the `node` user can write to it.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Image layers are EPHEMERAL: anything written into /app/uploads inside the
# container is lost when the container is replaced. Mount a real volume (or
# migrate uploadService.js to object storage) or uploaded media will vanish on
# every redeploy while the GalleryItem rows survive, pointing at nothing.
VOLUME ["/app/uploads"]

USER node

EXPOSE 5000

CMD ["node", "server.js"]
