import React from 'react';
import {Composition} from 'remotion';
import {DUREE_SHORT, FPS, Short} from './Short';

export const Racine: React.FC = () => (
	<Composition id="Short" component={Short} durationInFrames={DUREE_SHORT} fps={FPS} width={1080} height={1920} />
);
