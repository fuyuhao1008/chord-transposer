import { NextRequest, NextResponse } from 'next/server';
import { chordTransposer, Chord } from '@/lib/chord-transposer';
import sharp from 'sharp';
import { LLMClient, Config, APIError } from 'coze-coding-dev-sdk';

/**
 * 视觉模型配置
 * 明确定义每个模型的类型和优先级
 */
interface VisionModelConfig {
  id: string;
  name: string;
  type: 'pure-vision' | 'multimodal';
  priority: number;
}

// 可用视觉模型列表（配置化，按优先级排序）
// 注意：只有真正支持视觉的模型才能被列入此列表
// 文本模型（thinking, flash, lite等）不能处理图片，不能作为备用
const AVAILABLE_VISION_MODELS: readonly VisionModelConfig[] = [
  {
    id: 'doubao-seed-1-6-vision-250815',
    name: '纯视觉模型',
    type: 'pure-vision',
    priority: 1,
  },
  {
    id: 'doubao-seed-1-8-251228',
    name: '多模态Agent',
    type: 'multimodal',
    priority: 2,
  },
] as const;

/**
 * 获取模型配置
 */
function getModelConfig(modelId: string): VisionModelConfig | undefined {
  return AVAILABLE_VISION_MODELS.find(m => m.id === modelId);
}

/**
 * 获取模型优先级
 */
function getVisionModelPriority(modelId: string): number {
  const config = getModelConfig(modelId);
  if (config) {
    return config.priority;
  }
  // 如果模型不在列表中，默认最低优先级
  return 3;
}

/**
 * 获取模型类型描述
 */
function getModelTypeDescription(modelId: string): string {
  const config = getModelConfig(modelId);
  if (config) {
    return config.type === 'pure-vision' ? '纯视觉模型 ✓' : '多模态模型';
  }
  return '未知模型';
}

/**
 * 获取用户配置的主模型
 */
function getPrimaryModel(): string {
  const configuredModel = process.env.VISION_MODEL;
  
  // 如果配置了模型，使用配置的模型
  if (configuredModel) {
    // 验证配置的模型是否在可用列表中
    const config = getModelConfig(configuredModel);
    if (config) {
      console.log(`📋 使用用户配置的主模型: ${configuredModel} (${config.name})`);
      return configuredModel;
    }
    console.warn(`⚠️ 配置的模型 ${configuredModel} 不在可用列表中，将使用默认模型`);
  }
  
  // 否则使用默认的纯视觉模型
  const defaultModel = AVAILABLE_VISION_MODELS[0];
  console.log(`📋 使用默认纯视觉模型: ${defaultModel.id} (${defaultModel.name})`);
  return defaultModel.id;
}

/**
 * 检查模型是否包含"视觉"或"vision"关键词（不区分大小写）
 */
function isVisionKeywordModel(model: VisionModelConfig): boolean {
  const lowerId = model.id.toLowerCase();
  const lowerName = model.name.toLowerCase();
  return lowerId.includes('vision') || lowerName.includes('vision') ||
         lowerId.includes('视觉') || lowerName.includes('视觉');
}

/**
 * 智能选择备用模型（优先视觉模型）
 * 优先级：1. 包含"视觉"/"vision"关键词的模型 2. 纯视觉模型 3. 多模态模型
 * 排除当前失败的模型
 */
function selectFallbackModel(excludedModel: string): string {
  const excludedConfig = getModelConfig(excludedModel);
  
  // 过滤掉已失败的模型
  const availableModels = AVAILABLE_VISION_MODELS.filter(m => m.id !== excludedModel);
  
  if (availableModels.length === 0) {
    throw new Error('没有可用的备用模型');
  }
  
  // 策略1：优先选择包含"视觉"/"vision"关键词的模型
  const visionKeywordModels = availableModels.filter(m => isVisionKeywordModel(m));
  if (visionKeywordModels.length > 0) {
    const selected = visionKeywordModels[0];
    console.log(`🔍 智能选择备用模型（视觉关键词优先）: ${selected.id} (${selected.name}, 优先级: ${selected.priority})`);
    return selected.id;
  }
  
  // 策略2：按模型类型优先级选择（纯视觉 > 多模态）
  const pureVisionModels = availableModels.filter(m => m.type === 'pure-vision');
  const multimodalModels = availableModels.filter(m => m.type === 'multimodal');
  
  // 优先选择纯视觉模型
  if (pureVisionModels.length > 0) {
    const selected = pureVisionModels[0];
    console.log(`🔍 智能选择备用模型（纯视觉优先）: ${selected.id} (${selected.name}, 优先级: ${selected.priority})`);
    return selected.id;
  }
  
  // 其次选择多模态模型
  if (multimodalModels.length > 0) {
    const selected = multimodalModels[0];
    console.log(`🔍 智能选择备用模型（多模态次选）: ${selected.id} (${selected.name}, 优先级: ${selected.priority})`);
    return selected.id;
  }
  
  // 如果所有策略都失败，返回第一个可用模型
  return availableModels[0].id;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const targetKey = formData.get('targetKey') as string;
    const originalKeyInput = formData.get('originalKey') as string;
    const anchorFirstStr = formData.get('anchorFirst') as string;
    const anchorLastStr = formData.get('anchorLast') as string;
    const directionStr = formData.get('direction') as string;
    const semitonesStr = formData.get('semitones') as string;
    const onlyRecognizeKey = formData.get('onlyRecognizeKey') as string;
    const chordsDataStr = formData.get('chordsData') as string; // 前端传递的预存和弦数据
    const chordColor = (formData.get('chordColor') as string) || '#2563EB'; // 默认蓝色
    const fontSizeStr = formData.get('fontSize') as string; // 字体大小参数

    if (!imageFile) {
      return NextResponse.json({ error: '请上传图片' }, { status: 400 });
    }

    // 如果只是识别原调（同时识别和弦，复用于转调）
    if (onlyRecognizeKey === 'true') {
      // 将图片转换为 buffer
      const originalImageBuffer = Buffer.from(await imageFile.arrayBuffer());

      // 获取原始图片尺寸
      const originalMetadata = await sharp(originalImageBuffer).metadata();
      const originalWidth = originalMetadata.width || 800;
      const originalHeight = originalMetadata.height || 1000;

      // 智能放大低分辨率图片（用于AI识别）
      const upscaledImage = await upscaleImageIfNeeded(originalImageBuffer);
      const imgWidth = upscaledImage.width;
      const imgHeight = upscaledImage.height;

      if (upscaledImage.wasUpscaled) {
        console.log(`✅ AI识别使用放大图片: ${imgWidth}x${imgHeight}（原始: ${originalWidth}x${originalHeight}）`);
      }

      // 将图片转换为 base64
      const imageBase64 = `data:${imageFile.type};base64,${upscaledImage.buffer.toString('base64')}`;

      console.log('图片尺寸:', imgWidth, 'x', imgHeight);

      // 识别原调和和弦（一次调用，返回完整结果）
      const recognitionResult = await recognizeChordsFromImage(imageBase64, imageFile.type, imgWidth, imgHeight);

      // 返回原调和完整的识别结果（前端会存储后者用于转调）
      return NextResponse.json({
        originalKey: recognitionResult.key ? chordTransposer.normalizeKey(recognitionResult.key) : null,
        recognitionResult: recognitionResult, // 包含所有和弦数据
      });
    }

    // 正常转调流程
    if (!targetKey) {
      return NextResponse.json({ error: '请选择目标调' }, { status: 400 });
    }

    // 计算实际半音数
    let semitones = 0;
    if (directionStr && semitonesStr) {
      const dir = directionStr === 'up' ? 1 : -1;
      semitones = dir * parseFloat(semitonesStr);
    }

    console.log('转调设置:', { targetKey, direction: directionStr, semitonesInput: semitonesStr, finalSemitones: semitones });

    // 解析用户指定的锚点（可选）
    let userAnchorFirst = null;
    let userAnchorLast = null;
    if (anchorFirstStr && anchorLastStr) {
      userAnchorFirst = JSON.parse(anchorFirstStr);
      userAnchorLast = JSON.parse(anchorLastStr);
      console.log('用户指定的锚点:', { first: userAnchorFirst, last: userAnchorLast });
    }

    // 保存原始图片buffer（用于最终标注）
    const originalImageBuffer = Buffer.from(await imageFile.arrayBuffer());

    // 获取原始图片尺寸
    const originalMetadata = await sharp(originalImageBuffer).metadata();
    const originalWidth = originalMetadata.width || 800;
    const originalHeight = originalMetadata.height || 1000;

    // 智能放大低分辨率图片（用于AI识别）
    const upscaledImage = await upscaleImageIfNeeded(originalImageBuffer);
    const imgWidth = upscaledImage.width;
    const imgHeight = upscaledImage.height;

    if (upscaledImage.wasUpscaled) {
      console.log(`✅ AI识别使用放大图片: ${imgWidth}x${imgHeight}（原始: ${originalWidth}x${originalHeight}）`);
    }

    console.log('图片尺寸:', imgWidth, 'x', imgHeight);

    // 将图片转换为 base64
    const imageBase64 = `data:${imageFile.type};base64,${upscaledImage.buffer.toString('base64')}`;

    // 识别和弦：如果前端传递了预存数据，直接使用；否则调用大模型
    let recognitionResult: any;
    if (chordsDataStr) {
      try {
        recognitionResult = JSON.parse(chordsDataStr);
        console.log('📦 使用预存和弦数据，跳过大模型调用');
        console.log('预存数据:', JSON.stringify(recognitionResult, null, 2));
      } catch (error) {
        console.error('解析预存和弦数据失败:', error);
        return NextResponse.json({ error: '预存数据无效' }, { status: 400 });
      }
    } else {
      console.log('🤖 调用大模型识别和弦...');
      recognitionResult = await recognizeChordsFromImage(imageBase64, imageFile.type, imgWidth, imgHeight);
    }

    if (!recognitionResult) {
      return NextResponse.json({ error: '和弦识别失败' }, { status: 500 });
    }

    // 计算缩放比例（如果图片被放大了）
    const scaleX = originalWidth / imgWidth;
    const scaleY = originalHeight / imgHeight;
    const wasUpscaled = upscaledImage.wasUpscaled;

    // 确定原调（需要用于OCR修正）
    let originalKey = originalKeyInput;
    if (!originalKey && recognitionResult.key) {
      originalKey = chordTransposer.normalizeKey(recognitionResult.key);
    }
    if (!originalKey) {
      originalKey = 'C'; // 默认 C 调
    }

    // 解析识别出的和弦（使用中心点坐标）
    const chords: Chord[] = [];
    const rawCenters = recognitionResult.centers || [];

    console.log('========== AI识别原始结果 ==========');
    console.log('原始数据:', JSON.stringify(recognitionResult, null, 2));
    console.log('中心点数量:', rawCenters.length);

    // 收集所有有效的中心点坐标（像素坐标）
    const validCenters = rawCenters.filter(
      (c: any) => typeof c.cx === 'number' && typeof c.cy === 'number' && !isNaN(c.cx) && !isNaN(c.cy) &&
                   c.cx >= 0 && c.cx <= 1000 && c.cy >= 0 && c.cy <= 1000
    );

    // 去重和异常值检测（基于像素坐标）
    const dedupedCenters: any[] = [];
    const pixelDistanceThreshold = Math.max(imgWidth, imgHeight) * 0.01; // 1%的最大边长作为阈值（避免误删）

    // 检测异常Y值：计算所有和弦的Y坐标中位数
    const yCoordinates = validCenters.map((c: any) => c.cy);
    const sortedY = [...yCoordinates].sort((a: number, b: number) => a - b);
    const medianY = sortedY[Math.floor(sortedY.length / 2)];
    const yStdDev = Math.sqrt(yCoordinates.reduce((sum: number, y: number) => sum + Math.pow(y - medianY, 2), 0) / yCoordinates.length);

    for (const center of validCenters) {
      let isDuplicate = false;

      // 异常值检测：排除Y坐标偏离中位数超过3个标准差的和弦
      if (validCenters.length > 5 && Math.abs(center.cy - medianY) > 3 * yStdDev) {
        console.log(`⚠️ 检测到异常Y坐标: ${center.text} 在 y=${center.cy}, 偏离中位数 ${medianY}，可能是误识别`);
        continue;
      }

      // 去重：只有当和弦文本相同且距离很近时，才认为是重复
      for (const existing of dedupedCenters) {
        // 先检查和弦文本是否相同（规范化比较）
        if (center.text.toLowerCase().trim() !== existing.text.toLowerCase().trim()) {
          continue; // 不同和弦，不进行距离检测
        }

        // 相同和弦，再检查距离
        const dx = center.cx - existing.cx;
        const dy = center.cy - existing.cy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < pixelDistanceThreshold) {
          isDuplicate = true;
          console.log(`⚠️ 检测到重复和弦: ${center.text} 与 ${existing.text} 距离 ${distance.toFixed(1)}px，跳过`);
          break;
        }
      }

      if (!isDuplicate) {
        dedupedCenters.push(center);
      }
    }

    // 显式排序：按Y坐标优先（从上到下），X坐标次之（从左到右）
    dedupedCenters.sort((a: any, b: any) => {
      if (Math.abs(a.cy - b.cy) < 30) { // Y坐标相差小于30像素，认为是同一行
        return a.cx - b.cx; // 同一行按X排序
      }
      return a.cy - b.cy; // 不同行按Y排序
    });

    console.log('========== 去重统计 ==========');
    console.log('原始数量:', validCenters.length);
    console.log('去重后数量:', dedupedCenters.length);
    console.log('移除重复:', validCenters.length - dedupedCenters.length);
    console.log('Y坐标中位数:', medianY.toFixed(1), '标准差:', yStdDev.toFixed(1));

    if (dedupedCenters.length > 0) {
      // ========== 直接使用千分比坐标 ==========
      // X轴：直接使用 cx / 10
      // Y轴：有用户锚点时校准，否则使用 cy / 10

      // Y轴：根据是否有用户锚点决定
      let userMinY = null;
      let userMaxY = null;

      if (userAnchorFirst && userAnchorLast) {
        console.log('========== 使用千分比坐标（带用户Y轴锚点） ==========');
        userMinY = userAnchorFirst.y;
        userMaxY = userAnchorLast.y;
        console.log('用户Y轴锚点:', { min: userMinY, max: userMaxY });
      } else {
        console.log('========== 直接使用千分比坐标 ==========');
      }

      // 对每个和弦直接使用千分比坐标
      for (let i = 0; i < dedupedCenters.length; i++) {
        const rawCenter = dedupedCenters[i];

        console.log(`\n========== 处理中心点 ${i + 1}: ${rawCenter.text} ==========`);
        console.log('AI返回的原始坐标:', { cx: rawCenter.cx, cy: rawCenter.cy });

        // X轴：直接使用千分比
        const x = rawCenter.cx / 10;  // 千分比 → 百分比
        console.log(`X轴千分比: ${rawCenter.cx} → ${x.toFixed(1)}%`);

        // Y轴：根据是否有用户锚点
        let y;
        if (userMinY !== null && userMaxY !== null) {
          // 使用用户锚点进行Y轴校准
          // 计算AI Y轴在AI范围内的比例
          const aiMinY = Math.min(...dedupedCenters.map((c: any) => c.cy));
          const aiMaxY = Math.max(...dedupedCenters.map((c: any) => c.cy));

          const ratioY = (rawCenter.cy - aiMinY) / (aiMaxY - aiMinY || 1);
          y = userMinY + ratioY * (userMaxY - userMinY);
          console.log(`Y轴校准: AI千分比=${rawCenter.cy} → AI比例=${ratioY.toFixed(3)} → 用户Y=${y.toFixed(1)}%`);
        } else {
          // 直接使用千分比
          y = rawCenter.cy / 10;
          console.log(`Y轴千分比: ${rawCenter.cy} → ${y.toFixed(1)}%`);
        }

        console.log('最终百分比坐标:', { x: x.toFixed(1), y: y.toFixed(1) });

        // 根据原调修正AI识别的和弦（修正遗漏的升降号）
        const correctedChordText = chordTransposer.correctChordByKey(rawCenter.text, originalKey);
        if (correctedChordText !== rawCenter.text) {
          console.log(`  ✅ OCR修正: ${rawCenter.text} → ${correctedChordText}`);
        }

        const parsed = chordTransposer.parseChord(correctedChordText);
        if (parsed) {
          chords.push({
            ...parsed,
            x: x,
            y: y,
          });
          console.log(`✓ 解析成功，添加到和弦列表 (索引 ${chords.length - 1})`);
        } else {
          console.warn(`✗ 解析失败: ${rawCenter.text}`);
        }
      }
    } else {
      console.warn('⚠️ 没有有效的中心点坐标');
    }

    console.log('\n========== 坐标汇总 ==========');
    console.log('和弦总数:', chords.length);
    if (chords.length > 0) {
      const maxX = Math.max(...chords.map(c => c.x || 0));
      const maxY = Math.max(...chords.map(c => c.y || 0));
      const minX = Math.min(...chords.map(c => c.x || 0));
      const minY = Math.min(...chords.map(c => c.y || 0));
      console.log('X范围:', minX.toFixed(1), '-', maxX.toFixed(1), '%');
      console.log('Y范围:', minY.toFixed(1), '-', maxY.toFixed(1), '%');
    }

    console.log('\n========== 最终和弦列表 ==========');
    console.log(JSON.stringify(chords.map(c => ({
      root: c.root,
      quality: c.quality,
      x: c.x?.toFixed(2),
      y: c.y?.toFixed(2),
    })), null, 2));

    // 执行转调
    let transposeResult;
    if (semitones !== 0) {
      // 用户指定了升降音数，使用新方法
      // 传入用户选择的目标调，确保显示的targetKey与用户选择一致
      transposeResult = chordTransposer.transposeChordsBySemitones(chords, originalKey, semitones, true, targetKey);
      console.log('使用升降音数转调:', semitones, '用户选择目标调:', targetKey);
    } else {
      // 使用目标调转调
      transposeResult = chordTransposer.transposeChords(chords, originalKey, targetKey, true);
      console.log('使用目标调转调:', targetKey);
    }

    console.log('转调结果:', transposeResult);

    // 处理字体大小参数
    let fontSize = null;
    if (fontSizeStr) {
      const parsedFontSize = parseFloat(fontSizeStr);
      if (!isNaN(parsedFontSize) && parsedFontSize > 0) {
        fontSize = parsedFontSize;
      }
    }

    // 生成标注后的图片（使用canvas）
    // 注意：使用原始图片进行标注，因为百分比坐标是相对的，会自动正确映射
    const annotateResult = await annotateImage(
      originalImageBuffer,
      transposeResult,
      chordColor,
      fontSize,
      transposeResult.originalKey,
      transposeResult.targetKey
    );

    return NextResponse.json({
      originalKey: transposeResult.originalKey,
      targetKey: transposeResult.targetKey,
      semitones: transposeResult.semitones,
      chordColor: chordColor,
      fontSize: annotateResult.fontSize, // 使用实际使用的fontSize
      chords: transposeResult.chords.map(item => ({
        original: chordTransposer.chordToString(item.original),
        transposed: chordTransposer.chordToString(item.transposed),
        x: item.transposed.x,
        y: item.transposed.y,
      })),
      resultImage: annotateResult.resultImage, // 使用返回的resultImage
      recognition: recognitionResult,
    });
  } catch (error) {
    console.error('转调处理错误:', error);
    return NextResponse.json({ error: '处理失败' }, { status: 500 });
  }
}

/**
 * 根据中心点扩展边界框
 * @param cx 中心点 x 坐标（像素）
 * @param cy 中心点 y 坐标（像素）
 * @param chordText 和弦文本
 * @param imgWidth 图片宽度
 * @param imgHeight 图片高度
 */
function expandBBox(
  cx: number,
  cy: number,
  chordText: string,
  imgWidth: number,
  imgHeight: number
): { x1: number; y1: number; x2: number; y2: number } {
  // 根据图片大小动态调整字符尺寸
  const charWidth = Math.max(12, Math.floor(imgWidth / 80));   // 单字符平均宽度
  const charHeight = Math.max(16, Math.floor(imgHeight / 50));  // 字符高度
  const padding = Math.max(4, Math.floor(imgWidth / 200));     // 边距

  const textWidth = chordText.length * charWidth;

  return {
    x1: Math.max(0, Math.min(imgWidth, Math.round(cx - textWidth / 2 - padding))),
    y1: Math.max(0, Math.min(imgHeight, Math.round(cy - charHeight / 2 - padding))),
    x2: Math.max(0, Math.min(imgWidth, Math.round(cx + textWidth / 2 + padding))),
    y2: Math.max(0, Math.min(imgHeight, Math.round(cy + charHeight / 2 + padding))),
  };
}

/**
 * 智能放大低分辨率图片
 * 如果宽度或高度小于1200，等比例放大到至少1200
 * @param imageBuffer 原始图片buffer
 * @returns 处理后的图片buffer和尺寸信息
 */
async function upscaleImageIfNeeded(imageBuffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number; wasUpscaled: boolean }> {
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 800;
  const originalHeight = metadata.height || 1000;

  const MIN_SIZE = 1200;

  // 检查是否需要放大
  let needsUpscale = false;
  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  if (originalWidth >= MIN_SIZE && originalHeight >= MIN_SIZE) {
    // 两个维度都满足，不需要放大
    return { buffer: imageBuffer, width: originalWidth, height: originalHeight, wasUpscaled: false };
  }

  // 计算目标尺寸
  if (originalWidth < MIN_SIZE && originalHeight < MIN_SIZE) {
    // 两个都小于1200，将较小的那个放大到1200
    if (originalWidth < originalHeight) {
      targetWidth = MIN_SIZE;
      targetHeight = Math.round((MIN_SIZE / originalWidth) * originalHeight);
    } else {
      targetHeight = MIN_SIZE;
      targetWidth = Math.round((MIN_SIZE / originalHeight) * originalWidth);
    }
  } else if (originalWidth < MIN_SIZE) {
    // 只有宽度小于1200，放大宽度到1200，高度等比例放大
    targetWidth = MIN_SIZE;
    targetHeight = Math.round((MIN_SIZE / originalWidth) * originalHeight);
  } else {
    // 只有高度小于1200，放大高度到1200，宽度等比例放大
    targetHeight = MIN_SIZE;
    targetWidth = Math.round((MIN_SIZE / originalHeight) * originalWidth);
  }

  console.log(`🔧 图片放大: ${originalWidth}x${originalHeight} → ${targetWidth}x${targetHeight}`);

  // 使用高质量缩放算法放大图片
  const upscaledBuffer = await sharp(imageBuffer)
    .resize(targetWidth, targetHeight, {
      kernel: sharp.kernel.lanczos3, // 使用Lanczos3算法获得更好的质量
      withoutEnlargement: false,
    })
    .toBuffer();

  return {
    buffer: upscaledBuffer,
    width: targetWidth,
    height: targetHeight,
    wasUpscaled: true,
  };
}

/**
 * 调用视觉模型（支持备用模型机制）
 */
async function callVisionModelWithFallback(
  client: LLMClient,
  messages: any[],
  modelName: string,
  isFallback = false
): Promise<{ response: any; modelUsed: string }> {
  try {
    const modelLabel = isFallback ? '备用模型' : '主模型';
    console.log(`🤖 调用${modelLabel}: ${modelName}`);
    
    const response = await client.invoke(messages, {
      model: modelName,
      temperature: 0.2, // 低温度以获得更准确的结果
    });
    
    console.log(`✅ ${modelLabel}调用成功: ${modelName}`);
    return { response, modelUsed: modelName };
  } catch (error) {
    const modelLabel = isFallback ? '备用模型' : '主模型';
    console.error(`❌ ${modelLabel}调用失败 (${modelName}):`, error instanceof APIError ? error.message : error);
    throw error;
  }
}

/**
 * 调用多模态模型识别图片中的和弦和调号（支持智能模型切换）
 */
async function recognizeChordsFromImage(imageBase64: string, mimeType: string, imgWidth: number, imgHeight: number): Promise<any> {
  try {
    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config);

    // 获取主模型
    const primaryModel = getPrimaryModel();
    
    console.log('='.repeat(60));
    console.log('🎯 和弦识别任务启动');
    console.log(`📐 图片尺寸: ${imgWidth} x ${imgHeight}`);
    console.log(`🤖 主模型: ${primaryModel}`);
    console.log(`🤖 可用视觉模型: ${AVAILABLE_VISION_MODELS.length} 个`);
    console.log('='.repeat(60));

    // 构造优化的提示词（绝对像素坐标 + 中心点定位）
    const systemPrompt = `你是一个专业的简谱和弦 OCR 定位系统。你的任务是从一张简谱图片中识别调号，并定位所有和弦标记的精确像素位置。

==============================
【图片尺寸（非常重要）】
- 图片宽度：${imgWidth} 像素
- 图片高度：${imgHeight} 像素
- 图片左上角坐标为 (0, 0)
- 图片右下角坐标为 (${imgWidth}, ${imgHeight})

==============================
【唯一允许的坐标系统】
- 坐标必须是"绝对像素坐标"
- x 轴范围：0 ≤ x ≤ ${imgWidth}
- y 轴范围：0 ≤ y ≤ ${imgHeight}
- ❌ 不允许使用百分比
- ❌ 不允许使用 0–1 或 0–100 的归一化坐标
- ❌ 不允许相对坐标或比例坐标

==============================
【识别任务】

1. 调号识别：
- 查找图片左上角的调号标记，格式可能是："1=C"、"1=G"、"1=A"、"原调: F"、"1=bB"、"1=bE"、"1=bA"等
- 必须识别升降号（#或b），返回完整的调号，包括升降号
- 示例：
  - "1=C" → 返回 "C"
  - "1=G" → 返回 "G"
  - "1=Bb" 或 "1=bB" → 返回 "Bb"（降号必须保留）
  - "1=F#" 或 "1=#F" → 返回 "F#"（升号必须保留）
- 如果图片中没有调号标记，返回 null

2. 和弦识别：
- 识别图片中所有和弦标记（例如：C, Am, G7, F#m, Asus4, D/F# 等）
- 和弦通常位于音符或小节线上方
- 注意：升降号（#、b）可能以三种形式出现：
  1. 普通形式：F#、Bb、G#m
  2. 上标形式（浮在上半空间）：F^#、B^b、G^#m（类似 A7sus4 中 7、4 的上标）
  3. 前置形式：#F、bE（识别后请转换为标准形式 F#、Eb）
- 无论升降号以何种形式出现，都应识别并返回标准格式（如 F# 而非 F^#）
- ⚠️ 终止标记和重复记号（非常重要）：
  - Fine.、D.S.、D.C.、Segno、Coda 等是终止/重复记号，不是和弦，必须忽略
  - 不要识别"Fine."、".Fine"等作为和弦
  - 不要将"ine"、"Fine."等文本识别为和弦
  - 如果看到"CD.S.al.Fine."，只识别"C"和弦，忽略后面的"D.S.al.Fine."
  - 如果看到"D7Fine."，只识别"D7"和弦，忽略后面的"Fine."
  - 若看到用"或"或"or"连接的两个和弦（如"G 或 G/B"），"或"字是分隔符，只返回第一个和弦"G"及其中心位置
- 忽略歌词、简谱数字（1–7）、拍号（4/4 等）、速度标记

==============================
【坐标定位规则（严格）】

你的任务不是返回边界框，而是返回每个和弦文字的"视觉中心点"。

- 返回 center_x, center_y
- center_x, center_y 必须是绝对像素坐标
- center_y 必须真实反映和弦在图片中的垂直位置
- center_x 必须真实反映和弦在图片中的水平位置

==============================
【分布校验规则（必须遵守）】

- 如果图片下半部分（y > ${Math.floor(imgHeight * 0.5)}）存在和弦，必须返回对应坐标
- 不允许所有和弦的 y 值集中在图片上半部分
- 图片底部区域（y > ${Math.floor(imgHeight * 0.75)}）出现的和弦，必须被识别并返回

==============================
【返回格式（只允许 JSON）】

{
  "key": "A" 或 null,
  "centers": [
    { "text": "D",   "cx": 145, "cy": 260 },
    { "text": "A",   "cx": 390, "cy": 260 },
    { "text": "F#m", "cx": 800, "cy": 1480 }
  ]
}

❗ 不要输出任何解释性文字
❗ 不要使用 Markdown
❗ 不要省略任何检测到的和弦
❗ 按从左到右、从上到下的顺序返回`;

    const userPrompt = '请分析这张简谱图片，识别调号和所有和弦标记，以JSON格式返回。特别注意：必须返回每个和弦的真实像素中心点坐标（cx, cy），坐标范围必须是 0-' + imgWidth + '（x轴）和 0-' + imgHeight + '（y轴）。';

    // 构造消息（多模态）
    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: userPrompt },
          {
            type: 'image_url' as const,
            image_url: {
              url: imageBase64,
              detail: 'high' as const,
            },
          },
        ],
      },
    ];

    // 调用视觉模型（智能模型切换：优先纯视觉模型）
    let response: any;
    let modelUsed: string;
    let failedModels: string[] = [];
    
    // 第一阶段：尝试主模型
    try {
      console.log(`🚀 尝试主模型: ${primaryModel} (优先级: ${getVisionModelPriority(primaryModel)})`);
      const result = await callVisionModelWithFallback(client, messages, primaryModel, false);
      response = result.response;
      modelUsed = result.modelUsed;
    } catch (primaryError) {
      console.warn(`⚠️ 主模型 ${primaryModel} 调用失败: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
      failedModels.push(primaryModel);
      
      // 第二阶段：智能选择备用模型（优先纯视觉模型）
      let fallbackModel = selectFallbackModel(primaryModel);
      let fallbackAttempts = 0;
      const maxFallbackAttempts = AVAILABLE_VISION_MODELS.length - 1; // 最多尝试所有其他模型
      
      while (fallbackAttempts < maxFallbackAttempts && failedModels.includes(fallbackModel)) {
        fallbackModel = selectFallbackModel(fallbackModel); // 选择下一个备选模型
        fallbackAttempts++;
      }
      
      if (failedModels.includes(fallbackModel)) {
        console.error(`💔 所有可用模型均已尝试失败`);
        throw new Error(`所有视觉模型均调用失败: ${failedModels.join(', ')}`);
      }
      
      try {
        console.log(`🔄 尝试备用模型: ${fallbackModel} (优先级: ${getVisionModelPriority(fallbackModel)})`);
        const result = await callVisionModelWithFallback(client, messages, fallbackModel, true);
        response = result.response;
        modelUsed = result.modelUsed;
        console.log(`✅ 备用模型切换成功: ${fallbackModel}`);
        console.log(`📊 模型类型: ${getVisionModelPriority(fallbackModel) === 1 ? '纯视觉模型' : '多模态模型'}`);
      } catch (fallbackError) {
        console.error(`💔 备用模型 ${fallbackModel} 也失败了`);
        failedModels.push(fallbackModel);
        throw new Error(`所有尝试的模型均调用失败: ${failedModels.join(', ')}`);
      }
    }

    console.log(`🎯 实际使用的模型: ${modelUsed}`);
    console.log(`📊 模型类型: ${getVisionModelPriority(modelUsed) === 1 ? '纯视觉模型 ✓' : '多模态模型'}`);

    // 解析 JSON 响应
    const content = response.content.trim();

    // 尝试提取 JSON（可能被包裹在代码块中）
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1];
    }

    // 解析 JSON
    const result = JSON.parse(jsonStr);
    
    // 在返回结果中添加使用的模型信息
    result._modelUsed = modelUsed;

    console.log('识别结果:', result);

    return result;
  } catch (error) {
    console.error('和弦识别失败:', error);
    // 失败时返回空结果
    return {
      key: null,
      chords: [],
    };
  }
}

/**
 * 将十六进制颜色转换为RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * 将RGB转换为十六进制颜色
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * 调亮颜色
 * @param hexColor 十六进制颜色
 * @param factor 调亮因子（0-1），越大越亮
 */
function lightenColor(hexColor: string, factor: number = 0.4): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;

  // 混合白色来调亮
  const r = rgb.r + (255 - rgb.r) * factor;
  const g = rgb.g + (255 - rgb.g) * factor;
  const b = rgb.b + (255 - rgb.b) * factor;

  return rgbToHex(r, g, b);
}

/**
 * 检测两个矩形是否重叠
 */
function rectanglesOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

/**
 * 在原图上标注转调后的和弦
 * @param imageBuffer 图片缓冲区
 * @param transposeResult 转调结果
 * @param chordColor 和弦颜色
 * @param customFontSize 自定义字体大小（可选，如果不提供则自动计算）
 * @returns 包含图片base64和实际使用的fontSize
 */
async function annotateImage(
  imageBuffer: Buffer,
  transposeResult: any,
  chordColor: string = '#2563EB',
  customFontSize?: number | null,
  originalKey: string = '',
  targetKey: string = ''
): Promise<{ resultImage: string; fontSize: number }> {
  try {
    const { createCanvas, loadImage } = require('canvas');

    // 加载原图
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // 绘制原图
    ctx.drawImage(image, 0, 0);

    // 计算字体大小：如果提供了自定义值则使用，否则动态计算
    const fontSize = customFontSize || Math.max(16, Math.min(88, Math.round(image.width / 45)));

    // 设置字体（用于测量文本）
    ctx.font = `normal ${fontSize}px Georgia, serif`;

    // 第一步：遍历所有和弦，计算并存储背景框和文本信息
    type ChordDrawInfo = {
      chordText: string;
      x: number;
      y: number;
      rectX: number;          // 实际绘制矩形的左上角x
      rectY: number;          // 实际绘制矩形的左上角y
      rectWidth: number;      // 实际绘制矩形宽度
      rectHeight: number;     // 实际绘制矩形高度
      overlapRectX: number;   // 重叠检测矩形的左上角x（较小padding）
      overlapRectY: number;   // 重叠检测矩形的左上角y（较小padding）
      overlapRectWidth: number; // 重叠检测矩形宽度（较小padding）
      overlapRectHeight: number; // 重叠检测矩形高度（较小padding）
      color: string;          // 最终颜色（可能是原色或调淡色）
    };

    const chordDrawInfos: ChordDrawInfo[] = [];

    for (let i = 0; i < transposeResult.chords.length; i++) {
      const item = transposeResult.chords[i];
      const chord = item.transposed;

      // 检查坐标是否有效
      if (typeof chord.x !== 'number' || typeof chord.y !== 'number' || isNaN(chord.x) || isNaN(chord.y)) {
        continue;
      }

      if (chord.x < 0 || chord.x > 100 || chord.y < 0 || chord.y > 100) {
        continue;
      }

      // 转换百分比坐标为实际像素坐标
      const x = Math.round((chord.x / 100) * image.width);
      const y = Math.round((chord.y / 100) * image.height);

      // 计算和弦文本
      const chordText = chordTransposer.chordToString(chord);

      // 测量文本宽度和高度
      const textMetrics = ctx.measureText(chordText);
      const textWidth = textMetrics.width;
      // 估算文本高度（更精确）
      const textHeight = fontSize * 1.1;

      // 计算实际绘制矩形（大padding，确保完全覆盖原和弦）
      const drawPadding = fontSize * 0.8; // 大padding，实际绘制用
      const rectWidth = Math.round(textWidth + drawPadding * 2);
      const rectHeight = Math.round(textHeight + drawPadding * 0.63); // 纵向padding减少10%
      const rectX = x - rectWidth / 2;
      const rectY = y - rectHeight / 2;

      // 计算重叠检测矩形（小padding，避免过度检测重叠）
      const overlapPadding = fontSize * 0.2; // 小padding，重叠检测用
      const overlapRectWidth = Math.round(textWidth + overlapPadding * 2);
      const overlapRectHeight = Math.round(textHeight + overlapPadding * 0.7);
      const overlapRectX = x - overlapRectWidth / 2;
      const overlapRectY = y - overlapRectHeight / 2;

      chordDrawInfos.push({
        chordText,
        x,
        y,
        rectX,
        rectY,
        rectWidth,
        rectHeight,
        overlapRectX,
        overlapRectY,
        overlapRectWidth,
        overlapRectHeight,
        color: chordColor, // 初始使用原色
      });
    }

    // 第二步：检测重叠并调整颜色
    // 策略：构建重叠图，对每个连通分量从左到右交替着色

    // 1. 构建邻接表
    const adjacency: number[][] = Array.from({ length: chordDrawInfos.length }, () => []);
    for (let i = 0; i < chordDrawInfos.length; i++) {
      for (let j = i + 1; j < chordDrawInfos.length; j++) {
        const a = chordDrawInfos[i];
        const b = chordDrawInfos[j];
        if (rectanglesOverlap(
          a.overlapRectX, a.overlapRectY, a.overlapRectWidth, a.overlapRectHeight,
          b.overlapRectX, b.overlapRectY, b.overlapRectWidth, b.overlapRectHeight
        )) {
          adjacency[i].push(j);
          adjacency[j].push(i);
        }
      }
    }

    // 2. 找出每个连通分量并从左到右交替着色
    const visited = new Set<number>();
    const colorAssignments: boolean[] = Array(chordDrawInfos.length).fill(false); // false=原色, true=浅色

    for (let start = 0; start < chordDrawInfos.length; start++) {
      if (visited.has(start)) continue;

      // BFS收集整个连通分量
      const component: number[] = [];
      const queue: number[] = [start];
      visited.add(start);

      while (queue.length > 0) {
        const u = queue.shift()!;
        component.push(u);

        for (const v of adjacency[u]) {
          if (!visited.has(v)) {
            visited.add(v);
            queue.push(v);
          }
        }
      }

      // 按x坐标排序（从左到右）
      component.sort((a, b) => chordDrawInfos[a].x - chordDrawInfos[b].x);

      // 交替着色：第1个原色，第2个浅色，第3个原色...
      for (let k = 0; k < component.length; k++) {
        colorAssignments[component[k]] = (k % 2 === 1);
      }
    }

    // 3. 应用颜色
    for (let i = 0; i < chordDrawInfos.length; i++) {
      if (colorAssignments[i]) {
        chordDrawInfos[i].color = lightenColor(chordColor, 0.4);
      }
    }

    // 第二步：绘制所有白色背景框（圆角矩形）

    // 第二步：绘制所有白色背景框（圆角矩形）
    for (const info of chordDrawInfos) {
      // 计算圆角半径（字体大小的20%，最大不超过8px）
      const cornerRadius = Math.min(fontSize * 0.2, 8);

      // 绘制白色背景圆角矩形（覆盖原和弦，无边框）
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.roundRect(info.rectX, info.rectY, info.rectWidth, info.rectHeight, cornerRadius);
      ctx.fill();
    }

    // 第三步：绘制所有文本（在最顶层）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const info of chordDrawInfos) {
      // 绘制和弦文本（使用 middle 基线，确保文本中心对齐坐标点）
      ctx.fillStyle = info.color; // 使用调整后的颜色（可能是原色或调淡色）
      ctx.fillText(info.chordText, info.x, info.y);
    }

    // 在左上角绘制转调标记（分色显示）
    if (originalKey && targetKey) {
      const markFontSize = Math.floor(image.width * 0.04); // 宽度的4%
      const arrow = ' → '; // 箭头
      const markPadding = 15;

      // 计算文本尺寸
      ctx.font = `normal ${markFontSize}px Georgia, serif`; // Georgia字体，不加粗
      const originalMetrics = ctx.measureText(originalKey);
      const arrowMetrics = ctx.measureText(arrow);
      const targetMetrics = ctx.measureText(targetKey);

      const totalWidth = originalMetrics.width + arrowMetrics.width + targetMetrics.width;
      const markHeight = markFontSize * 1.2;

      // 计算左上角位置（留出边距）
      const markX = markPadding;
      const markY = markPadding + markHeight;

      // 绘制半透明白色背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(
        markX - markPadding / 2,
        markY - markHeight - markPadding / 2,
        totalWidth + markPadding * 1.5,
        markHeight + markPadding
      );

      // 设置文本绘制属性
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // 绘制原调（黑色）
      ctx.fillStyle = '#000000'; // 黑色
      ctx.fillText(originalKey, markX, markY - markHeight);

      // 绘制箭头（黑色）
      ctx.fillStyle = '#000000'; // 黑色
      ctx.fillText(arrow, markX + originalMetrics.width, markY - markHeight);

      // 绘制目标调（蓝色）
      ctx.fillStyle = '#2563EB'; // 蓝色
      ctx.fillText(targetKey, markX + originalMetrics.width + arrowMetrics.width, markY - markHeight);
    }

    // 转换为 Buffer
    const resultBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });

    // 返回 base64 格式和实际使用的fontSize
    return {
      resultImage: `data:image/jpeg;base64,${resultBuffer.toString('base64')}`,
      fontSize: fontSize,
    };
  } catch (error) {
    console.error('图片标注失败:', error);
    // 失败时返回原图和默认fontSize
    return {
      resultImage: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
      fontSize: 20, // 失败时返回默认值
    };
  }
}
