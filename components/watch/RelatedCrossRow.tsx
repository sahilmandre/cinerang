import { getCrossTitles, RelatedMedia } from '@/lib/related';
import Row from '@/components/Row';

/**
 * The cross-media related row: films for a series, series for a film.
 *
 * It is rendered inside a <Suspense> boundary on the watch page, so the
 * discovery queries it needs never delay the player, the synopsis or the
 * main "More like this" row — the row simply streams in underneath.
 */
export default async function RelatedCrossRow({
  details,
  type,
  title,
  limit = 12,
}: {
  details: any;
  type: RelatedMedia;
  title: string;
  limit?: number;
}) {
  const items = await getCrossTitles(details, type, { limit });
  if (items.length === 0) return null;
  return <Row title={title} items={items} type={type === 'movie' ? 'tv' : 'movie'} />;
}
