import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { apiRouter } from "./routes/api.routes";

export const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", apiRouter);
app.use((_req, res) => res.status(404).json({ message: "Rota não encontrada" }));
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ message: "Erro interno do servidor" });
});
