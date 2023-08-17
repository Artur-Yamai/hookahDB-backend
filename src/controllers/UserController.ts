import { Response, Request, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import db, { UserModels } from "../models";
import { jwtSectretKey } from "../secrets";
import { avatarsDirName } from "../constants";
import { createFileUploader } from "../utils";
import responseHandler from "../utils/responseHandler";
import logger from "../logger/logger.service";

const upload = createFileUploader(avatarsDirName);

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, login, refCode } = req.body;

    const salt = await bcrypt.genSalt(10);
    const passwordHash: string = await bcrypt.hash(password, salt);

    const queryResult = await db.query(UserModels.register(), [
      uuidv4(),
      login,
      email,
      passwordHash,
    ]);

    const newUserId = queryResult.rows[0]?.id;

    if (!newUserId) throw "Пользователь небыл создан";

    await db.query(UserModels.saveNewRefRelation(), [refCode, newUserId]);

    responseHandler.success(req, res, 201, `userId - ${newUserId}`, {
      success: true,
    });
  } catch (error: any) {
    responseHandler.error(req, res, error, "Не удалось зарегистрироваться");
  }
};

export const auth = async (req: Request, res: Response) => {
  try {
    const login: string = req.body.login;

    const queryResult = await db.query(UserModels.auth(), [login]);

    const user = queryResult.rows[0];

    if (!user) {
      const respMessage: string = "Неверный логин или пароль";
      const logText = `${login} - ${respMessage}`;
      return responseHandler.notFound(req, res, logText, respMessage);
    }

    const isValid: boolean = await bcrypt.compare(
      req.body.password,
      user.passwordHash
    );

    if (!isValid) {
      const message: string = "Неверный логин или пароль";
      responseHandler.exception(
        req,
        res,
        401,
        `${req.body.login} - ${message}`,
        message
      );
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
      },
      jwtSectretKey,
      {
        expiresIn: "30d",
      }
    );

    delete user.passwordHash;

    responseHandler.success(req, res, 200, `userId - ${user.id}`, {
      success: true,
      data: { user, token },
    });
  } catch (error) {
    responseHandler.error(req, res, error, "Не удалось авторизоваться");
  }
};

export const authById = async (req: Request, res: Response) => {
  try {
    const userId = req.headers.userId;
    const queryResult = await db.query(UserModels.authById(), [userId]);

    const user = queryResult.rows[0];

    if (!user) {
      const respMessage: string = "Пользователь не найден";
      const logText = `userId - ${userId} : ${respMessage}`;
      return responseHandler.notFound(req, res, logText, respMessage);
    }

    delete user.passwordHash;

    responseHandler.success(req, res, 200, `userId - ${user.id}`, {
      success: true,
      body: user,
    });
  } catch (error) {
    responseHandler.error(req, res, error, "Нет доступа");
  }
};

export const saveAvatar = [
  upload.single("photo"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.body.id;
      const fileName = req.file?.filename;

      if (!fileName) {
        throw Error("Фото небыло сохранено");
      }

      const queryResult = await db.query(UserModels.saveAvatar(), [
        `uploads/avatars/${fileName}`,
        userId,
      ]);

      const oldAvatarUrl = queryResult.rows[0]?.avatarUrl;

      if (oldAvatarUrl) {
        const path = "./dist/" + oldAvatarUrl;
        fs.unlink(path, (err) => {
          if (err) logger.error(err.message);
        });
      }

      next();
    } catch (error) {
      responseHandler.error(req, res, error, "Не удалось сохранить аватар");
    }
  },
  authById,
];

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const queryResult = await db.query(UserModels.getUserById(), [id]);

    const user = queryResult.rows[0];

    if (!user) {
      const respMessage: string = "Пользователь не найден";
      const logText: string = `userId - ${id} : ${respMessage}`;
      return responseHandler.notFound(req, res, logText, respMessage);
    }

    responseHandler.success(req, res, 200, `userId - ${user.id}`, {
      success: true,
      body: user,
    });
  } catch (error) {
    responseHandler.error(req, res, error, "Юзер не был найден");
  }
};

export const loginExists = async (req: Request, res: Response) => {
  try {
    const login = req.params.login;

    if (!login) {
      const message: string = "login отсутсвует";
      responseHandler.exception(req, res, 400, message, message);
      return;
    }

    const queryResult = await db.query(UserModels.loginExists(), [login]);

    const user = queryResult.rows[0];

    responseHandler.success(
      req,
      res,
      200,
      `login "${login}" ${!!user ? "exist" : "not exist"}`,
      {
        success: true,
        body: {
          isExists: !!user,
        },
      }
    );
  } catch (error) {
    responseHandler.error(req, res, error, "Логин не проверен");
  }
};

export const emailExists = async (req: Request, res: Response) => {
  try {
    const email = req.params.email;

    if (!email) {
      const message: string = "email отсутсвует";
      responseHandler.exception(req, res, 400, message, message);
      return;
    }

    const queryResult = await db.query(UserModels.emailExists(), [email]);

    const user = queryResult.rows[0];

    responseHandler.success(
      req,
      res,
      200,
      `email "${email}" ${!!user ? "exist" : "not exist"}`,
      {
        success: true,
        body: { isExists: !!user },
      }
    );
  } catch (error) {
    responseHandler.error(req, res, error, "Email не проверен");
  }
};

export const refCodeExist = async (req: Request, res: Response) => {
  try {
    const refCode = req.params.refCode;

    if (!refCode) {
      const message: string = "refCode отсутсвует";
      responseHandler.exception(req, res, 400, message, message);
      return;
    }

    const queryResult = await db.query(UserModels.refCodeExist(), [refCode]);

    const user = queryResult.rows[0];

    responseHandler.success(
      req,
      res,
      200,
      `refCode "${refCode}" ${!!user ? "exist" : "not exist"}`,
      {
        success: true,
        body: { isExists: !!user },
      }
    );
  } catch (error) {
    responseHandler.error(req, res, error, "Реферальный код не проверен");
  }
};

// export const getUserComments = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const userId = req.params.id;

//    const comments = to get comments

//     const message: string = "Получен список комментариев";
//     responseHandler.success(req, res, 201, ``, {
//       success: true,
//       message,
//       body: comments,
//     });
//   } catch (error) {
//     responseHandler.error(req, res, error, "Комментарии не получены");
//   }
// };

export const getFavoritesTobaccoByUserId = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.params.id;

    const queryResult = await db.query(
      UserModels.getFavoritesTobaccoByUserId(),
      [userId]
    );

    const tobaccoList = queryResult.rows;

    const message = "Список избранного успешно получен";
    responseHandler.success(
      req,
      res,
      201,
      `Получен списко избранных табаков пользователя`,
      {
        success: true,
        message,
        // TODO: найти как получать из БД данные сразу в нужном виде
        body: tobaccoList,
      }
    );
  } catch (error) {
    responseHandler.error(
      req,
      res,
      error,
      "Не был получен список избранных табаков"
    );
  }
};

export const getFavoritesCoalByUserId = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    const queryResult = await db.query(UserModels.getFavoritesCoalByUserId(), [
      userId,
    ]);

    const coalList = queryResult.rows;

    const message = "Список избранного успешно получен";
    responseHandler.success(
      req,
      res,
      201,
      `Получен списко избранных табаков пользователя`,
      {
        success: true,
        message,
        body: coalList,
      }
    );
  } catch (error) {
    responseHandler.error(
      req,
      res,
      error,
      "Не был получен список избранных углей"
    );
  }
};
