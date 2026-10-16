import RecommendedExplorer from '@/components/RecommendedExplorer';

export const metadata = {
  title: 'Recommended movies — CineRang',
};

export default function RecommendedMoviesPage() {
  return <RecommendedExplorer media="movie" />;
}
