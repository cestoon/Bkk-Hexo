import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, '..', '.picgo', 'config.json');
// 环境变量文件路径
const ENV_PATH = path.join(__dirname, '..', '.env');

/**
 * 安全化PicGo配置
 * 将敏感信息（如GitHub令牌）从配置文件中移除，改为使用环境变量
 */
async function securePicGoConfig() {
  try {
    // 确保.env文件存在
    if (!fs.existsSync(ENV_PATH)) {
      fs.writeFileSync(ENV_PATH, '', 'utf8');
      console.log(`创建了.env文件: ${ENV_PATH}`);
    }

    // 加载环境变量
    dotenv.config({ path: ENV_PATH });

    // 读取当前配置
    if (!fs.existsSync(CONFIG_PATH)) {
      console.error('PicGo配置文件不存在');
      return false;
    }

    const config = await fs.readJson(CONFIG_PATH);
    
    // 检查是否有GitHub配置
    if (config.picBed && config.picBed.github) {
      // 保存GitHub令牌到环境变量（如果不存在）
      const currentToken = config.picBed.github.token;
      if (currentToken && !process.env.GITHUB_TOKEN) {
        // 将令牌添加到.env文件
        const envContent = await fs.readFile(ENV_PATH, 'utf8');
        const newEnvContent = envContent + 
          (envContent.endsWith('\n') ? '' : '\n') + 
          `GITHUB_TOKEN=${currentToken}\n`;
        await fs.writeFile(ENV_PATH, newEnvContent, 'utf8');
        console.log('GitHub令牌已保存到.env文件');
      }

      // 从配置中移除令牌
      config.picBed.github.token = '';
      await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
      console.log('已从PicGo配置文件中移除GitHub令牌');

      // 添加.env到.gitignore
      const gitignorePath = path.join(__dirname, '..', '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
        if (!gitignoreContent.includes('.env')) {
          const newGitignoreContent = gitignoreContent + 
            (gitignoreContent.endsWith('\n') ? '' : '\n') + 
            '.env\n';
          await fs.writeFile(gitignorePath, newGitignoreContent, 'utf8');
          console.log('已将.env添加到.gitignore');
        }
      }

      return true;
    } else {
      console.log('未找到GitHub配置');
      return false;
    }
  } catch (error) {
    console.error('安全化PicGo配置失败:', error);
    return false;
  }
}

/**
 * 获取GitHub令牌
 * 优先从环境变量获取，如果不存在则返回空字符串
 */
export function getGitHubToken() {
  // 确保环境变量已加载
  dotenv.config({ path: ENV_PATH });
  return process.env.GITHUB_TOKEN || '';
}

// 如果直接运行此脚本，则执行安全化配置
if (import.meta.url === `file://${process.argv[1]}`) {
  securePicGoConfig().then(success => {
    if (success) {
      console.log('PicGo配置已安全化，敏感信息已移至环境变量');
    } else {
      console.log('PicGo配置安全化未完成');
    }
  });
}

export { securePicGoConfig };