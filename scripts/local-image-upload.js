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

// 配置项
const config = {
  // Typora用户图片目录，根据实际情况修改
  typoraImageDir: path.join(process.env.HOME || process.env.USERPROFILE, 'Library/Application Support/typora-user-images'),
  // 博客图片目录
  blogImageDir: path.join(__dirname, '..', 'source', 'images'),
  // 博客文章目录
  postsDir: path.join(__dirname, '..', 'source', '_posts'),
  // PicGo配置文件路径
  picgoConfigPath: path.join(__dirname, '..', '.picgo', 'config.json')
};

// 获取所有本地图片文件
async function getLocalImageFiles() {
  try {
    // 从Typora用户图片目录获取图片
    const typoraImages = fs.existsSync(config.typoraImageDir) 
      ? await glob('**/*.{png,jpg,jpeg,gif}', { cwd: config.typoraImageDir })
      : [];
    
    console.log(`在Typora用户图片目录找到 ${typoraImages.length} 个图片文件`);
    
    return {
      typoraImages
    };
  } catch (err) {
    console.error('获取本地图片文件失败:', err);
    return { typoraImages: [] };
  }
}

// 使用PicGo上传单个图片
function uploadWithPicGo(imagePath) {
  return new Promise((resolve, reject) => {
    console.log(`开始上传图片: ${imagePath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      console.error(`图片文件不存在: ${imagePath}`);
      reject(new Error(`图片文件不存在: ${imagePath}`));
      return;
    }
    
    // 检查PicGo配置
    if (!fs.existsSync(config.picgoConfigPath)) {
      console.error('PicGo配置文件不存在，请先配置PicGo');
      reject(new Error('PicGo配置文件不存在'));
      return;
    }
    
    // 从环境变量获取GitHub令牌
    const token = getGitHubToken();
    if (!token) {
      console.warn('警告: 未找到GitHub令牌环境变量，请运行 node scripts/secure-picgo-config.js 进行配置');
    }
    
    // 使用PicGo的配置文件上传图片
    const command = `npx picgo upload "${imagePath}" -c "${config.picgoConfigPath}"`;
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

// 从Markdown内容中提取本地图片路径
function extractLocalImagePaths(mdContent) {
  const result = {
    markdownImages: [],
    htmlImages: []
  };
  
  // 提取Markdown图片语法: ![alt](path/to/image.png)
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = mdImageRegex.exec(mdContent)) !== null) {
    const imagePath = match[2].trim();
    // 只处理本地图片，不处理已经是URL的图片
    if (!imagePath.startsWith('http') && !imagePath.startsWith('data:')) {
      result.markdownImages.push({
        fullMatch: match[0],
        alt: match[1],
        path: imagePath
      });
    }
  }
  
  // 特别处理Mac系统上Typora的完整路径格式
  const macTyporaMdRegex = /!\[([^\]]*)\]\((\/Users\/[^\/]+\/Library\/Application Support\/typora-user-images\/[^)]+)\)/g;
  while ((match = macTyporaMdRegex.exec(mdContent)) !== null) {
    const imagePath = match[2].trim();
    result.markdownImages.push({
      fullMatch: match[0],
      alt: match[1],
      path: imagePath
    });
  }
  
  // 特别处理Mac系统上Typora的完整路径格式
  const macTyporaRegex = /<img src="(\/Users\/[^\/]+\/Library\/Application Support\/typora-user-images\/[^"]+)"[^>]*>/g;
  while ((match = macTyporaRegex.exec(mdContent)) !== null) {
    const imagePath = match[1].trim();
    result.htmlImages.push({
      fullMatch: match[0],
      path: imagePath
    });
  }
  
  // 提取HTML图片标签: <img src="path/to/image.png" alt="alt" />
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  while ((match = htmlImageRegex.exec(mdContent)) !== null) {
    const imagePath = match[1].trim();
    // 只处理本地图片，不处理已经是URL的图片
    if (!imagePath.startsWith('http') && !imagePath.startsWith('data:')) {
      result.htmlImages.push({
        fullMatch: match[0],
        path: imagePath
      });
    }
  }
  
  return result;
}

// 更新Markdown文件中的图片链接
async function updateMarkdownFile(mdPath) {
  console.log(`处理文章: ${mdPath}`);
  
  // 读取Markdown文件内容
  const mdContent = await fs.readFile(mdPath, 'utf8');
  
  // 提取本地图片路径
  const { markdownImages, htmlImages } = extractLocalImagePaths(mdContent);
  console.log(`找到 ${markdownImages.length} 个Markdown图片和 ${htmlImages.length} 个HTML图片`);
  
  if (markdownImages.length === 0 && htmlImages.length === 0) {
    console.log('没有找到需要处理的本地图片，跳过');
    return false;
  }
  
  // 获取本地图片文件
  const { typoraImages } = await getLocalImageFiles();
  
  // 创建图片映射表
  const imageMap = new Map();
  
  // 处理Markdown图片
  let updatedContent = mdContent;
  for (const img of markdownImages) {
    // 获取图片文件名
    const fileName = path.basename(img.path);
    
    // 检查是否是完整路径的Typora图片
    const isFullPathTyporaImage = img.path.startsWith('/Users/') && img.path.includes('Application Support/typora-user-images');
    
    // 检查是否是Typora图片
    const isTyporaImage = isFullPathTyporaImage || img.path.includes('typora-user-images') || typoraImages.some(p => p.endsWith(fileName));
    
    if (isTyporaImage) {
      // 如果已经处理过相同文件名的图片，直接使用之前的URL
      if (imageMap.has(fileName)) {
        const cdnUrl = imageMap.get(fileName);
        updatedContent = updatedContent.replace(img.fullMatch, `![${img.alt}](${cdnUrl})`);
        console.log(`复用已上传的图片: ${fileName} -> ${cdnUrl}`);
        continue;
      }
      
      // 如果是完整路径的Typora图片，直接使用该路径
      if (isFullPathTyporaImage) {
        try {
          // 直接上传完整路径的图片
          const cdnUrl = await uploadWithPicGo(img.path);
          
          // 更新内容
          updatedContent = updatedContent.replace(img.fullMatch, `![${img.alt}](${cdnUrl})`);
          
          // 保存映射
          imageMap.set(fileName, cdnUrl);
        } catch (error) {
          console.error(`处理完整路径Typora图片失败: ${img.path}`, error.message);
        }
      }
      // 否则查找Typora图片的完整路径
      else {
        const typoraImagePath = typoraImages.find(p => p.endsWith(fileName));
        if (typoraImagePath) {
          try {
            // 上传图片
            const fullImagePath = path.join(config.typoraImageDir, typoraImagePath);
            const cdnUrl = await uploadWithPicGo(fullImagePath);
            
            // 更新内容
            updatedContent = updatedContent.replace(img.fullMatch, `![${img.alt}](${cdnUrl})`);
            
            // 保存映射
            imageMap.set(fileName, cdnUrl);
          } catch (error) {
            console.error(`处理Typora图片失败: ${fileName}`, error.message);
          }
        } else {
          console.warn(`找不到Typora图片: ${fileName}`);
        }
      }
    } else {
      // 处理其他本地图片
      try {
        // 尝试不同的路径组合
        const possiblePaths = [
          img.path, // 原始路径
          path.join(config.blogImageDir, fileName), // 博客图片目录
          path.join(path.dirname(mdPath), img.path) // 相对于文章的路径
        ];
        
        // 查找第一个存在的路径
        const existingPath = possiblePaths.find(p => fs.existsSync(p));
        
        if (existingPath) {
          // 上传图片
          const cdnUrl = await uploadWithPicGo(existingPath);
          
          // 更新内容
          updatedContent = updatedContent.replace(img.fullMatch, `![${img.alt}](${cdnUrl})`);
          
          // 保存映射
          imageMap.set(fileName, cdnUrl);
        } else {
          console.warn(`找不到本地图片: ${img.path}`);
        }
      } catch (error) {
        console.error(`处理本地图片失败: ${img.path}`, error.message);
      }
    }
  }
  
  // 处理HTML图片
  for (const img of htmlImages) {
    // 获取图片文件名
    const fileName = path.basename(img.path);
    
    // 检查是否是完整路径的Typora图片
    const isFullPathTyporaImage = img.path.startsWith('/Users/') && img.path.includes('Application Support/typora-user-images');
    // 检查是否是Typora图片
    const isTyporaImage = isFullPathTyporaImage || img.path.includes('typora-user-images') || typoraImages.some(p => p.endsWith(fileName));
    
    if (isTyporaImage) {
      // 如果已经处理过相同文件名的图片，直接使用之前的URL
      if (imageMap.has(fileName)) {
        const cdnUrl = imageMap.get(fileName);
        updatedContent = updatedContent.replace(img.fullMatch, `<img src="${cdnUrl}" alt="" />`);
        console.log(`复用已上传的图片: ${fileName} -> ${cdnUrl}`);
        continue;
      }
      
      // 如果是完整路径的Typora图片，直接使用该路径
      if (isFullPathTyporaImage) {
        try {
          // 直接上传完整路径的图片
          const cdnUrl = await uploadWithPicGo(img.path);
          
          // 更新内容
          updatedContent = updatedContent.replace(img.fullMatch, `<img src="${cdnUrl}" alt="" />`);
          
          // 保存映射
          imageMap.set(fileName, cdnUrl);
        } catch (error) {
          console.error(`处理完整路径Typora图片失败: ${img.path}`, error.message);
        }
      }
      // 否则查找Typora图片的完整路径
      else {
        const typoraImagePath = typoraImages.find(p => p.endsWith(fileName));
        if (typoraImagePath) {
          try {
            // 上传图片
            const fullImagePath = path.join(config.typoraImageDir, typoraImagePath);
            const cdnUrl = await uploadWithPicGo(fullImagePath);
            
            // 更新内容
            updatedContent = updatedContent.replace(img.path, cdnUrl);
            
            // 保存映射
            imageMap.set(fileName, cdnUrl);
          } catch (error) {
            console.error(`处理Typora图片失败: ${fileName}`, error.message);
          }
        } else {
          console.warn(`找不到Typora图片: ${fileName}`);
        }
      }
    } else {
      // 处理其他本地图片
      try {
        // 尝试不同的路径组合
        const possiblePaths = [
          img.path, // 原始路径
          path.join(config.blogImageDir, fileName), // 博客图片目录
          path.join(path.dirname(mdPath), img.path) // 相对于文章的路径
        ];
        
        // 查找第一个存在的路径
        const existingPath = possiblePaths.find(p => fs.existsSync(p));
        
        if (existingPath) {
          // 上传图片
          const cdnUrl = await uploadWithPicGo(existingPath);
          
          // 更新内容
          updatedContent = updatedContent.replace(img.fullMatch, `<img src="${cdnUrl}" alt="" />`);
          
          // 保存映射
          imageMap.set(fileName, cdnUrl);
        } else {
          console.warn(`找不到本地图片: ${img.path}`);
        }
      } catch (error) {
        console.error(`处理本地图片失败: ${img.path}`, error.message);
      }
    }
  }
  
  // 如果内容有变化，写入文件
  if (mdContent !== updatedContent) {
    await fs.writeFile(mdPath, updatedContent, 'utf8');
    console.log(`已更新文章中的图片链接: ${path.basename(mdPath)}`);
    return true;
  }
  
  return false;
}

// 主函数
async function main() {
  try {
    // 加载环境变量
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
    
    // 检查PicGo配置
    if (!fs.existsSync(config.picgoConfigPath)) {
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
    
    // 获取所有Markdown文件
    const mdFiles = await fs.readdir(config.postsDir);
    let updatedCount = 0;
    
    // 处理每个Markdown文件
    for (const mdFile of mdFiles) {
      if (mdFile.endsWith('.md')) {
        const mdPath = path.join(config.postsDir, mdFile);
        const updated = await updateMarkdownFile(mdPath);
        if (updated) updatedCount++;
      }
    }
    
    console.log(`完成！共处理 ${mdFiles.length} 个文章，更新了 ${updatedCount} 个文章的图片链接。`);
  } catch (error) {
    console.error('发生错误:', error);
  }
}

// 运行主函数
main();