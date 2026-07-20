import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth, addDays, isSameDay, getDay } from "date-fns";
import { cn } from "@/lib/utils";

interface BookingCalendarProps {
  saloonId: string;
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
}

interface DayBookingCount {
  date: string;
  count: number;
}

interface SaloonSchedule {
  weekly_off_day: number | null;
  closed_dates: string[];
}

export const BookingCalendar = ({ saloonId, onDateSelect, selectedDate }: BookingCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookingCounts, setBookingCounts] = useState<DayBookingCount[]>([]);
  const [schedule, setSchedule] = useState<SaloonSchedule>({ weekly_off_day: null, closed_dates: [] });

  useEffect(() => {
    fetchBookingCounts();
    fetchSchedule();
  }, [saloonId, currentMonth]);

  const fetchSchedule = async () => {
    const { data } = await supabase
      .from("saloons")
      .select("weekly_off_day, closed_dates")
      .eq("id", saloonId)
      .single();

    if (data) {
      setSchedule({
        weekly_off_day: data.weekly_off_day,
        closed_dates: data.closed_dates || [],
      });
    }
  };

  const fetchBookingCounts = async () => {
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("bookings")
      .select("booking_date")
      .eq("saloon_id", saloonId)
      .gte("booking_date", start)
      .lte("booking_date", end)
      .neq("status", "cancelled");

    if (!error && data) {
      const counts: Record<string, number> = {};
      data.forEach((b) => {
        counts[b.booking_date] = (counts[b.booking_date] || 0) + 1;
      });
      setBookingCounts(
        Object.entries(counts).map(([date, count]) => ({ date, count }))
      );
    }
  };

  const getBookingLevel = (date: Date): "free" | "moderate" | "busy" | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const found = bookingCounts.find((b) => b.date === dateStr);
    if (!found) return "free";
    if (found.count <= 3) return "moderate";
    return "busy";
  };

  // Check if date should be disabled
  const isDateDisabled = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Past dates
    if (date < today) return true;
    
    // More than 7 days in future
    const maxDate = addDays(today, 7);
    if (date > maxDate) return true;
    
    // Weekly off day
    if (schedule.weekly_off_day !== null && getDay(date) === schedule.weekly_off_day) {
      return true;
    }
    
    // Specific closed dates
    const dateStr = format(date, "yyyy-MM-dd");
    if (schedule.closed_dates.includes(dateStr)) {
      return true;
    }
    
    return false;
  };

  const modifiers = {
    free: (date: Date) => !isDateDisabled(date) && getBookingLevel(date) === "free",
    moderate: (date: Date) => !isDateDisabled(date) && getBookingLevel(date) === "moderate",
    busy: (date: Date) => !isDateDisabled(date) && getBookingLevel(date) === "busy",
    closed: (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return schedule.closed_dates.includes(dateStr) || 
        (schedule.weekly_off_day !== null && getDay(date) === schedule.weekly_off_day);
    },
  };

  const modifiersClassNames = {
    free: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    busy: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    closed: "bg-muted text-muted-foreground line-through",
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>Booking Calendar</span>
          <div className="flex gap-2 text-xs font-normal flex-wrap">
            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30">
              Free
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30">
              Moderate
            </Badge>
            <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30">
              Busy
            </Badge>
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              Closed
            </Badge>
          </div>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Book up to 7 days in advance</p>
      </CardHeader>
      <CardContent>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && !isDateDisabled(date) && onDateSelect?.(date)}
          onMonthChange={setCurrentMonth}
          disabled={isDateDisabled}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          className="pointer-events-auto rounded-md border"
        />
      </CardContent>
    </Card>
  );
};