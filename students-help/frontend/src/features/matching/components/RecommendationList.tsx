import { StudentRecommendationCard } from './StudentRecommendationCard';
import type { Recommendation } from '../types';

type RecommendationListProps = {
  taskId: string;
  recommendations: Recommendation[];
};

export function RecommendationList({ taskId, recommendations }: RecommendationListProps) {
  return (
    <ul className="skill-list">
      {recommendations.map((recommendation) => (
        <li key={recommendation.student.id}>
          <StudentRecommendationCard taskId={taskId} recommendation={recommendation} />
        </li>
      ))}
    </ul>
  );
}
