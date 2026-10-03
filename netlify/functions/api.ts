import type { Handler } from "@netlify/functions";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import serverless from "serverless-http";
import { registerRoutes } from "../../backend/routes";

let initialize: Promise<void> | undefined;
let handleRequest: ReturnType<typeof serverless> | undefined;

async function initializeFunction() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    const functionPrefix = "/.netlify/functions/api";
    if (req.url === functionPrefix || req.url.startsWith(`${functionPrefix}/`)) {
      req.url = req.url.slice(functionPrefix.length) || "/";
    }
    next();
  });
  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buffer;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  await registerRoutes(createServer(app), app);
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    console.error("Netlify API error:", err);
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    return res.status(status).json({ message: status < 500 ? err.message : "Internal Server Error" });
  });
  handleRequest = serverless(app);
}

export const handler: Handler = async (event, context) => {
  initialize ??= initializeFunction();
  await initialize;
  return handleRequest!(event, context);
};
