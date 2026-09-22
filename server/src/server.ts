import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import connectDB from "./config/db";

const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  await connectDB();

  const server = http.createServer(app);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
