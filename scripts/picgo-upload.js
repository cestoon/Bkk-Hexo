import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { glob } from 'glob';
import dotenv from 'dotenv';
import { getGitHubToken } from './secure-picgo-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取所有图片文件
async function getImageFiles(sourceDir) {
  try {
    const files = await glob('**/*.{png,jpg,jpeg,gif}', { cwd: sourceDir });
    return files;
  } catch (err) {
    console.error('获取图片文件失败:', err);
    return [];
  }
}

// 使用PicGo上传单个图片
function uploadWithPicGo(imagePath) {
  return new Promise((resolve, reject) => {
    console.log(`开始上传图片: ${imagePath}`);
    
    // 检查PicGo配置
    const picgoConfigPath = path.join(__dirname, '..', '.picgo', 'config.json');
    try {
      const configContent = fs.readFileSync(picgoConfigPath, 'utf8');
      const config = JSON.parse(configContent);
      console.log(`PicGo配置信息: 上传器=${config.picBed.current}, GitHub仓库=${config.picBed.github?.repo || '未设置'}, 分支=${config.picBed.github?.branch || '未设置'}, 路径=${config.picBed.github?.path || '未设置'}`);
      
      // 从环境变量获取GitHub令牌
      const token = getGitHubToken();
      if (!token) {
        console.warn('警告: 未找到GitHub令牌环境变量，请运行 node scripts/secure-picgo-config.js 进行配置');
      }
    } catch (err) {
      console.error('读取PicGo配置文件失败:', err);
    }
    
    // 使用PicGo的配置文件上传图片
    const command = `npx picgo upload "${imagePath}" -c "${picgoConfigPath}"`;
    console.log(`执行命令: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`上传图片失败: ${error.message}`);
        reject(error);
        return;
      }
      
      // 检查是否有错误输出
      if (stderr) {
        console.error(`上传错误输出: ${stderr}`);
      }
      
      // 检查stdout是否包含错误信息
      if (stdout.includes('ERROR') || stdout.includes('WARN')) {
        console.error(`PicGo上传警告或错误: ${stdout}`);
        reject(new Error(`PicGo上传失败: ${stdout}`));
        return;
      }
      
      // 尝试从输出中提取URL
      const lines = stdout.trim().split('\n');
      const url = lines[lines.length - 1].trim();
      
      if (url.startsWith('http')) {
        console.log(`成功上传: ${imagePath} -> ${url}`);
        resolve(url);
      } else {
        console.error(`无法从PicGo输出中获取URL: ${stdout}`);
        reject(new Error('上传成功但无法获取URL'));
      }
    });
  });
}

// 更新Markdown文件中的图片链接
async function updateMarkdownLinks(mdContent, imageMap) {
  let updatedContent = mdContent;
  for (const [localPath, cdnUrl] of Object.entries(imageMap)) {
    if (cdnUrl) {
      // 匹配相对路径的图片链接
      const relativeRegex = new RegExp(`!\\[([^\\]]*)\\]\\((?:\\.\\./)*images/${localPath.replace(/\\/g, '/')}\\)`, 'g');
      updatedContent = updatedContent.replace(relativeRegex, `![$1](${cdnUrl})`);
      
      // 匹配绝对路径的图片链接
      const absoluteRegex = new RegExp(`!\\[([^\\]]*)\\]\\(/images/${localPath.replace(/\\/g, '/')}\\)`, 'g');
      updatedContent = updatedContent.replace(absoluteRegex, `![$1](${cdnUrl})`);
    }
  }
  return updatedContent;
}

// 主函数
async function main() {
  const sourceImagesDir = path.join(__dirname, '..', 'source', 'images');
  const postsDir = path.join(__dirname, '..', 'source', '_posts');
  
  try {
    // 加载环境变量
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
    
    // 检查PicGo配置
    const picgoConfigPath = path.join(__dirname, '..', '.picgo', 'config.json');
    if (!fs.existsSync(picgoConfigPath)) {
      console.error('PicGo配置文件不存在，请先配置PicGo');
      return;
    }
    
    // 检查GitHub令牌
    const token = getGitHubToken();
    if (!token) {
      console.warn('未找到GitHub令牌环境变量，请运行 node scripts/secure-picgo-config.js 进行配置');
      const answer = await new Promise(resolve => {
        process.stdout.write('是否继续上传? (y/n): ');
        process.stdin.once('data', data => {
          resolve(data.toString().trim().toLowerCase());
        });
      });
      
      if (answer !== 'y') {
        console.log('上传已取消');
        return;
      }
    }
    
    // 获取所有图片文件
    const imageFiles = await getImageFiles(sourceImagesDir);
    console.log(`找到 ${imageFiles.length} 个图片文件`);
    
    // 上传图片并创建映射
    const imageMap = {};
    for (const imageFile of imageFiles) {
      try {
        const fullImagePath = path.join(sourceImagesDir, imageFile);
        const cdnUrl = await uploadWithPicGo(fullImagePath);
        if (cdnUrl) {
          imageMap[imageFile] = cdnUrl;
        }
      } catch (error) {
        console.error(`上传图片 ${imageFile} 失败:`, error.message);
      }
    }
    
    // 更新Markdown文件
    const mdFiles = await fs.readdir(postsDir);
    for (const mdFile of mdFiles) {
      if (mdFile.endsWith('.md')) {
        const mdPath = path.join(postsDir, mdFile);
        const content = await fs.readFile(mdPath, 'utf8');
        const updatedContent = await updateMarkdownLinks(content, imageMap);
        if (content !== updatedContent) {
          await fs.writeFile(mdPath, updatedContent, 'utf8');
          console.log(`已更新文章中的图片链接: ${mdFile}`);
        }
      }
    }
    
    console.log('完成！所有图片已上传，文章链接已更新。');
  } catch (error) {
    console.error('发生错误:', error);
  }
}

main();