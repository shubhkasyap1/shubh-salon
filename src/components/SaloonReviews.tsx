import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
  profiles?: { name: string } | null;
}

interface SaloonReviewsProps {
  saloonId: string;
  showUserNames?: boolean;
  showIndividualRatings?: boolean;
}

export const SaloonReviews = ({ 
  saloonId, 
  showUserNames = true,
  showIndividualRatings = true 
}: SaloonReviewsProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [saloonId]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("saloon_id", saloonId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate average rating
      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(avg);
      }

      setReviews(data || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "text-primary fill-primary"
                : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="w-full">
            <CardTitle className="flex items-center justify-between cursor-pointer hover:text-primary transition-colors">
              <span className="flex items-center gap-2">
                <Star className="w-5 h-5 text-primary fill-primary" />
                Reviews & Ratings
              </span>
              <div className="flex items-center gap-3">
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2 text-sm font-normal">
                    <span className="font-bold text-lg">{averageRating.toFixed(1)}</span>
                    {renderStars(Math.round(averageRating))}
                    <span className="text-muted-foreground">({reviews.length})</span>
                  </div>
                )}
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No reviews yet. Be the first to review!
              </p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {reviews.map((review) => (
                  <div key={review.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {showUserNames && (
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs">
                              {(review.profiles?.name || "U").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          {showUserNames && (
                            <p className="font-medium text-sm">
                              {review.profiles?.name || "Anonymous"}
                            </p>
                          )}
                          {showIndividualRatings && renderStars(review.rating)}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(review.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
