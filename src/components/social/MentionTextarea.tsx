import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserSuggestion {
  user_id: string;
  full_name: string;
  nickname: string | null;
  profile_photo_url: string | null;
  position: string | null;
}

interface MentionData {
  userId: string;
  displayName: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  onMentionsChange?: (mentions: string[]) => void;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  rows = 3,
  onMentionsChange,
}: MentionTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionsMap, setMentionsMap] = useState<Map<string, MentionData>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  // Search for users when typing @
  const searchUsers = async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, nickname, profile_photo_url, position')
        .or(`full_name.ilike.%${query}%,nickname.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      setSuggestions(data || []);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Error searching users:', error);
      setSuggestions([]);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    onChange(newValue);

    // Check if we're typing a mention
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setShowSuggestions(true);
      searchUsers(query);
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
    }

    // Update mentions list based on current @mentions in text
    updateMentionsFromText(newValue);
  };

  const updateMentionsFromText = (text: string) => {
    // Find all @Name patterns and check against our mentionsMap
    const mentionRegex = /@(\w+)/g;
    const foundMentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionName = match[1];
      // Find in our map by display name
      mentionsMap.forEach((data, key) => {
        if (data.displayName.toLowerCase() === mentionName.toLowerCase()) {
          foundMentions.push(data.userId);
        }
      });
    }
    
    onMentionsChange?.(foundMentions);
  };

  const insertMention = (user: UserSuggestion) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    
    // Find the @ position
    const mentionStartIndex = textBeforeCursor.lastIndexOf('@');
    const textBeforeMention = value.slice(0, mentionStartIndex);
    
    // Use display name (nickname or full name), strip leading @ if present
    const rawName = user.nickname || user.full_name.split(' ')[0];
    const displayName = rawName.replace(/^@+/, '');
    
    // Just show @Name in the textarea
    const newValue = textBeforeMention + '@' + displayName + ' ' + textAfterCursor;
    onChange(newValue);
    
    // Store the mapping of displayName -> userId
    const newMap = new Map(mentionsMap);
    newMap.set(displayName.toLowerCase(), { userId: user.user_id, displayName });
    setMentionsMap(newMap);
    
    // Update mentions list
    const allMentions = Array.from(newMap.values()).map(m => m.userId);
    onMentionsChange?.(allMentions);
    
    setShowSuggestions(false);
    setMentionQuery('');
    
    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        if (showSuggestions && suggestions[selectedIndex]) {
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !textareaRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn('resize-none', className)}
        rows={rows}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        >
          {suggestions.map((user, index) => (
            <button
              key={user.user_id}
              type="button"
              onClick={() => insertMention(user)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profile_photo_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {user.nickname || user.full_name}
                </p>
                {user.position && (
                  <p className="text-xs text-muted-foreground truncate">
                    {user.position}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Utility to highlight @mentions in displayed text
export function formatMentionText(text: string): React.ReactNode {
  // Match @Name patterns (simple format)
  const parts: React.ReactNode[] = [];
  const regex = /@(\w+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Add mention as styled span
    const displayName = match[1];
    parts.push(
      <span
        key={match.index}
        className="text-primary font-medium"
      >
        @{displayName}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
