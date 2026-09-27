# DeepSeek API key 配置说明

## 1. 创建自己的 key

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com/)，注册或登录自己的账号。
2. 在 API Keys 页面创建一把新 key，并复制完整内容。不同账号的可用模型和余额可能不同。
3. 这把 key 只属于创建它的账号。不要把它发到 GitHub、聊天记录、截图或前端代码里。

## 2. 写入本机配置

在项目根目录执行：

```powershell
Copy-Item .\wardrobe_local_tool\.env.example .\wardrobe_local_tool\.env
notepad .\wardrobe_local_tool\.env
```

把文件中的占位符替换成自己的 key：

```text
OPENAI_API_KEY=sk-你的真实DeepSeekKey
OPENAI_BASE_URL=https://api.deepseek.com
VISION_MODEL=这里填写账号中支持图片输入的模型名
CHAT_MODEL=deepseek-chat
CUTOUT_MODEL=birefnet-general-lite
```

等号两侧不要加多余空格或引号。`.env` 已被 Git 忽略；只有 `.env.example` 会进入仓库，而且里面没有真实密钥。

## 3. 选择视觉模型

衣物照片识别需要支持图片输入的视觉/多模态模型。登录控制台查看自己账号的模型列表，把准确的模型名填入 `VISION_MODEL`。如果模型不支持图片输入，网页会提示“当前接口或模型不支持图片输入”；这时只需要换成账号中支持图片的模型，不需要修改前端代码。

当天穿搭对话使用 `CHAT_MODEL`。如果账号中的文本模型名称不同，也按控制台显示的名称修改。

## 4. 启动和检查

先安装项目：

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

启动本地服务：

```powershell
powershell -ExecutionPolicy Bypass -File .\wardrobe_local_tool\start_web.ps1
```

另开一个终端启动网页：

```powershell
pnpm web -- --port 8091
```

可在浏览器打开 <http://localhost:8000/api/health> 检查服务是否启动。`deepseek_configured` 为 `true` 只表示本机读到了 key，不代表 key 一定有效；上传衣物时才会验证模型权限。

## 5. 常见错误

- **401 / Incorrect API key**：key 复制不完整、已撤销、余额不足，或 `OPENAI_BASE_URL` 与 key 所属平台不匹配。重新创建并粘贴该平台的 key。
- **不支持图片输入**：`VISION_MODEL` 不是视觉模型，换成控制台标注支持图片输入的模型。
- **网络超时**：先确认电脑能访问 API 地址；抠图模型首次运行还会下载到本机缓存，完成后可离线重复处理已缓存模型的图片。
- **浏览器定位失败**：在 `localhost` 页面允许位置权限；天气接口不需要把城市写死。

如果 key 曾经被公开，立即在 DeepSeek 控制台撤销旧 key，再生成新 key。
