import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { csatApi } from '../../api/client';
import { Star, ThumbsUp, ThumbsDown, MessageSquare, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';

interface CsatSurveyFormProps {
  surveyId: string;
  ticketId: string;
  ticketNumber: string;
  ticketTitle: string;
  questions: {
    id: string;
    questionText: string;
    questionType: string;
    isRequired: boolean;
    scaleMin: number;
    scaleMax: number;
  }[];
  onComplete?: () => void;
  onClose?: () => void;
}

export function CsatSurveyForm({
  surveyId,
  ticketId,
  ticketNumber,
  ticketTitle,
  questions,
  onComplete,
  onClose,
}: CsatSurveyFormProps) {
  const [responses, setResponses] = useState<Record<string, { ratingValue?: number; textValue?: string }>>({});
  const [comment, setComment] = useState('');

  const submitMutation = useMutation({
    mutationFn: (data: { rating: number; comment?: string; responses?: any[] }) =>
      csatApi.submitSurvey(surveyId, data),
    onSuccess: () => {
      onComplete?.();
    },
  });

  const optOutMutation = useMutation({
    mutationFn: () => csatApi.optOut(ticketId),
    onSuccess: () => {
      onClose?.();
    },
  });

  const handleRatingChange = (questionId: string, rating: number) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { ratingValue: rating },
    }));
  };

  const handleTextChange = (questionId: string, text: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { textValue: text, ratingValue: prev[questionId]?.ratingValue },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Get the main rating from the first rating question
    const mainRatingQuestion = questions.find((q) => q.questionType === 'rating');
    const mainRating = mainRatingQuestion
      ? responses[mainRatingQuestion.id]?.ratingValue || 0
      : 0;

    // Build responses array
    const responseArray = Object.entries(responses)
      .filter(([questionId]) => questionId !== mainRatingQuestion?.id)
      .map(([questionId, response]) => ({
        questionId,
        ratingValue: response.ratingValue,
        textValue: response.textValue,
      }));

    submitMutation.mutate({
      rating: mainRating,
      comment: comment || undefined,
      responses: responseArray.length > 0 ? responseArray : undefined,
    });
  };

  const mainRatingQuestion = questions.find((q) => q.questionType === 'rating');
  const mainRating = mainRatingQuestion
    ? responses[mainRatingQuestion.id]?.ratingValue || 0
    : 0;

  const isMainRatingValid = mainRating > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">How was your experience?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ticket #{ticketNumber}: {ticketTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Main Rating Question */}
          {mainRatingQuestion && (
            <div>
              <label className="block text-sm font-medium mb-3">
                {mainRatingQuestion.questionText}
                {mainRatingQuestion.isRequired && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleRatingChange(mainRatingQuestion.id, rating)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        rating <= (responses[mainRatingQuestion.id]?.ratingValue || 0)
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">
                  {mainRating > 0 && (
                    mainRating >= 4 ? 'Satisfied' : mainRating >= 3 ? 'Neutral' : 'Unsatisfied'
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Other Questions */}
          {questions
            .filter((q) => q.questionType !== 'rating')
            .map((question) => (
              <div key={question.id}>
                <label className="block text-sm font-medium mb-2">
                  {question.questionText}
                  {question.isRequired && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>

                {question.questionType === 'nps' && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 11 }, (_, i) => i).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleRatingChange(question.id, value)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                          responses[question.id]?.ratingValue === value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}

                {question.questionType === 'satisfaction' && (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleRatingChange(question.id, 5)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        responses[question.id]?.ratingValue === 5
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRatingChange(question.id, 1)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        responses[question.id]?.ratingValue === 1
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      No
                    </button>
                  </div>
                )}

                {question.questionType === 'thumbs' && (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleRatingChange(question.id, 5)}
                      className={`p-3 rounded-full transition-colors ${
                        responses[question.id]?.ratingValue === 5
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <ThumbsUp className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRatingChange(question.id, 1)}
                      className={`p-3 rounded-full transition-colors ${
                        responses[question.id]?.ratingValue === 1
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <ThumbsDown className="w-6 h-6" />
                    </button>
                  </div>
                )}

                {question.questionType === 'comment' && (
                  <Textarea
                    value={responses[question.id]?.textValue || ''}
                    onChange={(e) => handleTextChange(question.id, e.target.value)}
                    placeholder="Enter your feedback..."
                    rows={3}
                  />
                )}
              </div>
            ))}

          {/* General Comment */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Additional Comments
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share any additional feedback or suggestions..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={() => optOutMutation.mutate()}
              className="text-sm text-muted-foreground hover:text-gray-600 dark:hover:text-gray-400"
              disabled={optOutMutation.isPending}
            >
              Skip survey
            </button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isMainRatingValid || submitMutation.isPending}
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
