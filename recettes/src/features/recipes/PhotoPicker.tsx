import { useEffect, useId, useMemo } from 'react';
import { Icon } from '@/components/Icon';
import { usePhotoUrls } from './api';

/**
 * Photos d'une recette : celles déjà enregistrées et les nouvelles, avec un
 * bouton pour en ajouter (l'appareil photo sur téléphone) et un pour en retirer.
 */
export function PhotoPicker({
  label,
  hint,
  paths,
  files,
  onPathsChange,
  onFilesChange,
}: {
  label: string;
  hint: string;
  paths: string[];
  files: File[];
  onPathsChange: (paths: string[]) => void;
  onFilesChange: (files: File[]) => void;
}) {
  const id = useId();
  const { data: urls } = usePhotoUrls(paths);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  // Libère les aperçus quand ils ne servent plus.
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const thumbs = [
    ...paths.map((path) => ({ key: path, src: urls?.[path], remove: () => onPathsChange(paths.filter((p) => p !== path)) })),
    ...files.map((file, index) => ({ key: `${file.name}-${index}`, src: previews[index], remove: () => onFilesChange(files.filter((_, i) => i !== index)) })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {thumbs.map((thumb) => (
          <div key={thumb.key} className="relative size-24 overflow-hidden rounded-xl border border-line bg-line/50">
            {thumb.src && <img src={thumb.src} alt="" className="size-full object-cover" />}
            <button
              type="button"
              aria-label="Retirer la photo"
              onClick={thumb.remove}
              className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-ink/70 text-paper"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
        <label htmlFor={id} className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-field text-sm text-muted hover:border-accent hover:text-accent">
          <Icon name="camera" />
          Ajouter
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            onFilesChange([...files, ...Array.from(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
      </div>
      <p className="text-sm text-muted">{hint}</p>
    </div>
  );
}
