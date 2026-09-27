'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon, X, List, ListOrdered, CheckSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';
import styles from './rich-text-editor.module.css';
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, // We have a separate title field
        paragraph: {
          HTMLAttributes: {
            class: styles.Paragraph,
          },
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: {
            class: styles.List,
          },
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: {
            class: styles.List,
          },
        },
        listItem: {
          HTMLAttributes: {
            class: styles.ListItem,
          },
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: styles.TaskItem,
        },
      }),
      Link.configure({
        openOnClick: false, // We handle clicks manually
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
            class: styles.Link,
            target: '_blank',
            rel: 'noopener noreferrer',
        }
      }),
      ImageExtension.configure({
        HTMLAttributes: {
            class: styles.Image,
        },
      }),
      // Remove placeholder if empty string is passed
      ...(placeholder !== '' ? [
        Placeholder.configure({
          placeholder: placeholder || '',
          emptyEditorClass: cn('is-editor-empty', styles.EmptyPlaceholder),
        })
      ] : []),
    ],
    content: content,
    editorProps: {
      attributes: {
        class: cn(
          'tiptap',
          styles.Editor,
          className
        ),
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/') && onImageUpload) {
             event.preventDefault(); 
             
             setIsUploadingImage(true);
             // Insert a loading placeholder
             const { schema } = view.state;
             const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
             const insertPos = coordinates ? coordinates.pos : view.state.doc.content.size;
             
             onImageUpload(file).then(url => {
                if (coordinates) {
                    view.dispatch(view.state.tr.insert(coordinates.pos, schema.nodes.image.create({ src: url })));
                } else {
                     view.dispatch(view.state.tr.insert(view.state.doc.content.size, schema.nodes.image.create({ src: url })));
                }
             }).catch(err => console.error("Image upload failed", err))
             .finally(() => setIsUploadingImage(false));
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
      },
      // Add markdown shortcuts for checkboxes
      handleTextInput: (view, from, to, text) => {
        const { state } = view;
        const { $from } = state.selection;
        
        // Check if we're at the start of a line
        const lineStart = $from.start();
        const textBefore = state.doc.textBetween(lineStart, from, '\0', '\0');
        
        // Handle checkbox markdown: - [ ] or - [x]
        if (text === ' ' && (textBefore === '-[' || textBefore === '- [')) {
          // Convert to task list
          const tr = state.tr;
          tr.delete(lineStart, to);
          view.dispatch(tr);
          editor?.chain().focus().toggleTaskList().run();
          return true;
        }
        
        return false;
      },
      // Fix backspace handling for empty paragraphs before lists/task lists
      handleKeyDown: (view, event) => {
        if (event.key === 'Backspace') {
          const { state } = view;
          const { $from, empty } = state.selection;
          
          // If we're at the start of a task item, try to delete empty lines before it first
          if (empty && $from.parentOffset === 0) {
            const parent = $from.parent;
            
            // Check if we're in a task item
            if (parent.type.name === 'taskItem' || 
                (parent.type.name === 'paragraph' && $from.node($from.depth - 1)?.type.name === 'taskItem')) {
              
              // Look backwards for empty paragraphs
              try {
                const beforePos = $from.pos - 1;
                if (beforePos > 0) {
                  const resolvedBefore = state.doc.resolve(beforePos);
                  const nodeBefore = resolvedBefore.nodeBefore;
                  
                  // If there's an empty paragraph before, delete it and prevent default
                  if (nodeBefore && nodeBefore.type.name === 'paragraph' && nodeBefore.nodeSize === 2) {
                    const deleteFrom = beforePos - nodeBefore.nodeSize + 1;
                    const deleteTo = beforePos + 1;
                    const tr = state.tr.delete(deleteFrom, deleteTo);
                    view.dispatch(tr);
                    return true; // Prevent default - we handled it
                  }
                }
              } catch (e) {
                // If we can't find an empty line, allow default backspace
              }
              
              // If no empty paragraph found, allow default backspace (which will delete the checkbox)
              return false;
            }
          }
          
          // For other cases: check if we're at the start of any node with an empty paragraph before
          if (empty && $from.parentOffset === 0 && $from.pos > 1) {
            try {
              const nodeBefore = state.doc.resolve($from.pos - 1).nodeBefore;
              
              // If the node before is an empty paragraph, delete it
              if (nodeBefore && nodeBefore.type.name === 'paragraph' && nodeBefore.nodeSize === 2) {
                const tr = state.tr.delete($from.pos - 2, $from.pos);
                view.dispatch(tr);
                return true;
              }
            } catch (e) {
              // Ignore errors
            }
          }
          
          // Check if we're in an empty paragraph ourselves
          if (empty && $from.parent.type.name === 'paragraph' && $from.parent.nodeSize === 2) {
            const posBefore = $from.pos - $from.parentOffset - 1;
            if (posBefore >= 0) {
              try {
                const tr = state.tr.delete(posBefore, $from.pos + 1);
                view.dispatch(tr);
                return true;
              } catch (e) {
                // Ignore errors
              }
            }
          }
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
        <div className={styles.Root}>
        {/* Sticky Toolbar */}
        <div className={styles.Toolbar}>
          {isUploadingImage && (
            <div className={styles.Uploading}>
              <Loader2 className={styles.Spinner} />
              <span>Uploading...</span>
            </div>
          )}
          <Toggle
            size="sm"
            pressed={editor.isActive('bold')}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
            onMouseDown={(e) => e.preventDefault()}
            className={styles.ToolButton}
            aria-label="Bold"
          >
            <Bold className={styles.ToolIcon} />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('italic')}
            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            onMouseDown={(e) => e.preventDefault()}
            className={styles.ToolButton}
            aria-label="Italic"
          >
            <Italic className={styles.ToolIcon} />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('strike')}
            onPressedChange={() => editor.chain().focus().toggleStrike().run()}
            onMouseDown={(e) => e.preventDefault()}
            className={styles.ToolButton}
            aria-label="Strikethrough"
          >
            <Strikethrough className={styles.ToolIcon} />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('code')}
            onPressedChange={() => editor.chain().focus().toggleCode().run()}
            onMouseDown={(e) => e.preventDefault()}
            className={styles.ToolButton}
            aria-label="Code"
          >
            <Code className={styles.ToolIcon} />
          </Toggle>
          <div className={styles.Divider} />
          <Toggle
            size="sm"
            pressed={editor.isActive('bulletList')}
            onPressedChange={() => {
              editor.chain().focus().toggleBulletList().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!editor.can().toggleBulletList()}
            className={styles.ToolButton}
            aria-label="Bullet List"
          >
            <List className={styles.ToolIcon} />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('taskList')}
            onPressedChange={() => {
              editor.chain().focus().toggleTaskList().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!editor.can().toggleTaskList()}
            className={styles.ToolButton}
            aria-label="Task List"
          >
            <CheckSquare className={styles.ToolIcon} />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('orderedList')}
            onPressedChange={() => {
              editor.chain().focus().toggleOrderedList().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!editor.can().toggleOrderedList()}
            className={styles.ToolButton}
            aria-label="Ordered List"
          >
            <ListOrdered className={styles.ToolIcon} />
          </Toggle>
          <div className={styles.Divider} />
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
            onMouseDown={(e) => e.preventDefault()}
            className={styles.ToolButton}
            aria-label="Link"
          >
            <LinkIcon className={styles.ToolIcon} />
          </Toggle>
      </div>

      {/* Editor Content */}
      <div className={styles.Body}>
        <EditorContent editor={editor} />
      </div>
    </div>

    {/* Lightbox for Image Expansion */}
    {zoomedImage && (
        <div 
            className={styles.Zoom}
            onClick={() => setZoomedImage(null)}
        >
            <div className={styles.ZoomFrame}>
                 <button 
                    className={styles.ZoomClose}
                    onClick={() => setZoomedImage(null)}
                >
                    <X className={styles.ZoomCloseIcon} />
                </button>
                <img 
                    src={zoomedImage} 
                    alt="Zoomed content" 
                    className={styles.ZoomImage}
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                />
            </div>
        </div>
    )}
    </>
  );
}
