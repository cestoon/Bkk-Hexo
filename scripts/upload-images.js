import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { glob } from 'glob';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// GitHub配置
const config = {
  repo: 'cestoon/BkkImage',
  branch: 'main',
  token: process.env.GITHUB_TOKEN || '',
  imagePath: 'images/',
};

// 检查令牌是否存在
if (!config.token) {
  console.error('错误: 未找到GitHub令牌。请确保在.env文件中设置了GITHUB_TOKEN环境变量。');
  process.exit(1);
}

// 创建GitHub客户端
const octokit = new Octokit({
  auth: config.token
});


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

// 上传单个图片到GitHub
async function uploadImage(imagePath, imageContent) {
  const [owner, repo] = config.repo.split('/');
  const base64Content = imageContent.toString('base64');
  const githubPath = path.join(config.imagePath, imagePath).replace(/\\/g, '/');
  
  try {
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: githubPath,
      message: `Upload image: ${imagePath}`,
      content: base64Content,
      branch: config.branch
    });
    
    return `https://raw.githubusercontent.com/${config.repo}/${config.branch}/${githubPath}`;
  } catch (error) {
    if (error.status === 422) {
      // 文件已存在，直接返回URL
      return `https://raw.githubusercontent.com/${config.repo}/${config.branch}/${githubPath}`;
    }
    console.error(`上传图片 ${imagePath} 失败:`, error.message);
    return null;
  }
}

// 更新Markdown文件中的图片链接
async function updateMarkdownLinks(mdContent, imageMap) {
  let updatedContent = mdContent;
  for (const [localPath, cdnUrl] of Object.entries(imageMap)) {
    if (cdnUrl) {
      // 匹配相对路径的图片链接
      const relativeRegex = new RegExp(`!\\[([^\\]]*)\\]\\((?:\.\./)*images/${localPath.replace(/\\/g, '/')}\\)`, 'g');
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
    // 获取所有图片文件
    const imageFiles = await getImageFiles(sourceImagesDir);
    console.log(`找到 ${imageFiles.length} 个图片文件`);
    
    // 上传图片并创建映射
    const imageMap = {};
    for (const imageFile of imageFiles) {
      const imageContent = await fs.readFile(path.join(sourceImagesDir, imageFile));
      const cdnUrl = await uploadImage(imageFile, imageContent);
      if (cdnUrl) {
        imageMap[imageFile] = cdnUrl;
        console.log(`已上传: ${imageFile} -> ${cdnUrl}`);
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