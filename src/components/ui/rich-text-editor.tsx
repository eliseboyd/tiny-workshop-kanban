'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';
import { useEffect } from 'react';

type RichTextEditorProps = {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({ content, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, // We have a separate title field
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
            class: 'text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-colors cursor-pointer',
            target: '_blank',
            rel: 'noopener noreferrer',
        }
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start typing...',
        emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-muted-foreground/50 before:float-left before:pointer-events-none',
      }),
    ],
    content: content,
    editorProps: {
      attributes: {
        class: cn(
          'prose dark:prose-invert max-w-none min-h-[100px] focus:outline-none outline-none font-sans',
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update content if it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      if (!editor.isFocused) {
          editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative group border rounded-md p-2 bg-transparent border-transparent hover:border-border focus-within:border-border transition-colors">
      {/* Fixed Toolbar */}
      <div className="flex items-center gap-1 mb-2 pb-2 border-b border-border/50 transition-opacity">
          <Toggle
            size="sm"
            pressed={editor.isActive('bold')}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
            className="h-7 w-7 p-0"
            aria-label="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('italic')}
            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            className="h-7 w-7 p-0"
            aria-label="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('strike')}
            onPressedChange={() => editor.chain().focus().toggleStrike().run()}
            className="h-7 w-7 p-0"
            aria-label="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('code')}
            onPressedChange={() => editor.chain().focus().toggleCode().run()}
            className="h-7 w-7 p-0"
            aria-label="Code"
          >
            <Code className="h-3.5 w-3.5" />
          </Toggle>
          <div className="w-px h-4 bg-border mx-1" />
          <Toggle
            size="sm"
            pressed={editor.isActive('link')}
            onPressedChange={() => {
                const previousUrl = editor.getAttributes('link').href;
                const url = window.prompt('URL', previousUrl);
                if (url === null) return;
                if (url === '') {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  return;
                }
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }}
            className="h-7 w-7 p-0"
            aria-label="Link"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </Toggle>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}
