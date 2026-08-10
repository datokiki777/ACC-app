// Tag colors intentionally avoid the app's other semantic hues (accent gold) and stay limited to
// a small, easy-to-scan set. These exact hex values match what's already assigned to existing
// people's records — changing them would silently break tag-based sorting for anyone who already
// picked a color, since sorting matches by exact hex value.
export const TAG_COLORS = ['#5692ff', '#35c26b', '#ff6b6b'] as const;
