import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings2, RotateCcw, Check, Loader2 } from "lucide-react";
import { GuruBoardCanvas } from "@/components/GuruBoardCanvas";
import { BOARD_PRESETS, DEFAULT_CLASSROOM_PREFERENCES, contrastRatio, type ClassroomPreferences } from "@/lib/classroom-preferences";
import { toast } from "sonner";

export function ClassroomSettings({ preferences, apply, disabled = false }: { preferences: ClassroomPreferences; apply: (next: ClassroomPreferences) => Promise<void>; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const patch = (value: Partial<ClassroomPreferences>) => setDraft((old) => ({ ...old, ...value }));
  return <>
    <Button variant="outline" size="sm" disabled={disabled} onClick={() => { setDraft(preferences); setOpen(true); }}><Settings2 /> Classroom settings</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Classroom settings</DialogTitle><DialogDescription>Your board appearance. Lesson content stays unchanged.</DialogDescription></DialogHeader>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <Label htmlFor="teacher-visible" className="flex-1">Show teacher<span className="block text-xs font-normal text-muted-foreground">Hiding the teacher never pauses or changes the lesson.</span></Label>
              <Switch id="teacher-visible" checked={draft.teacherVisible} onCheckedChange={(teacherVisible) => patch({ teacherVisible })} />
            </div>
            <Label>AI model for my lessons</Label>
            <Select value={draft.aiModel} onValueChange={(aiModel: ClassroomPreferences['aiModel']) => patch({ aiModel })}><SelectTrigger aria-label="AI model"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Guru.AI default (Gemini)</SelectItem><SelectItem value="openai">ChatGPT (OpenAI)</SelectItem></SelectContent></Select>
            <p className="text-xs text-muted-foreground">All features stay the same; only the model that writes your lessons, practice and feedback changes.</p>
            <Label>Teacher size</Label>
            <Select value={draft.teacherSize} onValueChange={(teacherSize: ClassroomPreferences['teacherSize']) => patch({ teacherSize })}><SelectTrigger aria-label="Teacher size"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="small">Small</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent></Select>
            <Label>Board theme</Label>
            <div className="grid grid-cols-2 gap-2">
              {BOARD_PRESETS.map((preset) => <Button key={preset.id} variant={draft.preset === preset.id ? "default" : "outline"} className="h-auto justify-start whitespace-normal py-2 text-left text-xs" onClick={() => patch({ preset: preset.id, background: null, foreground: null, accent: null })}>{draft.preset === preset.id && <Check className="shrink-0" />}{preset.label}</Button>)}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['background', 'Background'], ['foreground', 'Text'], ['accent', 'Highlight']] as const).map(([key, label]) => <Label key={key} className="flex flex-col gap-2 text-xs">{label}<input type="color" aria-label={`Board ${label.toLowerCase()} color`} value={draft[key] ?? (key === 'background' ? '#ffffff' : key === 'foreground' ? '#17212b' : '#2563eb')} className="h-9 w-full cursor-pointer rounded border border-border bg-background" onChange={(event) => {
                // A pair of explicit custom colors ensures server-side contrast validation is reproducible.
                patch({ [key]: event.target.value, ...(key !== 'accent' ? {
                  background: key === 'background' ? event.target.value : draft.background ?? '#ffffff',
                  foreground: key === 'foreground' ? event.target.value : draft.foreground ?? '#17212b',
                } : {}) });
              }} /></Label>)}
            </div>
            {([['fontSize', 'Font size', 14, 28, 1], ['lineSpacing', 'Line spacing', 1.3, 2.2, 0.1], ['zoom', 'Board zoom', 0.8, 1.5, 0.05]] as const).map(([key, label, min, max, step]) => <div key={key} className="space-y-2"><Label>{label}: {key === 'zoom' ? `${Math.round(draft[key] * 100)}%` : draft[key]}</Label><Slider aria-label={label} value={[draft[key]]} min={min} max={max} step={step} onValueChange={([value]) => { if (value !== undefined) patch({ [key]: value }); }} /></div>)}
            <Label>Font family</Label>
            <Select value={draft.font} onValueChange={(font: ClassroomPreferences['font']) => patch({ font })}><SelectTrigger aria-label="Board font family"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sans">Readable sans</SelectItem><SelectItem value="serif">Book serif</SelectItem><SelectItem value="mono">Monospace</SelectItem></SelectContent></Select>
            <Label>Content density</Label>
            <Select value={draft.density} onValueChange={(density: ClassroomPreferences['density']) => patch({ density })}><SelectTrigger aria-label="Board content density"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comfortable">Comfortable</SelectItem><SelectItem value="compact">Compact</SelectItem></SelectContent></Select>
          </div>
          <div className="classroom-preview min-w-0"><GuruBoardCanvas title="Preview" preferences={draft} revealed={3} blocks={[{ type: 'heading', text: "Newton’s second law" }, { type: 'formula', text: 'F = ma', label: 'Force' }, { type: 'text', text: 'Force equals mass multiplied by acceleration.', highlight: true }]} /></div>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" onClick={() => setDraft({ ...DEFAULT_CLASSROOM_PREFERENCES })}><RotateCcw /> Reset to default</Button>
          <Button disabled={saving} onClick={async () => {
            if (draft.background && draft.foreground && contrastRatio(draft.background, draft.foreground) < 4.5) return toast.error('Choose text and background colors with stronger contrast.');
            setSaving(true);
            try { await apply(draft); setOpen(false); toast.success('Board settings saved'); }
            catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save board settings'); }
            finally { setSaving(false); }
          }}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Apply settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}