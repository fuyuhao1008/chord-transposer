# 简谱和弦转调器 - Vercel 快速部署指南

## 部署步骤（5分钟内完成）

### 方法1：通过 GitHub 自动部署（推荐）

#### 步骤1：推送代码到 GitHub
```bash
# 如果还没有 Git 仓库，先初始化
git init

# 添加所有文件
git add .

# 提交
git commit -m "feat: 简谱和弦转调器"

# 推送到 GitHub
# 1. 先在 GitHub 上创建新仓库
# 2. 然后执行以下命令：
git remote add origin https://github.com/你的用户名/你的仓库名.git
git branch -M main
git push -u origin main
```

#### 步骤2：连接到 Vercel
1. 访问 https://vercel.com
2. 使用 GitHub 账号登录（免费）
3. 点击 "Add New Project"
4. 选择刚才推送的 GitHub 仓库
5. 点击 "Import"

#### 步骤3：配置项目
Vercel 会自动检测 Next.js 项目，您只需确认以下配置：

```
Framework Preset: Next.js
Root Directory: ./
Build Command: pnpm build
Output Directory: .next
Install Command: pnpm install
```

点击 "Deploy" 即可开始部署！

#### 步骤4：等待部署完成（约2-3分钟）
- Vercel 会自动构建项目
- 构建成功后会自动分配一个域名（如 `your-project.vercel.app`）
- 访问该域名即可使用

### 方法2：通过 Vercel CLI 部署

#### 步骤1：安装 Vercel CLI
```bash
pnpm add -g vercel
```

#### 步骤2：登录
```bash
vercel login
```
会打开浏览器登录 GitHub 账号

#### 步骤3：部署
```bash
# 在项目根目录执行
vercel
```

按照提示操作：
1. Set up and deploy? → `Y`
2. Which scope? → 选择你的账号
3. Link to existing project? → `N`（首次部署）
4. What's your project's name? → 输入项目名称（如 `chord-transposer`）
5. In which directory is your code located? → 按回车（默认根目录）
6. Want to override the settings? → `N`（使用默认设置）

等待部署完成，Vercel 会提供一个预览链接。

#### 步骤4：部署到生产环境
```bash
vercel --prod
```

## 部署后验证

1. **检查部署状态**
   - 访问 Vercel Dashboard
   - 查看项目的 Deployment 状态
   - 状态应为 "Ready"

2. **测试功能**
   - 访问部署的域名
   - 上传一张简谱图片
   - 测试和弦识别和转调功能

3. **查看日志**
   - 如果遇到问题，访问 Vercel Dashboard
   - 点击 "Deployments" → 选择最新部署 → "Logs"
   - 查看错误信息

## 常见问题

### Q: 部署失败，提示 "Module not found"
A: 清理 node_modules 后重新部署
```bash
rm -rf node_modules .next
pnpm install
```

### Q: API 路由报错 500
A: 检查环境变量配置，确认 `coze-coding-dev-sdk` 的配置是否正确

### Q: 图片上传失败
A: 检查 Vercel 的 Body Size Limit（默认 4.5MB），如果图片更大需要调整配置

### Q: 如何自定义域名？
A: 在 Vercel Dashboard → Settings → Domains → 添加自定义域名

## 费用说明

- **Vercel Hobby Plan（免费）**：
  - 100GB 带宽/月
  - 无限项目
  - 自动 HTTPS
  - 全球 CDN

完全免费，无需付费！

## 技术支持

如果遇到问题：
1. 查看 Vercel 文档：https://vercel.com/docs
2. 查看 Next.js 部署指南：https://nextjs.org/docs/deployment
3. 检查项目日志：Vercel Dashboard → Logs
