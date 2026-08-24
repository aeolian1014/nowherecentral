# ------------------------------------------------------------------
# Nowhere Central — local container
#
# There is nothing to build. The site is hand-written HTML, CSS and ES
# modules, and server.js is a zero-dependency static server, so this is
# a runtime image and not a build pipeline: no package.json, no install
# step, no bundler. Alpine because the whole job is reading files off
# disk and writing them to a socket.
# ------------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

# Copied by hand rather than `COPY . .` so the image holds what the site
# serves and nothing else — the same rule the asset tree follows. A new
# top-level directory has to be added here on purpose.
COPY server.js index.html ./
COPY css/ ./css/
COPY js/ ./js/
COPY assets/ ./assets/

# server.js already reads PORT, and Node's listen() binds every
# interface by default, which is what makes it reachable from outside
# the container.
ENV PORT=4173
EXPOSE 4173

# Alpine's busybox wget is enough to answer "is it serving yet".
HEALTHCHECK --interval=10s --timeout=3s --start-period=2s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:4173/ || exit 1

USER node

CMD ["node", "server.js"]
