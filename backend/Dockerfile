FROM node:22-alpine

WORKDIR /app

# Copy root & shared packages if any
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/ ./shared/

# Install dependencies
RUN npm --prefix backend install

# Copy backend source
COPY backend/ ./backend/

WORKDIR /app/backend

# Build backend
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
