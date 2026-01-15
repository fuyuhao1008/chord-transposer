# 简谱和弦转调器

基于 AI 驱动的简谱和弦自动转调工具，支持上传简谱图片，自动识别和弦并转调到任意调性。

## 功能特性

### ✅ 已实现功能

1. **和弦转调核心算法**
   - 支持完整的12个调性（C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab, A, A#/Bb, B）
   - 支持所有和弦类型（三和弦、七和弦、挂留和弦、转位和弦等）
   - **等音转换**：D# → Eb, A# → Bb（按简谱常用记法）
   - 保留和弦性质（Cmaj7 → Dmaj7, Fsus4 → Gsus4）
   - 处理转位和弦（C/E → D/E）

2. **用户界面**
   - 图片上传界面（支持拖拽上传）
   - 调性选择（原调自动识别或手动选择，目标调手动选择）
   - 实时转调结果显示
   - 和弦序列对比展示
   - 转调结果图片预览

3. **图片标注功能**
   - 在原图上原位替换和弦
   - 动态调整字体大小以适应图片尺寸
   - 白色背景覆盖原和弦，蓝色文本显示新和弦
   - 支持 SVG 叠加和图片合成

4. **测试工具**
   - `/test` 页面：测试和弦转调算法
   - 支持手动输入和弦和坐标进行测试

### 🔨 待完善功能

1. **多模态模型集成**
   - 当前返回模拟数据，需要集成真实的多模态大模型 API
   - 识别图片中的调号（如 "1=C", "1=G"）
   - 识别图片中的所有和弦标记
   - 返回每个和弦的位置坐标

2. **增强功能**
   - 批量处理多张图片
   - 支持更多图片格式
   - 优化和弦识别准确率
   - 支持手动编辑识别结果

## 技术栈

- **前端**: Next.js 16 + TypeScript + Tailwind CSS 4
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **后端**: Next.js API Routes
- **图片处理**: Sharp
- **包管理**: pnpm

## 项目结构

```
src/
├── app/
│   ├── page.tsx                    # 首页
│   ├── transpose/
│   │   └── page.tsx                # 转调功能主页面
│   ├── test/
│   │   └── page.tsx                # 测试页面
│   └── api/
│       ├── transpose/
│       │   └── route.ts           # 转调 API
│       └── test/
│           └── route.ts           # 测试 API
├── lib/
│   └── chord-transposer.ts        # 和弦转调核心算法
└── components/
    └── ui/                         # shadcn/ui 组件
```

## 使用方法

### 启动开发环境

```bash
# 依赖已安装，直接启动开发服务器
coze dev
```

服务将在 `http://localhost:5000` 启动

### 使用转调功能

1. 访问首页 `http://localhost:5000`
2. 点击"开始使用"进入转调页面
3. 上传简谱图片（支持 JPG、PNG 格式）
4. 选择目标调性（原调会自动识别，也可手动指定）
5. 点击"开始转调"按钮
6. 查看转调结果，可下载标注后的图片

### 使用测试页面

访问 `http://localhost:5000/test` 可以测试和弦转调算法：

1. 输入和弦文本（如 C, Am7, Gsus4）
2. 输入和弦在图片中的位置（X、Y 百分比坐标）
3. 选择原调和目标调
4. 点击"执行转调"查看结果

## 和弦转调算法

### 支持的和弦格式

- **基础和弦**: C, D, E, F, G, A, B
- **变化音**: C#, Db, D#, Eb, F#, Gb, G#, Ab, A#, Bb
- **小调**: Cm, Dm, Em, Fm, Gm, Am, Bm
- **七和弦**: C7, Dm7, Em7, Fmaj7, G7, Am7, Bdim7
- **挂留和弦**: Csus2, Csus4
- **转位和弦**: C/E, Am/G, F/A
- **复合和弦**: Cmaj7, Dm9, G11, B7#9

### 等音转换规则

根据简谱常用记法，自动进行以下转换：
- D# → Eb
- A# → Bb
- 其他变化音保持原样

### 转调示例

| 原调 | 目标调 | 原和弦 | 新和弦 |
|-----|-------|-------|--------|
| C   | G     | C     | G      |
| C   | G     | Am    | Em     |
| C   | G     | Fmaj7 | Cmaj7  |
| C   | G     | G/B   | D/F#   |
| C   | E     | D#m7  | Gm7    |

## API 接口

### POST /api/transpose

上传图片并执行转调

**请求参数**:
- `image`: 图片文件（FormData）
- `targetKey`: 目标调（如 "C", "G", "Eb"）
- `originalKey`: 原调（可选，系统会自动识别）

**返回数据**:
```json
{
  "originalKey": "C",
  "targetKey": "G",
  "semitones": 7,
  "chords": [
    {
      "original": { "root": "C", "quality": "", "original": "C" },
      "transposed": { "root": "G", "quality": "", "original": "C" }
    }
  ],
  "resultImage": "data:image/jpeg;base64,..."
}
```

### POST /api/test

测试和弦转调算法

**请求参数**:
```json
{
  "chords": [
    { "text": "C", "x": 20, "y": 30 }
  ],
  "originalKey": "C",
  "targetKey": "G"
}
```

**返回数据**:
```json
{
  "success": true,
  "result": { /* 转调结果 */ }
}
```

## 开发说明

### 集成多模态模型

当前 `src/app/api/transpose/route.ts` 中的 `recognizeChordsFromImage` 函数返回模拟数据。

要集成真实的多模态模型：

1. 获取多模态 API 的访问凭证
2. 在 `recognizeChordsFromImage` 函数中调用 API
3. 使用以下提示词：
   ```
   请分析这张简谱图片，识别出以下信息：

   1. 调号（Key）：如 "1=C", "1=G", "Key: F" 等
   2. 所有和弦标记：如 C, Am, G7, Fsus4, C/E 等
   3. 每个和弦的位置（百分比坐标）

   请以JSON格式返回：
   {
     "key": "C",
     "chords": [
       {
         "text": "C",
         "x": 20,
         "y": 30
       },
       ...
     ]
   }
   ```

### 添加新的和弦类型

在 `src/lib/chord-transposer.ts` 中的 `parseChord` 方法中添加新的和弦正则匹配规则。

## 测试

运行以下命令进行类型检查：

```bash
npx tsc --noEmit
```

运行构建：

```bash
pnpm build
```

## 许可证

MIT

## 致谢

- [Next.js](https://nextjs.org/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Sharp](https://sharp.pixelplumbing.com/)
