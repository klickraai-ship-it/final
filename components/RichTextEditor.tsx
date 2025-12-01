
import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { FontFamily } from '@tiptap/extension-font-family';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  AlignJustify,
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
  Palette,
  Eye,
  FileCode,
  Table as TableIcon,
  Columns,
  Rows,
  Trash2,
  Type
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  content, 
  onChange, 
  placeholder = 'Start typing your email content...',
  minHeight = '300px'
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');
  const [customBgColor, setCustomBgColor] = useState('#ffffff');
  const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'code'>('editor');
  const [codeContent, setCodeContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
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
        allowBase64: true,
        HTMLAttributes: {
          style: 'max-width: 100%; height: auto; display: block;',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          style: 'border-collapse: collapse; width: 100%;',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          style: 'background-color: #f3f4f6; font-weight: bold; border: 1px solid #d1d5db; padding: 8px;',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          style: 'border: 1px solid #d1d5db; padding: 8px;',
        },
      }),
      FontFamily,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none px-4 py-3',
        style: `min-height: ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="border border-gray-700 rounded-lg p-4">
        <div className="text-gray-400 mb-2">Loading editor...</div>
        <textarea
          className="w-full min-h-[300px] bg-gray-800 text-white p-3 rounded border border-gray-700 focus:border-indigo-500 focus:outline-none"
          placeholder={placeholder}
          value={content}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  const handleSetLink = () => {
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setShowLinkInput(false);
      return;
    }

    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setShowLinkInput(false);
    setLinkUrl('');
  };

  const handleAddImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setShowImageInput(false);
      setImageUrl('');
    }
  };

  const setTextColor = (color: string) => {
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
      className={`p-2 rounded hover:bg-gray-700 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center ${
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
        <div className="flex gap-1 border-r border-gray-700 pr-2 mr-1">
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
        <div className="flex gap-1 border-r border-gray-700 pr-2 mr-1">
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
        </div>

        {/* Text Alignment */}
        <div className="flex gap-1 border-r border-gray-700 pr-2 mr-1">
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
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            active={editor.isActive({ textAlign: 'justify' })}
            title="Justify"
          >
            <AlignJustify className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Lists */}
        <div className="flex gap-1 border-r border-gray-700 pr-2 mr-1">
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

        {/* Link & Image */}
        <div className="flex gap-1 border-r border-gray-700 pr-2 mr-1">
          <div className="relative">
            <ToolbarButton
              onClick={() => setShowLinkInput(!showLinkInput)}
              active={editor.isActive('link') || showLinkInput}
              title="Insert Link"
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
            {showLinkInput && (
              <div className="absolute top-full left-0 mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[300px]">
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetLink()}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSetLink}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
                    type="button"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => {
                      editor.chain().focus().unsetLink().run();
                      setShowLinkInput(false);
                      setLinkUrl('');
                    }}
                    className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-500"
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="relative">
            <ToolbarButton
              onClick={() => setShowImageInput(!showImageInput)}
              active={showImageInput}
              title="Insert Image"
            >
              <ImageIcon className="h-4 w-4" />
            </ToolbarButton>
            {showImageInput && (
              <div className="absolute top-full left-0 mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[300px]">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddImage()}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleAddImage}
                  className="w-full mt-2 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
                  type="button"
                >
                  Insert Image
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex gap-1 border-r border-gray-700 pr-2 mr-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="Insert Table"
          >
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>
          {editor.isActive('table') && (
            <>
              <ToolbarButton
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="Add Column"
              >
                <Columns className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="Add Row"
              >
                <Rows className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteTable().run()}
                title="Delete Table"
              >
                <Trash2 className="h-4 w-4" />
              </ToolbarButton>
            </>
          )}
        </div>

        {/* Color Picker */}
        <div className="flex gap-1 border-r border-gray-700 pr-2 mr-1">
          <div className="relative">
            <ToolbarButton
              onClick={() => setShowColorPicker(!showColorPicker)}
              active={showColorPicker}
              title="Text Color"
            >
              <Palette className="h-4 w-4" />
            </ToolbarButton>
            
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[280px]">
                <div className="text-xs text-gray-400 mb-2 font-semibold">Quick Colors</div>
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {[
                    '#000000', '#FFFFFF', '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
                    '#9b59b6', '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#d35400',
                    '#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#16a085'
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => setTextColor(color)}
                      className="w-8 h-8 rounded border-2 border-gray-600 hover:scale-110 transition-transform"
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
                    className="w-10 h-10 rounded border border-gray-600 cursor-pointer bg-gray-800"
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
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
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
        <div className="flex gap-1 border-r border-gray-700 pr-2 mr-1">
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

        {/* View Mode */}
        <div className="flex gap-1">
          <ToolbarButton
            onClick={switchToCodeView}
            active={viewMode === 'code'}
            title={viewMode === 'code' ? 'Switch to Editor' : 'View HTML Code'}
          >
            <FileCode className="h-4 w-4" />
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
        <div className="bg-gray-900">
          <EditorContent editor={editor} className="text-gray-100" />
        </div>
      )}

      {/* Code View */}
      {viewMode === 'code' && (
        <textarea
          value={codeContent}
          onChange={(e) => setCodeContent(e.target.value)}
          className="w-full px-4 py-3 bg-gray-900 text-gray-100 font-mono text-sm focus:outline-none resize-none"
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
