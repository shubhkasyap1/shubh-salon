import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CalendarDays, X, CalendarOff, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

interface SaloonScheduleSettingsProps {
  saloonId: string;
  weeklyOffDay: number | null;
  closedDates: string[];
  openingTime: string;
  closingTime: string;
  onUpdate: () => void;
}

export const SaloonScheduleSettings = ({
  saloonId,
  weeklyOffDay,
  closedDates,
  openingTime,
  closingTime,
  onUpdate,
}: SaloonScheduleSettingsProps) => {
  const { toast } = useToast();
  const [selectedWeeklyOff, setSelectedWeeklyOff] = useState<string>(
    weeklyOffDay !== null ? String(weeklyOffDay) : "none"
  );
  const [closedDatesList, setClosedDatesList] = useState<string[]>(closedDates || []);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [rangeDatePickerOpen, setRangeDatePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openTime, setOpenTime] = useState(openingTime || "09:00");
  const [closeTime, setCloseTime] = useState(closingTime || "21:00");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const handleWeeklyOffChange = async (value: string) => {
    setSelectedWeeklyOff(value);
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from("saloons")
        .update({ weekly_off_day: value === "none" ? null : parseInt(value) })
        .eq("id", saloonId);

      if (error) throw error;
      toast({ title: "Weekly off updated" });
      onUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error updating", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleHoursChange = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("saloons")
        .update({ 
          opening_time: openTime,
          closing_time: closeTime
        })
        .eq("id", saloonId);

      if (error) throw error;
      toast({ title: "Operating hours updated" });
      onUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error updating hours", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const addClosedDate = async (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    if (closedDatesList.includes(dateStr)) {
      toast({ title: "Date already added", variant: "destructive" });
      return;
    }

    const newList = [...closedDatesList, dateStr].sort();
    setClosedDatesList(newList);
    setDatePickerOpen(false);

    try {
      const { error } = await supabase
        .from("saloons")
        .update({ closed_dates: newList })
        .eq("id", saloonId);

      if (error) throw error;
      toast({ title: "Closed date added" });
      onUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error adding date", description: message, variant: "destructive" });
      setClosedDatesList(closedDatesList);
    }
  };

  const addClosedDateRange = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Please select both start and end dates", variant: "destructive" });
      return;
    }

    const datesInRange = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const dateStrings = datesInRange.map(d => format(d, "yyyy-MM-dd"));
    
    const newList = [...new Set([...closedDatesList, ...dateStrings])].sort();
    setClosedDatesList(newList);
    setRangeDatePickerOpen(false);
    setDateRange(undefined);

    try {
      const { error } = await supabase
        .from("saloons")
        .update({ closed_dates: newList })
        .eq("id", saloonId);

      if (error) throw error;
      toast({ title: `Added ${dateStrings.length} closed dates` });
      onUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error adding dates", description: message, variant: "destructive" });
      setClosedDatesList(closedDatesList);
    }
  };

  const removeClosedDate = async (dateStr: string) => {
    const newList = closedDatesList.filter((d) => d !== dateStr);
    setClosedDatesList(newList);

    try {
      const { error } = await supabase
        .from("saloons")
        .update({ closed_dates: newList })
        .eq("id", saloonId);

      if (error) throw error;
      toast({ title: "Closed date removed" });
      onUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error removing date", description: message, variant: "destructive" });
      setClosedDatesList(closedDatesList);
    }
  };

  const clearAllClosedDates = async () => {
    setClosedDatesList([]);
    try {
      const { error } = await supabase
        .from("saloons")
        .update({ closed_dates: [] })
        .eq("id", saloonId);

      if (error) throw error;
      toast({ title: "All closed dates cleared" });
      onUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error clearing dates", description: message, variant: "destructive" });
      setClosedDatesList(closedDates || []);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          Schedule Settings
        </CardTitle>
        <CardDescription>
          Manage operating hours, weekly off day, and specific closed dates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Operating Hours */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Operating Hours
          </Label>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label htmlFor="open-time" className="text-sm text-muted-foreground">Open:</Label>
              <Input
                id="open-time"
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="close-time" className="text-sm text-muted-foreground">Close:</Label>
              <Input
                id="close-time"
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-32"
              />
            </div>
            <Button 
              size="sm" 
              onClick={handleHoursChange} 
              disabled={isSaving}
            >
              Save Hours
            </Button>
          </div>
        </div>

        {/* Weekly Off Day */}
        <div className="space-y-2">
          <Label>Weekly Off Day (Optional)</Label>
          <Select value={selectedWeeklyOff} onValueChange={handleWeeklyOffChange} disabled={isSaving}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select a day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Weekly Off</SelectItem>
              {DAYS_OF_WEEK.map((day) => (
                <SelectItem key={day.value} value={day.value}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Customers won't be able to book on this day every week
          </p>
        </div>

        {/* Specific Closed Dates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Closed Dates</Label>
            {closedDatesList.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllClosedDates} className="text-destructive hover:text-destructive">
                Clear All
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {closedDatesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No specific closed dates</p>
            ) : (
              closedDatesList.map((dateStr) => (
                <Badge key={dateStr} variant="secondary" className="flex items-center gap-1">
                  <CalendarOff className="w-3 h-3" />
                  {format(new Date(dateStr), "MMM d, yyyy")}
                  <button
                    onClick={() => removeClosedDate(dateStr)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {/* Single Date Picker */}
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Add Single Date
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  onSelect={(date) => date && addClosedDate(date)}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {/* Date Range Picker */}
            <Popover open={rangeDatePickerOpen} onOpenChange={setRangeDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Add Date Range
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    numberOfMonths={1}
                    className={cn("pointer-events-auto")}
                  />
                  <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setDateRange(undefined);
                        setRangeDatePickerOpen(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={addClosedDateRange}
                      disabled={!dateRange?.from || !dateRange?.to}
                    >
                      Add Range
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Add specific dates when your salon will be closed (e.g., holidays)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
