-- Un seul avis par personne, par recette et par groupe (on le supprime pour en redonner un).
create unique index reviews_one_per_author on public.reviews (recipe_id, group_id, author_id);
