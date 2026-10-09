import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import * as companyController from "../controllers/company.controller";
import * as managerAccessController from "../controllers/manager-access.controller";
import * as occurrenceController from "../controllers/occurrence.controller";
import { requireAdmin, requireAuth, requireManager } from "../middleware/auth.middleware";

export const apiRouter = Router();

apiRouter.post("/auth/register", authController.register);
apiRouter.post("/auth/login", authController.login);
apiRouter.get("/me", requireAuth, (req, res) => res.json({ user: (req as import("../middleware/auth.middleware").AuthRequest).user }));

apiRouter.get("/manager-access-request", requireAuth, managerAccessController.getOwnRequest);
apiRouter.post("/manager-access-request", requireAuth, managerAccessController.request);
apiRouter.get("/admin/manager-access-requests", requireAuth, requireAdmin, managerAccessController.list);
apiRouter.patch("/admin/manager-access-requests/:id", requireAuth, requireAdmin, managerAccessController.decide);

apiRouter.get("/companies", requireAuth, companyController.list);
apiRouter.get("/companies/managed", requireAuth, requireManager, companyController.listManaged);
apiRouter.post("/companies", requireAuth, requireManager, companyController.create);
apiRouter.get("/companies/:companyId/locations", requireAuth, companyController.listLocations);
apiRouter.post("/companies/:companyId/locations", requireAuth, requireManager, companyController.addLocation);
apiRouter.get("/companies/:companyId/operators", requireAuth, requireManager, companyController.listOperators);
apiRouter.post("/companies/:companyId/operators", requireAuth, requireManager, companyController.addOperator);

apiRouter.get("/occurrences", requireAuth, occurrenceController.list);
apiRouter.post("/occurrences", requireAuth, occurrenceController.create);
apiRouter.get("/occurrences/:id", requireAuth, occurrenceController.getById);
apiRouter.patch("/occurrences/:id", requireAuth, requireManager, occurrenceController.update);
apiRouter.post("/occurrences/:id/comments", requireAuth, occurrenceController.addComment);
apiRouter.post("/occurrences/:id/rating", requireAuth, occurrenceController.rate);
apiRouter.get("/dashboard", requireAuth, requireManager, occurrenceController.dashboard);
