'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ALL_KEYS } from '@/lib/chord-transposer';
import { Upload, Eye, Music } from 'lucide-react';

interface TestChord {
  text: string;
  x: number;
  y: number;
}

export default function TestPage() {
  const [activeTab, setActiveTab] = useState<'chord' | 'image'>('chord');
  const [chords, setChords] = useState<TestChord[]>([
    { text: 'C', x: 20, y: 30 },
    { text: 'Am', x: 35, y: 30 },
    { text: 'F', x: 50, y: 30 },
    { text: 'G', x: 65, y: 30 },
    { text: 'C', x: 80, y: 30 },
  ]);
  const [originalKey, setOriginalKey] = useState<string>('C');
  const [targetKey, setTargetKey] = useState<string>('G');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 图片识别测试
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [recognitionResult, setRecognitionResult] = useState<any>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const addChord = () => {
    setChords([...chords, { text: 'C', x: 50, y: 50 }]);
  };

  const removeChord = (index: number) => {
    setChords(chords.filter((_, i) => i !== index));
  };

  const updateChord = (index: number, field: keyof TestChord, value: string | number) => {
    const newChords = [...chords];
    newChords[index] = { ...newChords[index], [field]: value };
    setChords(newChords);
  };

  const testTranspose = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chords, originalKey, targetKey }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('测试失败:', error);
      alert('测试失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理图片上传
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 测试图片识别
  const testImageRecognition = async () => {
    if (!imageFile) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await fetch('/api/test-recognize', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setRecognitionResult(data);
    } catch (error) {
      console.error('识别失败:', error);
      alert('识别失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <Music className="w-8 h-8" />
          测试工具
        </h1>

        {/* 标签切换 */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('chord')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'chord'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            和弦转调测试
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'image'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            图片识别测试
          </button>
        </div>

        {activeTab === 'chord' ? (
          // 和弦转调测试
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>输入和弦</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {chords.map((chord, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="和弦 (如: C, Am7)"
                      value={chord.text}
                      onChange={(e) => updateChord(index, 'text', e.target.value)}
                      className="w-32"
                    />
                    <Input
                      type="number"
                      placeholder="X %"
                      value={chord.x}
                      onChange={(e) => updateChord(index, 'x', parseFloat(e.target.value) || 0)}
                      className="w-20"
                    />
                    <Input
                      type="number"
                      placeholder="Y %"
                      value={chord.y}
                      onChange={(e) => updateChord(index, 'y', parseFloat(e.target.value) || 0)}
                      className="w-20"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeChord(index)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
                <Button onClick={addChord} variant="outline" className="w-full">
                  添加和弦
                </Button>

                <div className="border-t pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">原调</label>
                    <select
                      value={originalKey}
                      onChange={(e) => setOriginalKey(e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      {ALL_KEYS.map((key) => (
                        <option key={key.value} value={key.value}>
                          {key.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">目标调</label>
                    <select
                      value={targetKey}
                      onChange={(e) => setTargetKey(e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      {ALL_KEYS.map((key) => (
                        <option key={key.value} value={key.value}>
                          {key.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={testTranspose}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? '转调中...' : '执行转调'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>转调结果</CardTitle>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">原调 → 目标调:</p>
                      <p className="text-xl font-semibold">
                        {result.result.originalKey} → {result.result.targetKey}
                      </p>
                      <p className="text-sm text-gray-600">半音数: {result.result.semitones}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">和弦对比:</p>
                      <div className="space-y-2">
                        {result.result.chords.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-100 rounded">
                            <span className="font-mono">{item.original}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-mono font-semibold text-indigo-600">
                              {item.transposed}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    点击"执行转调"查看结果
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          // 图片识别测试
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  上传简谱图片
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="上传的简谱"
                      className="max-w-full max-h-96 mx-auto rounded"
                    />
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-12 h-12 mx-auto text-gray-400" />
                      <p className="text-gray-600">
                        点击或拖拽上传简谱图片
                      </p>
                      <p className="text-sm text-gray-500">
                        支持 JPG、PNG 格式
                      </p>
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                <Button
                  onClick={testImageRecognition}
                  disabled={!imageFile || loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? '识别中...' : '开始识别'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  识别结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recognitionResult ? (
                  <div className="space-y-4">
                    {recognitionResult.success ? (
                      <>
                        <div>
                          <p className="text-sm font-medium mb-2">原始响应：</p>
                          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                            {recognitionResult.rawResponse}
                          </pre>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">解析结果：</p>
                          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                            {JSON.stringify(recognitionResult.result, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">识别调号：</p>
                          <p className="text-2xl font-bold text-indigo-600">
                            {recognitionResult.result.key || '未识别到调号'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">识别和弦数：</p>
                          <p className="text-xl font-semibold">
                            {recognitionResult.result.chords?.length || 0}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="text-red-600">
                        <p className="font-semibold">识别失败</p>
                        <p className="text-sm">{recognitionResult.error}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    上传图片并点击"开始识别"查看结果
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
