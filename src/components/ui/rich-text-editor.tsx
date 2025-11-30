'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';
import { useEffect, useState } from 'react';

type RichTextEditorProps = {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  onImageUpload?: (file: File) => Promise<string>;
};

export function RichTextEditor({ content, onChange, placeholder, className, onImageUpload }: RichTextEditorProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

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
        openOnClick: false, // We handle clicks manually
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
            class: 'text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-colors cursor-pointer',
            target: '_blank',
            rel: 'noopener noreferrer',
        }
      }),
      ImageExtension.configure({
        HTMLAttributes: {
            class: 'w-full h-auto rounded-lg my-4 cursor-zoom-in border border-border/50 shadow-sm transition-all hover:shadow-md',
        },
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
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/') && onImageUpload) {
             event.preventDefault(); 
             
             // Optimistic insertion could be done here, but for now we just upload then insert
             onImageUpload(file).then(url => {
                const { schema } = view.state;
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                // If dropped inside, insert at coords, otherwise append?
                if (coordinates) {
                    view.dispatch(view.state.tr.insert(coordinates.pos, schema.nodes.image.create({ src: url })));
                } else {
                    // Fallback to appending if drop coords are weird
                     view.dispatch(view.state.tr.insert(view.state.doc.content.size, schema.nodes.image.create({ src: url })));
                }
             }).catch(err => console.error("Image upload failed", err));
             return true; 
          }
        }
        return false;
      },
      handleClickOn: (view, pos, node, nodePos, event, direct) => {
         if (node.type.name === 'image') {
             setZoomedImage(node.attrs.src);
             return true;
         }
         return false;
      }
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
    <>
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

    {/* Lightbox for Image Expansion */}
    {zoomedImage && (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setZoomedImage(null)}
        >
            <div className="relative max-w-[90vw] max-h-[90vh] overflow-auto">
                 <button 
                    className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 rounded-full transition-colors"
                    onClick={() => setZoomedImage(null)}
                >
                    <X className="h-6 w-6" />
                </button>
                <img 
                    src={zoomedImage} 
                    alt="Zoomed content" 
                    className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl"
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                />
            </div>
        </div>
    )}
    </>
  );
}
