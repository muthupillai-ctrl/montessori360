# Runtime image for apps/api and apps/ams-api. The build context is staged by
# scripts/lib/common.sh: compiled dist/ + a package.json with dev and workspace
# deps removed and versions pinned to what's installed locally.
FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY dist ./dist
ENV NODE_ENV=production
# package.json "main" points at the compiled entry point
CMD ["node", "."]
