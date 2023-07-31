import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { createFileUploader } from "../utils";
import { coalDirName } from "../constants";
import responseHandler from "../utils/responseHandler";
import db, { CoalModels } from "../models";
import { getUserIdFromToken } from "../helpers";
import logger from "../logger/logger.service";

const upload = createFileUploader(coalDirName);

export const create = [
  upload.single("photo"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, fabricatorId, description } = req.body;
      const userId = req.headers.userId;
      const fileName: string | undefined = req.file?.filename;

      if (!fileName) {
        const message: string =
          "Фотография не подходят по формату или отсутсвует";
        responseHandler.exception(
          req,
          res,
          403,
          `userId - ${userId}: ${message}`,
          message
        );
        return;
      }

      const queryResult = await db.query(CoalModels.create(), [
        uuidv4(),
        name,
        fabricatorId,
        description,
        userId,
        `uploads/coals/${fileName}`,
      ]);

      const coalId = queryResult.rows[0].id;

      const message: string = "Новый уголь сохранен";
      responseHandler.success(
        req,
        res,
        201,
        `coalId - ${coalId} : ${message}`,
        {
          success: true,
          message,
          body: { id: coalId },
        }
      );
    } catch (error) {
      responseHandler.error(req, res, error, "Уголь не был создан");
    }
  },
];

export const getAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const queryResult = await db.query(CoalModels.getAll());

    const coals = queryResult.rows;

    responseHandler.success(req, res, 201, "Получен список всех углей", {
      success: true,
      body: coals,
    });
  } catch (error) {
    responseHandler.error(req, res, error, "Угли небыли получены");
  }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    const coalId = req.params.id;
    const userId: string | null = getUserIdFromToken(req.headers.authorization);

    const queryResult = await db.query(CoalModels.getById(), [coalId]); //userId

    const coal = queryResult.rows[0];

    if (!coal) {
      const respMessage: string = "Данные отстуствуют";
      const logText: string = `coalId - ${coalId} : ${respMessage}`;
      return responseHandler.notFound(req, res, logText, respMessage);
    }

    responseHandler.success(req, res, 200, `coalId - ${coalId}`, {
      success: true,
      body: coal,
    });
  } catch (error) {
    responseHandler.error(req, res, error, "Уголь небыл получены");
  }
};

export const update = [
  upload.single("photo"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      let oldPhotoUrl: string = "";
      const fileName: string | undefined = req.file?.filename;
      const userId = req.headers.userId;

      const { name, fabricatorId, description, id } = req.body;

      if (fileName) {
        const queryResult = await db.query(CoalModels.getOldPhotoUrl(), [id]);
        console.log(queryResult.rows);
        oldPhotoUrl = queryResult.rows[0]?.photoUrl;
      }

      const queryResult = await db.query(CoalModels.update(), [
        name, // $1
        fabricatorId, // $2
        description, // $3
        fileName ? `uploads/tobaccos/${fileName}` : fileName, // $4
        id, // $5
        // userId, // $6
      ]);

      const coal = queryResult.rows[0];

      if (!coal) {
        const logText = `coalId "${id}" - не найден`;
        const respMessage = "Уголь не найден";
        return responseHandler.notFound(req, res, logText, respMessage);
      }

      if (oldPhotoUrl) {
        const path = "./dist/" + oldPhotoUrl;
        fs.unlink(path, (err) => err && logger.error(err.message));
      }

      responseHandler.success(
        req,
        res,
        200,
        `userId - ${userId} updated coalId - ${id}`,
        {
          success: true,
          message: "Табак успешно обновлен",
          body: coal,
        }
      );
    } catch (error) {
      responseHandler.error(req, res, error, "Уголь не был обновлен");
    }
  },
];

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.body.id;
    const userId = req.headers.userId;

    const queryResult = await db.query(CoalModels.remove(), [id]);

    const coal = queryResult.rows[0];

    // await db.query(CoalModels.saveDeletedTobacco(), [
    //   uuidv4(),
    //   coal.tobacco_id,
    //   coal.tobacco_name,
    //   coal.fabricator_id,
    //   coal.tobacco_description,
    //   coal.photo_url,
    //   coal.user_id,
    //   coal.created_at,
    //   coal.updated_at,
    // ]);

    const logText = `userId - ${userId} deleted coalId - ${id}`;
    responseHandler.forRemoved(req, res, logText);
  } catch (error) {
    responseHandler.error(req, res, error, "Уголь не был удален");
  }
};

export const getCoalComments = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.json({ success: true, message: "getCoalComments" });
};