'use client';

import { useEffect } from 'react';
import VConsole from 'vconsole';

export function VConsoleInit() {
  useEffect(() => {
    // 只在开发环境和客户端初始化vconsole
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      // 避免重复初始化
      if (!(window as any).__vconsole_initialized) {
        const vConsole = new VConsole();
        (window as any).__vconsole_initialized = true;
        console.log('✅ VConsole已初始化，点击右下角绿色按钮可打开控制台');
      }
    }
  }, []);

  return null;
}
