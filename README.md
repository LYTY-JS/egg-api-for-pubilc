# Egg API - 图像处理与使用统计系统

## 项目概述
这是一个基于Node.js的图像处理API系统，提供以下功能：
- 人脸检测与替换
- GIF处理
- QQ号使用统计与黑名单管理

## 系统要求
- Node.js 18+
- OpenCV (用于图像处理)
- npm/pnpm (包管理器)
- cmke

## 安装指南

### Windows安装
1. 克隆项目
2. 拉取opencv
3. 编译opencv
4. 安装cmake
5. 安装依赖
6. 构建opencv4nodejs
7. node egg-api

### Linux安装 (Ubuntu/Debian)
1. 克隆项目
2. 拉取opencv
3. 编译opencv
4. 安装cmake
5. 安装依赖
6. 构建opencv4nodejs
7. node egg-api

## 配置说明

### OpenCV配置
确保OpenCV库路径正确，可在package.json中配置:
```json
"opencv4nodejs": {
  "disableAutoBuild": 1,
  "opencvIncludeDir": "/usr/local/include/opencv4",
  "opencvLibDir": "/usr/local/lib",
  "opencvBinDir": "/usr/local/bin"
}
```

### 黑名单配置
手动编辑`config/blacklist.json`文件:
```json
{
  "qq_blacklist": ["违规QQ号1", "违规QQ号2"]
}
```

## API文档

### 图像处理API
- `POST /process-image` - 处理静态图片
- `POST /process-gif` - 处理GIF动画

请求体:
```json
{
  "imageUrl": "图片URL",
  "replacementImageUrl": "替换图片URL",
  "qq": "操作者QQ号(可选)"
}
```

Headers: `X-QQ-Number: 操作者QQ号(可选)`

### 统计API
- `GET /tongji` - 获取所有QQ号统计
- `POST /tongji/blacklist` - 添加QQ号到黑名单
- `DELETE /tongji/blacklist/:qq` - 从黑名单移除QQ号

## 使用说明

1. 启动服务:
   ```bash
   pnpm start
   ```

2. 访问管理界面:
   打开浏览器访问 `http://localhost:3000`

## 维护指南

### 黑名单管理
1. 通过网页界面管理
2. 或直接编辑`config/blacklist.json`文件
3. 或使用API操作:
   ```bash
   # 添加黑名单
   curl -X POST -H "Content-Type: application/json" -d '{"qq":"123456"}' http://localhost:3000/tongji/blacklist

   # 移除黑名单
   curl -X DELETE http://localhost:3000/tongji/blacklist/123456
   ```

## 项目结构
```
egg-api/
├── apps/                # 应用模块
├── classifiers/         # 分类器数据
├── config/              # 配置文件
│   └── blacklist.json   # 黑名单配置
├── data/                # 数据存储
│   └── stats.json       # 使用统计数据
├── output/              # 输出目录
├── package.json         # 项目配置
├── egg-api.js           # 主入口文件
└── README.md            # 说明文档
```
