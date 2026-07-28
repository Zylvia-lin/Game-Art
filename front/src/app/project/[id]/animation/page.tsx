'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, Film, Loader2, Maximize2, Play, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { AssetMentionPrompt } from '@/components/tools/asset-mention-prompt';
import { ModelSelector } from '@/components/tools/model-selector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { API_BASE, resolveImageUrl, type ModelConfig } from '@/lib/api';
import {
  animationApi, type FrameExtraction, type VideoTask,
} from '@/lib/animation-api';

const RATIOS = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9', 'adaptive'];
const ALL_RESOLUTIONS = ['480p', '720p', '1080p', '4k'];
type Module = 'generate' | 'edit' | 'frames';

export default function AnimationPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = String(id);
  const [module, setModule] = useState<Module>('generate');
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [extractions, setExtractions] = useState<FrameExtraction[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [model, setModel] = useState<ModelConfig | null>(null);
  const [prompt, setPrompt] = useState('');
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState('720p');
  const [duration, setDuration] = useState(5);
  const [audio, setAudio] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<VideoTask | null>(null);
  const [extractionId, setExtractionId] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exportFps, setExportFps] = useState(12);
  const [exportVideoUrl, setExportVideoUrl] = useState('');
  const [sequencePreview, setSequencePreview] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [videoTasks, frameResults] = await Promise.all([
      animationApi.tasks(projectId), animationApi.extractions(projectId),
    ]);
    setTasks(videoTasks);
    setExtractions(frameResults);
  }, [projectId]);

  useEffect(() => { load().catch((error) => toast.error(error.message)); }, [load]);
  useEffect(() => {
    const pending = tasks.filter((task) => !['succeeded', 'failed', 'cancelled'].includes(task.status));
    if (!pending.length) return;
    const timer = window.setInterval(async () => {
      await Promise.all(pending.map((task) => animationApi.refresh(task.id).catch(() => null)));
      await load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [tasks, load]);
  useEffect(() => {
    if (!sequencePreview.length) return;
    const timer = window.setInterval(
      () => setPreviewIndex((index) => (index + 1) % sequencePreview.length),
      Math.max(16, 1000 / exportFps),
    );
    return () => window.clearInterval(timer);
  }, [sequencePreview, exportFps]);

  const succeeded = tasks.filter((task) => task.status === 'succeeded' && task.video_url);
  const source = tasks.find((task) => task.id === sourceId);
  const extraction = extractions.find((item) => item.id === extractionId);
  const resolutions = useMemo(() => {
    const configured = Object.keys(model?.price_config || {}).filter((key) => ALL_RESOLUTIONS.includes(key));
    if (configured.length) return configured;
    const name = model?.model_name || '';
    return name.includes('fast') || name.includes('mini') ? ['480p', '720p'] : ALL_RESOLUTIONS;
  }, [model]);

  useEffect(() => {
    if (!resolutions.includes(resolution)) setResolution(resolutions[0]);
  }, [resolutions, resolution]);
  useEffect(() => {
    if (extraction) {
      setSelected(new Set(extraction.selected_frames || []));
      setExportVideoUrl(extraction.export_video_url ? resolveImageUrl(extraction.export_video_url) : "");
      setSequencePreview((extraction.sequence_preview_urls || []).map(resolveImageUrl));
      setPreviewIndex(0);
    }
  }, [extraction]);

  const submit = async () => {
    if (!modelId) return toast.error('请选择视频模型');
    setBusy(true);
    try {
      if (module === 'generate') {
        await animationApi.generate({
          project_id: projectId, model_id: modelId, prompt, asset_ids: assetIds,
          ratio, resolution, duration, generate_audio: audio,
        });
      } else {
        if (!sourceId) throw new Error('请选择已成功的视频');
        await animationApi.edit({
          project_id: projectId, source_video_task_id: sourceId, model_id: modelId,
          prompt, generate_audio: audio,
        });
      }
      setPrompt('');
      toast.success('视频任务已提交');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交失败');
    } finally { setBusy(false); }
  };

  const createExtraction = async () => {
    if (!sourceId) return toast.error('请选择已成功的视频');
    setBusy(true);
    try {
      const result = await animationApi.extract(sourceId);
      await load();
      setExtractionId(result.id);
      toast.success(`已按 24fps 提取 ${result.total_frames} 帧`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提取失败');
    } finally { setBusy(false); }
  };

  const choose = (mode: 'all' | 'clear' | 'odd' | 'even') => {
    if (!extraction) return;
    const values = Array.from({ length: extraction.total_frames }, (_, index) => index + 1);
    setSelected(new Set(
      mode === 'clear' ? [] : mode === 'all' ? values : values.filter((number) => mode === 'odd' ? number % 2 === 1 : number % 2 === 0),
    ));
  };
  const chooseRemainder = () => {
    if (!extraction) return;
    const divisor = Number(window.prompt('除数（例如 3）', '3'));
    const remainder = Number(window.prompt('余数（按 1-based 帧号）', '1'));
    if (!Number.isInteger(divisor) || divisor < 1 || !Number.isInteger(remainder)) return;
    setSelected(new Set(
      Array.from({ length: extraction.total_frames }, (_, index) => index + 1)
        .filter((number) => number % divisor === remainder),
    ));
  };
  const ordered = [...selected].sort((a, b) => a - b);
  const saveSelection = () => extraction && animationApi.saveSelection(extraction.id, ordered)
    .then(load).then(() => toast.success('选择已保存')).catch((error) => toast.error(error.message));
  const exportVideo = async () => {
    if (!extraction) return;
    const result = await animationApi.exportVideo(extraction.id, ordered, exportFps);
    setExportVideoUrl(resolveImageUrl(result.url));
    toast.success('无音频 MP4 已导出');
  };
  const exportSequence = async () => {
    if (!extraction) return;
    const result = await animationApi.exportSequence(extraction.id, ordered);
    setSequencePreview(result.preview_urls.map(resolveImageUrl));
    setPreviewIndex(0);
    await load();
    toast.success('PNG 序列已准备，ZIP 将在下载时创建');
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[360px_minmax(0,1fr)_320px]">
      <aside className="space-y-5 overflow-y-auto border-r p-5">
        <div>
          <h1 className="text-xl font-semibold">动画视频</h1>
          <p className="text-sm text-muted-foreground">生成、编辑与 24fps 帧提取</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['generate', 'edit', 'frames'] as Module[]).map((value) => (
            <Button key={value} variant={module === value ? 'default' : 'outline'} size="sm" onClick={() => setModule(value)}>
              {value === 'generate' ? '视频生成' : value === 'edit' ? '视频编辑' : '帧提取'}
            </Button>
          ))}
        </div>

        {module !== 'frames' && (
          <>
            {module === 'edit' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">源视频（必选）</label>
                <select className="w-full rounded-md border bg-background p-2 text-sm" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                  <option value="">请选择成功视频</option>
                  {succeeded.map((task) => <option key={task.id} value={task.id}>{task.user_prompt || task.id}</option>)}
                </select>
              </div>
            )}
            <ModelSelector type="video" value={modelId} onChange={(value, config) => { setModelId(value); setModel(config); }} label="视频模型" />
            {module === 'generate'
              ? <AssetMentionPrompt projectId={projectId} value={prompt} onChange={setPrompt} selectedIds={assetIds} onSelectedIdsChange={setAssetIds} />
              : <div className="space-y-2"><label className="text-sm font-medium">编辑描述</label><Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} /></div>}
            {module === 'generate' ? (
              <>
                <div className="space-y-2"><label className="text-sm font-medium">比例</label><div className="flex flex-wrap gap-1">{RATIOS.map((value) => <Button key={value} size="sm" variant={ratio === value ? 'default' : 'outline'} onClick={() => setRatio(value)}>{value}</Button>)}</div></div>
                <div className="space-y-2"><label className="text-sm font-medium">分辨率</label><div className="flex flex-wrap gap-1">{resolutions.map((value) => <Button key={value} size="sm" variant={resolution === value ? 'default' : 'outline'} onClick={() => setResolution(value)}>{value}</Button>)}</div></div>
                <div className="space-y-2"><label className="text-sm font-medium">时长：{duration} 秒</label><Input type="range" min={4} max={15} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></div>
              </>
            ) : source && (
              <div className="rounded-lg bg-muted p-3 text-sm">继承参数：{source.ratio} · {source.resolution} · {source.duration} 秒</div>
            )}
            <label className="flex items-center justify-between text-sm">生成音频（默认关闭）<Switch checked={audio} onCheckedChange={setAudio} /></label>
            <Button className="w-full" disabled={busy || !prompt.trim()} onClick={submit}>{busy ? <Loader2 className="animate-spin" /> : <Play />}提交{module === 'edit' ? '编辑' : '生成'}</Button>
          </>
        )}

        {module === 'frames' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">源视频</label>
              <select className="w-full rounded-md border bg-background p-2 text-sm" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">请选择成功视频</option>
                {succeeded.map((task) => <option key={task.id} value={task.id}>{task.user_prompt || task.id}</option>)}
              </select>
              <Button className="w-full" disabled={busy || !sourceId} onClick={createExtraction}><Scissors />按 24fps 提取无损 PNG</Button>
            </div>
            {extractions.length > 0 && (
              <select className="w-full rounded-md border bg-background p-2 text-sm" value={extractionId} onChange={(event) => setExtractionId(event.target.value)}>
                <option value="">选择提取结果</option>
                {extractions.map((item) => <option key={item.id} value={item.id}>{item.total_frames} 帧 · {item.status}</option>)}
              </select>
            )}
            {extraction && (
              <>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => choose('all')}>全选</Button>
                  <Button size="sm" variant="outline" onClick={() => choose('clear')}>清空</Button>
                  <Button size="sm" variant="outline" onClick={() => choose('odd')}>奇数帧</Button>
                  <Button size="sm" variant="outline" onClick={() => choose('even')}>偶数帧</Button>
                  <Button size="sm" variant="outline" onClick={chooseRemainder}>按余数</Button>
                </div>
                <Button variant="secondary" onClick={saveSelection}>保存选择（{selected.size}）</Button>
                <label className="text-sm">导出帧率<Input type="number" min={1} max={60} value={exportFps} onChange={(event) => setExportFps(Number(event.target.value))} /></label>
                <Button onClick={exportVideo} disabled={!selected.size}><Film />导出无音频 MP4</Button>
                <Button onClick={exportSequence} disabled={!selected.size}><Scissors />导出 PNG 序列</Button>
                {(extraction.sequence_dir || sequencePreview.length > 0) && <Button asChild variant="outline"><a href={animationApi.zipUrl(extraction.id)}><Download />下载 ZIP（按需生成）</a></Button>}
              </>
            )}
          </>
        )}
      </aside>

      <main className="min-w-0 overflow-y-auto p-5">
        {module === 'frames' && extraction ? (
          <>
            <div className="mb-3 text-sm text-muted-foreground">{extraction.total_frames} 帧 · 固定 24fps · 点击单帧选择/取消</div>
            <div className="grid grid-cols-4 gap-2 md:grid-cols-6 xl:grid-cols-8">
              {extraction.frames.map((frame) => {
                const checked = selected.has(frame.number);
                return <button key={frame.number} className={`relative overflow-hidden rounded border-2 ${checked ? 'border-primary' : 'border-transparent'}`} onClick={() => setSelected((current) => { const next = new Set(current); checked ? next.delete(frame.number) : next.add(frame.number); return next; })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveImageUrl(frame.thumbnail_url)} alt={`帧 ${frame.number}`} className="aspect-square w-full object-contain bg-black" loading="lazy" />
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-xs text-white">{checked ? '✓ ' : ''}{frame.number}</span>
                </button>;
              })}
            </div>
            {(sequencePreview.length > 0 || exportVideoUrl) && <div className="mt-6 rounded-xl border p-4">
              <h2 className="mb-3 font-medium">导出结果循环预览</h2>
              {exportVideoUrl ? <video src={exportVideoUrl} controls loop className="max-h-96 w-full bg-black" /> : sequencePreview.length > 0 && <img src={sequencePreview[previewIndex]} alt="循环预览" className="max-h-96 w-full object-contain bg-black" />}
            </div>}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground"><div><Film className="mx-auto mb-3 size-14 opacity-30" /><p>从右侧任务卡片播放或大屏预览视频</p></div></div>
        )}
      </main>

      <aside className="overflow-y-auto border-l p-4">
        <h2 className="mb-3 font-medium">视频 / 导出结果</h2>
        <div className="space-y-3">
          {tasks.map((task) => <article key={task.id} className="rounded-xl border p-3">
            {task.video_url ? <video src={resolveImageUrl(task.video_url)} controls muted loop className="aspect-video w-full rounded bg-black" /> : <div className="flex aspect-video items-center justify-center rounded bg-muted text-sm">{task.status}</div>}
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{task.user_prompt || '视频任务'}</p><p className="text-xs text-muted-foreground">{task.task_type === 'edit' ? '编辑' : '生成'} · {task.ratio} · {task.resolution} · {task.duration}s</p></div>
              {task.video_url && <Button size="icon" variant="ghost" onClick={() => setPreview(task)}><Maximize2 /></Button>}
            </div>
          </article>)}
          {tasks.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">暂无视频任务</p>}
        </div>
      </aside>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-5xl"><DialogTitle>{preview?.user_prompt || '视频预览'}</DialogTitle>{preview?.video_url && <video src={resolveImageUrl(preview.video_url)} controls autoPlay loop className="max-h-[75vh] w-full bg-black" />}</DialogContent>
      </Dialog>
    </div>
  );
}
