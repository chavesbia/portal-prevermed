import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, Code, FileText,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useContractPlaceholders, PLACEHOLDER_GRUPOS } from '@/hooks/useContractPlaceholders';
import { useEffect } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function TipTapEditor({ value, onChange, placeholder, minHeight = 400 }: Props) {
  const { data: placeholders = [] } = useContractPlaceholders(true);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || 'Comece a escrever o modelo de contrato…' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const tbBtn = (active: boolean) =>
    `h-8 w-8 p-0 ${active ? 'bg-accent text-accent-foreground' : ''}`;

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b p-2 bg-muted/40 sticky top-0 z-10">
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive('italic'))}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive('underline'))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive('heading', { level: 1 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive('heading', { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive('heading', { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive('bulletList'))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive('orderedList'))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive({ textAlign: 'left' }))}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive({ textAlign: 'center' }))}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={tbBtn(editor.isActive({ textAlign: 'right' }))}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2"
          title="Inserir quebra de página"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <FileText className="h-4 w-4" /> <span className="text-xs">Quebra de página</span>
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1 h-8">
              <Code className="h-4 w-4" /> Placeholder
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto w-96">
            {PLACEHOLDER_GRUPOS.map(g => {
              const items = placeholders.filter(p => p.grupo === g.key);
              if (items.length === 0) return null;
              return (
                <div key={g.key}>
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/40">{g.label}</div>
                  {items.map(p => {
                    const hasExtenso = ['numero', 'moeda', 'data'].includes(p.formato);
                    return (
                      <div key={p.id}>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().insertContent(`{{${p.chave}}}`).run()}>
                          <code className="text-primary text-xs mr-2">{`{{${p.chave}}}`}</code>
                          <span className="text-xs text-muted-foreground">{p.label}</span>
                        </DropdownMenuItem>
                        {hasExtenso && (
                          <DropdownMenuItem
                            onClick={() => editor.chain().focus().insertContent(`{{${p.chave}_EXTENSO}}`).run()}>
                            <code className="text-emerald-700 text-xs mr-2">{`{{${p.chave}_EXTENSO}}`}</code>
                            <span className="text-xs text-muted-foreground">{p.label} (por extenso)</span>
                          </DropdownMenuItem>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {placeholders.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground">Nenhum placeholder ativo.</div>
            )}
            <div className="px-3 py-2 text-[10px] text-muted-foreground border-t bg-muted/20">
              Dica: <code>{`{{CHAVE_EXTENSO}}`}</code> é gerado automaticamente para placeholders de número, moeda e data.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[var(--mh)] [&_.ProseMirror_hr]:my-6 [&_.ProseMirror_hr]:border-0 [&_.ProseMirror_hr]:border-t-2 [&_.ProseMirror_hr]:border-dashed [&_.ProseMirror_hr]:border-primary/60 [&_.ProseMirror_hr]:relative [&_.ProseMirror_hr]:after:content-['Quebra_de_página'] [&_.ProseMirror_hr]:after:absolute [&_.ProseMirror_hr]:after:left-1/2 [&_.ProseMirror_hr]:after:-translate-x-1/2 [&_.ProseMirror_hr]:after:-top-2.5 [&_.ProseMirror_hr]:after:bg-background [&_.ProseMirror_hr]:after:px-2 [&_.ProseMirror_hr]:after:text-[10px] [&_.ProseMirror_hr]:after:uppercase [&_.ProseMirror_hr]:after:tracking-wider [&_.ProseMirror_hr]:after:text-primary"
        style={{ ['--mh' as any]: `${minHeight}px` }}
      />
    </div>
  );
}
