# Use Node.js base image
FROM node:18
 
# Set working directory
WORKDIR /app
 
# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install
 
# Copy the rest of the app
COPY . .
 
# Expose the app port
EXPOSE 3000
 
# Start the app
CMD ["node", "server.js"]