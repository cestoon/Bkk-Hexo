import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 安装依赖
async function installDependencies() {
  return new Promise((resolve, reject) => {
    console.log('正在安装必要的依赖...');
    exec('npm install dotenv', (error, stdout, stderr) => {
      if (error) {
        console.error(`安装依赖失败: ${error.message}`);
        reject(error);
        return;
      }
      console.log('依赖安装成功！');
      resolve();
    });
  });
}

// 检查配置文件
async function checkConfig() {
  const envPath = path.join(__dirname, '..', '.env');
  const picgoConfigPath = path.join(__dirname, '..', '.picgo', 'config.json');
  
  console.log('检查配置文件...');
  
  if (fs.existsSync(envPath)) {
    console.log('✅ .env 文件已存在');
  } else {
    console.log('❌ .env 文件不存在，将在运行 secure-picgo-config.js 时创建');
  }
  
  if (fs.existsSync(picgoConfigPath)) {
    console.log('✅ PicGo 配置文件已存在');
  } else {
    console.log('❌ PicGo 配置文件不存在，请先配置 PicGo');
  }
}

// 主函数
async function main() {
  try {
    // 安装依赖
    await installDependencies();
    
    // 检查配置
    await checkConfig();
    
    console.log('\n使用说明:');
    console.log('1. 运行 "node scripts/secure-picgo-config.js" 将 GitHub 令牌从配置文件移至环境变量');
    console.log('2. 运行 "node scripts/picgo-upload.js" 上传图片');
    console.log('3. 运行 "node scripts/local-image-upload.js" 处理本地图片');
    console.log('\n安全提示:');
    console.log('- .env 文件已被添加到 .gitignore，确保不会将其推送到公共仓库');
    console.log('- GitHub 令牌已从 PicGo 配置文件中移除，改为使用环境变量存储');
  } catch (error) {
    console.error('安装过程中发生错误:', error);
  }
}

main();