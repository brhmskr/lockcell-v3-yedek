FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Klasörü ve dosyayı Docker içinde manuel oluştur (Garanti olsun)
RUN mkdir -p attached_assets && touch attached_assets/lockcell-beyaz_1772012570656.webp && touch attached_assets/lockcell_logo_1772012546609.webp
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
EXPOSE 5001
CMD ["npm", "start"]
