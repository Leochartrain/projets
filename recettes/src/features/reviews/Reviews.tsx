import { useState, type FormEvent } from 'react';
import { Button, ErrorBox, TextArea } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useUserId } from '@/features/auth/AuthProvider';
import { useMyGroups } from '@/features/groups/api';
import { errorMessage } from '@/lib/supabase';
import { useAddReview, useDeleteReview, useReviews } from './api';

/**
 * Notes et commentaires d'une recette. Chaque avis appartient à un groupe :
 * seuls ses membres le voient. On peut donner son avis dans les groupes où la
 * recette est partagée et dont on fait partie.
 */
export function Reviews({ recipeId, groups, isAuthor }: { recipeId: string; groups: { id: string; name: string }[]; isAuthor: boolean }) {
  const userId = useUserId();
  const { data: reviews } = useReviews(recipeId);
  const { data: myGroups } = useMyGroups();
  const addReview = useAddReview(recipeId);
  const deleteReview = useDeleteReview(recipeId);
  const reviewable = groups.filter((g) => myGroups?.some((m) => m.id === g.id));
  const [groupId, setGroupId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  if (groups.length === 0) return null;
  const chosenGroup = groupId ?? reviewable[0]?.id ?? null;
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!chosenGroup || (!rating && !comment.trim())) return;
    await addReview.mutateAsync({ groupId: chosenGroup, rating, comment });
    setRating(null);
    setComment('');
  }

  return (
    <section id="avis" className="flex flex-col gap-4 border-t border-line pt-5">
      <h2 className="text-xl">Avis</h2>

      {reviewable.length > 0 && !isAuthor && (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-2">Ta note</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} sur 5`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(rating === value ? null : value)}
                  className={`flex size-11 items-center justify-center rounded-xl ${rating && value <= rating ? 'text-mustard' : 'text-field'}`}
                >
                  <Icon name="star" size={28} filled={Boolean(rating && value <= rating)} />
                </button>
              ))}
            </div>
          </fieldset>
          <TextArea label="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="Je l'ai faite pour dimanche, un régal !" />
          {reviewable.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className="label">Visible dans</span>
              <select value={chosenGroup ?? ''} onChange={(e) => setGroupId(e.target.value)} className="h-12 rounded-xl border border-field bg-card px-3">
                {reviewable.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {addReview.error && <ErrorBox>{errorMessage(addReview.error)}</ErrorBox>}
          <Button type="submit" disabled={addReview.isPending || (!rating && !comment.trim())}>
            Publier mon avis
          </Button>
        </form>
      )}

      {reviews?.length === 0 && <p className="text-muted">Pas encore d'avis.</p>}
      <ul className="flex flex-col gap-3">
        {reviews?.map((review) => (
          <li key={review.id} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-bold">{review.authorName}</span>
              {review.rating && <span className="font-mono text-sm text-mustard">{'★'.repeat(review.rating)}</span>}
            </div>
            {review.comment && <p className="leading-relaxed">{review.comment}</p>}
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span>
                {new Date(review.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                {groups.length > 1 && ` · ${groupName(review.groupId)}`}
              </span>
              {review.authorId === userId && (
                <button type="button" onClick={() => deleteReview.mutate(review.id)} className="text-danger underline-offset-2 hover:underline">
                  Supprimer
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
