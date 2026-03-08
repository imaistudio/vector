import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { getMentionType } from './mention-config';
import type { MentionTypeId } from './mention-config';

const mentionSuggestionPluginKey = new PluginKey('mentionSuggestion');

export type MentionExtensionOptions = {
  suggestion: Partial<SuggestionOptions>;
};

/** Build a URL hash encoding mention metadata based on the type's config. */
function buildMentionHash(item: {
  type: string;
  email?: string;
  icon?: string;
  color?: string;
}): string {
  const config = getMentionType(item.type as MentionTypeId);
  if (!config) return '';

  const params = new URLSearchParams();

  if (config.hashEncoding === 'email' && item.email) {
    params.set('email', item.email);
  } else if (config.hashEncoding === 'icon') {
    if (item.icon) params.set('icon', item.icon);
    if (item.color) params.set('color', item.color);
  }

  const hash = params.toString();
  return hash ? `#${hash}` : '';
}

const MentionExtension = Extension.create<MentionExtensionOptions>({
  name: 'entity-mention',

  addOptions() {
    return {
      suggestion: {} as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: mentionSuggestionPluginKey,
        char: '@',
        allowSpaces: true,
        // Prevent re-triggering when the @ is inside an existing link (mention)
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const linkMark = state.schema.marks.link;
          if (!linkMark) return true;
          // Check marks on the resolved position (works for middle of mark)
          if ($from.marks().some(m => m.type === linkMark)) return false;
          // Also check the text node at this position (handles inclusive:false boundaries)
          const nodeAfter = $from.nodeAfter;
          if (nodeAfter?.marks.some(m => m.type === linkMark)) return false;
          return true;
        },
        command: ({ editor, range, props }) => {
          const item = props as {
            id: string;
            label: string;
            type: string;
            href: string;
            email?: string;
            icon?: string;
            color?: string;
          };

          const config = getMentionType(item.type as MentionTypeId);
          const prefix = config?.textPrefix ?? '';
          const label = `${prefix}${item.label}`;
          const href = item.href + buildMentionHash(item);

          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              {
                type: 'text',
                text: label,
                marks: [
                  {
                    type: 'link',
                    attrs: { href },
                  },
                ],
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run();
        },
        ...this.options.suggestion,
      }),
    ];
  },
});

export default MentionExtension;
