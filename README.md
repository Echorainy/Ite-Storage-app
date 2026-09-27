# MeRoom

“MeRoom”是一款基于 Expo、React Native 和 SQLite 的家庭物品位置管理应用，也可用于搭建个人智能衣柜。它把家庭、房间、收纳模块和物品组织成可搜索的空间结构，帮助你快速记录和找回物品。

## 功能

### 家庭与空间管理

- 创建、切换和重命名多个家庭。
- 支持删除整个家庭；删除时会级联移除该家庭的房间、收纳模块和物品，并取消相关到期提醒。
- 为每个家庭创建房间，例如厨房、卧室、主卧衣柜或储物间。
- 在房间中创建两级收纳模块，例如橱柜、抽屉、挂衣区和收纳盒。
- 为模块设置颜色，并用 8×8 网格记录模块占用的空间。
- 支持点击或拖动编辑网格；已占用的位置不能重复使用。
- Android 返回键支持从模块逐级返回房间。

### 物品记录与搜索

- 记录物品名称、所属家庭、房间、具体模块、分类和网格位置。
- 支持编辑、删除物品和查看完整位置路径。
- 首页搜索覆盖所有家庭，可按物品名称、分类或位置搜索。
- 首页和物品页提供“全部物品”“30 天内过期”“7 天内过期”“已过期”筛选统计。

### 分类与保质期

- 内置食品、饮品、药品、清洁用品、工具、文件、其他和未分类。
- 支持创建、修改和删除自定义分类。
- 可直接设置过期日期，也可通过生产日期和保质期天数计算过期日。
- 在支持本地通知的独立开发版中，可在到期前默认 7 天上午 9:00 提醒。

### 智能衣柜系统

应用内置独立的“智能衣柜”页面，用于管理衣物并生成当天的穿搭建议：

- **衣物档案**：记录衣物名称、类别、颜色、材质、季节、图片和存放位置。
- **衣物分类**：支持上身、下身、鞋子和配饰，并提供 T 恤、衬衫、牛仔裤、运动鞋、包、帽子等细分类别。
- **智能识别**：网页端可上传衣物图片，由衣物视觉服务识别名称、类别、颜色、材质和季节，并生成图片预览。
- **批量导入**：网页端支持导入 JSON 衣物清单。
- **衣物搜索**：可按名称、类别、颜色、材质或季节搜索，并查看衣物所在家庭、房间和模块。
- **天气绑定**：网页端可绑定当前位置，调用天气服务获取今天的城市、温度、天气状况和降雨概率。
- **AI 穿搭建议**：结合当天的天气和当前衣柜内容生成一套穿搭建议；DeepSeek 服务不可用时会自动使用本地规则生成建议。

推荐的使用流程：

1. 进入“智能衣柜”，先添加衣物或导入衣物 JSON。
2. 为衣物选择类别、颜色、材质和季节，并按需设置房间或收纳模块位置。
3. 在网页端绑定当前位置获取天气。
4. 点击“生成今日建议”，根据当天气温和衣柜中的衣物查看穿搭建议。

智能衣柜的天气、图片识别、JSON 导入和 AI 建议依赖项目配置的服务地址，默认地址为 `http://localhost:8000`，可通过 `EXPO_PUBLIC_WARDROBE_API_URL` 修改。移动端页面支持衣物档案和位置管理；图片上传、JSON 导入和浏览器定位天气目前仅在网页端开放。

衣物改造示例入口目前用于展示示例，实际改造功能尚未完成。

### DeepSeek API Key 配置

智能衣柜的“今日 AI 穿搭建议”需要一个服务端来调用 DeepSeek。请先在 DeepSeek 开放平台创建 API Key，再把密钥配置到衣柜服务端；不要把密钥写入 `App.tsx`、`src/WardrobePage.tsx`、Expo 客户端代码或提交到 Git。

#### 1. 创建 DeepSeek API Key

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com/) 并登录账号。
2. 进入 API Keys 页面，点击创建新 Key。
3. 复制生成的 Key。Key 通常只会完整显示一次，请立即保存到密码管理器。
4. 根据平台要求完成充值或设置余额/用量限制，确保服务端有可用额度。

#### 2. 使用 PowerShell 一键配置本地服务

本仓库已经包含 `wardrobe_local_tool` 衣柜服务端，不需要另行下载或手动创建后端文件夹。先在项目根目录打开 PowerShell，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

如果当前 PowerShell 显示的路径不是项目目录，请先切换到项目实际所在的位置。不要直接输入“项目目录”；那只是文档中的占位说明。最简单的做法是在资源管理器中打开项目文件夹 `整理箱`，点击地址栏，输入 `powershell` 并回车。新窗口中的路径应当以项目目录结尾，然后执行上面的命令。

也可以使用完整路径切换目录。请把下面的路径替换成你电脑上实际的项目路径：

```powershell
Set-Location "C:\Users\你的用户名\Documents\ChatGPT\整理箱"
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

执行前可以用下面的命令确认当前位置和脚本是否存在：

```powershell
Get-Location
Test-Path .\setup.ps1
```

第二条命令返回 `True` 后，再运行配置命令。

脚本会自动安装前端依赖、创建 `wardrobe_local_tool\.venv`、安装 Python 依赖，并准备 `wardrobe_local_tool\.env`。执行过程中会安全地询问 DeepSeek API Key，输入内容不会显示。

脚本使用后端实际读取的变量名：

```dotenv
OPENAI_API_KEY=你的 DeepSeek API Key
OPENAI_BASE_URL=https://api.deepseek.com
CHAT_MODEL=deepseek-chat
VISION_MODEL=deepseek-flash
```

API Key 会保存到 `wardrobe_local_tool\.env`，不会写入 Expo 客户端。重复执行 `setup.ps1` 时，如果已经存在有效 Key，脚本会保留现有配置，不会覆盖。

#### 3. 启动本地服务

配置完成后，继续在项目根目录执行：

```powershell
.\start-all.ps1
```

该命令会启动衣柜 API（默认 `http://localhost:8000`）和 MeRoom Web 客户端（默认 `http://localhost:8091`）。也可以分别启动：

```powershell
powershell -ExecutionPolicy Bypass -File .\wardrobe_local_tool\start_web.ps1 -Port 8000
pnpm web -- --port 8091
```

`.env` 文件只供服务端读取，应加入后端项目的 `.gitignore`：

```gitignore
.env
.env.*
!.env.example
```

可以提交不含真实密钥的模板文件 `.env.example`：

```dotenv
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.deepseek.com
CHAT_MODEL=deepseek-chat
VISION_MODEL=deepseek-flash
```

不要在日志、错误页面、截图、提交记录或前端返回值中打印完整 API Key。

#### 4. 配置前端访问地址

在本项目根目录创建 `.env.local`：

```powershell
EXPO_PUBLIC_WARDROBE_API_URL=http://localhost:8000
```

`EXPO_PUBLIC_` 变量会被打包进客户端，只能放服务端地址等公开信息，不能放 `OPENAI_API_KEY` 或任何 DeepSeek 密钥。修改后重启 Expo：

```powershell
pnpm start
```

如果手机访问电脑上的服务端，`localhost` 指的是手机本身，需要改成电脑在局域网中的 IP，例如：

```powershell
EXPO_PUBLIC_WARDROBE_API_URL=http://192.168.1.100:8000
```

同时确保服务端监听局域网地址（例如 `0.0.0.0`）、电脑防火墙允许该端口，并让手机和电脑连接同一网络。部署到线上时，将它改成 HTTPS 服务地址，例如 `https://wardrobe.example.com`。

#### 5. 确认服务端接口

衣柜页面会请求：

| 请求 | 用途 |
| --- | --- |
| `POST /api/chat` | 调用 DeepSeek 生成今日穿搭建议 |
| `GET /api/weather?days=1&latitude=<纬度>&longitude=<经度>` | 获取天气 |
| `POST /api/analyze` | 上传衣物图片并请求识别 |

其中 `/api/chat` 应在服务端完成以下流程：读取 `OPENAI_API_KEY`，向 DeepSeek API 发起请求，把天气和衣物清单转为提示词，并向客户端返回：

```json
{ "answer": "今天建议穿……" }
```

客户端发送的 JSON 至少包含 `message`、`wardrobe` 和 `weather`。DeepSeek 请求失败时，客户端会退回本地规则建议。

#### 6. 验证配置

服务端启动后，先用浏览器或命令行确认地址可访问，再打开应用的“智能衣柜”页面并点击“生成今日建议”。例如检查聊天接口是否连通：

```powershell
$body = @{
  message = '只返回一句测试回复'
  wardrobe = @()
  weather = $null
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:8000/api/chat' `
  -ContentType 'application/json' `
  -Body $body
```

如果返回包含 `answer` 的 JSON，说明客户端和服务端接口已连通。若页面提示“DeepSeek 服务暂不可用”，依次检查服务端是否启动、`OPENAI_API_KEY` 是否加载、账户余额是否可用、前端 URL 是否正确，以及手机是否能访问电脑 IP。

#### 7. 常见安全要求

- API Key 只放在服务端环境变量中，不放在 `EXPO_PUBLIC_*` 变量中。
- 不要把 API Key 直接写入 README、源码、JSON 衣物文件或测试数据。
- 如果 Key 泄露，立即在 DeepSeek 平台撤销并重新创建，然后重启服务端。
- 生产环境使用 HTTPS，并在服务端限制请求频率和错误信息，避免把上游密钥或完整响应暴露给客户端。
## 技术栈

- Expo 57
- React 19
- React Native 0.86
- TypeScript
- Expo SQLite
- Expo Notifications
- React Native Gesture Handler

## 环境要求

- Node.js 18 或更高版本
- pnpm
- Android：Android Studio 和模拟器，或 Android 真机
- iOS：macOS、Xcode 和 iOS 模拟器，或 iPhone 真机

## 安装与启动

```powershell
pnpm install
pnpm start
```

也可以直接启动目标平台：

```powershell
pnpm android   # Android
pnpm ios       # iOS，需要 macOS + Xcode
pnpm web       # 浏览器
```

首次启动会创建示例数据，包括“我的家”、厨房、卧室、收纳模块和示例物品。移动端数据会保存到设备本地 SQLite 数据库，重启应用后仍然保留。

## Android 使用

### Android 模拟器

1. 安装 Android Studio 并启动一个模拟器。
2. 在项目目录执行：

   ```powershell
   pnpm install
   pnpm android
   ```

3. 应用会安装并在模拟器中打开。

### Android 真机

1. 开启手机“开发者选项”和“USB 调试”，或让手机与电脑连接到同一局域网。
2. 执行 `pnpm start`，在 Expo 开发服务器菜单中选择设备，或使用二维码打开应用。
3. 如果需要测试系统通知，请使用独立开发版；Expo Go 预览环境不会启用通知模块。

### 构建 Android APK

项目已经配置 EAS 内部测试构建：

```powershell
npx eas login
npx eas build --profile preview --platform android
```

`preview` 会生成可安装的 APK。正式发布包使用：

```powershell
npx eas build --profile production --platform android
```

## iOS 使用

### iOS 模拟器

1. 在 macOS 安装 Xcode 并启动 iPhone 模拟器。
2. 在项目目录执行：

   ```powershell
   pnpm install
   pnpm ios
   ```

### iPhone 真机

1. 通过 USB 连接 iPhone，或确保 iPhone 与电脑在同一局域网。
2. 执行 `pnpm start`，通过 Expo 开发服务器菜单或二维码打开应用。
3. 测试本地通知时，请使用独立开发版并允许系统通知；Expo Go 仅用于界面和基础流程预览。

## 数据与通知

- 数据只保存在当前设备，不提供账号登录、云同步或跨设备共享。
- 卸载应用或清除应用数据会删除本地家庭、房间、模块、物品和分类。
- 本地通知在设备端生成，不依赖远程服务器。
- 修改物品会重新安排提醒，删除物品会取消对应提醒。
- 可在“设置 → 到期提醒”中申请通知权限；若此前拒绝，请先到系统设置中允许通知。

## 开发与验证

```powershell
pnpm typecheck
pnpm test
pnpm exec expo export --platform android --platform web
```

运行浏览器 UI 测试：

```powershell
pnpm exec expo start --web --port 8083
pnpm exec playwright install chromium
pnpm test:ui
```

浏览器预览地址：<http://localhost:8083>

## 项目结构

- `App.tsx`：应用状态、导航和主要业务流程
- `src/domain.ts`：家庭、房间、模块、物品和日期逻辑
- `src/storage.ts`、`src/persistence.ts`：SQLite 存储和快照编解码
- `src/notifications.ts`：通知权限和提醒调度
- `src/pages.tsx`、`src/ItemForm.tsx`：页面和物品表单
- `tests/`：领域、持久化、通知和网格编辑测试

## 当前限制

- 目前是本地单设备应用，没有云端账户和同步功能。
- Expo Go 中不启用系统通知，需要独立开发版或正式构建才能完整验证通知。
- 暂不支持跨家庭移动物品。衣物改造功能仍在开发中。
