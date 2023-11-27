const express = require("express");
const { MongoClient } = require("mongodb");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const port = 8998;
const { connect } = require("./config/db"); // 导入数据库连接函数

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const { UserModel, QRCodeModel } = require("./models");
const moment = require("moment");
const QRCodeNode = require("qrcode");

// 生成Token
const jwt = require("jsonwebtoken");
function generateToken(data, secret) {
  let iat = Math.floor(Date.now() / 1000);
  let exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 15; // 有效期 15 天
  let token = jwt.sign(
    {
      data,
      iat,
      exp,
    },
    secret,
  );
  return token;
}
function decryptToken(token, secret) {
  try {
    token = token.replace("Bearer ", "");
    let res = jwt.verify(token, secret);
    return res;
  }catch (error) {
    console.error(error);
    return false;
  }
}
// 验证Token
const authenticated = async (req, res, next) => {
  const { authorization } = req.headers;
  const decoded = decryptToken(authorization, "secret");
  if (!decoded) {
    res.status(401).send({
      code: 401,
      message: "未登录",
    });
    return;
  }
  req.logged = true;
  req.user = {
    username: decoded.data.username,
  }
  await next();
}

// 登录接口
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const db = await connect();
    const user = await db.collection("users").findOne({ username, password });
    if (!user) {
      res.send({
        code: 2241,
        message: "用户名或密码错误",
        data: null,
      });
      return;
    }
    const token = generateToken({ username }, "secret");
    res.send({
      code: 200,
      message: "登录成功",
      data: {
        token,
        userInfo: {
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      code: 500,
      message: "登录失败",
      error: error.message,
    });
  }
})
// 注册接口
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.send({
      code: 2241,
      message: "用户名或密码不能为空",
      data: null,
    });
    return;
  }
  try {
    // 如果用户名已经存在，返回错误
    const db = await connect();
    if (await db.collection("users").findOne({ username })) {
      res.send({
        code: 2241,
        message: "用户名已存在",
        data: null,
      });
      return;
    }
    // 如果用户名不存在，创建用户
    const user = new UserModel({
      username,
      password,
    });
    await db.collection("users").insertOne(user);
    res.send({
      code: 200,
      message: "注册成功",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      code: 500,
      message: "注册失败",
      error: error.message,
    });
  }
})



// 二维码生成接口
app.get("/qrcode/gene", async (req, res) => {
  try {
    const db = await connect();

    // 将二维码存入数据库
    const qrcode = new QRCodeModel({
      createdAt: Date.now(),
      expireAt: moment(Date.now()).add(120, "s").toDate(),
    });

    await db.collection("qrcodes").insertOne(qrcode);

    // 将 qrcodeData 转换成文本之后写入二维码
    let qrcodeData = {
      qrcodeId: qrcode._id,
      createdAt: qrcode.createdAt,
      expireAt: qrcode.expireAt,
    };

    const qrcodeUrl = await QRCodeNode.toDataURL(JSON.stringify(qrcodeData));

    // 返回结果
    res.send({
      code: 200,
      message: "生成二维码成功",
      data: {
        qrcodeId: qrcode._id,
        qrcodeUrl,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      code: 500,
      message: "生成二维码失败",
      error: error.message,
    });
  }
});

// 二维码状态查询接口
app.get("/qrcode/check", async (req, res) => {
  try {
    const db = await connect();

    const { qrcodeId } = req.query;
    const ObjectId = require('mongodb').ObjectId;
    const objectIdQrcodeId = new ObjectId(qrcodeId);
    const qrcode = await db.collection('qrcodes').findOne({ _id: objectIdQrcodeId });
    if (!qrcode) {
      res.send({
        code: 2241,
        message: "二维码不存在",
        data: null,
      });
      return;
    }
    res.send({
      code: 200,
      message: "查询二维码状态成功",
      data: {
        qrcodeId,
        scanned: qrcode.scanned,
        expired: moment() >= moment(qrcode.expireAt),
        success: qrcode.status === 1,
        canceled: qrcode.status === -1,
        status: qrcode.status,
        userInfo: qrcode.userInfo,
        ticket: qrcode.ticket,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      code: 500,
      message: "生成二维码失败",
      error: error.message,
    });
  }
});

// 标记已扫描接口
app.post("/qrcode/scanned", async (req, res) => {
  try {
    const db = await connect();
    const { qrcodeId } = req.body;
    const ObjectId = require('mongodb').ObjectId;
    const objectIdQrcodeId = new ObjectId(qrcodeId);
    const qrcode = await db.collection('qrcodes').findOne({ _id: objectIdQrcodeId });
    if (!qrcode) {
      res.send({
        code: 2241,
        message: "二维码不存在",
        data: null,
      });
      return;
    }
    await db.collection('qrcodes').findOneAndUpdate({ _id: objectIdQrcodeId }, { 
      $set: { 
        scanned: true,
        userInfo:{
          username: req.user.username,
        }
    } });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      code: 500,
      message: "标记已扫描失败",
      error: error.message,
    });
  }
})

// 授权接口
app.post("/qrcode/confirm", async (req, res) => {
  try {
    const db = await connect();
    const { qrcodeId } = req.body;
    const ObjectId = require('mongodb').ObjectId;
    const objectIdQrcodeId = new ObjectId(qrcodeId);
    const qrcode = await db.collection('qrcodes').findOne({ _id: objectIdQrcodeId });
    if (!qrcode) {
      res.send({
        code: 2241,
        message: "二维码不存在",
        data: null,
      });
      return;
    }
    await db.collection('qrcodes').findOneAndUpdate({ _id: objectIdQrcodeId }, { 
      $set: { status: 1, } 
  });
  res.send({
    code: 200,
    message: "授权成功",
  });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      code: 500,
      message: "授权失败",
      error: error.message,
    });
  }
})

// 取消授权接口
app.post("/qrcode/cancel", async (req, res) => {
  try {
    const db = await connect();
    const { qrcodeId } = req.body;
    const ObjectId = require('mongodb').ObjectId;
    const objectIdQrcodeId = new ObjectId(qrcodeId);
    const qrcode = await db.collection('qrcodes').findOne({ _id: objectIdQrcodeId });
    if (!qrcode) {
      res.send({
        code: 2241,
        message: "二维码不存在",
        data: null,
      });
      return;
    }
    await db.collection('qrcodes').findOneAndUpdate({ _id: objectIdQrcodeId }, { 
      $set: { status: -1, } 
  });
  res.send({
    code: 200,
    message: "取消授权成功",
  });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      code: 500,
      message: "取消授权失败",
      error: error.message,
    });
  }
})


function listen() {
  app.listen(port);
  console.log("Express app started on port " + port);
}

listen();
