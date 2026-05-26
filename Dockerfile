# Use Node.js 24 LTS (Alpine for smaller image size)
FROM node:24-alpine

# Image description
LABEL org.opencontainers.image.description "A real-time, high-precision collaborative timing application for synchronized rooms across timezones."

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
