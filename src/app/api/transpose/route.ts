import { NextRequest, NextResponse } from 'next/server';
import { chordTransposer, Chord } from '@/lib/chord-transposer';
import sharp from 'sharp';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

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
    const chordColor = (formData.get('chordColor') as string) || '#2563EB'; // 默认蓝色
    const fontSizeStr = formData.get('fontSize') as string; // 字体大小参数

    if (!imageFile) {
      return NextResponse.json({ error: '请上传图片' }, { status: 400 });
    }

    // 如果只是识别原调
    if (onlyRecognizeKey === 'true') {
      // 将图片转换为 base64
      const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      const imageBase64 = `data:${imageFile.type};base64,${imageBuffer.toString('base64')}`;

      // 获取图片尺寸
      const imageInfo = await sharp(imageBuffer).metadata();
      const imgWidth = imageInfo.width || 800;
      const imgHeight = imageInfo.height || 1000;

      // 只识别原调
      const recognitionResult = await recognizeChordsFromImage(imageBase64, imageFile.type, imgWidth, imgHeight);

      return NextResponse.json({
        originalKey: recognitionResult.key ? chordTransposer.normalizeKey(recognitionResult.key) : null,
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

    // 将图片转换为 base64
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const imageBase64 = `data:${imageFile.type};base64,${imageBuffer.toString('base64')}`;

    // 获取图片尺寸（用于坐标转换和传递给AI）
    const imageInfo = await sharp(imageBuffer).metadata();
    const imgWidth = imageInfo.width || 800;
    const imgHeight = imageInfo.height || 1000;
    console.log('图片尺寸:', imgWidth, 'x', imgHeight);

    // 调用多模态模型识别和弦（传入图片尺寸）
    const recognitionResult = await recognizeChordsFromImage(imageBase64, imageFile.type, imgWidth, imgHeight);

    if (!recognitionResult) {
      return NextResponse.json({ error: '和弦识别失败' }, { status: 500 });
    }

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

    // 收集所有有效的中心点坐标
    const validCenters = rawCenters.filter(
      (c: any) => typeof c.cx === 'number' && typeof c.cy === 'number' && !isNaN(c.cx) && !isNaN(c.cy)
    );

    // 去重：移除坐标非常接近的重复和弦（阈值降低到1%）
    const dedupedCenters: any[] = [];
    const distanceThreshold = 1; // 百分比距离阈值（1%）

    for (const center of validCenters) {
      let isDuplicate = false;

      // 检查是否与已存在的和弦太接近
      for (const existing of dedupedCenters) {
        const dx = Math.abs((center.cx / imgWidth) * 100 - (existing.cx / imgWidth) * 100);
        const dy = Math.abs((center.cy / imgHeight) * 100 - (existing.cy / imgHeight) * 100);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < distanceThreshold) {
          isDuplicate = true;
          console.log(`⚠️ 检测到重复和弦: ${center.text} 与 ${existing.text} 距离 ${distance.toFixed(2)}%，跳过`);
          break;
        }
      }

      if (!isDuplicate) {
        dedupedCenters.push(center);
      }
    }

    console.log('========== 去重统计 ==========');
    console.log('原始数量:', validCenters.length);
    console.log('去重后数量:', dedupedCenters.length);
    console.log('移除重复:', validCenters.length - dedupedCenters.length);

    if (dedupedCenters.length > 0) {
      if (userAnchorFirst && userAnchorLast) {
        // ========== 用户指定锚点映射（简单版本） ==========
        console.log('========== 使用用户指定锚点映射 ==========');
        console.log('用户指定的第一个和弦位置（百分比）:', userAnchorFirst);
        console.log('用户指定的最后一个和弦位置（百分比）:', userAnchorLast);

        // AI 返回的第一个和最后一个和弦（像素坐标）
        const aiFirst = dedupedCenters[0];
        const aiLast = dedupedCenters[dedupedCenters.length - 1];

        console.log('AI 返回的第一个和弦:', { cx: aiFirst.cx, cy: aiFirst.cy, text: aiFirst.text });
        console.log('AI 返回的最后一个和弦:', { cx: aiLast.cx, cy: aiLast.cy, text: aiLast.text });

        // 对每个和弦应用锚点映射
        for (let i = 0; i < dedupedCenters.length; i++) {
          const rawCenter = dedupedCenters[i];

          console.log(`\n========== 处理中心点 ${i + 1}: ${rawCenter.text} ==========`);
          console.log('AI返回的原始坐标:', { cx: rawCenter.cx, cy: rawCenter.cy });

          // 计算在 AI 空间中的比例位置（0-1）
          const aiRatioX = (rawCenter.cx - aiFirst.cx) / (aiLast.cx - aiFirst.cx || 1);
          const aiRatioY = (rawCenter.cy - aiFirst.cy) / (aiLast.cy - aiFirst.cy || 1);

          console.log('AI 空间比例:', { ratioX: aiRatioX.toFixed(3), ratioY: aiRatioY.toFixed(3) });

          // 映射到用户指定的空间
          const x = userAnchorFirst.x + aiRatioX * (userAnchorLast.x - userAnchorFirst.x);
          const y = userAnchorFirst.y + aiRatioY * (userAnchorLast.y - userAnchorFirst.y);

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
        // ========== 自动归一化映射 ==========
        // 计算 AI 输出的边界盒
        const minX = Math.min(...dedupedCenters.map((c: any) => c.cx));
        const maxX = Math.max(...dedupedCenters.map((c: any) => c.cx));
        const minY = Math.min(...dedupedCenters.map((c: any) => c.cy));
        const maxY = Math.max(...dedupedCenters.map((c: any) => c.cy));

        console.log('========== 坐标归一化 ==========');
        console.log('AI 输出边界盒:', { minX, maxX, minY, maxY });
        console.log('图片尺寸:', { width: imgWidth, height: imgHeight });

        // 计算缩放因子（线性映射到完整画布）
        const rangeX = maxX - minX || 1; // 避免除以0
        const rangeY = maxY - minY || 1;
        const scaleX = imgWidth / rangeX;
        const scaleY = imgHeight / rangeY;

        console.log('缩放因子:', { scaleX: scaleX.toFixed(2), scaleY: scaleY.toFixed(2) });

        // 对每个和弦应用坐标归一化
        for (let i = 0; i < dedupedCenters.length; i++) {
          const rawCenter = dedupedCenters[i];

          console.log(`\n========== 处理中心点 ${i + 1}: ${rawCenter.text} ==========`);
          console.log('AI返回的原始坐标:', { cx: rawCenter.cx, cy: rawCenter.cy });

          // 线性映射到真实像素空间
          const realX = (rawCenter.cx - minX) * scaleX;
          const realY = (rawCenter.cy - minY) * scaleY;

          console.log('映射后的真实像素:', { realX: realX.toFixed(1), realY: realY.toFixed(1) });

          // 转换为百分比
          const x = (realX / imgWidth) * 100;
          const y = (realY / imgHeight) * 100;

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
      transposeResult = chordTransposer.transposeChordsBySemitones(chords, originalKey, semitones, true);
      console.log('使用升降音数转调:', semitones);
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
    const resultImage = await annotateImage(
      imageBuffer,
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
      fontSize: fontSize,
      chords: transposeResult.chords.map(item => ({
        original: chordTransposer.chordToString(item.original),
        transposed: chordTransposer.chordToString(item.transposed),
        x: item.transposed.x,
        y: item.transposed.y,
      })),
      resultImage: resultImage,
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
 * 调用多模态模型识别图片中的和弦和调号
 */
async function recognizeChordsFromImage(imageBase64: string, mimeType: string, imgWidth: number, imgHeight: number): Promise<any> {
  try {
    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config);

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
- 查找图片左上角的调号标记，如："1=C"、"1=G"、"1=A"、"Key: F"
- 如果存在，返回调性字母（如 "A"）
- 如果不存在，返回 null

2. 和弦识别：
- 识别图片中所有和弦标记（例如：C, Am, G7, F#m, Asus4, D/F# 等）
- 和弦通常位于音符或小节线上方
- 注意：升降号（#、b）可能以三种形式出现：
  1. 普通形式：F#、Bb、G#m
  2. 上标形式（浮在上半空间）：F^#、B^b、G^#m（类似 A7sus4 中 7、4 的上标）
  3. 前置形式：#F、bE（识别后请转换为标准形式 F#、Eb）
- 无论升降号以何种形式出现，都应识别并返回标准格式（如 F# 而非 F^#）
- 特别注意：即使和弦标记与重复记号（如 D.C.al.Fine.、Fine.、D.S.）紧邻（如 "CD.C.al.Fine."），也要识别其中的和弦（如 C）
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

    // 调用视觉模型
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.2, // 低温度以获得更准确的结果
    });

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
 */
async function annotateImage(
  imageBuffer: Buffer,
  transposeResult: any,
  chordColor: string = '#2563EB',
  customFontSize?: number | null,
  originalKey: string = '',
  targetKey: string = ''
): Promise<string> {
  try {
    const { createCanvas, loadImage } = require('canvas');

    console.log('========== 开始标注图片 ==========');
    console.log('和弦数量:', transposeResult.chords.length);
    console.log('和弦详情:', JSON.stringify(transposeResult.chords, null, 2));
    console.log('自定义字体大小:', customFontSize);
    console.log('转调信息:', { originalKey, targetKey });

    // 加载原图
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    console.log('图片尺寸:', image.width, 'x', image.height);

    // 绘制原图
    ctx.drawImage(image, 0, 0);

    // 计算字体大小：如果提供了自定义值则使用，否则动态计算
    const fontSize = customFontSize || Math.max(16, Math.min(28, Math.round(image.width / 45)));
    console.log('实际字体大小:', fontSize);

    // 设置字体（用于测量文本）
    ctx.font = `normal ${fontSize}px Arial, Helvetica, sans-serif`;

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

      console.log(`\n--- 和弦 ${i + 1} ---`);
      console.log('原始和弦:', JSON.stringify(item.original));
      console.log('转调和弦:', JSON.stringify(chord));

      // 检查坐标是否有效
      if (typeof chord.x !== 'number' || typeof chord.y !== 'number' || isNaN(chord.x) || isNaN(chord.y)) {
        console.warn(`❌ 坐标类型无效:`, typeof chord.x, typeof chord.y, chord.x, chord.y);
        continue;
      }

      if (chord.x < 0 || chord.x > 100 || chord.y < 0 || chord.y > 100) {
        console.warn(`❌ 坐标范围无效:`, chord.x, chord.y);
        continue;
      }

      // 转换百分比坐标为实际像素坐标
      const x = Math.round((chord.x / 100) * image.width);
      const y = Math.round((chord.y / 100) * image.height);
      console.log(`✓ 坐标有效:`, chord.x, chord.y, '-> 像素:', x, y);

      // 计算和弦文本
      const chordText = chordTransposer.chordToString(chord);
      console.log('文本内容:', chordText);

      // 测量文本宽度和高度
      const textMetrics = ctx.measureText(chordText);
      const textWidth = textMetrics.width;
      // 估算文本高度（更精确）
      const textHeight = fontSize * 1.1;
      console.log('文本尺寸:', { width: textWidth, height: textHeight });

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

      console.log('绘制矩形(大padding):', { rectX, rectY, rectWidth, rectHeight });
      console.log('重叠检测矩形(小padding):', { overlapRectX, overlapRectY, overlapRectWidth, overlapRectHeight });

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

    console.log('========== 计算完成，准备绘制 ==========');
    console.log('和弦数量:', chordDrawInfos.length);

    // 第二步：检测重叠并调整颜色（按位置交替变化）
    console.log('\n========== 检测重叠 ==========');
    // 1. 检测所有重叠的和弦（使用小padding的矩形进行检测）
    const overlappingChords: number[] = []; // 存储重叠和弦的索引

    for (let i = 0; i < chordDrawInfos.length; i++) {
      let hasOverlap = false;
      for (let j = 0; j < chordDrawInfos.length; j++) {
        if (i === j) continue;

        const current = chordDrawInfos[i];
        const other = chordDrawInfos[j];

        // 使用小padding的重叠检测矩形来判断是否重叠
        if (rectanglesOverlap(
          current.overlapRectX, current.overlapRectY, current.overlapRectWidth, current.overlapRectHeight,
          other.overlapRectX, other.overlapRectY, other.overlapRectWidth, other.overlapRectHeight
        )) {
          console.log(`⚠️ 检测到重叠: 和弦${i+1} "${current.chordText}" 与 和弦${j+1} "${other.chordText}"`);
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        overlappingChords.push(i);
      }
    }

    // 2. 将重叠的和弦按照x坐标（从左到右）排序
    overlappingChords.sort((a, b) => chordDrawInfos[a].x - chordDrawInfos[b].x);

    console.log(`重叠和弦总数: ${overlappingChords.length}`);
    console.log(`重叠和弦索引（按x排序）: ${overlappingChords.map(i => i + 1).join(', ')}`);

    // 3. 按排序顺序交替分配颜色（第1个原色，第2个浅色，第3个原色...）
    for (let k = 0; k < overlappingChords.length; k++) {
      const i = overlappingChords[k]; // 原始索引
      if (k % 2 === 1) {
        // 偶数索引（第2、4、6...个）使用浅色
        chordDrawInfos[i].color = lightenColor(chordColor, 0.4);
        console.log(`  → 和弦${i+1} "${chordDrawInfos[i].chordText}" 排序位置${k+1}，使用调淡色`);
      } else {
        console.log(`  → 和弦${i+1} "${chordDrawInfos[i].chordText}" 排序位置${k+1}，使用原色`);
      }
    }

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

    console.log('✓ 已绘制所有背景框');

    // 第三步：绘制所有文本（在最顶层）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const info of chordDrawInfos) {
      // 绘制和弦文本（使用 middle 基线，确保文本中心对齐坐标点）
      ctx.fillStyle = info.color; // 使用调整后的颜色（可能是原色或调淡色）
      ctx.fillText(info.chordText, info.x, info.y);
      console.log(`✓ 已绘制文本: ${info.chordText} 在 (${info.x}, ${info.y}), 颜色: ${info.color}`);
    }

    console.log('\n========== 标注完成 ==========');
    console.log('成功绘制的和弦数:', chordDrawInfos.length, '/', transposeResult.chords.length);

    // 在左上角绘制转调标记（蓝色）
    if (originalKey && targetKey) {
      const markFontSize = Math.max(20, Math.min(32, Math.round(image.width / 35))); // 增大字号
      const markText = `${originalKey} --> ${targetKey}`; // 简洁格式：Bb --> F
      const markPadding = 15;

      // 计算文本尺寸
      ctx.font = `bold ${markFontSize}px Arial, "Microsoft YaHei", sans-serif`;
      const markMetrics = ctx.measureText(markText);
      const markWidth = markMetrics.width;
      const markHeight = markFontSize * 1.2;

      // 计算左上角位置（留出边距）
      const markX = markPadding;
      const markY = markPadding + markHeight;

      // 绘制半透明白色背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(
        markX - markPadding / 2,
        markY - markHeight - markPadding / 2,
        markWidth + markPadding * 1.5,
        markHeight + markPadding
      );

      // 绘制蓝色文字（左对齐）
      ctx.fillStyle = '#2563EB'; // 蓝色
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(markText, markX, markY - markHeight);

      console.log('✓ 已绘制转调标记:', markText, '在左上角');
    }

    // 转换为 Buffer
    const resultBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });

    console.log('图片合成完成，大小:', resultBuffer.length);

    // 返回 base64 格式
    return `data:image/jpeg;base64,${resultBuffer.toString('base64')}`;
  } catch (error) {
    console.error('❌ 图片标注失败:', error);
    // 失败时返回原图
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  }
}
