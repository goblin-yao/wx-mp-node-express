import App from '@/app';
import IndexRoute from '@routes/index.route';
import ProxyAPIRoute from '@routes/proxyapi.route';
import MiniProgramAPIRoute from '@routes/miniprogram.route';
import GZHRoute from '@routes/gzh.route';
// import AuthRoute from '@routes/auth.route';
// import UsersRoute from '@routes/users.route';

const app = new App([new IndexRoute(), new ProxyAPIRoute(), new MiniProgramAPIRoute(), new GZHRoute()]);

app.listen();
