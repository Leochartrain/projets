import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIES } from './config';

/** Un ingrédient : avec une quantité (recalculée selon le nombre de parts) ou un texte libre (« 1 pincée »). */
const ingredient = z.object({
  nom: z.string(),
  quantite: z.number().positive().optional(),
  /** g, ml, cl, c. à café, c. à soupe… Vide pour un nombre de pièces (3 pommes, 1 œuf). */
  unite: z.string().default(''),
  /** Texte libre à la place de la quantité, jamais recalculé : « 1 pincée », « 1/2 gousse ». */
  texte: z.string().optional(),
  /** Précision affichée après le nom : « (environ 50 g) », « bien froide ». */
  note: z.string().optional(),
});

const recettes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/recettes' }),
  schema: ({ image }) =>
    z.object({
      titre: z.string(),
      /** Une phrase qui donne envie, sous le titre et dans Google. */
      resume: z.string(),
      categorie: z.enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]]),
      date: z.coerce.date(),
      photo: image(),
      /** Décrit la photo pour les personnes malvoyantes et pour Google. */
      photoAlt: z.string(),
      /** Crédit si la photo n'est pas de Léo (photo provisoire libre de droits). */
      photoCredit: z.string().optional(),
      /** Recette de démonstration, en attendant les vraies : le site n'est pas référencé tant qu'il en reste une. */
      exemple: z.boolean().default(false),
      /** Recette d'un autre pâtissier : toujours créditée, avec un lien vers la publication d'origine. */
      source: z
        .object({
          /** Nom de l'auteur : « Nicolas Tonini ». */
          auteur: z.string(),
          /** Pseudo sur la plateforme : « @nicook_off ». */
          compte: z.string().optional(),
          /** Instagram, YouTube, un livre… */
          plateforme: z.string(),
          url: z.string().url(),
        })
        .optional(),

      parts: z.number().int().positive(),
      /** Diamètre en cm du cercle ou moule rond de la recette de base : sert à proposer un diamètre quand on change le nombre de parts. */
      cercle: z.number().positive().optional(),
      /** Moule non rond de la recette de base, affiché tel quel : « Moule à cake de 25 × 8 cm ». */
      moule: z.string().optional(),
      difficulte: z.enum(['facile', 'intermédiaire', 'avancée']),
      /** Temps en minutes. */
      temps: z.object({
        preparation: z.number().int().nonnegative(),
        cuisson: z.number().int().nonnegative().default(0),
        repos: z.number().int().nonnegative().default(0),
      }),

      /** Ingrédients groupés par préparation (pâte, crème…). */
      ingredients: z.array(z.object({ titre: z.string(), liste: z.array(ingredient) })),
      /** Étapes groupées de la même façon. */
      etapes: z.array(z.object({ titre: z.string(), liste: z.array(z.string()) })),
      astuces: z.array(z.string()).default([]),
    }),
});

export const collections = { recettes };
