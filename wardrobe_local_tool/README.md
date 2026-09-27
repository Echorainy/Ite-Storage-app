# 智能衣柜本地视觉服务

这个目录提供 Outfit App 使用的本地 FastAPI 服务。图片先在本机用 rembg 的 BiRefNet 模型生成透明衣物主体，再交给配置的 DeepSeek 视觉模型识别类别、颜色、材质和季节，并写入本地 SQLite。服务也提供天气和当天穿搭建议接口。

## 安装与配置

在本目录的 PowerShell 中执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
Copy-Item .env.example .env
```

然后编辑 `.env`：

```text
OPENAI_API_KEY=你的DeepSeek_API_KEY
OPENAI_BASE_URL=https://api.deepseek.com
VISION_MODEL=deepseek-flash
CHAT_MODEL=deepseek-chat
CUTOUT_MODEL=birefnet-general-lite
```

只有支持图片输入的视觉模型才能识别衣物。`.env`、虚拟环境、数据库和图片输出均为本机文件，不要提交到 GitHub。

完整的 key 创建、模型选择和错误排查说明见项目根目录的 [docs/deepseek-api-key.md](../docs/deepseek-api-key.md)。每台电脑都应填写自己的 key。

## 启动网页服务

```powershell
powershell -ExecutionPolicy Bypass -File .\start_web.ps1
```

服务默认监听 <http://127.0.0.1:8000>。主项目网页默认请求 `http://localhost:8000`。

## 批量处理

把 jpg、jpeg、png 或 webp 放进 `input/` 后执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

结果保存在本机的 `wardrobe.db`、`output/wardrobe.json`、`output/uploads/` 和 `output/cutout/`。首次使用抠图模型可能需要下载模型文件；之后可离线重复运行。

## 本地接口测试

安装依赖后，在本目录运行 `.\.venv\Scripts\python.exe -m unittest test_api -v`。测试使用模拟模型和天气响应，不下载模型、不调用外部 API。
