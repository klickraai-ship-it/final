import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Link as LinkIcon,
  List,
  ListOrdered,
  Undo,
  Redo,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Palette
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

// Convert TipTap HTML to email-safe inline-styled HTML
function convertToEmailSafeHtml(html: string): string {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Convert all elements to use inline styles instead of classes
  const processNode = (node: Element) => {
    // Remove TipTap classes and add inline styles
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      
      // Handle text alignment
      if (element.style.textAlign) {
        const align = element.style.textAlign;
        element.setAttribute('align', align);
      }
      
      // Handle headings - add proper inline styles
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'h1') {
        element.style.cssText = 'font-size: 2em; font-weight: bold; margin: 0.67em 0;';
      } else if (tagName === 'h2') {
        element.style.cssText = 'font-size: 1.5em; font-weight: bold; margin: 0.75em 0;';
      } else if (tagName === 'h3') {
        element.style.cssText = 'font-size: 1.17em; font-weight: bold; margin: 0.83em 0;';
      } else if (tagName === 'p') {
        if (!element.style.cssText) {
          element.style.cssText = 'margin: 1em 0;';
        }
      } else if (tagName === 'a') {
        if (!element.style.color) {
          element.style.color = '#0066cc';
          element.style.textDecoration = 'underline';
        }
      } else if (tagName === 'img') {
        element.style.display = 'block';
        element.style.maxWidth = '100%';
        element.style.height = 'auto';
      }
      
      // Remove all class attributes (not supported in emails)
      element.removeAttribute('class');
      
      // Process child nodes
      Array.from(element.children).forEach(child => processNode(child as Element));
    }
  };
  
  Array.from(tempDiv.children).forEach(child => processNode(child as Element));
  
  // Wrap content in email-safe container
  const emailHtml = `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333333;">
      ${tempDiv.innerHTML}
    </div>
  `.trim();
  
  return emailHtml;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  content, 
  onChange, 
  placeholder = 'Start typing your email content...',
  minHeight = '300px'
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');
  const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'code'>('editor');
  const [codeContent, setCodeContent] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: 'color: #0066cc; text-decoration: underline;',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Underline,
      Image.configure({
        inline: true,
        HTMLAttributes: {
          style: 'max-width: 100%; height: auto; display: block;',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const rawHtml = editor.getHTML();
      const emailSafeHtml = convertToEmailSafeHtml(rawHtml);
      onChange(emailSafeHtml);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
  });

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  const setLink = () => {
    const url = window.prompt('Enter URL:');
    
    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
    setShowColorPicker(false);
  };

  const applyCustomColor = () => {
    if (customColor) {
      editor.chain().focus().setColor(customColor).run();
      setShowColorPicker(false);
    }
  };

  const switchToCodeView = () => {
    if (viewMode === 'editor') {
      setCodeContent(editor.getHTML());
      setViewMode('code');
    } else if (viewMode === 'code') {
      editor.commands.setContent(codeContent);
      onChange(codeContent);
      setViewMode('editor');
    }
  };

  const switchToPreview = () => {
    if (viewMode === 'preview') {
      setViewMode('editor');
    } else {
      setViewMode('preview');
    }
  };

  const ToolbarButton = ({ 
    onClick, 
    active, 
    disabled, 
    children, 
    title 
  }: { 
    onClick: () => void; 
    active?: boolean; 
    disabled?: boolean; 
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-gray-700 transition-colors ${
        active ? 'bg-gray-700 text-blue-400' : 'text-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      type="button"
    >
      {children}
    </button>
  );

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-700 bg-gray-850">
        {/* Headings */}
        <div className="flex gap-1 border-r border-gray-700 pr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Text Formatting */}
        <div className="flex gap-1 border-r border-gray-700 pr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Code"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Text Alignment */}
        <div className="flex gap-1 border-r border-gray-700 pr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Lists */}
        <div className="flex gap-1 border-r border-gray-700 pr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Links, Images & Colors */}
        <div className="flex gap-1 border-r border-gray-700 pr-2">
          <ToolbarButton
            onClick={setLink}
            active={editor.isActive('link')}
            title="Insert Link"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            onClick={addImage}
            title="Insert Image"
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>

          {/* Enhanced Color Picker */}
          <div className="relative">
            <ToolbarButton
              onClick={() => setShowColorPicker(!showColorPicker)}
              active={showColorPicker}
              title="Text Color"
            >
              <Palette className="h-4 w-4" />
            </ToolbarButton>
            
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[240px]">
                <div className="text-xs text-gray-400 mb-2 font-semibold">Quick Colors</div>
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {[
                    '#000000', '#FFFFFF', '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
                    '#9b59b6', '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#d35400'
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => setColor(color)}
                      className="w-8 h-8 rounded border-2 border-gray-600 hover:scale-110 transition-transform hover:border-blue-400"
                      style={{ backgroundColor: color }}
                      title={color}
                      type="button"
                    />
                  ))}
                </div>
                <div className="text-xs text-gray-400 mb-2 font-semibold">Custom Color</div>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-12 h-8 rounded border border-gray-600 cursor-pointer bg-gray-800"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="#000000"
                  />
                  <button
                    onClick={applyCustomColor}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 transition-colors"
                    type="button"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-1 border-r border-gray-700 pr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* View Mode Toggles */}
        <div className="flex gap-1">
          <ToolbarButton
            onClick={switchToCodeView}
            active={viewMode === 'code'}
            title={viewMode === 'code' ? 'Switch to Editor' : 'View HTML Code'}
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={switchToPreview}
            active={viewMode === 'preview'}
            title={viewMode === 'preview' ? 'Edit' : 'Preview'}
          >
            <Eye className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor Content */}
      {viewMode === 'editor' && (
        <EditorContent 
          editor={editor} 
          className="text-gray-100"
          style={{ minHeight }}
        />
      )}

      {/* Code View */}
      {viewMode === 'code' && (
        <textarea
          value={codeContent}
          onChange={(e) => setCodeContent(e.target.value)}
          className="w-full px-4 py-3 bg-gray-900 text-gray-100 font-mono text-sm focus:outline-none"
          style={{ minHeight }}
          spellCheck={false}
        />
      )}

      {/* Preview Mode */}
      {viewMode === 'preview' && (
        <div
          className="px-4 py-3 bg-white text-gray-900 overflow-auto"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
        />
      )}

      {/* Merge Tags Helper */}
      <div className="p-2 border-t border-gray-700 bg-gray-850 text-xs text-gray-400">
        <span className="font-semibold">Available merge tags:</span> 
        <code className="mx-1">{'{{firstName}}'}</code>
        <code className="mx-1">{'{{lastName}}'}</code>
        <code className="mx-1">{'{{email}}'}</code>
        <code className="mx-1">{'{{campaign_name}}'}</code>
        <code className="mx-1">{'{{unsubscribe_url}}'}</code>
        <code className="mx-1">{'{{web_version_url}}'}</code>
      </div>
    </div>
  );
};

export default RichTextEditor;
