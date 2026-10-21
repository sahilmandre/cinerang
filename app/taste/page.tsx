import TasteQuiz from '@/components/TasteQuiz';
import SyncHint from '@/components/SyncHint';

export default function TastePage() {
  return (
    <div className="mt-6 sm:mt-8 min-h-[70vh]">
      <TasteQuiz />
      <SyncHint what="your taste" className="mt-6 justify-center" />
    </div>
  );
}
