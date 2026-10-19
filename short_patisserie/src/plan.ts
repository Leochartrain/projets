// Découpage du Short : un plan = un rush (public/rushes/<rush>) + un sous-titre.
// Tant que le rush n'existe pas, le plan affiche une carte « à filmer ».
// Durées en secondes, à 30 i/s.

export type Plan = {
	rush: string;
	duree: number;
	texte: string;
	aFilmer: string;
	emoji: string;
};

export const TITRE = 'Tarte marbrée pomme caramel 🍏🤎';

export const PLANS: Plan[] = [
	{
		rush: '01-accroche.mp4',
		duree: 2.5,
		texte: 'Tarte marbrée pomme caramel 🍏🤎',
		aFilmer: 'Tarte finie sur la planche en bois, la caméra descend doucement vers les vagues de chantilly',
		emoji: '🥧',
	},
	{
		rush: '02-pate.mp4',
		duree: 3.5,
		texte: 'Mélange beurre mou, sucre glace, poudre d’amande, œuf et farine',
		aFilmer: 'Vue de dessus du saladier, mélange à la maryse',
		emoji: '🧈',
	},
	{
		rush: '03-cacao.mp4',
		duree: 3,
		texte: 'Coupe ta pâte en deux et ajoute cacao + cannelle dans une moitié',
		aFilmer: 'Les deux pâtons côte à côte, le cacao tombe sur l’un des deux',
		emoji: '🍫',
	},
	{
		rush: '04-marbrage.mp4',
		duree: 3.5,
		texte: 'Superpose les deux pâtes et étale pour un effet marbré sympa',
		aFilmer: 'Morceaux des deux pâtes empilés, coup de rouleau qui révèle le marbré',
		emoji: '🌀',
	},
	{
		rush: '05-foncage.mp4',
		duree: 3,
		texte: 'Fonce ton cercle et mets 30 min au frigo',
		aFilmer: 'Pâte posée dans le cercle de 20 cm, on coupe l’excédent au couteau',
		emoji: '⭕',
	},
	{
		rush: '06-cuisson.mp4',
		duree: 2.5,
		texte: 'Cuis 25 min à 160 °C',
		aFilmer: 'Fond de tarte qui sort du four, bien doré',
		emoji: '🔥',
	},
	{
		rush: '07-caramel.mp4',
		duree: 3.5,
		texte: 'Caramel à sec, puis crème chaude et beurre demi-sel',
		aFilmer: 'Casserole : le sucre fond, on verse la crème, ça bouillonne',
		emoji: '🍯',
	},
	{
		rush: '08-compotee.mp4',
		duree: 3,
		texte: 'Compotée de pommes vanille au fond de la tarte',
		aFilmer: 'On étale la compotée à la cuillère dans le fond cuit',
		emoji: '🍏',
	},
	{
		rush: '09-couche-caramel.mp4',
		duree: 2.5,
		texte: 'Une belle couche de caramel par-dessus',
		aFilmer: 'Le caramel coule en filet sur la compotée',
		emoji: '🤤',
	},
	{
		rush: '10-chantilly.mp4',
		duree: 3,
		texte: 'Chantilly mascarpone caramel, bien ferme',
		aFilmer: 'Fouet électrique, puis on retourne le bol pour montrer que ça tient',
		emoji: '🥛',
	},
	{
		rush: '11-pochage.mp4',
		duree: 4.5,
		texte: 'Poche en vagues avec une douille pétale',
		aFilmer: 'Vue de dessus, pochage en vagues d’un bord à l’autre (plan accéléré ×2)',
		emoji: '〰️',
	},
	{
		rush: '12-deco.mp4',
		duree: 3,
		texte: 'Termine avec des dés de pomme verte et des pécans caramélisées',
		aFilmer: 'Décor posé à la pince entre les vagues',
		emoji: '🌰',
	},
	{
		rush: '13-coupe.mp4',
		duree: 3.5,
		texte: 'Et regarde cette coupe 😍',
		aFilmer: 'Couteau qui tranche, on sort la part et on montre la coupe marbrée',
		emoji: '🔪',
	},
	{
		rush: '14-fin.mp4',
		duree: 2.5,
		texte: 'Recette complète en description !',
		aFilmer: 'La part dans l’assiette, une fourchette qui en prend un morceau',
		emoji: '🍴',
	},
];
