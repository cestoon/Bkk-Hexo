# 图片上传工具使用说明

## 安全改进

为了提高安全性，我们对PicGo配置进行了以下改进：

1. **GitHub令牌安全存储**：将GitHub令牌从配置文件移至环境变量，避免令牌被推送到公共仓库
2. **自动.gitignore配置**：自动将.env文件添加到.gitignore，确保敏感信息不会被提交
3. **环境变量管理**：使用dotenv库安全管理环境变量

## 使用方法

### 初始设置

1. 安装依赖：
   ```bash
   npm run install-deps
   ```
   或者直接运行：
   ```bash
   node scripts/install-dependencies.js
   ```

2. 安全化PicGo配置（将GitHub令牌从配置文件移至环境变量）：
   ```bash
   npm run secure-config
   ```
   或者直接运行：
   ```bash
   node scripts/secure-picgo-config.js
   ```

### 图片上传

1. 上传博客图片目录中的所有图片：
   ```bash
   npm run upload-images
   ```
   或者直接运行：
   ```bash
   node scripts/picgo-upload.js
   ```

2. 处理文章中的本地图片（包括Typora用户图片）：
   ```bash
   npm run upload-local
   ```
   或者直接运行：
   ```bash
   node scripts/local-image-upload.js
   ```

## 文件说明

- `secure-picgo-config.js`: 安全化PicGo配置，将GitHub令牌从配置文件移至环境变量
- `picgo-upload.js`: 上传博客图片目录中的所有图片
- `local-image-upload.js`: 处理文章中的本地图片（包括Typora用户图片）
- `install-dependencies.js`: 安装必要的依赖

## 安全提示

- **不要提交.env文件**：确保.env文件不会被推送到公共仓库
- **定期更新GitHub令牌**：为了安全，建议定期更新GitHub令牌
- **备份环境变量**：在安全的地方备份.env文件内容，以防丢失

## 故障排除

如果遇到上传失败的情况，请检查：

1. 环境变量是否正确设置（运行`npm run secure-config`）
2. PicGo配置是否正确（检查.picgo/config.json文件）
3. GitHub仓库设置是否正确（repo、branch、path等）