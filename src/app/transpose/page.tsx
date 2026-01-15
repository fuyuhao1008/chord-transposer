'use client';

import { useState, useRef, useEffect } from 'react';
import { ALL_KEYS, getKeyIndex } from '@/lib/chord-transposer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Music, Download, Loader2 } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

type PageState = 'upload' | 'locating_first' | 'locating_last' | 'settings' | 'processing' | 'result';

// 图标组件：精确的圆圈和文字框设计
function CalibrationMarker({
  index,
  isFirst,
  isLongPressed,
  isMobile,
}: {
  index: number;
  isFirst: boolean;
  isLongPressed: boolean;
  isMobile: boolean;
}) {
  // 根据索引生成不同的文字内容
  const textLines = isFirst
    ? ['请长按此文本框并拖动', '使红点落在第一个和弦标记中央']
    : ['请长按此文本框并拖动', '使红点落在最后一个和弦标记中央'];

  // 文字中需要强调的部分（黄色）
  const highlightWord = isFirst ? '第一个' : '最后一个';

  // 判断是否移动端
  const isMobileSize = isMobile;

  // 根据是否移动端调整图标整体尺寸
  const scaleFactor = isMobileSize ? 0.65 : 1; // 移动端缩小到65%（让图标更紧凑）

  // 尺寸参数
  const circleOuterSize = 60 * scaleFactor; // 外圆直径
  const circleInnerSize = 30 * scaleFactor; // 内圆直径
  const circleBorderWidth = 3 * scaleFactor; // 外圆边框
  const dotSize = 4.5 * scaleFactor; // 中心红点直径（减小到原来的75%）
  const dotBorderWidth = 0; // 中心红点无白色边框（删除）
  const crossLineLength = 58 * scaleFactor; // 十字准心长度
  const textFontSize = 14 * scaleFactor; // 字体大小
  const textPadding = 12 * scaleFactor; // 文字框内边距
  const spacing = 20 * scaleFactor; // 圆圈和文字框的间距
  const textRectBorderRadius = 8 * scaleFactor; // 文字框圆角

  return (
    <div
      className="calibration-marker"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: isFirst ? 'row' : 'row-reverse', // 第一个图标文字在右，第二个在左
        position: 'relative',
        transform: isLongPressed ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.15s ease-out',
        // 强制禁止所有文本选择和默认触摸行为
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none',
        pointerEvents: 'auto',
        cursor: 'grab',
      }}
    >
      {/* 左侧圆圈部分 */}
      <div
        className="alignment-circle"
        style={{
          width: circleOuterSize,
          height: circleOuterSize,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* 外圆边框 */}
        <div
          style={{
            position: 'absolute',
            width: circleOuterSize,
            height: circleOuterSize,
            borderRadius: '50%',
            border: `${circleBorderWidth}px solid #1890ff`,
            backgroundColor: 'transparent',
            top: 0,
            left: 0,
          }}
        />

        {/* 内圆虚线 */}
        <div
          style={{
            position: 'absolute',
            width: circleInnerSize,
            height: circleInnerSize,
            borderRadius: '50%',
            border: `1px dashed rgba(24, 144, 255, 0.5)`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* 十字准心 - 水平线 */}
        <div
          style={{
            position: 'absolute',
            width: crossLineLength,
            height: '0.5px',
            backgroundColor: 'rgba(255, 0, 0, 0.3)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* 十字准心 - 垂直线 */}
        <div
          style={{
            position: 'absolute',
            width: '0.5px',
            height: crossLineLength,
            backgroundColor: 'rgba(255, 0, 0, 0.3)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* 中心红点 */}
        <div
          style={{
            position: 'absolute',
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: '#ff4d4f',
            border: `${dotBorderWidth}px solid white`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
          }}
        />
      </div>

      {/* 文字框 - 位置根据 isFirst 决定在左或右 */}
      <div
        className="instruction-box"
        style={{
          backgroundColor: '#1890ff',
          borderRadius: `${textRectBorderRadius}px`,
          padding: `${textPadding}px ${textPadding}px`,
          paddingLeft: textPadding,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          marginLeft: isFirst ? spacing : 0,
          marginRight: isFirst ? 0 : spacing,
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {/* 第一行文字 */}
        <div
          style={{
            fontSize: textFontSize,
            color: '#ffffff',
            fontWeight: 400,
            marginBottom: textPadding / 2,
            fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
            lineHeight: 1.4,
          }}
        >
          {textLines[0]}
        </div>

        {/* 第二行文字（带高亮） */}
        <div
          style={{
            fontSize: textFontSize,
            color: '#ffffff',
            fontWeight: 400,
            fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
            lineHeight: 1.4,
          }}
        >
          使红点落在
          <span style={{ color: '#ffd666' }}>{highlightWord}</span>
          和弦标记中央
        </div>
      </div>
    </div>
  );
}

const COLOR_OPTIONS = [
  { value: '#000000', label: '黑色' },
  { value: '#DC2626', label: '红色' },
  { value: '#2563EB', label: '蓝色' },
  { value: '#16A34A', label: '绿色' },
  { value: '#9333EA', label: '紫色' },
];

export default function TransposePage() {
  const [pageState, setPageState] = useState<PageState>('upload');
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageKey, setImageKey] = useState<number>(0);
  const [anchorPoints, setAnchorPoints] = useState<Point[]>([]);
  const [originalKey, setOriginalKey] = useState<string>('');
  const [targetKey, setTargetKey] = useState<string>('');
  const [direction, setDirection] = useState<'up' | 'down' | ''>('');
  const [semitones, setSemitones] = useState<number | ''>('');
  const [result, setResult] = useState<any>(null);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [isAutoRecognized, setIsAutoRecognized] = useState<boolean>(false); // 标记是否AI自动识别
  const [chordColor, setChordColor] = useState<string>('#2563EB'); // 默认改为蓝色
  const [fontSize, setFontSize] = useState<number | null>(null); // 自定义字体大小
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false); // 是否正在调整字体
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [longPressedIndex, setLongPressedIndex] = useState<number | null>(null);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const anchorPointsRef = useRef<Point[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressedRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const draggingIndexRef = useRef<number | null>(null);
  const initialTouchPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedTooMuchRef = useRef<boolean>(false);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isMobileRef = useRef<boolean>(false); // 使用ref而不是state，避免闭包问题
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null); // 记录拖动时的鼠标偏移量
  const activePointersRef = useRef<Set<number>>(new Set()); // 跟踪活跃的pointer ID

  // 检测移动端设备
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      // 检测常见的移动端User-Agent
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      const isMobileDevice = mobileRegex.test(userAgent);
      // 同时也检查屏幕宽度作为备用
      const isSmallScreen = window.innerWidth < 768;

      const isMobileResult = isMobileDevice || isSmallScreen;
      setIsMobile(isMobileResult);
      isMobileRef.current = isMobileResult; // 同步到ref
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 同步anchorPoints到ref
  useEffect(() => {
    anchorPointsRef.current = anchorPoints;
  }, [anchorPoints]);

  // 确保只在客户端渲染完成后才显示图片
  useEffect(() => {
    setMounted(true);
  }, []);

  // Pointer Events 事件处理函数（跨平台统一方案）

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 检测是否是多指操作（缩放手势）
    activePointersRef.current.add(e.pointerId);
    if (activePointersRef.current.size > 1) {
      // 多指操作，不允许触发长按和拖动，允许缩放手势
      return;
    }

    const container = imageContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const pointerX = e.clientX - containerRect.left;
    const pointerY = e.clientY - containerRect.top;

    const markerIndex = isTouchOnMarker(pointerX, pointerY);

    if (markerIndex !== null) {
      // 指针在图标上，立即阻止默认行为（避免浏览器长按菜单和滚动）
      e.preventDefault();
      e.stopPropagation();

      // 计算鼠标相对于图标中心的偏移量（用于拖动时保持相对位置）
      const point = anchorPointsRef.current[markerIndex];
      const markerCenterX = (point.x / 100) * containerRect.width;
      const markerCenterY = (point.y / 100) * containerRect.height;
      dragOffsetRef.current = {
        x: pointerX - markerCenterX,
        y: pointerY - markerCenterY,
      };

      // 启动长按检测
      initialTouchPosRef.current = { x: pointerX, y: pointerY };
      touchMovedTooMuchRef.current = false;
      isLongPressedRef.current = false;
      isDraggingRef.current = false;

      // 500ms后触发长按放大和拖动模式
      longPressTimerRef.current = setTimeout(() => {
        if (!touchMovedTooMuchRef.current && initialTouchPosRef.current) {
          // 长按触发，进入拖动模式
          isLongPressedRef.current = true;
          isDraggingRef.current = true;
          draggingIndexRef.current = markerIndex;

          // 触觉反馈（仅移动端支持）
          if ('vibrate' in navigator && e.pointerType === 'touch') {
            navigator.vibrate([50, 30, 50]);
          }

          // 视觉反馈：更新状态让图标放大50%
          setLongPressedIndex(markerIndex);
        }
      }, 500);
    } else {
      // 如果不在图标上，不启动长按检测，也不阻止默认行为（允许滚动）
      isLongPressedRef.current = false;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    // 检测是否移动了太多（基于初始位置）
    if (initialTouchPosRef.current && !isLongPressedRef.current) {
      const deltaX = Math.abs(pointerX - initialTouchPosRef.current.x);
      const deltaY = Math.abs(pointerY - initialTouchPosRef.current.y);
      const movedDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // 如果移动超过15px，视为滚动意图，取消长按检测（增加阈值让长按更容易触发）
      if (movedDistance > 15) {
        touchMovedTooMuchRef.current = true;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        return; // 滚动意图，直接返回
      }
    }

    // 只有在长按触发后才进入拖动模式
    if (!isLongPressedRef.current || !isDraggingRef.current || draggingIndexRef.current === null) {
      // 检测是否移动了太多（基于初始位置）- 只在未触发长按时检测
      if (!isLongPressedRef.current && initialTouchPosRef.current) {
        const deltaX = Math.abs(pointerX - initialTouchPosRef.current.x);
        const deltaY = Math.abs(pointerY - initialTouchPosRef.current.y);
        const movedDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // 如果移动超过15px，视为滚动意图，取消长按检测
        if (movedDistance > 15) {
          touchMovedTooMuchRef.current = true;
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          return; // 滚动意图，直接返回
        }
      }
      // 没有长按，不处理拖动
      return;
    }

    // 长按已触发，阻止默认滚动，处理拖动
    e.preventDefault();
    e.stopPropagation();

    const container = imageContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // 计算鼠标在容器中的位置
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    // 减去偏移量，得到新的图标中心位置
    const newCenterX = dragOffsetRef.current ? mouseX - dragOffsetRef.current.x : mouseX;
    const newCenterY = dragOffsetRef.current ? mouseY - dragOffsetRef.current.y : mouseY;

    // 转换为百分比坐标
    const x = Math.max(0, Math.min(100, (newCenterX / containerRect.width) * 100));
    const y = Math.max(0, Math.min(100, (newCenterY / containerRect.height) * 100));

    // 更新图标位置
    setAnchorPoints(prev => {
      const newPoints = [...prev];
      if (draggingIndexRef.current !== null && newPoints[draggingIndexRef.current]) {
        newPoints[draggingIndexRef.current] = { x, y };
      }
      return newPoints;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    // 清理pointer ID
    activePointersRef.current.delete(e.pointerId);

    // 清理长按计时器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // 重置所有状态
    isLongPressedRef.current = false;
    isDraggingRef.current = false;
    draggingIndexRef.current = null;
    initialTouchPosRef.current = null;
    touchMovedTooMuchRef.current = false;
    dragOffsetRef.current = null;
    setLongPressedIndex(null);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    // 清理pointer ID
    activePointersRef.current.delete(e.pointerId);

    // 清理长按计时器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // 重置所有状态
    isLongPressedRef.current = false;
    isDraggingRef.current = false;
    draggingIndexRef.current = null;
    initialTouchPosRef.current = null;
    touchMovedTooMuchRef.current = false;
    dragOffsetRef.current = null;
    setLongPressedIndex(null);
  };

  // 阻止右键菜单和长按菜单
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // 清理计时器
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // 处理文件上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
        setImageKey(prev => prev + 1);
        setPageState('locating_first');
        setAnchorPoints([]);
        setResult(null);
        setOriginalKey('');
        setIsAutoRecognized(false);
        setIsRecognizing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // 更换图片
  const handleChangeImage = () => {
    setPageState('upload');
    setImageSrc('');
    setAnchorPoints([]);
    setResult(null);
    setOriginalKey('');
    setIsAutoRecognized(false);
    setTargetKey('');
    setDirection('');
    setSemitones('');
    setIsRecognizing(false);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  // 处理图片点击
  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // 如果正在拖拽，不处理点击
    if (draggingIndex !== null) return;

    // 如果已经有2个和弦，禁止点击添加新和弦
    if (anchorPoints.length >= 2) {
      return;
    }

    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const newPoints = [...anchorPoints, { x, y }];
    setAnchorPoints(newPoints);

    if (pageState === 'locating_first') {
      setPageState('locating_last');
    } else if (pageState === 'locating_last') {
      // 两个和弦都已选择，等待用户确认
    }
  };

  // 处理标记拖拽开始
  const handleMarkerMouseDown = (event: React.MouseEvent, index: number) => {
    event.stopPropagation();
    setDraggingIndex(index);
    // 记录鼠标按下位置，用于区分点击和拖动
    mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
  };

  // 处理标记拖拽移动
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draggingIndex === null) return;

    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));

    const newPoints = [...anchorPoints];
    newPoints[draggingIndex] = { x, y };
    setAnchorPoints(newPoints);
  };

  // 处理标记拖拽结束
  const handleMouseUp = () => {
    setDraggingIndex(null);
  };

  // 判断指针位置是否在某个图标区域内（考虑新图标的实际尺寸）
  const isTouchOnMarker = (pointerX: number, pointerY: number): number | null => {
    const container = imageContainerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    // 实时检测屏幕宽度，避免使用过时的 isMobile 状态
    const isCurrentlyMobile = window.innerWidth < 768;
    const scaleFactor = isCurrentlyMobile ? 0.65 : 1;

    // 新图标尺寸参数（精确计算）
    const circleOuterSize = 60 * scaleFactor; // 外圆直径
    const spacing = 20 * scaleFactor; // 圆圈和文字框的间距
    // 文字框实际尺寸（根据文字内容计算）
    const textWidth = 236 * scaleFactor; // 文字框宽度（微调以对齐红点）
    const textHeight = 70 * scaleFactor; // 文字框高度（两行文字）
    const totalWidth = circleOuterSize + spacing + textWidth; // 总宽度
    const totalHeight = Math.max(circleOuterSize, textHeight); // 总高度

    for (let i = 0; i < anchorPointsRef.current.length; i++) {
      const point = anchorPointsRef.current[i];
      // 红点圆心中心点位置（用于确定和弦中心）
      const redDotCenterX = (point.x / 100) * rect.width;
      const redDotCenterY = (point.y / 100) * rect.height;

      // 计算图标实际占据的矩形区域
      let markerLeft, markerRight;

      if (i === 0) {
        // 第一个图标：圆圈在左，文字在右
        markerLeft = redDotCenterX - circleOuterSize / 2; // 从圆圈左边开始
        markerRight = markerLeft + totalWidth; // 到文字框右边结束
      } else {
        // 第二个图标：圆圈在右，文字在左
        markerRight = redDotCenterX + circleOuterSize / 2; // 从圆圈右边开始
        markerLeft = markerRight - totalWidth; // 到文字框左边结束
      }

      const markerTop = redDotCenterY - totalHeight / 2;
      const markerBottom = markerTop + totalHeight;

      // 检测点是否在图标矩形区域内
      if (
        pointerX >= markerLeft &&
        pointerX <= markerRight &&
        pointerY >= markerTop &&
        pointerY <= markerBottom
      ) {
        return i;
      }
    }

    return null;
  };

  // 确认选择并识别原调
  const handleConfirmSelection = async () => {
    if (anchorPoints.length !== 2 || isRecognizing) return;

    setIsRecognizing(true);

    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', file);
      formData.append('onlyRecognizeKey', 'true');

      const apiResponse = await fetch('/api/transpose', {
        method: 'POST',
        body: formData,
      });

      const data = await apiResponse.json();
      if (data.originalKey) {
        setOriginalKey(data.originalKey);
        setIsAutoRecognized(true); // 标记为AI自动识别
      } else {
        setIsAutoRecognized(false); // 未识别到，标记为非自动识别
      }
    } catch (error) {
      console.error('自动识别原调失败:', error);
    } finally {
      setIsRecognizing(false);
      setPageState('settings');
    }
  };

  // 重新选择第一个和弦
  const handleRelocateFirst = () => {
    setAnchorPoints([]);
    setPageState('locating_first');
  };

  // 用户手动选择原调时，清除自动识别标记
  const handleManualSelectOriginalKey = (key: string) => {
    setOriginalKey(key);
    setIsAutoRecognized(false); // 用户手动选择，标记为非自动识别
  };

  // 自动计算半音数和方向（优先选择小的）
  useEffect(() => {
    if (originalKey && originalKey !== 'auto' && targetKey) {
      const originalIndex = getKeyIndex(originalKey);
      const targetIndex = getKeyIndex(targetKey);

      if (originalIndex !== -1 && targetIndex !== -1) {
        // 计算两个可能的半音数
        const upSemitones = (targetIndex - originalIndex + 12) % 12;
        const downSemitones = (originalIndex - targetIndex + 12) % 12;

        // 优先选择半音数较小的方向
        if (upSemitones <= downSemitones) {
          setDirection('up');
          setSemitones(upSemitones);
        } else {
          setDirection('down');
          setSemitones(downSemitones);
        }
      }
    }
  }, [targetKey, originalKey]);

  // 开始转调处理
  const handleTranspose = async () => {
    if (!imageSrc || !targetKey || !direction || semitones === '') return;

    setPageState('processing');

    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', file);
      formData.append('targetKey', targetKey);
      if (originalKey) {
        formData.append('originalKey', originalKey);
      }
      formData.append('direction', direction);
      formData.append('semitones', semitones.toString());
      if (anchorPoints.length === 2) {
        formData.append('anchorFirst', JSON.stringify(anchorPoints[0]));
        formData.append('anchorLast', JSON.stringify(anchorPoints[1]));
      }
      formData.append('chordColor', chordColor);
      // 第一次转调不传fontSize，让后端自动计算

      const apiResponse = await fetch('/api/transpose', {
        method: 'POST',
        body: formData,
      });

      const data = await apiResponse.json();
      setResult(data);
      setPageState('result');
    } catch (error) {
      console.error('转调失败:', error);
      alert('转调失败，请稍后重试');
      setPageState('settings');
    }
  };

  // 调整字体或颜色后重新生成图片
  const handleAdjustment = async () => {
    if (!imageSrc || !targetKey || !direction || semitones === '') return;

    setIsAdjusting(true);

    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', file);
      formData.append('targetKey', targetKey);
      if (originalKey) {
        formData.append('originalKey', originalKey);
      }
      formData.append('direction', direction);
      formData.append('semitones', semitones.toString());
      if (anchorPoints.length === 2) {
        formData.append('anchorFirst', JSON.stringify(anchorPoints[0]));
        formData.append('anchorLast', JSON.stringify(anchorPoints[1]));
      }
      formData.append('chordColor', chordColor);
      if (fontSize) {
        formData.append('fontSize', fontSize.toString());
      }

      const apiResponse = await fetch('/api/transpose', {
        method: 'POST',
        body: formData,
      });

      const data = await apiResponse.json();
      setResult(data);
    } catch (error) {
      console.error('调整失败:', error);
      alert('调整失败，请稍后重试');
    } finally {
      setIsAdjusting(false);
    }
  };

  // 下载结果图片
  const handleDownload = () => {
    if (!result?.resultImage) return;

    const link = document.createElement('a');
    link.download = `transposed-${targetKey}.jpg`;
    link.href = result.resultImage;
    link.click();
  };

  // 计算调数显示文本（半音数除以2）
  const getKeyStepDisplay = () => {
    if (semitones === '') return '';
    const dir = direction === 'up' ? '升' : '降';
    const value = Number(semitones);
    const keyStep = value / 2; // 半音数除以2转换为调数
    // 如果是整数，不显示小数点
    return `${dir}${Number.isInteger(keyStep) ? keyStep : keyStep}调`;
  };

  // 格式化调名显示（去掉"大调"）
  const formatKeyLabel = (key: string) => {
    return key + '调';
  };

  // 加载中状态
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Music className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              简谱和弦转调器
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            上传简谱图片，自动识别和弦并转调到任意调性
          </p>
        </div>

        {/* 上传区域（居中显示） */}
        {pageState === 'upload' && (
          <div className="flex justify-center mb-6">
            <Card className="w-full max-w-2xl">
              <CardContent className="pt-6">
                <div
                  className={`border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center transition-colors cursor-pointer ${
                    isMobile ? 'p-8' : 'p-16'
                  } hover:border-indigo-500`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={`space-y-4 ${isMobile ? 'space-y-2' : ''}`}>
                    <Upload className={`mx-auto text-gray-400 ${isMobile ? 'w-14 h-14' : 'w-20 h-20'}`} />
                    <p className={`${isMobile ? 'text-lg' : 'text-xl'} text-gray-600 dark:text-gray-400 font-semibold`}>
                      点击上传简谱图片
                    </p>
                    <p className={`text-gray-500 dark:text-gray-500 ${isMobile ? 'text-sm' : 'text-base'}`}>
                      支持 JPG、PNG 格式
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* 定位阶段：图片居中显示 */}
        {mounted && (pageState === 'locating_first' || pageState === 'locating_last') && imageSrc && (
          <div className="flex justify-center mb-6">
            <Card className="w-full max-w-4xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>定位和弦分布</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleChangeImage}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    更换图片
                  </Button>
                </CardTitle>
              </CardHeader>

              {/* 提示条（定位阶段） */}
              <div className="mb-4 bg-indigo-600 text-white px-6 py-4 rounded-lg text-center font-semibold text-lg shadow-lg animate-pulse">
                {pageState === 'locating_first'
                  ? (isMobile
                      ? '请点击图中【第一个】和弦标记号（可以放大图片查看）。'
                      : '请点击图中【第一个】和弦标记号。')
                  : (isMobile
                      ? '现在请点击图中【最后一个】和弦标记号。长按图标可拖动微调。'
                      : '现在请点击图中【最后一个】和弦标记号。可拖动标记进行微调。')}
              </div>

              <CardContent>
                <div
                  ref={imageContainerRef}
                  className={`relative border-2 rounded-lg overflow-hidden transition-colors ${
                    'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 cursor-crosshair'
                  }`}
                  style={{ touchAction: 'pan-y pinch-zoom' }}
                  onClick={handleImageClick}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  onContextMenu={handleContextMenu}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    key={imageKey}
                    src={imageSrc}
                    alt="简谱图片"
                    className="w-full h-auto"
                    style={{ pointerEvents: 'none' }}
                  />

                  {/* 锚点标记 */}
                  {anchorPoints.map((point, index) => {
                    const isLongPressed = longPressedIndex === index;
                    const isDragging = draggingIndex === index;
                    const isCurrentlyMobile = window.innerWidth < 768;
                    const scaleFactor = isCurrentlyMobile ? 0.65 : 1;
                    const circleOuterSize = 60 * scaleFactor; // 外圆直径
                    const spacing = 20 * scaleFactor; // 圆圈和文字框的间距
                    const textWidth = 236 * scaleFactor; // 文字框宽度（微调以对齐红点）

                    return (
                      <div
                        key={index}
                        className="absolute z-10"
                        style={{
                          left: `${point.x}%`,
                          top: `${point.y}%`,
                          // 根据图标方向调整偏移，让红点中心对齐到点击位置
                          // point.x和point.y存储的是红点圆心的位置
                          transform: index === 0
                            ? `translate(-${circleOuterSize / 2}px, -50%)` // 第一个图标：向左偏移圆圈半径，让红点圆心对齐到left位置
                            : `translate(-${textWidth + spacing + circleOuterSize / 2}px, -50%)`, // 第二个图标：圆圈在右，flex-reverse布局中圆圈中心在textWidth + spacing + circleOuterSize/2处（从左边算）
                          cursor: isDragging ? 'grabbing' : 'grab',
                          pointerEvents: 'auto',
                          WebkitUserSelect: 'none',
                          MozUserSelect: 'none',
                          msUserSelect: 'none',
                          userSelect: 'none',
                          WebkitTouchCallout: 'none',
                          touchAction: 'none',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // 只在桌面端且移动距离小于5px时才视为点击（避免拖动后触发点击）
                          if (!isMobile && mouseDownPosRef.current) {
                            const deltaX = Math.abs(e.clientX - mouseDownPosRef.current.x);
                            const deltaY = Math.abs(e.clientY - mouseDownPosRef.current.y);
                            if (deltaX < 5 && deltaY < 5 && index === 0) {
                              handleRelocateFirst();
                            }
                          }
                        }}
                        onMouseDown={(e) => handleMarkerMouseDown(e, index)}
                      >
                        {/* 使用新的CalibrationMarker组件 */}
                        <CalibrationMarker
                          index={index}
                          isFirst={index === 0}
                          isLongPressed={isLongPressed}
                          isMobile={isMobile}
                        />
                      </div>
                    );
                  })}

                </div>

                {/* 确认选择按钮 */}
                {anchorPoints.length === 2 && (
                  <div className="mt-4 flex justify-center">
                    {isRecognizing ? (
                      <Button
                        disabled
                        size={isMobile ? 'default' : 'lg'}
                        className={`w-full ${isMobile ? 'py-6 text-lg' : 'max-w-md'}`}
                      >
                        <Loader2 className={`animate-spin ${isMobile ? 'w-5 h-5 mr-3' : 'w-4 h-4 mr-2'}`} />
                        请稍后...（大约需要10秒）
                      </Button>
                    ) : (
                      <Button
                        onClick={handleConfirmSelection}
                        size={isMobile ? 'default' : 'lg'}
                        className={`w-full ${isMobile ? 'py-6 text-lg' : 'max-w-md'}`}
                      >
                        确认选择
                      </Button>
                    )}
                  </div>
                )}

                {/* 定位状态提示 */}
                {anchorPoints.length < 2 && (
                  <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    点击图中标记和弦的中心位置
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 设置和结果阶段：单栏布局 */}
        {(pageState === 'settings' || pageState === 'processing' || pageState === 'result') && (
          <div className="flex justify-center">
            <div className="w-full max-w-2xl space-y-4">
              {/* 转调设置 */}
              {pageState === 'settings' && (
                <Card>
                  <CardHeader>
                    <CardTitle>转调设置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 原调 */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        原调
                      </label>
                      {isAutoRecognized ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-semibold text-center">
                              {formatKeyLabel(originalKey)}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsAutoRecognized(false)}
                              className="h-8 px-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            >
                              修改
                            </Button>
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400 text-center">
                            （已自动识别）
                          </div>
                        </div>
                      ) : (
                        <Select value={originalKey} onValueChange={handleManualSelectOriginalKey}>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择" />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_KEYS.map((key) => (
                              <SelectItem key={key.value} value={key.value}>
                                {key.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* 目标调 */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        目标调
                      </label>
                      <div className="flex items-center gap-3">
                        <Select value={targetKey} onValueChange={setTargetKey}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="调名" />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_KEYS.map((key) => (
                              <SelectItem key={key.value} value={key.value}>
                                {key.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {targetKey && getKeyStepDisplay() && (
                          <span className="text-blue-600 dark:text-blue-400 font-semibold whitespace-nowrap">
                            {getKeyStepDisplay()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 开始转调按钮 */}
                    <Button
                      onClick={handleTranspose}
                      disabled={!targetKey || !direction || semitones === ''}
                      className="w-full"
                      size="lg"
                    >
                      开始转调
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* 处理中 */}
              {pageState === 'processing' && (
                <Card>
                  <CardContent className="py-16 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                    <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
                      请稍后...（大约需要10秒）
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 识别结果 */}
              {pageState === 'result' && result && (
                <>
                  {/* 识别结果 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>识别结果</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-sm text-gray-600 dark:text-gray-400">原调:</span>
                        <span className="font-semibold text-lg">{formatKeyLabel(result.originalKey)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-sm text-gray-600 dark:text-gray-400">目标调:</span>
                        <span className="font-semibold text-lg text-indigo-600 dark:text-indigo-400">
                          {formatKeyLabel(result.targetKey)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-sm text-gray-600 dark:text-gray-400">转换:</span>
                        <span className="font-semibold text-lg">
                          {getKeyStepDisplay()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">标记颜色:</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border border-gray-300"
                            style={{ backgroundColor: result.chordColor || '#2563EB' }}
                          />
                          <span className="font-semibold text-lg">
                            {COLOR_OPTIONS.find(c => c.value === (result.chordColor || '#2563EB'))?.label || '蓝色'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 转调结果 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>转调结果</span>
                        <Button size="sm" variant="outline" onClick={handleDownload} disabled={isAdjusting}>
                          <Download className="w-4 h-4 mr-2" />
                          下载
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 字体调整和颜色选择 */}
                      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        {/* 字体调整 */}
                        <div className="flex-1">
                          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                            字体大小
                          </label>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const newSize = (fontSize || 20) - 2;
                                setFontSize(newSize > 10 ? newSize : 10);
                              }}
                              disabled={isAdjusting || (fontSize !== null && fontSize <= 10)}
                            >
                              <span className="text-lg font-bold">-</span>
                            </Button>
                            <div className="flex-1 h-9 px-4 bg-white dark:bg-gray-700 rounded border flex items-center justify-center">
                              <span className="font-semibold text-lg">
                                {fontSize ? `${fontSize}px` : '自动'}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const newSize = (fontSize || 20) + 2;
                                setFontSize(newSize < 60 ? newSize : 60);
                              }}
                              disabled={isAdjusting || (fontSize !== null && fontSize >= 60)}
                            >
                              <span className="text-lg font-bold">+</span>
                            </Button>
                          </div>
                        </div>

                        {/* 颜色选择 */}
                        <div className="flex-1">
                          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                            标记颜色
                          </label>
                          <Select value={chordColor} onValueChange={setChordColor} disabled={isAdjusting}>
                            <SelectTrigger>
                              <SelectValue placeholder="选择颜色" />
                            </SelectTrigger>
                            <SelectContent>
                              {COLOR_OPTIONS.map((color) => (
                                <SelectItem key={color.value} value={color.value}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded border border-gray-300"
                                      style={{ backgroundColor: color.value }}
                                    />
                                    <span>{color.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 应用按钮 */}
                        <div className="flex items-end">
                          <Button
                            onClick={handleAdjustment}
                            disabled={isAdjusting}
                            className="w-full sm:w-auto min-w-[120px]"
                          >
                            {isAdjusting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                生成中
                              </>
                            ) : (
                              '重新生成图片'
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* 结果图片 */}
                      {isAdjusting ? (
                        <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                          <div className="text-center space-y-3">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                            <p className="text-lg text-gray-600 dark:text-gray-400 font-semibold">
                              字体调整中...
                            </p>
                          </div>
                        </div>
                      ) : mounted && result.resultImage ? (
                        <div className="flex justify-center">
                          <img
                            src={result.resultImage}
                            alt="转调结果"
                            className="max-w-4xl w-full rounded-lg border shadow-lg"
                          />
                        </div>
                      ) : mounted && !result.resultImage ? (
                        <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                          <p className="text-gray-500">没有返回图片</p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* 原图对照 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>原图对照</span>
                        <Button size="sm" variant="ghost" onClick={handleChangeImage}>
                          <Upload className="w-4 h-4 mr-2" />
                          更换图片
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {mounted && imageSrc ? (
                        <div className="flex justify-center">
                          <img
                            src={imageSrc}
                            alt="原图对照"
                            className="max-w-4xl w-full rounded-lg border"
                          />
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
