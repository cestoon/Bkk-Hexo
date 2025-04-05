import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 安装PicGo CLI
async function installPicGoCLI() {
  return new Promise((resolve, reject) => {
    console.log('正在安装PicGo CLI...');
    exec('npm install -g picgo', (error, stdout, stderr) => {
      if (error) {
        console.error(`安装PicGo CLI失败: ${error.message}`);
        reject(error);
        return;
      }
      console.log('PicGo CLI安装成功！');
      resolve();
    });
  });
}

// 检查PicGo配置
async function checkPicGoConfig() {
  const picgoConfigPath = path.join(__dirname, '..', '.picgo', 'config.json');
  
  if (fs.existsSync(picgoConfigPath)) {
    console.log('PicGo配置文件已存在');
    const config = await fs.readJson(picgoConfigPath);
    console.log('当前PicGo配置:');
    console.log(`- 上传器: ${config.picBed.current}`);
    console.log(`- GitHub仓库: ${config.picBed.github?.repo || '未设置'}`);
    return true;
  } else {
    console.error('PicGo配置文件不存在');
    return false;
  }
}

// 主函数
async function main() {
  try {
    // 安装PicGo CLI
    await installPicGoCLI();
    
    // 检查PicGo配置
    const configExists = await checkPicGoConfig();
    
    if (configExists) {
      console.log('\n使用方法:');
      console.log('1. 运行 "node scripts/picgo-upload.js" 上传所有图片并更新文章链接');
      console.log('2. 单独上传图片: "npx picgo upload 图片路径"');
    } else {
      console.log('\n请先配置PicGo:');
      console.log('1. 确保 .picgo/config.json 文件存在并配置正确');
      console.log('2. 配置文件应包含GitHub上传所需的token、repo等信息');
    }
  } catch (error) {
    console.error('安装过程中发生错误:', error);
  }
}

main();