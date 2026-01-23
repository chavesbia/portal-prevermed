import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMOJI_CATEGORIES = [
  {
    name: 'Rostos',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😛', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐']
  },
  {
    name: 'Gestos',
    emojis: ['👍', '👎', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄']
  },
  {
    name: 'Símbolos',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '✨', '⭐', '🌟', '💫', '🔥', '💥', '💯', '✅', '❌', '⚠️', '🚫', '❓', '❗', '💬', '👁️‍🗨️', '🗨️', '💭', '🎉', '🎊', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐']
  },
  {
    name: 'Natureza',
    emojis: ['🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥']
  }
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" type="button">
          <Smile className="h-4 w-4 mr-2" />
          Emoji
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {/* Category tabs */}
        <div className="flex gap-1 mb-2 border-b border-border pb-2">
          {EMOJI_CATEGORIES.map((category, index) => (
            <Button
              key={category.name}
              variant="ghost"
              size="sm"
              className={cn(
                'text-xs px-2 py-1 h-auto',
                activeCategory === index && 'bg-accent'
              )}
              onClick={() => setActiveCategory(index)}
            >
              {category.name}
            </Button>
          ))}
        </div>
        
        {/* Emoji grid */}
        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="text-xl p-1 hover:bg-muted rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
