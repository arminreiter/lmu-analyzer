import { useContext, useEffect, useId, useRef, useState } from 'react';
import { StickyNote, X } from 'lucide-react';
import { DataCardHeader } from './DataCardHeader';
import type { NoteUpdate, SessionNote } from '../lib/sessionNotes';
import { NotifyContext } from '../lib/sessionMenu';

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-racing-highlight/25 text-racing-text whitespace-nowrap">
      {tag}
      {onRemove && (
        <button onClick={onRemove} title={`Remove tag ${tag}`} className="text-racing-muted hover:text-racing-red cursor-pointer">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

/** Free-text note and tags for one session; saves on blur, on leaving the view and on closing the page */
export function SessionNotesCard({ value, knownTags, onChange }: {
  value: SessionNote;
  knownTags: string[];
  /** Applies the change to the stored note; false when it couldn't be stored */
  onChange: (update: NoteUpdate) => boolean;
}) {
  const [draft, setDraft] = useState(value.note);
  const [tagInput, setTagInput] = useState('');
  const [failed, setFailed] = useState(false);
  const listId = useId();

  const save = (update: NoteUpdate) => setFailed(!onChange(update));

  // Back, reload or closing the tab unmounts the textarea without a blur — save the draft then too.
  // The card is gone by then, so a failure goes to the app's notices.
  const notify = useContext(NotifyContext);
  const latest = useRef({ draft, value, onChange, notify });
  useEffect(() => { latest.current = { draft, value, onChange, notify }; });
  useEffect(() => {
    const flush = () => {
      const { draft, value, onChange, notify } = latest.current;
      if (draft !== value.note && !onChange(n => ({ ...n, note: draft }))) {
        notify("Your session note couldn't be saved — browser storage is full.");
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const addTag = () => {
    const tag = tagInput.trim().replace(/,$/, '');
    setTagInput('');
    if (!tag) return;
    // Dedupe against what's stored, not these props — another tab may have removed the tag
    save(n => (n.tags.some(t => t.toLowerCase() === tag.toLowerCase()) ? n : { ...n, tags: [...n.tags, tag] }));
  };

  return (
    <div className="data-card carbon-fiber overflow-hidden">
      <DataCardHeader title={<span className="flex items-center gap-2"><StickyNote className="w-3.5 h-3.5" /> NOTES</span>}>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {value.tags.map(t => <TagChip key={t} tag={t} onRemove={() => save(n => ({ ...n, tags: n.tags.filter(x => x !== t) }))} />)}
          <input
            value={tagInput}
            list={listId}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
            onBlur={addTag}
            placeholder="+ tag"
            aria-label="Add tag"
            className="w-24 bg-transparent border-b border-racing-border focus:border-racing-red/60 outline-none text-xs text-white px-1 py-0.5"
          />
          <datalist id={listId}>
            {knownTags.filter(t => !value.tags.includes(t)).map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
      </DataCardHeader>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value.note) save(n => ({ ...n, note: draft })); }}
        rows={draft ? 3 : 1}
        placeholder="Setup changes, what worked, what to try next…"
        aria-label="Session notes"
        className="block w-full resize-y bg-transparent px-4 py-3 text-sm text-racing-text placeholder:text-racing-muted/50 outline-none"
      />
      {failed && <p className="px-4 pb-3 text-xs text-racing-red">Couldn't save — browser storage is full. Free some space (e.g. remove the profile picture) and try again.</p>}
    </div>
  );
}
