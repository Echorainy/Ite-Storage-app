# 家里放哪儿

一个帮助记录家庭物品位置、搜索物品并管理保质期的 Expo React Native 原型。

## 运行

```bash
pnpm install
pnpm start
```

当前原型的数据保存在运行时内存中，重启 App 后会恢复示例数据。后续接入 SQLite 和本地通知。

## 多家庭版本

- 首页点击家名可新建、重命名或切换家。统计和普通物品列表仅查看当前家，搜索覆盖所有家。
- 房间页先显示卡片，点击后进入 8×8 布局。房间、橱柜、抽屉逐级返回。
- 新家从空房间列表开始；首页录入必须选择位置，布局内录入带入当前位置。
- 30 天和 7 天统计都包含今天，排除已过期物品，按本地日历日期计算。

## 验证与浏览器预览

```bash
pnpm test
pnpm typecheck
pnpm exec expo export --platform android --platform web
pnpm exec expo start --web --port 8083
pnpm exec playwright install chromium
pnpm test:ui
```

浏览器打开 http://localhost:8083。浏览器测试覆盖多家庭隔离、全局搜索、位置必选、空家庭、逐级返回、分类管理、午夜到期刷新与三种屏幕宽度的正方形网格。

当前仍不包含本地持久化、系统通知、逐格涂画与拖拽编辑、删除整个家、跨家搬移。

## 语音录入（Expo Go）

物品表单支持使用 `expo-audio` 录音（最多 15 秒），再把音频上传到语音识别接口。客户端只读取 `EXPO_PUBLIC_SPEECH_API_URL`；接口接收 multipart 字段 `audio`，并返回 `{ "text": "乌龙茶" }`。点击“使用这个名称”后回填名称，仍需用户确认保存。不会自动解析位置、日期或创建物品。

使用 Node 22.9+。复制 `.env.example` 为 `.env.local`，在本机文件内填写 `OPENAI_API_KEY`，不要将密钥粘贴到聊天中。手机与电脑连接同一个可信 Wi-Fi，设置 `SPEECH_HOST=0.0.0.0`，并把 `EXPO_PUBLIC_SPEECH_API_URL` 中的 localhost 换成电脑的局域网 IP。默认 `127.0.0.1` 只允许电脑本机访问。

分别在两个终端启动：

```bash
pnpm speech:server
# 第二个终端
pnpm start
```

内置 `server/speech.mjs` 使用 OpenAI `whisper-1` 转写中文。需要可用 API 额度和网络；密钥仅由服务端读取。该后端用于本地开发，公网部署前需加入身份验证、限流和 HTTPS。Web 测试默认允许 `http://localhost:8081`，不同端口需调整 `SPEECH_WEB_ORIGIN`；浏览器录音需要 localhost 或 HTTPS。修改客户端环境变量后重启 Expo。

真机验收：使用与项目 SDK 57 匹配的 Expo Go，检查允许/拒绝麦克风、15 秒自动停止、取消/关闭表单、断网、识别后编辑名称与手动保存。真实语音和付费接口需要配置密钥后在手机上验证。
