import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ticketsApi, csatApi } from '../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Star, ThumbsUp, ThumbsDown, MessageSquare, Search, CheckCircle } from 'lucide-react';

export function CsatSurveyPage() {
  const [ticketNumber, setTicketNumber] = useState('');
  const [searchedTicket, setSearchedTicket] = useState<any>(null);
  const [survey, setSurvey] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [searchError, setSearchError] = useState('');

  type Question = {
    id: string;
    questionText: string;
    questionType: string;
    isRequired: boolean;
    scaleMin: number;
    scaleMax: number;
  };

  // Search for ticket and its survey
  const searchTicketMutation = useMutation({
    mutationFn: async (ticketNum: string) => {
      // First find the ticket
      const ticketResponse = await ticketsApi.getByNumber(ticketNum);
      const ticket = ticketResponse.data;

      // Then check if there's a survey for this ticket
      try {
        const surveyResponse = await csatApi.getSurveyByTicket(ticket.id);
        return { ticket, survey: surveyResponse.data };
      } catch {
        return { ticket, survey: null };
      }
    },
    onSuccess: (data) => {
      setSearchedTicket(data.ticket);
      setSurvey(data.survey);
      setSearchError('');
      setRating(0);
      setComment('');
    },
    onError: () => {
      setSearchError('Ticket not found');
      setSearchedTicket(null);
      setSurvey(null);
    },
  });

  // Submit survey
  const submitMutation = useMutation({
    mutationFn: (data: { rating: number; comment?: string }) =>
      csatApi.submitSurvey(survey.id, data),
    onSuccess: () => {
      setSurvey({ ...survey, status: 'completed', rating });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketNumber.trim()) {
      searchTicketMutation.mutate(ticketNumber.trim());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating > 0) {
      submitMutation.mutate({ rating, comment: comment || undefined });
    }
  };

  const getSurveyConfig = (): Question[] => {
    if (!survey?.config?.questions) return [];
    return survey.config.questions;
  };

  const questions = getSurveyConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rate Your Experience</h1>
        <p className="text-muted-foreground">
          We value your feedback! Enter your ticket number to rate your support experience.
        </p>
      </div>

      {/* Search Form */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter ticket number (e.g., TKT-00001)"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={searchTicketMutation.isPending}>
              <Search className="w-4 h-4 mr-2" />
              {searchTicketMutation.isPending ? 'Searching...' : 'Find Ticket'}
            </Button>
          </form>
          {searchError && (
            <p className="text-red-500 text-sm mt-2">{searchError}</p>
          )}
        </CardContent>
      </Card>

      {/* Ticket Info & Survey Form */}
      {searchedTicket && (
        <Card>
          <CardHeader>
            <CardTitle>
              Ticket #{searchedTicket.ticketNumber}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Ticket Details */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="font-medium">{searchedTicket.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Status: <span className="capitalize">{searchedTicket.status?.replace('_', ' ')}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Priority: <span className="capitalize">{searchedTicket.priority}</span>
                </p>
              </div>

              {/* No Survey Available */}
              {!survey && (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-muted-foreground">
                    No survey available for this ticket yet.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Surveys are typically sent after a ticket is resolved.
                  </p>
                </div>
              )}

              {/* Survey Already Completed */}
              {survey?.status === 'completed' && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-medium text-green-600">Thank you!</p>
                  <p className="text-muted-foreground">
                    You've already submitted your feedback for this ticket.
                  </p>
                  <div className="mt-4">
                    <div className="flex items-center justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-6 h-6 ${
                            star <= (survey?.rating || 0)
                              ? 'text-yellow-500 fill-yellow-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {survey?.comment && (
                      <p className="text-sm text-muted-foreground mt-4 italic">
                        "{survey.comment}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Survey Opted Out */}
              {survey?.status === 'opted_out' && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    You've opted out of surveys for this ticket.
                  </p>
                </div>
              )}

              {/* Active Survey - Submit Form */}
              {survey && ['pending', 'sent', 'viewed'].includes(survey.status) && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-medium mb-2">
                      How satisfied were you with the support you received?
                    </h3>
                    <div className="flex items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-10 h-10 ${
                              star <= rating
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {rating === 0 && 'Click to rate'}
                      {rating === 1 && 'Poor'}
                      {rating === 2 && 'Fair'}
                      {rating === 3 && 'Good'}
                      {rating === 4 && 'Very Good'}
                      {rating === 5 && 'Excellent'}
                    </p>
                  </div>

                  {/* Additional Questions */}
                  {questions.filter((q: Question) => q.questionType !== 'rating').map((question: Question) => (
                    <div key={question.id} className="space-y-2">
                      <label className="block font-medium">
                        {question.questionText}
                        {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </label>

                      {question.questionType === 'nps' && (
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 11 }, (_, i) => i).map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {/* Handle NPS response */}}
                              className="w-8 h-8 rounded text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      )}

                      {question.questionType === 'thumbs' && (
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <ThumbsDown className="w-5 h-5" />
                            Not Satisfied
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <ThumbsUp className="w-5 h-5" />
                            Satisfied
                          </button>
                        </div>
                      )}

                      {question.questionType === 'comment' && (
                        <textarea
                          className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                          rows={3}
                          placeholder="Share your thoughts..."
                        />
                      )}
                    </div>
                  ))}

                  {/* Comment */}
                  <div className="space-y-2">
                    <label className="block font-medium">
                      Additional Comments (Optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                      rows={4}
                      placeholder="Tell us more about your experience..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => csatApi.optOut(searchedTicket.id)}
                      className="text-sm text-muted-foreground hover:text-gray-600"
                    >
                      Skip survey
                    </button>
                    <Button
                      type="submit"
                      disabled={rating === 0 || submitMutation.isPending}
                    >
                      {submitMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!searchedTicket && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-medium mb-4">How it works</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <p className="text-sm">Enter your ticket number</p>
              </div>
              <div className="text-center p-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-600 font-bold">2</span>
                </div>
                <p className="text-sm">Rate your experience</p>
              </div>
              <div className="text-center p-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-600 font-bold">3</span>
                </div>
                <p className="text-sm">Submit your feedback</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
