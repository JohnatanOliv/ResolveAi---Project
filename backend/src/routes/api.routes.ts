import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import * as occurrenceController from "../controllers/occurrence.controller";
import { requireAuth, requireManager } from "../middleware/auth.middleware";

export const apiRouter = Router();

apiRouter.post("/auth/register", authController.register);
apiRouter.post("/auth/login", authController.login);
apiRouter.get("/me", requireAuth, (req, res) => res.json({ user: (req as import("../middleware/auth.middleware").AuthRequest).user }));

apiRouter.get("/occurrences", requireAuth, occurrenceController.list);
apiRouter.post("/occurrences", requireAuth, occurrenceController.create);
apiRouter.get("/occurrences/:id", requireAuth, occurrenceController.getById);
apiRouter.patch("/occurrences/:id", requireAuth, requireManager, occurrenceController.update);
apiRouter.post("/occurrences/:id/comments", requireAuth, occurrenceController.addComment);
apiRouter.post("/occurrences/:id/rating", requireAuth, occurrenceController.rate);
apiRouter.get("/dashboard", requireAuth, requireManager, occurrenceController.dashboard);
