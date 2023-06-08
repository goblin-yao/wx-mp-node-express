import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import { PORT, LOG_FORMAT, NODE_ENV } from '@config';
import DB from '@databases';
import { Routes } from '@interfaces/routes.interface';
import errorMiddleware from '@middlewares/error.middleware';
import rateLimit from 'express-rate-limit';
import { logger, stream } from '@utils/logger';
import { join } from 'path';

class App {
  public app: express.Application;
  public env: string;
  public port: string | number;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || 80;

    this.connectToDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeSwagger();
    this.initializeErrorHandling();
  }

  public listen() {
    this.app.listen(this.port, () => {
      logger.info(`=================================`);
      logger.info(`======= ENV: ${this.env} =======`);
      logger.info(`🚀 App listening on the port ${this.port}`);
      logger.info(`=================================`);
    });
  }

  public getServer() {
    return this.app;
  }

  private connectToDatabase() {
    DB.sequelizeInstance.sync({ force: false });
  }

  private initializeMiddlewares() {
    this.app.use(cookieParser());

    // 创建限流中间件
    this.app.use(
      rateLimit({
        windowMs: 60 * 60 * 1000, // 1小时最多
        max: 500, // 最多允许500次请求
        keyGenerator: function (req) {
          // 根据 IP 地址和用户 ID, openid等 生成唯一标识
          return req.ip + '-' + (req.cookies['openid'] || req.headers['x-wx-openid']);
        },
        skip: (req, res) => {
          console.log('[req.path]', req.path);
          // 判断请求路径是否是静态文件路径
          if (req.path.startsWith('/public/') || req.path.startsWith('/asserts/')|| req.path.endsWith('.html')) {
            return true; // 跳过限流处理
          }
          if (req.path.includes('/proxyapi/chatstreaminvterval')) {
            return true; // 跳过限流处理
          }

          return false;
        },
        message: '请求过于频繁，请稍后再试！',
      }),
    );
    this.app.use(morgan(LOG_FORMAT, { stream }));
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, '../public'))); //存放html页面相关的，web版聊天
    this.app.use(express.static(join(__dirname, '../public_static'))); //存放微信认证等相关的内容
    this.app.use(express.urlencoded({ extended: false }));
  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach(route => {
      this.app.use('/', route.router);
    });
  }

  private initializeSwagger() {
    const options = {
      swaggerDefinition: {
        info: {
          title: 'REST API',
          version: '1.0.0',
          description: 'Example docs',
        },
      },
      apis: ['swagger.yaml'],
    };

    const specs = swaggerJSDoc(options);
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }
}

export default App;
