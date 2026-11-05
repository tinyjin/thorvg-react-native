export const colors = {
  background: '#1E1E1E',
  surface: '#252526',
  surfaceRaised: '#2D2D30',
  border: '#3E3E42',
  text: '#E6E6E6',
  textMuted: '#A0A0A6',
  accent: '#4FC1FF',
  warn: '#E5C07B',
  error: '#F48771',
  canvas: '#000000',
};

export const categories = [
  { key: 'all', label: 'All' },
  { key: 'basic', label: 'Basic' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'text', label: 'Text' },
  { key: 'media', label: 'Media' },
  { key: 'components', label: 'Components' },
  { key: 'views', label: 'Views' },
] as const;

export type CategoryKey = (typeof categories)[number]['key'];
