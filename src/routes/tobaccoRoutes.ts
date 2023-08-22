import { Router, NextFunction, Request, Response } from "express";
import { TobaccoController } from "../controllers";
import {
  rightsCheck,
  RoleCodes,
  checkAuth,
  handleValidationErrors,
} from "../utils";
import validations from "../validations";
import { createFileUploader } from "../utils";
import { tobaccoDirName } from "../constants";
const router = Router();

const upload = createFileUploader(tobaccoDirName);

router.get("/api/tobacco/:id", TobaccoController.getById);
router
  .route("/api/tobaccos")
  .get(TobaccoController.getAll)
  .post(
    checkAuth,
    (req: Request, res: Response, next: NextFunction) =>
      rightsCheck(req, res, next, RoleCodes.moderator),
    upload.single("photo"),
    validations.saveProduct,
    handleValidationErrors,
    TobaccoController.create
  )
  .put(
    checkAuth,
    (req: Request, res: Response, next: NextFunction) =>
      rightsCheck(req, res, next, RoleCodes.moderator),
    upload.single("photo"),
    validations.saveProduct,
    handleValidationErrors,
    TobaccoController.update
  )
  .delete(
    checkAuth,
    (req: Request, res: Response, next: NextFunction) =>
      rightsCheck(req, res, next, RoleCodes.moderator),
    TobaccoController.remove
  );
router.get("/api/tobacco/:id/comments", TobaccoController.getTobaccoComments);

export { router };
