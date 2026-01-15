# Coze 商业化应对方案

## 一、问题分析

### 当前集成方式
- **SDK**: `coze-coding-dev-sdk` v0.5.2
- **模型**: `doubao-seed-1-6-vision-250815`（豆包视觉模型）
- **用途**: 识别简谱图片中的和弦标记和调号
- **调用位置**: `src/app/api/transpose/route.ts:recognizeChordsFromImage`

### 商业化风险
1. **API Key 失效**: Coze环境免费API key可能停止服务
2. **功能完全不可用**: 和弦识别是核心功能，没有API key完全无法工作
3. **成本增加**: 需要自费购买API调用额度

---

## 二、短期应对方案（1-3天）

### 方案A：切换到替代模型（推荐）

#### 可用替代方案
| 模型 | 优势 | 劣势 | 适配难度 |
|------|------|------|----------|
| **DeepSeek-Vision** | 价格低，效果好 | API调用方式可能不同 | ⭐⭐ 中等 |
| **Kimi-Vision** | 中文支持好 | 需要注册 | ⭐⭐ 中等 |
| **OpenAI GPT-4o** | 效果最好 | 价格昂贵 | ⭐ 简单 |

#### 实施步骤

**1. 创建模型适配器** `src/lib/vision-models/adapter.ts`
```typescript
export interface VisionModelAdapter {
  recognizeChords(imageBase64: string, mimeType: string, imgWidth: number, imgHeight: number): Promise<{
    key: string | null;
    centers: Array<{ text: string; cx: number; cy: number }>;
  }>;
}

// DeepSeek 适配器
export class DeepSeekAdapter implements VisionModelAdapter {
  private apiKey: string;
  private baseURL = 'https://api.deepseek.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async recognizeChords(imageBase64: string, mimeType: string, imgWidth: number, imgHeight: number) {
    // 调用 DeepSeek API
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是简谱和弦识别专家...（系统提示词）`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '识别这张简谱图片的和弦...' },
              { type: 'image_url', image_url: { url: imageBase64 } },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    // 解析返回结果
    return this.parseResponse(data.choices[0].message.content);
  }

  private parseResponse(content: string) {
    // 解析 JSON 返回
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    return JSON.parse(jsonStr);
  }
}
```

**2. 修改 API Route** `src/app/api/transpose/route.ts`
```typescript
import { DeepSeekAdapter } from '@/lib/vision-models/adapter';

async function recognizeChordsFromImage(imageBase64: string, mimeType: string, imgWidth: number, imgHeight: number): Promise<any> {
  const apiKey = process.env.VISION_API_KEY || process.env.COZE_API_KEY;
  const modelType = process.env.VISION_MODEL_TYPE || 'coze'; // 'coze' | 'deepseek' | 'openai'

  let adapter;

  switch (modelType) {
    case 'deepseek':
      adapter = new DeepSeekAdapter(apiKey!);
      break;
    case 'coze':
    default:
      // 使用原有的 coze-coding-dev-sdk
      adapter = new CozeAdapter();
      break;
  }

  return adapter.recognizeChords(imageBase64, mimeType, imgWidth, imgHeight);
}
```

**3. 创建 Coze 适配器包装**
```typescript
export class CozeAdapter implements VisionModelAdapter {
  async recognizeChords(imageBase64: string, mimeType: string, imgWidth: number, imgHeight: number) {
    const { LLMClient, Config } = require('coze-coding-dev-sdk');
    const config = process.env.COZE_API_KEY 
      ? new Config({ apiKey: process.env.COZE_API_KEY })
      : new Config();
    const client = new LLMClient(config);

    // 原有逻辑保持不变
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: imageBase64, detail: 'high' } },
        ],
      },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.2,
    });

    return this.parseResponse(response.content);
  }

  private parseResponse(content: string) {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    return JSON.parse(jsonStr);
  }
}
```

**4. 更新环境变量** `.env.example`
```bash
# 视觉模型配置
VISION_MODEL_TYPE=coze  # coze | deepseek | openai
VISION_API_KEY=your-api-key-here

# Coze API Key（备用）
COZE_API_KEY=your-coze-api-key-here
```

**5. 更新部署配置**
在 Vercel/其他平台的 Environment Variables 中添加：
- `VISION_MODEL_TYPE=coze`
- `VISION_API_KEY=...`

### 方案B：购买 Coze 商业版 API Key

#### 步骤
1. **注册 Coze 商业账号**
   - 访问 https://www.coze.cn/
   - 申请开通 API 服务

2. **购买调用额度**
   - 根据预估调用量购买套餐
   - 建议先购买小包测试

3. **获取 API Key**
   - 在控制台创建 API Key
   - 保存到安全位置

4. **配置项目**
   - 在 `.env.local` 中设置 `COZE_API_KEY=your-key`
   - 在部署平台设置环境变量

5. **修改代码** `src/app/api/transpose/route.ts`
```typescript
const config = process.env.COZE_API_KEY
  ? new Config({ apiKey: process.env.COZE_API_KEY })
  : new Config();
```

---

## 三、中期优化方案（1-2周）

### 1. 实现多模型轮询策略

**目的**: 降低单一模型依赖，提高可用性

**实现**:
```typescript
export class MultiModelAdapter implements VisionModelAdapter {
  private adapters: VisionModelAdapter[];
  private currentIndex = 0;

  constructor(adapters: VisionModelAdapter[]) {
    this.adapters = adapters;
  }

  async recognizeChords(imageBase64: string, mimeType: string, imgWidth: number, imgHeight: number) {
    // 尝试所有模型，直到成功
    for (let i = 0; i < this.adapters.length; i++) {
      try {
        const adapter = this.adapters[this.currentIndex];
        const result = await adapter.recognizeChords(imageBase64, mimeType, imgWidth, imgHeight);
        console.log(`✓ Model ${this.currentIndex} success`);
        return result;
      } catch (error) {
        console.error(`✗ Model ${this.currentIndex} failed:`, error);
        this.currentIndex = (this.currentIndex + 1) % this.adapters.length;
      }
    }
    throw new Error('All models failed');
  }
}
```

### 2. 添加缓存机制

**目的**: 减少重复调用，节省成本

**实现**: 使用 Vercel KV 或 Redis 缓存识别结果
```typescript
import { kv } from '@vercel/kv';

async function recognizeChordsWithCache(imageHash: string, ...args: any[]) {
  // 检查缓存
  const cached = await kv.get(`chord:${imageHash}`);
  if (cached) {
    return cached;
  }

  // 调用模型
  const result = await recognizeChordsFromImage(...args);

  // 缓存结果（7天）
  await kv.set(`chord:${imageHash}`, result, { ex: 7 * 24 * 60 * 60 });

  return result;
}
```

### 3. 实现降级策略

**目的**: API不可用时提供备选方案

**降级方案**:
- 方案1: 提示用户手动输入所有和弦
- 方案2: 使用本地OCR模型（如 Tesseract.js）
- 方案3: 显示错误并提供重试按钮

---

## 四、长期战略方案（1个月+）

### 1. 自建 OCR 模型

**优势**:
- 完全自主，不受第三方限制
- 可针对简谱和弦进行专门优化
- 成本可控（一次性训练成本）

**技术方案**:
- 使用 PaddleOCR 或 EasyOCR 进行 fine-tuning
- 收集500-1000张简谱图片进行训练
- 部署到自己的服务器或云平台

### 2. 混合模型架构

```
                    ┌─────────────┐
                    │   用户上传   │
                    └──────┬──────┘
                           │
                ┌──────────▼──────────┐
                │   路由层（规则匹配）  │
                └──┬───────┬───────┬─┘
                   │       │       │
         ┌─────────┴─┐ ┌───▼───┐ ┌─▼──────┐
         │ 本地OCR  │ │ DeepSeek│ │ Coze   │
         │（快速）  │ │ （准确）│ │（兜底） │
         └──────────┘ └────────┘ └─────────┘
```

### 3. 成本优化策略

1. **模型选择策略**:
   - 简单谱子 → 本地OCR（免费）
   - 复杂谱子 → DeepSeek（便宜）
   - 失败兜底 → Coze/OpenAI（准确）

2. **请求优化**:
   - 图片压缩后再发送（减少token消耗）
   - 只发送包含和弦的图片区域
   - 批量处理（一次识别多张谱子）

3. **缓存策略**:
   - 图片指纹缓存（相同图片不重复调用）
   - 用户常用和弦缓存
   - 热门谱子预识别

---

## 五、实施时间表

### 第一周（紧急应对）
- [x] 分析现状，确定风险
- [ ] 选择替代模型（推荐 DeepSeek）
- [ ] 创建适配器架构
- [ ] 实现多模型支持
- [ ] 测试替代方案

### 第二周（优化部署）
- [ ] 配置多环境（开发/测试/生产）
- [ ] 实现缓存机制
- [ ] 添加降级策略
- [ ] 更新文档

### 第三-四周（长期优化）
- [ ] 评估自建OCR可行性
- [ ] 收集训练数据（如需要）
- [ ] 实现混合模型架构
- [ ] 成本监控和优化

---

## 六、成本估算

### 方案A：DeepSeek
- **价格**: 约 ¥0.01/张图片（估算）
- **月成本（1000张/月）**: ¥10
- **优势**: 性价比高，效果好

### 方案B：Coze 商业版
- **价格**: 待官方公布
- **优势**: 无需修改代码，迁移成本低

### 方案C：自建OCR
- **初始成本**: 服务器 + 训练数据约 ¥5000
- **运营成本**: 服务器约 ¥200/月
- **优势**: 长期成本低，自主可控

---

## 七、风险评估与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| Coze突然停止服务 | 中 | 高 | 立即切换到DeepSeek |
| API调用限额 | 高 | 中 | 多模型轮询 + 缓存 |
| 成本超预算 | 中 | 中 | 实施降级策略 + 成本监控 |
| 识别准确率下降 | 低 | 高 | 混合模型 + 人工审核 |

---

## 八、推荐方案

**短期**：实施方案A（切换到DeepSeek）
- 实施难度低
- 成本可控
- 效果有保障

**中期**：实现多模型 + 缓存
- 提高可用性
- 降低成本
- 增强稳定性

**长期**：评估自建OCR
- 如果调用量大（>10000/月），建议自建
- 如果调用量小（<1000/月），继续使用第三方API

---

## 九、关键代码修改清单

### 必须修改
1. ✅ `src/app/api/transpose/route.ts` - 支持自定义API key
2. 📝 创建 `src/lib/vision-models/adapter.ts` - 适配器架构
3. 📝 创建 `src/lib/vision-models/deepseek.ts` - DeepSeek适配器
4. 📝 创建 `src/lib/vision-models/openai.ts` - OpenAI适配器
5. 📝 创建 `src/lib/vision-models/coze.ts` - Coze适配器包装

### 可选修改
6. 📝 创建 `src/lib/cache/image-cache.ts` - 图片缓存
7. 📝 创建 `src/lib/model-router.ts` - 模型路由
8. 📝 添加监控和日志

### 环境变量
9. 📝 更新 `.env.example`
10. 📝 更新 `DEPLOYMENT.md`（添加API key配置说明）
11. 📝 更新 `README.md`（更新多模型说明）

---

## 十、快速实施指南

### 最小化修改（1小时内完成）

```typescript
// 1. 修改 src/app/api/transpose/route.ts
const config = process.env.COZE_API_KEY
  ? new Config({ apiKey: process.env.COZE_API_KEY })
  : new Config();

// 2. 在 .env.local 添加
COZE_API_KEY=your-api-key-here

// 3. 在部署平台设置环境变量
VISION_MODEL_TYPE=coze
COZE_API_KEY=your-api-key-here
```

### 完整修改（1-2天）

按照方案A实施，创建适配器架构，支持多模型切换。

---

## 十一、联系方式与支持

如有问题，请参考：
- DeepSeek 文档: https://platform.deepseek.com/docs
- OpenAI 文档: https://platform.openai.com/docs
- Coze 文档: https://www.coze.cn/docs

---

**文档版本**: v1.0
**最后更新**: 2025-01-23
**维护者**: 项目团队
