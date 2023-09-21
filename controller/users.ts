import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/user.middleware";
import {
  queryPromise,
  unifiedResponseBody,
  errorHandler,
} from "../utils/index";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

class UsersController {
  // 登录函数
  userLogin = async (req: Request, res: Response) => {
    const { phonenumber, password } = req.body;
    try {
      // 1. 检查手机号是否已经注册
      const retrieveRes = await queryPromise(
        "SELECT * FROM users WHERE user_phonenumber = ?",
        phonenumber
      );
      if (retrieveRes.length === 0) {
        unifiedResponseBody({
          result_code: 1,
          result_msg: "该手机号尚未注册",
          res,
        });
        return;
      }
      // 2. 检查密码是否正确
      const { password: hash } = retrieveRes[0];
      if (!bcrypt.compareSync(password, hash)) {
        unifiedResponseBody({
          result_code: 1,
          result_msg: "密码错误",
          res,
        });
        return;
      }
      (() => {
        // 3. 生成token
        const { password, createdAt, updatedAt, ...restUserInfo } =
          retrieveRes[0];
        const token = jwt.sign(restUserInfo, process.env.JWT_SECRET!, {
          expiresIn: "1h",
        });
        // 4. 返回结果
        unifiedResponseBody({
          result_code: 0,
          result_msg: "登录成功",
          result: { token },
          res,
        });
      })();
    } catch (error) {
      errorHandler({
        error,
        result_msg: "登录失败",
        result: { error },
        res,
      });
    }
  };

  // 注册函数
  userRegister = async (req: Request, res: Response) => {
    const { phonenumber, password } = req.body;
    try {
      // 1. 检查手机号是否已经注册
      const retrieveRes = await queryPromise(
        "SELECT * FROM users WHERE user_phonenumber = ?",
        phonenumber
      );
      if (retrieveRes.length !== 0) {
        unifiedResponseBody({
          result_code: 1,
          result_msg: "该手机号已注册",
          res,
        });
        return;
      }
      // 2. 将密码加密
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);

      // 3. 将用户信息存入数据库
      await queryPromise("INSERT INTO users SET ?", {
        user_phonenumber: phonenumber,
        password: hash,
      });

      // 4. 返回结果
      unifiedResponseBody({
        result_code: 0,
        result_msg: "注册成功",
        res,
      });
    } catch (error) {
      errorHandler({
        error,
        result_msg: "注册失败",
        result: { error },
        res,
      });
    }
  };

  // 更新用户信息
  updateUserInfo = async (req: AuthenticatedRequest, res: Response) => {
    const userInfo = req.body;
    const { user_id } = req.state!.userInfo;
    try {
      await queryPromise("UPDATE users SET ? WHERE user_id = ?", [
        { ...userInfo },
        user_id,
      ]);
      unifiedResponseBody({
        result_code: 0,
        result_msg: "更新用户信息成功",
        res,
      });
    } catch (error) {
      errorHandler({
        error,
        result_msg: "更新用户信息失败",
        result: {
          error,
        },
        res,
      });
    }
  };

  // 获取用户信息
  getUserInfo = async (req: AuthenticatedRequest, res: Response) => {
    // 如果有传来 user_id，就获取该用户的信息；否则，就获取当前登录用户的信息
    let user_id: number;
    if (req.query.user_id) {
      user_id = Number(req.query.user_id);
    } else {
      user_id = req.state!.userInfo.user_id;
    }
    try {
      // 去掉无关信息
      const {
        password,
        createdAt,
        updatedAt,
        university_id,
        gender,
        ...userInfo
      } = (
        await queryPromise("SELECT * FROM users WHERE user_id = ?", user_id)
      )[0];
      // 将university_id转换为university_name
      if (university_id) {
        userInfo.university = (
          await queryPromise(
            "SELECT university_name FROM universities WHERE university_id = ?",
            university_id
          )
        )[0].university_name;
      } else {
        userInfo.university = null;
      }
      // gender转为男/女
      userInfo.gender = gender === 0 ? "男" : "女";

      unifiedResponseBody({
        result_code: 0,
        result_msg: "获取用户信息成功",
        result: userInfo,
        res,
      });
    } catch (error) {
      errorHandler({
        error,
        result_msg: "获取用户信息失败",
        result: {
          error,
        },
        res,
      });
    }
  };

  // 获取用户列表
  getUserList = async (req: Request, res: Response) => {
    try {
      const result = await queryPromise(
        "SELECT * FROM users ORDER BY user_id DESC"
      );
      unifiedResponseBody({
        result_code: 0,
        result_msg: "获取用户列表成功",
        result,
        res,
      });
    } catch (error) {
      errorHandler({
        error,
        result_msg: "获取用户列表失败",
        result: {
          error,
        },
        res,
      });
    }
  };

  // 上传头像
  uploadAvatar = async (req: Request, res: Response) => {
    if (!req.file) {
      unifiedResponseBody({
        httpStatus: 400,
        result_code: 1,
        result_msg: "未检测到图片文件，请重新上传",
        res,
      });
      return;
    }
    const imgURL = `${process.env.AVATAR_PATH}/${req.file.filename}`;
    unifiedResponseBody({
      result_code: 0,
      result_msg: "上传图片成功",
      result: imgURL,
      res,
    });
  };

  // 上传背景
  uploadBackground = async (req: Request, res: Response) => {
    if (!req.file) {
      unifiedResponseBody({
        httpStatus: 400,
        result_code: 1,
        result_msg: "未检测到图片文件，请重新上传",
        res,
      });
      return;
    }
    const imgURL = `${process.env.BACKGROUND_PATH}/${req.file.filename}`;
    unifiedResponseBody({
      result_code: 0,
      result_msg: "上传图片成功",
      result: imgURL,
      res,
    });
  };
}

export const usersController = new UsersController();
