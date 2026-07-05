import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { cn } from "./utils/cn";

const DATA_KEY = "treatyourself.data.v1";
const IOS_BANNER_KEY = "treatyourself.ios-banner.dismissed";

type ThemeMode = "light" | "dark";
type Screen = "home" | "calendar" | "add" | "mood" | "insights" | "profile";
type CalendarView = "day" | "week" | "month";
type MoodValue = 1 | 2 | 3 | 4 | 5;
type MoodSource = "manual" | "before" | "after";

type ActivityCategory =
  | "Skincare"
  | "Mindfulness"
  | "Movement"
  | "Rest"
  | "Creativity"
  | "Connection";

type Activity = {
  id: string;
  title: string;
  category: ActivityCategory;
  date: string;
  time: string;
  duration: number;
  beforeMood?: MoodValue;
  afterMood?: MoodValue;
  reminder: boolean;
  notes: string;
  completed: boolean;
  createdAt: string;
};

type MoodEntry = {
  id: string;
  date: string;
  mood: MoodValue;
  note: string;
  source: MoodSource;
  activityId?: string;
  label?: string;
  createdAt: string;
};

type TreatYourselfData = {
  version: 1;
  onboarded: boolean;
  theme: ThemeMode;
  activities: Activity[];
  moodEntries: MoodEntry[];
};

type ActivityForm = {
  title: string;
  category: ActivityCategory;
  date: string;
  time: string;
  duration: number;
  beforeMood?: MoodValue;
  afterMood?: MoodValue;
  reminder: boolean;
  notes: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const CATEGORIES: ActivityCategory[] = [
  "Skincare",
  "Mindfulness",
  "Movement",
  "Rest",
  "Creativity",
  "Connection",
];

const CATEGORY_META: Record<
  ActivityCategory,
  { emoji: string; tint: string; ring: string; description: string }
> = {
  Skincare: {
    emoji: "🫧",
    tint: "from-rose-100 to-pink-50 dark:from-rose-500/20 dark:to-pink-400/10",
    ring: "bg-rose-400",
    description: "Soft rituals for skin and body",
  },
  Mindfulness: {
    emoji: "🧘🏽‍♀️",
    tint: "from-violet-100 to-purple-50 dark:from-violet-500/20 dark:to-indigo-400/10",
    ring: "bg-violet-400",
    description: "Meditation, breathwork, and quiet",
  },
  Movement: {
    emoji: "🌿",
    tint: "from-emerald-100 to-teal-50 dark:from-emerald-500/20 dark:to-teal-400/10",
    ring: "bg-emerald-400",
    description: "Walks, stretching, and gentle energy",
  },
  Rest: {
    emoji: "🌙",
    tint: "from-indigo-100 to-violet-50 dark:from-indigo-500/20 dark:to-violet-400/10",
    ring: "bg-indigo-400",
    description: "Sleep, recovery, and cozy pauses",
  },
  Creativity: {
    emoji: "📖",
    tint: "from-amber-100 to-orange-50 dark:from-amber-500/20 dark:to-orange-400/10",
    ring: "bg-amber-400",
    description: "Reading, journaling, and making",
  },
  Connection: {
    emoji: "💌",
    tint: "from-fuchsia-100 to-rose-50 dark:from-fuchsia-500/20 dark:to-rose-400/10",
    ring: "bg-fuchsia-400",
    description: "Kind messages and nourishing support",
  },
};

const MOODS: Array<{ value: MoodValue; emoji: string; label: string; tone: string }> = [
  { value: 1, emoji: "😔", label: "Low", tone: "from-slate-200 to-violet-100" },
  { value: 2, emoji: "😌", label: "Tender", tone: "from-purple-100 to-violet-100" },
  { value: 3, emoji: "🙂", label: "Steady", tone: "from-amber-50 to-amber-100" },
  { value: 4, emoji: "😊", label: "Light", tone: "from-pink-100 to-rose-100" },
  { value: 5, emoji: "🥰", label: "Glowing", tone: "from-fuchsia-100 to-pink-100" },
];

const QUOTES = [
  "Small rituals count. Your nervous system notices every soft choice.",
  "You are allowed to be cared for by the life you are building.",
  "Choose the version of self-care that feels possible, not perfect.",
  "Gentleness is productive when your body has been asking for rest.",
  "One mindful breath can turn the whole day toward you.",
];

const AFFIRMATIONS = [
  "I can take up space and still move gently.",
  "My needs are worthy of time on my calendar.",
  "Rest is a ritual, not a reward.",
  "I listen to my mood without judging it.",
  "Care is something I practice in small beautiful ways.",
];

const RITUAL_TEMPLATES: ActivityForm[] = [
  {
    title: "Skincare Night",
    category: "Skincare",
    date: toDateKey(new Date()),
    time: "20:30",
    duration: 35,
    beforeMood: 2,
    afterMood: undefined,
    reminder: true,
    notes: "Cleanse, mask, serum, moisturizer, and no rushing.",
  },
  {
    title: "Journaling",
    category: "Creativity",
    date: toDateKey(new Date()),
    time: "21:15",
    duration: 20,
    beforeMood: 3,
    afterMood: undefined,
    reminder: true,
    notes: "Three pages or three honest sentences.",
  },
  {
    title: "Meditation",
    category: "Mindfulness",
    date: toDateKey(new Date()),
    time: "07:45",
    duration: 12,
    beforeMood: 2,
    afterMood: undefined,
    reminder: true,
    notes: "Breathe slowly and soften your shoulders.",
  },
  {
    title: "Rest Day",
    category: "Rest",
    date: toDateKey(new Date()),
    time: "18:00",
    duration: 60,
    beforeMood: 1,
    afterMood: undefined,
    reminder: true,
    notes: "Clear the evening and protect the quiet.",
  },
];

const CARE_SUGGESTIONS: Record<
  MoodValue,
  Array<{ title: string; category: ActivityCategory; duration: number; reason: string }>
> = {
  1: [
    {
      title: "Comfort Reset",
      category: "Rest",
      duration: 25,
      reason: "Low moods often respond to warmth, water, and zero pressure.",
    },
    {
      title: "Tiny Walk",
      category: "Movement",
      duration: 10,
      reason: "A short outside loop can create a gentle mood lift without draining you.",
    },
  ],
  2: [
    {
      title: "Soft Journaling",
      category: "Creativity",
      duration: 15,
      reason: "Tender feelings need language before they need a solution.",
    },
    {
      title: "Body Scan Meditation",
      category: "Mindfulness",
      duration: 12,
      reason: "A slow body scan helps your mind feel safely held.",
    },
  ],
  3: [
    {
      title: "Skincare Night",
      category: "Skincare",
      duration: 30,
      reason: "A steady mood is a beautiful time for a sensory ritual.",
    },
    {
      title: "Reading Nook",
      category: "Creativity",
      duration: 25,
      reason: "Reading keeps the calm going without asking for too much energy.",
    },
  ],
  4: [
    {
      title: "Sunset Walk",
      category: "Movement",
      duration: 30,
      reason: "Use the light mood for nourishing movement and fresh air.",
    },
    {
      title: "Gratitude Note",
      category: "Connection",
      duration: 10,
      reason: "Sharing appreciation can amplify an already bright mood.",
    },
  ],
  5: [
    {
      title: "Creative Flow",
      category: "Creativity",
      duration: 45,
      reason: "Glowing energy is perfect for expressive, playful care.",
    },
    {
      title: "Spa Day Planning",
      category: "Skincare",
      duration: 40,
      reason: "A high mood can help you design a ritual future-you will love.",
    },
  ],
};

const SCREEN_META: Array<{ id: Screen; label: string; icon: IconName }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "add", label: "Add", icon: "plus" },
  { id: "mood", label: "Mood", icon: "heart" },
  { id: "insights", label: "Insights", icon: "chart" },
  { id: "profile", label: "Profile", icon: "user" },
];

const screenMotion = {
  initial: { opacity: 0, y: 18, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(8px)" },
};

export default function App() {
  const [data, setData] = useState<TreatYourselfData>(() => loadData());
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [careOpen, setCareOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", data.theme === "dark");
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
    const isIos =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigatorWithStandalone.platform === "MacIntel" && navigatorWithStandalone.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || Boolean(navigatorWithStandalone.standalone);

    setShowIosBanner(
      Boolean(isIos && !isStandalone && localStorage.getItem(IOS_BANNER_KEY) !== "true")
    );
  }, []);

  const todayKey = toDateKey(new Date());
  const sortedActivities = useMemo(() => sortActivities(data.activities), [data.activities]);
  const todayActivities = useMemo(
    () => sortedActivities.filter((activity) => activity.date === todayKey),
    [sortedActivities, todayKey]
  );
  const upcomingReminders = useMemo(() => getUpcomingReminders(sortedActivities), [sortedActivities]);
  const latestMood = useMemo(() => getLatestMood(data.moodEntries), [data.moodEntries]);
  const stats = useMemo(() => getWellnessStats(data), [data]);
  const insights = useMemo(() => getActivityInsights(data.activities), [data.activities]);
  const editingActivity = editingId ? data.activities.find((activity) => activity.id === editingId) : undefined;
  const dailyQuote = QUOTES[new Date().getDate() % QUOTES.length];

  const updateTheme = () => {
    setData((current) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" }));
  };

  const addActivity = (form: ActivityForm) => {
    const newActivity: Activity = {
      ...form,
      id: createId("activity"),
      title: form.title.trim(),
      notes: form.notes.trim(),
      duration: Number(form.duration) || 30,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      activities: [...current.activities, newActivity],
      moodEntries: [...current.moodEntries, ...activityMoodEntries(newActivity)],
    }));
    setEditingId(null);
    setActiveScreen("calendar");
  };

  const updateActivity = (id: string, form: ActivityForm) => {
    setData((current) => {
      let updatedActivity: Activity | undefined;
      const activities = current.activities.map((activity) => {
        if (activity.id !== id) return activity;
        updatedActivity = {
          ...activity,
          ...form,
          title: form.title.trim(),
          notes: form.notes.trim(),
          duration: Number(form.duration) || 30,
        };
        return updatedActivity;
      });

      return {
        ...current,
        activities,
        moodEntries: [
          ...current.moodEntries.filter((entry) => entry.activityId !== id),
          ...(updatedActivity ? activityMoodEntries(updatedActivity) : []),
        ],
      };
    });
    setEditingId(null);
    setActiveScreen("calendar");
  };

  const deleteActivity = (id: string) => {
    setData((current) => ({
      ...current,
      activities: current.activities.filter((activity) => activity.id !== id),
      moodEntries: current.moodEntries.filter((entry) => entry.activityId !== id),
    }));
    if (editingId === id) setEditingId(null);
  };

  const toggleActivityComplete = (id: string) => {
    setData((current) => ({
      ...current,
      activities: current.activities.map((activity) =>
        activity.id === id ? { ...activity, completed: !activity.completed } : activity
      ),
    }));
  };

  const setActivityMood = (id: string, phase: Exclude<MoodSource, "manual">, mood: MoodValue) => {
    setData((current) => {
      const activity = current.activities.find((item) => item.id === id);
      if (!activity) return current;

      const activities = current.activities.map((item) =>
        item.id === id ? { ...item, [phase === "before" ? "beforeMood" : "afterMood"]: mood } : item
      );

      const moodEntry: MoodEntry = {
        id: createId("mood"),
        date: activity.date,
        mood,
        note: `${phase === "before" ? "Before" : "After"} ${activity.title}`,
        source: phase,
        activityId: id,
        label: activity.title,
        createdAt: new Date().toISOString(),
      };

      return {
        ...current,
        activities,
        moodEntries: [
          ...current.moodEntries.filter((entry) => !(entry.activityId === id && entry.source === phase)),
          moodEntry,
        ],
      };
    });
  };

  const addMoodEntry = (mood: MoodValue, note: string) => {
    setData((current) => ({
      ...current,
      moodEntries: [
        ...current.moodEntries,
        {
          id: createId("mood"),
          date: todayKey,
          mood,
          note: note.trim() || "Mood check-in",
          source: "manual",
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const scheduleSuggestion = (suggestion: { title: string; category: ActivityCategory; duration: number }) => {
    addActivity({
      title: suggestion.title,
      category: suggestion.category,
      date: todayKey,
      time: getNextHourTime(),
      duration: suggestion.duration,
      beforeMood: latestMood?.mood,
      afterMood: undefined,
      reminder: true,
      notes: "Suggested by the I Need Care button.",
    });
    setCareOpen(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const dismissIosBanner = () => {
    localStorage.setItem(IOS_BANNER_KEY, "true");
    setShowIosBanner(false);
  };

  const startOnboarding = () => {
    setData((current) => ({ ...current, onboarded: true }));
    setActiveScreen("home");
  };

  const resetLocalData = () => {
    setData({ ...createDefaultData(), onboarded: true, theme: data.theme });
    setEditingId(null);
    setActiveScreen("home");
  };

  const openAddScreen = () => {
    setEditingId(null);
    setActiveScreen("add");
  };

  const openEditScreen = (activity: Activity) => {
    setEditingId(activity.id);
    setActiveScreen("add");
  };

  if (!data.onboarded) {
    return (
      <OnboardingScreen
        theme={data.theme}
        onToggleTheme={updateTheme}
        onStart={startOnboarding}
        canInstall={Boolean(deferredPrompt)}
        onInstall={handleInstall}
        showIosBanner={showIosBanner}
        onDismissIosBanner={dismissIosBanner}
      />
    );
  }

  return (
    <AppShell
      activeScreen={activeScreen}
      setActiveScreen={(screen) => {
        if (screen !== "add") setEditingId(null);
        if (screen === "add") openAddScreen();
        else setActiveScreen(screen);
      }}
      theme={data.theme}
      onToggleTheme={updateTheme}
      canInstall={Boolean(deferredPrompt)}
      onInstall={handleInstall}
      showIosBanner={showIosBanner}
      onDismissIosBanner={dismissIosBanner}
      upcomingReminder={upcomingReminders[0]}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeScreen}
          variants={screenMotion}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeScreen === "home" && (
            <HomeDashboard
              todayActivities={todayActivities}
              upcomingReminders={upcomingReminders}
              latestMood={latestMood}
              stats={stats}
              quote={dailyQuote}
              onNeedCare={() => setCareOpen(true)}
              onAddActivity={openAddScreen}
              onEditActivity={openEditScreen}
              onDeleteActivity={deleteActivity}
              onToggleComplete={toggleActivityComplete}
              onSetActivityMood={setActivityMood}
              onGoToMood={() => setActiveScreen("mood")}
            />
          )}

          {activeScreen === "calendar" && (
            <CalendarScreen
              activities={sortedActivities}
              onAddActivity={openAddScreen}
              onEditActivity={openEditScreen}
              onDeleteActivity={deleteActivity}
              onToggleComplete={toggleActivityComplete}
              onSetActivityMood={setActivityMood}
            />
          )}

          {activeScreen === "add" && (
            <AddActivityScreen
              editingActivity={editingActivity}
              onCancel={() => {
                setEditingId(null);
                setActiveScreen("calendar");
              }}
              onCreate={addActivity}
              onUpdate={updateActivity}
            />
          )}

          {activeScreen === "mood" && (
            <MoodTrackerScreen
              activities={sortedActivities}
              moodEntries={data.moodEntries}
              latestMood={latestMood}
              onAddMood={addMoodEntry}
              onSetActivityMood={setActivityMood}
              onNeedCare={() => setCareOpen(true)}
            />
          )}

          {activeScreen === "insights" && (
            <InsightsScreen
              activities={sortedActivities}
              moodEntries={data.moodEntries}
              stats={stats}
              insights={insights}
            />
          )}

          {activeScreen === "profile" && (
            <ProfileScreen
              theme={data.theme}
              stats={stats}
              latestMood={latestMood}
              affirmation={AFFIRMATIONS[new Date().getDay() % AFFIRMATIONS.length]}
              canInstall={Boolean(deferredPrompt)}
              onInstall={handleInstall}
              onToggleTheme={updateTheme}
              onResetOnboarding={() => setData((current) => ({ ...current, onboarded: false }))}
              onResetData={resetLocalData}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <CareSuggestionModal
        open={careOpen}
        latestMood={latestMood}
        onClose={() => setCareOpen(false)}
        onSchedule={scheduleSuggestion}
      />
    </AppShell>
  );
}

function OnboardingScreen({
  theme,
  onToggleTheme,
  onStart,
  canInstall,
  onInstall,
  showIosBanner,
  onDismissIosBanner,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onStart: () => void;
  canInstall: boolean;
  onInstall: () => void;
  showIosBanner: boolean;
  onDismissIosBanner: () => void;
}) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fbf7f1] text-[#201729] dark:bg-[#130f1f] dark:text-white">
      <BackgroundOrbs />
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 md:grid md:grid-cols-[1fr_0.9fr] md:items-center md:gap-10 md:px-10">
        <div className="mb-5 flex items-center justify-between md:absolute md:left-10 md:right-10 md:top-8">
          <BrandLockup />
          <button
            type="button"
            onClick={onToggleTheme}
            className="glass-button h-11 w-11"
            aria-label="Toggle color mode"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" />
          </button>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="order-2 pb-10 pt-4 md:order-1 md:pt-20"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-violet-500 dark:text-violet-300">
            Welcome, Rita
          </p>
          <h1 className="mt-4 max-w-2xl text-5xl font-black leading-[0.92] tracking-[-0.08em] text-[#1c1423] dark:text-white md:text-7xl">
            Treat Yourself
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[#6f6179] dark:text-violet-100/78">
            A premium self-care planner for rituals, mood check-ins, reminders, and gentle insights that help Rita feel cared for every day.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <motion.button
              type="button"
              onClick={onStart}
              whileTap={{ scale: 0.98 }}
              whileHover={{ y: -2 }}
              className="primary-button h-14 px-7 text-base"
            >
              Get Started
              <Icon name="sparkle" className="h-5 w-5" />
            </motion.button>
            {canInstall && (
              <button type="button" onClick={onInstall} className="secondary-button h-14 px-7 text-base">
                Install App
                <Icon name="download" className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {[
              ["Mood lift", "+22%"],
              ["Rituals", "7 days"],
              ["Offline", "Ready"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.6rem] bg-white/60 p-4 shadow-soft ring-1 ring-white/80 backdrop-blur-xl dark:bg-white/8 dark:ring-white/10">
                <p className="text-xl font-black tracking-tight text-[#21162d] dark:text-white">{value}</p>
                <p className="mt-1 text-xs font-semibold text-[#8a7b91] dark:text-violet-100/60">{label}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="order-1 mx-auto w-full max-w-sm pt-3 md:order-2 md:pt-20"
        >
          <div className="relative overflow-hidden rounded-[2.4rem] bg-white/70 p-4 shadow-[0_28px_90px_rgba(133,90,218,0.26)] ring-1 ring-white/80 backdrop-blur-2xl dark:bg-white/10 dark:ring-white/10">
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, -1, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-[2rem] bg-gradient-to-br from-[#f8dbe0] via-[#eee3ff] to-[#fff8ec] p-5 dark:from-violet-500/20 dark:via-fuchsia-500/10 dark:to-amber-400/10"
            >
              <WellnessIllustration />
            </motion.div>
            <div className="px-3 pb-4 pt-5 text-center">
              <h2 className="text-3xl font-black tracking-[-0.05em]">Take care of yourself today, Rita ✨</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#827389] dark:text-violet-100/66">
                Plan rituals, check your mood, and discover what helps you feel better.
              </p>
              <div className="mt-5 flex justify-center gap-1.5">
                <span className="h-2 w-6 rounded-full bg-violet-500" />
                <span className="h-2 w-2 rounded-full bg-violet-200" />
                <span className="h-2 w-2 rounded-full bg-violet-200" />
              </div>
            </div>
          </div>
        </motion.section>

        {showIosBanner && (
          <div className="md:col-span-2">
            <IosInstallBanner onDismiss={onDismissIosBanner} />
          </div>
        )}
      </main>
    </div>
  );
}

function AppShell({
  activeScreen,
  setActiveScreen,
  theme,
  onToggleTheme,
  canInstall,
  onInstall,
  showIosBanner,
  onDismissIosBanner,
  upcomingReminder,
  children,
}: {
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  canInstall: boolean;
  onInstall: () => void;
  showIosBanner: boolean;
  onDismissIosBanner: () => void;
  upcomingReminder?: Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fbf7f1] text-[#201729] dark:bg-[#130f1f] dark:text-white">
      <BackgroundOrbs />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl md:p-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-72 shrink-0 flex-col rounded-[2.2rem] bg-white/55 p-4 shadow-soft ring-1 ring-white/70 backdrop-blur-2xl dark:bg-white/[0.07] dark:ring-white/10 md:flex">
          <div className="flex items-center justify-between p-2">
            <BrandLockup />
            <button type="button" onClick={onToggleTheme} className="glass-button h-11 w-11" aria-label="Toggle color mode">
              <Icon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-7 space-y-2">
            {SCREEN_META.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={activeScreen === item.id}
                onClick={() => setActiveScreen(item.id)}
                desktop
              />
            ))}
          </nav>

          <div className="mt-auto space-y-3 rounded-[1.8rem] bg-gradient-to-br from-violet-500 to-fuchsia-400 p-5 text-white shadow-[0_20px_55px_rgba(139,92,246,0.32)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Affirmation</p>
            <p className="text-lg font-bold leading-7">Rest is part of the plan, Rita.</p>
            {canInstall && (
              <button
                type="button"
                onClick={onInstall}
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-violet-600"
              >
                <Icon name="download" className="h-4 w-4" />
                Install app
              </button>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-28 md:pb-0">
          <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-2">
            {showIosBanner && <IosInstallBanner onDismiss={onDismissIosBanner} />}
            {upcomingReminder && <ReminderNotice activity={upcomingReminder} />}
            {children}
          </div>
        </main>
      </div>

      <BottomNavigation activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
    </div>
  );
}

function HomeDashboard({
  todayActivities,
  upcomingReminders,
  latestMood,
  stats,
  quote,
  onNeedCare,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onToggleComplete,
  onSetActivityMood,
  onGoToMood,
}: {
  todayActivities: Activity[];
  upcomingReminders: Activity[];
  latestMood?: MoodEntry;
  stats: WellnessStats;
  quote: string;
  onNeedCare: () => void;
  onAddActivity: () => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onSetActivityMood: (id: string, phase: Exclude<MoodSource, "manual">, mood: MoodValue) => void;
  onGoToMood: () => void;
}) {
  const moodMeta = latestMood ? getMoodMeta(latestMood.mood) : undefined;

  return (
    <div className="space-y-5">
      <ScreenHeader
        eyebrow="Treat Yourself"
        title="Good Morning, Rita 👋"
        subtitle={formatDate(toDateKey(new Date()), { weekday: "long", month: "long", day: "numeric" })}
        action={
          <button type="button" onClick={onAddActivity} className="glass-button h-11 w-11" aria-label="Add activity">
            <Icon name="plus" className="h-5 w-5" />
          </button>
        }
      />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.45 }}
        className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-[#f8dce4] via-[#eee0ff] to-[#fff9ed] p-5 shadow-soft ring-1 ring-white/80 dark:from-violet-500/22 dark:via-fuchsia-500/12 dark:to-amber-400/10 dark:ring-white/10"
      >
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/40 blur-2xl dark:bg-white/10" />
        <div className="relative grid gap-4 md:grid-cols-[1fr_220px] md:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-violet-500 dark:text-violet-200">Today is yours</p>
            <h2 className="mt-3 max-w-xl text-4xl font-black leading-[0.95] tracking-[-0.07em] text-[#21162d] dark:text-white md:text-5xl">
              A softer plan for Rita.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#75677e] dark:text-violet-100/70">{quote}</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onNeedCare} className="primary-button h-12 px-5">
                I Need Care
                <Icon name="sparkle" className="h-5 w-5" />
              </button>
              <button type="button" onClick={onGoToMood} className="secondary-button h-12 px-5">
                Check mood
                <span className="text-lg">{moodMeta?.emoji ?? "🙂"}</span>
              </button>
            </div>
          </div>
          <div className="hidden md:block">
            <WellnessIllustration compact />
          </div>
        </div>
      </motion.section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value={`${stats.completedToday}/${stats.plannedToday}`} caption="rituals done" icon="check" />
        <StatCard label="Mood" value={moodMeta ? moodMeta.label : "Open"} caption={moodMeta ? moodMeta.emoji : "tap to log"} icon="heart" onClick={onGoToMood} />
        <StatCard label="Streak" value={`${stats.streak}d`} caption="care days" icon="sparkle" />
        <StatCard label="Mood lift" value={`${stats.averageLift > 0 ? "+" : ""}${stats.averageLift.toFixed(1)}`} caption="avg after care" icon="chart" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-3">
          <SectionTitle title="Today's self-care" subtitle="Mood check-ins before and after each ritual." />
          {todayActivities.length > 0 ? (
            <div className="space-y-3">
              {todayActivities.map((activity, index) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  index={index}
                  onEdit={() => onEditActivity(activity)}
                  onDelete={() => onDeleteActivity(activity.id)}
                  onToggleComplete={() => onToggleComplete(activity.id)}
                  onSetMood={onSetActivityMood}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No rituals yet today"
              text="Schedule something kind and lightweight for Rita."
              buttonLabel="Add activity"
              onClick={onAddActivity}
            />
          )}
        </div>

        <div className="space-y-3">
          <SectionTitle title="Upcoming reminders" subtitle="Gentle nudges for your next sessions." />
          <div className="space-y-3">
            {upcomingReminders.slice(0, 4).map((activity) => (
              <ReminderMini key={activity.id} activity={activity} />
            ))}
            {upcomingReminders.length === 0 && (
              <div className="premium-card p-5 text-sm text-[#7c6d84] dark:text-violet-100/65">
                No reminders are coming up. Add a ritual with reminders turned on.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function CalendarScreen({
  activities,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onToggleComplete,
  onSetActivityMood,
}: {
  activities: Activity[];
  onAddActivity: () => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onSetActivityMood: (id: string, phase: Exclude<MoodSource, "manual">, mood: MoodValue) => void;
}) {
  const [view, setView] = useState<CalendarView>("day");
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ActivityCategory | "All">("All");
  const filteredActivities = useMemo(
    () => filterActivities(activities, search, category),
    [activities, search, category]
  );
  const visibleActivities = getActivitiesForView(filteredActivities, selectedDate, view);

  return (
    <div className="space-y-5">
      <ScreenHeader
        eyebrow="Calendar"
        title="Self-care calendar"
        subtitle="Daily, weekly, and monthly views for Rita's care plan."
        action={
          <button type="button" onClick={onAddActivity} className="primary-icon-button" aria-label="Add activity">
            <Icon name="plus" className="h-5 w-5" />
          </button>
        }
      />

      <div className="premium-card space-y-4 p-4">
        <div className="flex rounded-full bg-white/55 p-1 ring-1 ring-black/5 dark:bg-white/8 dark:ring-white/10">
          {(["day", "week", "month"] as CalendarView[]).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setView(item)}
              className={cn(
                "relative flex-1 rounded-full px-3 py-2 text-sm font-black capitalize transition",
                view === item ? "text-white" : "text-[#8a7b91] dark:text-violet-100/58"
              )}
            >
              {view === item && (
                <motion.span
                  layoutId="calendar-view-pill"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 shadow-lg shadow-violet-500/25"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative">{item}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative block">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b8aa4]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rituals"
              className="input-field pl-11"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as ActivityCategory | "All")}
            className="input-field"
          >
            <option value="All">All categories</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">
        <CalendarPanel
          view={view}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          activities={filteredActivities}
        />

        <div className="space-y-3">
          <SectionTitle
            title={view === "month" ? "Selected rituals" : `${capitalize(view)} plan`}
            subtitle={formatDate(selectedDate, { weekday: "long", month: "short", day: "numeric" })}
          />
          {visibleActivities.length ? (
            <div className="space-y-3">
              {visibleActivities.map((activity, index) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  index={index}
                  compact
                  onEdit={() => onEditActivity(activity)}
                  onDelete={() => onDeleteActivity(activity.id)}
                  onToggleComplete={() => onToggleComplete(activity.id)}
                  onSetMood={onSetActivityMood}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="This space is open"
              text="No rituals match this view yet."
              buttonLabel="Schedule care"
              onClick={onAddActivity}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarPanel({
  view,
  selectedDate,
  setSelectedDate,
  activities,
}: {
  view: CalendarView;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  activities: Activity[];
}) {
  const weekDays = getWeekDays(selectedDate);
  const monthDays = getMonthGrid(selectedDate);
  const selectedMonth = fromDateKey(selectedDate).getMonth();

  return (
    <div className="premium-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" className="glass-button h-10 w-10" onClick={() => setSelectedDate(shiftDate(selectedDate, view, -1))}>
          <Icon name="chevron" className="h-5 w-5 rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-500 dark:text-violet-300">{view} view</p>
          <h3 className="text-xl font-black tracking-[-0.04em]">
            {view === "month"
              ? formatDate(selectedDate, { month: "long", year: "numeric" })
              : formatDate(selectedDate, { month: "long", day: "numeric" })}
          </h3>
        </div>
        <button type="button" className="glass-button h-10 w-10" onClick={() => setSelectedDate(shiftDate(selectedDate, view, 1))}>
          <Icon name="chevron" className="h-5 w-5" />
        </button>
      </div>

      {view === "day" && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const isSelected = day === selectedDate;
            const count = activities.filter((activity) => activity.date === day).length;
            return (
              <button
                type="button"
                key={day}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "min-h-[5.3rem] rounded-[1.25rem] p-2 text-center transition",
                  isSelected
                    ? "bg-gradient-to-b from-violet-500 to-fuchsia-400 text-white shadow-lg shadow-violet-500/25"
                    : "bg-white/58 text-[#776981] ring-1 ring-black/5 hover:bg-white dark:bg-white/8 dark:text-violet-100/65 dark:ring-white/10"
                )}
              >
                <p className="text-[0.65rem] font-bold uppercase">{formatDate(day, { weekday: "short" })}</p>
                <p className="mt-2 text-xl font-black">{formatDate(day, { day: "numeric" })}</p>
                <div className="mt-2 flex justify-center gap-1">
                  {Array.from({ length: Math.min(count, 3) }).map((_, index) => (
                    <span key={index} className={cn("h-1.5 w-1.5 rounded-full", isSelected ? "bg-white" : "bg-violet-400")} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {view === "week" && (
        <div className="space-y-3">
          {weekDays.map((day) => {
            const dayActivities = activities.filter((activity) => activity.date === day);
            const completed = dayActivities.filter((activity) => activity.completed).length;
            const percent = dayActivities.length ? Math.round((completed / dayActivities.length) * 100) : 0;
            return (
              <button
                type="button"
                key={day}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "w-full rounded-[1.35rem] p-3 text-left transition",
                  day === selectedDate
                    ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                    : "bg-white/58 ring-1 ring-black/5 dark:bg-white/8 dark:ring-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">{formatDate(day, { weekday: "long" })}</p>
                    <p className={cn("text-xs", day === selectedDate ? "text-white/70" : "text-[#8f8098] dark:text-violet-100/55")}>{formatDate(day, { month: "short", day: "numeric" })}</p>
                  </div>
                  <span className="text-sm font-black">{dayActivities.length} rituals</span>
                </div>
                <div className={cn("mt-3 h-2 rounded-full", day === selectedDate ? "bg-white/25" : "bg-violet-100 dark:bg-white/10")}>
                  <div className="h-full rounded-full bg-gradient-to-r from-rose-300 to-fuchsia-300" style={{ width: `${percent}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {view === "month" && (
        <>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#9c8aa5] dark:text-violet-100/45">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthDays.map((day) => {
              const count = activities.filter((activity) => activity.date === day).length;
              const isSelected = day === selectedDate;
              const isCurrentMonth = fromDateKey(day).getMonth() === selectedMonth;
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square rounded-[1rem] p-1.5 text-left transition",
                    isSelected
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-400 text-white shadow-lg shadow-violet-500/25"
                      : "bg-white/55 ring-1 ring-black/5 hover:bg-white dark:bg-white/8 dark:ring-white/10",
                    !isCurrentMonth && !isSelected && "opacity-35"
                  )}
                >
                  <span className="text-xs font-black">{formatDate(day, { day: "numeric" })}</span>
                  <div className="mt-1 flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, index) => (
                      <span key={index} className={cn("h-1 w-1 rounded-full", isSelected ? "bg-white" : "bg-fuchsia-400")} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function AddActivityScreen({
  editingActivity,
  onCancel,
  onCreate,
  onUpdate,
}: {
  editingActivity?: Activity;
  onCancel: () => void;
  onCreate: (form: ActivityForm) => void;
  onUpdate: (id: string, form: ActivityForm) => void;
}) {
  const [form, setForm] = useState<ActivityForm>(() => activityToForm(editingActivity));

  useEffect(() => {
    setForm(activityToForm(editingActivity));
  }, [editingActivity?.id]);

  const canSave = form.title.trim().length > 0 && form.date && form.time;

  const submitForm = () => {
    if (!canSave) return;
    if (editingActivity) onUpdate(editingActivity.id, form);
    else onCreate(form);
  };

  return (
    <div className="space-y-5">
      <ScreenHeader
        eyebrow={editingActivity ? "Edit Activity" : "Add Activity"}
        title={editingActivity ? "Refine this ritual" : "Schedule a ritual"}
        subtitle="Build a care session with mood check-ins and reminders."
        action={
          <button type="button" onClick={onCancel} className="glass-button h-11 w-11" aria-label="Cancel">
            <Icon name="x" className="h-5 w-5" />
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
          className="premium-card space-y-5 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            submitForm();
          }}
        >
          <label className="space-y-2">
            <span className="field-label">Activity name</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Spa Day, Reading, Walks..."
              className="input-field"
            />
          </label>

          <div className="space-y-3">
            <span className="field-label">Category</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((category) => (
                <button
                  type="button"
                  key={category}
                  onClick={() => setForm({ ...form, category })}
                  className={cn(
                    "rounded-[1.4rem] p-3 text-left ring-1 transition",
                    form.category === category
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-400 text-white shadow-lg shadow-violet-500/20 ring-transparent"
                      : "bg-white/55 text-[#6f6179] ring-black/5 hover:bg-white dark:bg-white/8 dark:text-violet-100/70 dark:ring-white/10"
                  )}
                >
                  <span className="text-xl">{CATEGORY_META[category].emoji}</span>
                  <p className="mt-2 text-sm font-black">{category}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2">
              <span className="field-label">Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                className="input-field"
              />
            </label>
            <label className="space-y-2">
              <span className="field-label">Time</span>
              <input
                type="time"
                value={form.time}
                onChange={(event) => setForm({ ...form, time: event.target.value })}
                className="input-field"
              />
            </label>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="space-y-2">
              <span className="field-label">Duration</span>
              <input
                type="number"
                min={5}
                max={240}
                value={form.duration}
                onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })}
                className="input-field"
              />
            </label>
            <label className="mt-7 flex h-12 items-center gap-3 rounded-full bg-white/55 px-4 text-sm font-black ring-1 ring-black/5 dark:bg-white/8 dark:ring-white/10">
              <input
                type="checkbox"
                checked={form.reminder}
                onChange={(event) => setForm({ ...form, reminder: event.target.checked })}
                className="accent-violet-500"
              />
              Reminder
            </label>
          </div>

          <label className="space-y-2">
            <span className="field-label">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="What would make this feel extra caring?"
              className="input-field min-h-28 resize-none rounded-[1.5rem] py-4"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="field-label">Before mood</span>
              <MoodPicker value={form.beforeMood} onChange={(mood) => setForm({ ...form, beforeMood: mood })} compact />
            </div>
            <div className="space-y-2">
              <span className="field-label">After mood</span>
              <MoodPicker value={form.afterMood} onChange={(mood) => setForm({ ...form, afterMood: mood })} compact />
            </div>
          </div>

          <button type="submit" disabled={!canSave} className="primary-button h-14 w-full disabled:cursor-not-allowed disabled:opacity-50">
            {editingActivity ? "Save changes" : "Schedule ritual"}
            <Icon name="check" className="h-5 w-5" />
          </button>
        </motion.form>

        <div className="space-y-4">
          <SectionTitle title="Soft templates" subtitle="Tap one to prefill a ritual Rita might need." />
          <div className="grid gap-3">
            {RITUAL_TEMPLATES.map((template) => (
              <button
                type="button"
                key={template.title}
                onClick={() => setForm({ ...template, date: form.date, time: template.time })}
                className="premium-card group p-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-xl", CATEGORY_META[template.category].tint)}>
                    {CATEGORY_META[template.category].emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black tracking-[-0.02em]">{template.title}</p>
                    <p className="mt-1 text-xs font-semibold text-[#8d7f96] dark:text-violet-100/55">
                      {template.duration} min · {template.category}
                    </p>
                  </div>
                  <Icon name="chevron" className="h-5 w-5 text-violet-400 transition group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-[1.8rem] bg-[#201729] p-5 text-white shadow-soft dark:bg-white/10">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-200">Reminder system</p>
            <p className="mt-2 text-sm leading-6 text-white/76">
              Treat Yourself stores upcoming self-care reminders locally and highlights the next session on your dashboard, even when offline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoodTrackerScreen({
  activities,
  moodEntries,
  latestMood,
  onAddMood,
  onSetActivityMood,
  onNeedCare,
}: {
  activities: Activity[];
  moodEntries: MoodEntry[];
  latestMood?: MoodEntry;
  onAddMood: (mood: MoodValue, note: string) => void;
  onSetActivityMood: (id: string, phase: Exclude<MoodSource, "manual">, mood: MoodValue) => void;
  onNeedCare: () => void;
}) {
  const [selectedMood, setSelectedMood] = useState<MoodValue>(latestMood?.mood ?? 3);
  const [note, setNote] = useState("");
  const pendingActivities = activities
    .filter((activity) => activity.date >= toDateKey(addDays(new Date(), -2)) && (!activity.beforeMood || !activity.afterMood))
    .slice(0, 4);

  const saveMood = () => {
    onAddMood(selectedMood, note);
    setNote("");
  };

  return (
    <div className="space-y-5">
      <ScreenHeader
        eyebrow="Mood Tracker"
        title="How are you feeling, Rita?"
        subtitle="Capture mood history before and after self-care."
        action={
          <button type="button" onClick={onNeedCare} className="primary-icon-button" aria-label="I Need Care">
            <Icon name="sparkle" className="h-5 w-5" />
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="premium-card space-y-5 p-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-500 dark:text-violet-300">Check in</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">Choose today's mood</h2>
          </div>
          <MoodPicker value={selectedMood} onChange={setSelectedMood} />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="A few words about what Rita needs..."
            className="input-field min-h-28 resize-none rounded-[1.5rem] py-4"
          />
          <button type="button" onClick={saveMood} className="primary-button h-14 w-full">
            Save mood
            <Icon name="heart" className="h-5 w-5" />
          </button>
        </section>

        <section className="premium-card p-5">
          <SectionTitle title="Mood over time" subtitle="Recent history from local check-ins." />
          <div className="mt-4">
            <MoodLineChart entries={moodEntries} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatMini label="Entries" value={String(moodEntries.length)} />
            <StatMini label="Average" value={getAverageMoodLabel(moodEntries)} />
            <StatMini label="Latest" value={latestMood ? getMoodMeta(latestMood.mood).emoji : "-"} />
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <SectionTitle title="Before and after" subtitle="Complete mood check-ins for scheduled rituals." />
        {pendingActivities.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {pendingActivities.map((activity) => (
              <div key={activity.id} className="premium-card p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-xl", CATEGORY_META[activity.category].tint)}>
                    {CATEGORY_META[activity.category].emoji}
                  </div>
                  <div>
                    <p className="font-black tracking-[-0.02em]">{activity.title}</p>
                    <p className="mt-1 text-xs font-bold text-[#93849b] dark:text-violet-100/55">
                      {formatDate(activity.date, { month: "short", day: "numeric" })} at {formatTime(activity.time)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <MiniMoodRow label="Before" value={activity.beforeMood} onChange={(mood) => onSetActivityMood(activity.id, "before", mood)} />
                  <MiniMoodRow label="After" value={activity.afterMood} onChange={(mood) => onSetActivityMood(activity.id, "after", mood)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="premium-card p-5 text-sm text-[#7c6d84] dark:text-violet-100/65">
            All recent rituals have mood check-ins. Beautiful consistency, Rita.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="Mood history" subtitle="Your most recent local entries." />
        <div className="space-y-3">
          {[...moodEntries]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 8)
            .map((entry) => {
              const mood = getMoodMeta(entry.mood);
              return (
                <div key={entry.id} className="premium-card flex items-center gap-3 p-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-xl dark:bg-violet-500/20">{mood.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black tracking-[-0.02em]">{entry.label ?? mood.label}</p>
                    <p className="truncate text-sm text-[#8a7b91] dark:text-violet-100/55">{entry.note}</p>
                  </div>
                  <p className="text-right text-xs font-bold text-[#9a8ba2] dark:text-violet-100/45">
                    {formatDate(entry.date, { month: "short", day: "numeric" })}
                  </p>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function InsightsScreen({
  activities,
  moodEntries,
  stats,
  insights,
}: {
  activities: Activity[];
  moodEntries: MoodEntry[];
  stats: WellnessStats;
  insights: ActivityInsight[];
}) {
  const categoryTotals = CATEGORIES.map((category) => ({
    category,
    total: activities.filter((activity) => activity.category === category).length,
    completed: activities.filter((activity) => activity.category === category && activity.completed).length,
  }));
  const topInsight = insights[0];

  return (
    <div className="space-y-5">
      <ScreenHeader
        eyebrow="Insights"
        title="Wellness analytics"
        subtitle="Personalized patterns from Rita's local care data."
      />

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="premium-card p-5">
          <div className="flex items-center gap-4">
            <ProgressRing percent={stats.completionRate} label="Care score" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-500 dark:text-violet-300">Progress</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">{stats.completionRate}% complete</h2>
              <p className="mt-2 text-sm leading-6 text-[#7f7088] dark:text-violet-100/62">
                {stats.completedTotal} of {stats.plannedTotal} rituals completed.
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatMini label="Avg mood" value={getAverageMoodLabel(moodEntries)} />
            <StatMini label="Streak" value={`${stats.streak} days`} />
            <StatMini label="Mood lift" value={`${stats.averageLift > 0 ? "+" : ""}${stats.averageLift.toFixed(1)}`} />
            <StatMini label="Reminders" value={String(stats.reminderCount)} />
          </div>
        </div>

        <div className="premium-card p-5">
          <SectionTitle title="Mood analytics" subtitle="How your check-ins are trending." />
          <div className="mt-4">
            <MoodLineChart entries={moodEntries} large />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="premium-card p-5">
          <SectionTitle title="Most effective self-care" subtitle="Activities that improve mood the most." />
          <div className="mt-5 space-y-4">
            {insights.length ? (
              insights.slice(0, 5).map((item, index) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-lg dark:bg-violet-500/20">
                        {CATEGORY_META[item.category].emoji}
                      </div>
                      <div>
                        <p className="font-black tracking-[-0.02em]">{item.label}</p>
                        <p className="text-xs font-semibold text-[#97879f] dark:text-violet-100/50">{item.count} mood pairs</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-600 dark:bg-violet-500/20 dark:text-violet-100">
                      +{item.averageLift.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-violet-100 dark:bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (item.averageLift / 4) * 100)}%` }}
                      transition={{ delay: 0.1 + index * 0.06, duration: 0.7, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-[#7f7088] dark:text-violet-100/62">
                Add before and after moods to see which rituals help most.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] bg-gradient-to-br from-[#201729] to-[#5b3bbb] p-5 text-white shadow-soft">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-200">Personalized insight</p>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">
              {topInsight ? `${topInsight.label} helps Rita most.` : "Mood pairs unlock insights."}
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/72">
              {topInsight
                ? `${topInsight.label} has lifted your mood by an average of ${topInsight.averageLift.toFixed(1)} points. Keep it close on lower-energy days.`
                : "Track before and after moods for a few rituals to reveal your best self-care patterns."}
            </p>
          </div>

          <div className="premium-card p-5">
            <SectionTitle title="Category rhythm" subtitle="Where your rituals are going." />
            <div className="mt-5 space-y-3">
              {categoryTotals.map((item) => (
                <div key={item.category} className="flex items-center gap-3">
                  <div className={cn("h-3 w-3 rounded-full", CATEGORY_META[item.category].ring)} />
                  <p className="w-24 text-sm font-bold">{item.category}</p>
                  <div className="h-2 flex-1 rounded-full bg-violet-100 dark:bg-white/10">
                    <div
                      className={cn("h-full rounded-full", CATEGORY_META[item.category].ring)}
                      style={{ width: `${activities.length ? (item.total / activities.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-black text-[#7c6d84] dark:text-violet-100/60">{item.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProfileScreen({
  theme,
  stats,
  latestMood,
  affirmation,
  canInstall,
  onInstall,
  onToggleTheme,
  onResetOnboarding,
  onResetData,
}: {
  theme: ThemeMode;
  stats: WellnessStats;
  latestMood?: MoodEntry;
  affirmation: string;
  canInstall: boolean;
  onInstall: () => void;
  onToggleTheme: () => void;
  onResetOnboarding: () => void;
  onResetData: () => void;
}) {
  const latestMoodMeta = latestMood ? getMoodMeta(latestMood.mood) : undefined;

  return (
    <div className="space-y-5">
      <ScreenHeader eyebrow="Profile" title="Welcome back, Rita 💜" subtitle="Preferences, app install, and local wellness data." />

      <section className="premium-card overflow-hidden p-0">
        <div className="bg-gradient-to-br from-[#f8dce4] via-[#efe3ff] to-[#fff8ec] p-6 text-center dark:from-violet-500/25 dark:via-fuchsia-500/12 dark:to-amber-400/10">
          <ProfileAvatar />
          <h2 className="mt-4 text-3xl font-black tracking-[-0.05em]">Rita</h2>
          <p className="mt-1 text-sm font-semibold text-[#827389] dark:text-violet-100/60">Self-care curator</p>
          <div className="mx-auto mt-5 max-w-md rounded-[1.5rem] bg-white/58 p-4 text-sm leading-6 text-[#6f6179] ring-1 ring-white/80 backdrop-blur-xl dark:bg-white/8 dark:text-violet-100/72 dark:ring-white/10">
            “{affirmation}”
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rituals" value={String(stats.plannedTotal)} caption="planned locally" icon="calendar" />
        <StatCard label="Completed" value={`${stats.completionRate}%`} caption="care score" icon="check" />
        <StatCard label="Mood" value={latestMoodMeta?.label ?? "Open"} caption={latestMoodMeta?.emoji ?? "check in"} icon="heart" />
        <StatCard label="Streak" value={`${stats.streak}d`} caption="gentle days" icon="sparkle" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <SettingsRow
          icon={theme === "dark" ? "moon" : "sun"}
          title="Color mode"
          text={theme === "dark" ? "Dark lavender night" : "Light cream glow"}
          action={
            <button type="button" onClick={onToggleTheme} className="toggle-button" aria-label="Toggle color mode">
              <span className={cn("toggle-dot", theme === "dark" && "translate-x-6")} />
            </button>
          }
        />
        <SettingsRow icon="bell" title="Reminder system" text={`${stats.reminderCount} upcoming reminders stored locally`} />
        <SettingsRow icon="sparkle" title="Local storage" text="Data key: treatyourself.data.v1" />
        <SettingsRow icon="shield" title="Offline ready" text="PWA app shell and icons are cached after first visit" />
      </section>

      {canInstall && (
        <button type="button" onClick={onInstall} className="primary-button h-14 w-full">
          Install Treat Yourself
          <Icon name="download" className="h-5 w-5" />
        </button>
      )}

      <section className="premium-card space-y-3 p-5">
        <SectionTitle title="App controls" subtitle="These only affect this browser's local data." />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onResetOnboarding} className="secondary-button h-12">
            Replay onboarding
          </button>
          <button type="button" onClick={onResetData} className="danger-button h-12">
            Reset sample data
          </button>
        </div>
      </section>
    </div>
  );
}

function ActivityCard({
  activity,
  index,
  compact = false,
  onEdit,
  onDelete,
  onToggleComplete,
  onSetMood,
}: {
  activity: Activity;
  index: number;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onSetMood: (id: string, phase: Exclude<MoodSource, "manual">, mood: MoodValue) => void;
}) {
  const meta = CATEGORY_META[activity.category];

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.34 }}
      className="premium-card p-4"
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onToggleComplete}
          className={cn(
            "mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl transition",
            activity.completed
              ? "bg-gradient-to-br from-violet-500 to-fuchsia-400 text-white shadow-lg shadow-violet-500/25"
              : `bg-gradient-to-br ${meta.tint}`
          )}
          aria-label={activity.completed ? "Mark incomplete" : "Mark complete"}
        >
          {activity.completed ? <Icon name="check" className="h-5 w-5" /> : meta.emoji}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-500 dark:text-violet-300">
                {formatTime(activity.time)} · {activity.duration} min
              </p>
              <h3 className={cn("mt-1 font-black tracking-[-0.03em]", compact ? "text-lg" : "text-xl")}>{activity.title}</h3>
              <p className="mt-1 text-xs font-semibold text-[#918299] dark:text-violet-100/52">{activity.category}</p>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={onEdit} className="icon-button" aria-label="Edit activity">
                <Icon name="edit" className="h-4 w-4" />
              </button>
              <button type="button" onClick={onDelete} className="icon-button text-rose-500" aria-label="Delete activity">
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
          </div>

          {activity.notes && !compact && <p className="mt-3 text-sm leading-6 text-[#7f7088] dark:text-violet-100/62">{activity.notes}</p>}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniMoodRow label="Before" value={activity.beforeMood} onChange={(mood) => onSetMood(activity.id, "before", mood)} />
            <MiniMoodRow label="After" value={activity.afterMood} onChange={(mood) => onSetMood(activity.id, "after", mood)} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function MoodPicker({ value, onChange, compact = false }: { value?: MoodValue; onChange: (mood: MoodValue) => void; compact?: boolean }) {
  return (
    <div className={cn("grid grid-cols-5 gap-2", compact && "gap-1.5")}>
      {MOODS.map((mood) => (
        <button
          type="button"
          key={mood.value}
          onClick={() => onChange(mood.value)}
          className={cn(
            "rounded-[1.35rem] bg-white/55 p-2 text-center ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:bg-white dark:bg-white/8 dark:ring-white/10",
            value === mood.value && "bg-gradient-to-br from-violet-500 to-fuchsia-400 text-white shadow-lg shadow-violet-500/25 ring-transparent dark:from-violet-500 dark:to-fuchsia-400"
          )}
        >
          <span className={cn("block", compact ? "text-lg" : "text-3xl")}>{mood.emoji}</span>
          {!compact && <span className="mt-2 block text-xs font-black">{mood.label}</span>}
        </button>
      ))}
    </div>
  );
}

function MiniMoodRow({ label, value, onChange }: { label: string; value?: MoodValue; onChange: (mood: MoodValue) => void }) {
  return (
    <div className="rounded-[1.2rem] bg-white/42 p-2 ring-1 ring-black/5 dark:bg-white/[0.06] dark:ring-white/10">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8098] dark:text-violet-100/50">{label}</span>
        <span className="text-sm">{value ? getMoodMeta(value).emoji : "-"}</span>
      </div>
      <div className="flex gap-1">
        {MOODS.map((mood) => (
          <button
            type="button"
            key={mood.value}
            onClick={() => onChange(mood.value)}
            className={cn(
              "grid h-8 flex-1 place-items-center rounded-full text-sm transition",
              value === mood.value
                ? "bg-violet-500 text-white shadow-md shadow-violet-500/25"
                : "bg-white/70 hover:bg-white dark:bg-white/8"
            )}
            aria-label={`${label} mood ${mood.label}`}
          >
            {mood.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function CareSuggestionModal({
  open,
  latestMood,
  onClose,
  onSchedule,
}: {
  open: boolean;
  latestMood?: MoodEntry;
  onClose: () => void;
  onSchedule: (suggestion: { title: string; category: ActivityCategory; duration: number }) => void;
}) {
  const [mood, setMood] = useState<MoodValue>(latestMood?.mood ?? 2);
  const suggestions = CARE_SUGGESTIONS[mood];

  useEffect(() => {
    if (open) setMood(latestMood?.mood ?? 2);
  }, [open, latestMood?.mood]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-end bg-[#201729]/35 p-3 backdrop-blur-md md:place-items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg rounded-[2rem] bg-[#fffaf4]/95 p-5 shadow-[0_30px_90px_rgba(32,23,41,0.3)] ring-1 ring-white/80 backdrop-blur-2xl dark:bg-[#21182c]/95 dark:ring-white/10"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-500 dark:text-violet-300">I Need Care</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">What does Rita need?</h2>
              </div>
              <button type="button" onClick={onClose} className="glass-button h-10 w-10" aria-label="Close">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <MoodPicker value={mood} onChange={setMood} compact />
            </div>

            <div className="mt-5 space-y-3">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion.title}
                  onClick={() => onSchedule(suggestion)}
                  className="w-full rounded-[1.6rem] bg-white/64 p-4 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:bg-white dark:bg-white/8 dark:ring-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-xl", CATEGORY_META[suggestion.category].tint)}>
                      {CATEGORY_META[suggestion.category].emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black tracking-[-0.02em]">{suggestion.title}</p>
                      <p className="text-xs font-semibold text-[#93849b] dark:text-violet-100/55">
                        {suggestion.duration} min · {suggestion.category}
                      </p>
                    </div>
                    <Icon name="plus" className="h-5 w-5 text-violet-500" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#7f7088] dark:text-violet-100/62">{suggestion.reason}</p>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 pt-2 md:pt-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black leading-none tracking-[-0.06em] text-[#201729] dark:text-white md:text-5xl">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#7c6d84] dark:text-violet-100/62">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-black tracking-[-0.04em] text-[#201729] dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-[#8c7d95] dark:text-violet-100/55">{subtitle}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  caption: string;
  icon: IconName;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "div";

  return (
    <Component type={onClick ? "button" : undefined} onClick={onClick} className="premium-card p-4 text-left">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-100">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9b8aa4] dark:text-violet-100/45">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-[-0.05em]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#92839a] dark:text-violet-100/50">{caption}</p>
    </Component>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-white/52 p-3 ring-1 ring-black/5 dark:bg-white/8 dark:ring-white/10">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9b8aa4] dark:text-violet-100/45">{label}</p>
      <p className="mt-1 text-lg font-black tracking-[-0.03em]">{value}</p>
    </div>
  );
}

function EmptyState({ title, text, buttonLabel, onClick }: { title: string; text: string; buttonLabel: string; onClick: () => void }) {
  return (
    <div className="premium-card p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-2xl dark:bg-violet-500/20">🪷</div>
      <h3 className="mt-4 text-xl font-black tracking-[-0.04em]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#7c6d84] dark:text-violet-100/62">{text}</p>
      <button type="button" onClick={onClick} className="primary-button mx-auto mt-5 h-12 px-5">
        {buttonLabel}
        <Icon name="plus" className="h-5 w-5" />
      </button>
    </div>
  );
}

function ReminderNotice({ activity }: { activity: Activity }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 hidden items-center gap-3 rounded-[1.4rem] bg-white/60 p-3 text-sm shadow-soft ring-1 ring-white/70 backdrop-blur-xl dark:bg-white/8 dark:ring-white/10 md:flex"
    >
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-100">
        <Icon name="bell" className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black tracking-[-0.01em]">Next reminder: {activity.title}</p>
        <p className="text-xs text-[#8c7d95] dark:text-violet-100/50">{relativeActivityTime(activity)}</p>
      </div>
    </motion.div>
  );
}

function ReminderMini({ activity }: { activity: Activity }) {
  return (
    <div className="premium-card flex items-center gap-3 p-3">
      <div className={cn("grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-lg", CATEGORY_META[activity.category].tint)}>
        {CATEGORY_META[activity.category].emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black tracking-[-0.01em]">{activity.title}</p>
        <p className="mt-1 text-xs font-semibold text-[#92839a] dark:text-violet-100/50">{relativeActivityTime(activity)}</p>
      </div>
      <Icon name="bell" className="h-4 w-4 text-violet-400" />
    </div>
  );
}

function SettingsRow({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="premium-card flex items-center gap-3 p-4">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-100">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black tracking-[-0.02em]">{title}</p>
        <p className="mt-1 text-sm text-[#897a92] dark:text-violet-100/55">{text}</p>
      </div>
      {action}
    </div>
  );
}

function ProgressRing({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      className="grid h-28 w-28 shrink-0 place-items-center rounded-full p-2"
      style={{ background: `conic-gradient(#8b5cf6 ${percent}%, rgba(139,92,246,0.16) ${percent}%)` }}
    >
      <div className="grid h-full w-full place-items-center rounded-full bg-[#fffaf4] text-center dark:bg-[#21182c]">
        <div>
          <p className="text-2xl font-black tracking-[-0.05em]">{percent}%</p>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#97879f] dark:text-violet-100/50">{label}</p>
        </div>
      </div>
    </div>
  );
}

function MoodLineChart({ entries, large = false }: { entries: MoodEntry[]; large?: boolean }) {
  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(large ? -14 : -9);
  const width = 360;
  const height = large ? 190 : 150;
  const points = sorted.map((entry, index) => {
    const x = sorted.length === 1 ? width / 2 : (index / (sorted.length - 1)) * (width - 28) + 14;
    const y = height - 18 - ((entry.mood - 1) / 4) * (height - 38);
    return { x, y, entry };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="rounded-[1.6rem] bg-white/45 p-3 ring-1 ring-black/5 dark:bg-white/[0.06] dark:ring-white/10">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label="Mood history chart">
        <defs>
          <linearGradient id="moodLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#f0a0bc" />
            <stop offset="55%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#d946ef" />
          </linearGradient>
        </defs>
        {[1, 2, 3, 4, 5].map((line) => {
          const y = height - 18 - ((line - 1) / 4) * (height - 38);
          return <line key={line} x1="12" x2={width - 12} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" />;
        })}
        {points.length > 1 && (
          <motion.polyline
            points={path}
            fill="none"
            stroke="url(#moodLine)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        )}
        {points.map((point) => (
          <g key={point.entry.id}>
            <circle cx={point.x} cy={point.y} r="7" fill="#fff" opacity="0.92" />
            <circle cx={point.x} cy={point.y} r="4" fill="#8b5cf6" />
          </g>
        ))}
        {points.length === 0 && (
          <text x={width / 2} y={height / 2} textAnchor="middle" className="fill-[#8c7d95] text-sm font-bold">
            No mood data yet
          </text>
        )}
      </svg>
    </div>
  );
}

function BottomNavigation({ activeScreen, setActiveScreen }: { activeScreen: Screen; setActiveScreen: (screen: Screen) => void }) {
  return (
    <nav className="safe-bottom fixed inset-x-3 bottom-3 z-40 rounded-[1.8rem] bg-white/78 p-2 shadow-[0_18px_60px_rgba(72,44,108,0.2)] ring-1 ring-white/80 backdrop-blur-2xl dark:bg-[#21182c]/80 dark:ring-white/10 md:hidden">
      <div className="grid grid-cols-6 items-center gap-1">
        {SCREEN_META.map((item) => (
          <NavButton key={item.id} item={item} active={activeScreen === item.id} onClick={() => setActiveScreen(item.id)} />
        ))}
      </div>
    </nav>
  );
}

function NavButton({
  item,
  active,
  onClick,
  desktop = false,
}: {
  item: { id: Screen; label: string; icon: IconName };
  active: boolean;
  onClick: () => void;
  desktop?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center gap-3 rounded-[1.2rem] text-sm font-black transition",
        desktop ? "h-12 w-full justify-start px-4" : "h-14 flex-col gap-1 text-[0.62rem]",
        active ? "text-violet-600 dark:text-white" : "text-[#9a8ba2] hover:text-violet-500 dark:text-violet-100/45"
      )}
    >
      {active && (
        <motion.span
          layoutId={desktop ? "desktop-nav-active" : "mobile-nav-active"}
          className="absolute inset-0 rounded-[1.2rem] bg-violet-100 dark:bg-violet-500/20"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <Icon name={item.icon} className={cn("relative", desktop ? "h-5 w-5" : "h-5 w-5")} />
      <span className="relative">{desktop || item.id !== "insights" ? item.label : "Stats"}</span>
    </button>
  );
}

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-400 text-white shadow-lg shadow-violet-500/25">
        <LotusMark className="h-7 w-7" />
      </div>
      <div>
        <p className="text-lg font-black leading-none tracking-[-0.04em]">Treat Yourself</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[#9a8ba2] dark:text-violet-100/45">Self-care planner</p>
      </div>
    </div>
  );
}

function IosInstallBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-4 rounded-[1.5rem] bg-white/68 p-4 shadow-soft ring-1 ring-white/70 backdrop-blur-2xl dark:bg-white/8 dark:ring-white/10">
      <div className="flex gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-100">
          <Icon name="share" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black tracking-[-0.02em]">Add Treat Yourself to Home Screen</p>
          <p className="mt-1 text-sm leading-6 text-[#7c6d84] dark:text-violet-100/62">
            On iPhone Safari, tap Share, choose Add to Home Screen, then tap Add.
          </p>
        </div>
        <button type="button" onClick={onDismiss} className="icon-button" aria-label="Dismiss iOS install instructions">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BackgroundOrbs() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#e5d6ff] opacity-70 blur-3xl dark:bg-violet-700/30" />
      <div className="absolute right-[-6rem] top-20 h-80 w-80 rounded-full bg-[#ffd8df] opacity-75 blur-3xl dark:bg-fuchsia-700/20" />
      <div className="absolute bottom-[-8rem] left-1/4 h-96 w-96 rounded-full bg-[#fff0cd] opacity-80 blur-3xl dark:bg-amber-500/10" />
    </div>
  );
}

function WellnessIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <svg viewBox="0 0 360 300" className={cn("mx-auto w-full", compact ? "max-w-[220px]" : "max-w-[320px]")} role="img" aria-label="Calming self-care illustration">
      <defs>
        <linearGradient id="skinGlow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#9f594c" />
          <stop offset="100%" stopColor="#6f362f" />
        </linearGradient>
        <linearGradient id="lavenderFloor" x1="0" x2="1">
          <stop offset="0%" stopColor="#d9c7ff" />
          <stop offset="100%" stopColor="#f8cbd5" />
        </linearGradient>
      </defs>
      <ellipse cx="180" cy="248" rx="132" ry="24" fill="url(#lavenderFloor)" opacity="0.75" />
      <path d="M77 222c-20-29-20-75 0-113 22 20 31 64 18 109" fill="#b99de8" opacity="0.72" />
      <path d="M282 218c24-30 26-79 8-118-25 20-36 65-25 111" fill="#a78bda" opacity="0.65" />
      <path d="M92 205c-24-4-42-18-54-42 26-4 47 8 62 31" fill="#ef9aa5" opacity="0.72" />
      <path d="M265 201c26-3 47-18 61-43-30-4-53 10-67 33" fill="#efb1bc" opacity="0.7" />
      <circle cx="274" cy="67" r="20" fill="#fff5ce" />
      <path d="M282 49a19 19 0 0 0 0 36 24 24 0 1 1 0-36Z" fill="#d7c1ff" />
      <circle cx="98" cy="76" r="9" fill="#fff6d7" />
      <path d="M98 68l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" fill="#f0b15e" />
      <ellipse cx="181" cy="235" rx="83" ry="15" fill="#8060c6" opacity="0.22" />
      <path d="M126 220c20-28 45-41 75-38 31 3 55 17 74 39-30 13-123 14-149-1Z" fill="#7f69c8" />
      <path d="M142 169c-32 22-59 38-80 47 29 17 66 12 105-14" fill="#9f594c" />
      <path d="M219 170c31 22 58 38 80 47-30 17-67 12-105-14" fill="#8d4e43" />
      <path d="M142 118c7-24 27-38 49-36 24 2 42 19 46 45l6 58c-32 18-83 18-123 0l22-67Z" fill="#d9c7ff" />
      <path d="M161 125c10 18 35 18 48 0l7 57c-22 9-48 9-69 0l14-57Z" fill="#cbb8ff" opacity="0.8" />
      <circle cx="181" cy="75" r="31" fill="url(#skinGlow)" />
      <path d="M151 65c2-23 22-38 45-31 18 5 26 21 23 40-22-3-39-12-51-28-2 12-7 19-17 19Z" fill="#17111f" />
      <path d="M169 97c7 8 20 9 28 0v20c-7 8-22 8-29 0l1-20Z" fill="url(#skinGlow)" />
      <path d="M168 82c8 9 24 10 34 0" stroke="#321c1c" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.55" />
      <path d="M131 216c24-23 58-23 85-5" stroke="#6f56b8" strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d="M231 216c-24-23-58-23-85-5" stroke="#8d75d9" strokeWidth="13" strokeLinecap="round" fill="none" />
      <rect x="70" y="199" width="19" height="31" rx="8" fill="#f3b28e" />
      <rect x="283" y="201" width="18" height="29" rx="8" fill="#f1c76d" />
    </svg>
  );
}

function ProfileAvatar() {
  return (
    <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-400 p-1 shadow-[0_18px_45px_rgba(139,92,246,0.3)]">
      <div className="grid h-full w-full place-items-center rounded-full bg-[#fff5ef] text-3xl font-black text-violet-600 dark:bg-[#21182c]">
        R
      </div>
    </div>
  );
}

function LotusMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M24 39c-7-5-11-11-11-18 6 1 10 4 11 10 1-6 5-9 11-10 0 7-4 13-11 18Z" fill="currentColor" opacity="0.9" />
      <path d="M24 32c-6-4-9-9-9-16 5 1 8 4 9 9 1-5 4-8 9-9 0 7-3 12-9 16Z" fill="currentColor" opacity="0.55" />
      <path d="M24 28c-4-5-5-11 0-18 5 7 4 13 0 18Z" fill="currentColor" />
    </svg>
  );
}

type IconName =
  | "home"
  | "calendar"
  | "plus"
  | "heart"
  | "chart"
  | "user"
  | "sun"
  | "moon"
  | "search"
  | "bell"
  | "edit"
  | "trash"
  | "check"
  | "chevron"
  | "sparkle"
  | "download"
  | "share"
  | "x"
  | "shield";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="4" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 21l8.8-8a5.2 5.2 0 0 0 0-7.4Z" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="m7 15 4-5 4 3 4-7" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 13.8A8.6 8.6 0 1 1 10.2 3a7 7 0 0 0 10.8 10.8Z" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6 18 20H6L5 6" />
          <path d="M10 11v5M14 11v5" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m20 6-11 11-5-5" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 2 14.5 9.5 22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />
          <path d="M19 3v4M21 5h-4" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m8 8 4-4 4 4" />
          <path d="M5 12v7h14v-7" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-5" />
        </svg>
      );
    default:
      return null;
  }
}

type WellnessStats = {
  plannedTotal: number;
  completedTotal: number;
  completionRate: number;
  plannedToday: number;
  completedToday: number;
  streak: number;
  averageLift: number;
  reminderCount: number;
};

type ActivityInsight = {
  label: string;
  category: ActivityCategory;
  averageLift: number;
  count: number;
};

function createDefaultData(): TreatYourselfData {
  const now = new Date();
  const today = toDateKey(now);
  const yesterday = toDateKey(addDays(now, -1));
  const tomorrow = toDateKey(addDays(now, 1));
  const later = toDateKey(addDays(now, 3));

  const activities: Activity[] = [
    {
      id: "seed-meditation",
      title: "Morning Meditation",
      category: "Mindfulness",
      date: today,
      time: "08:30",
      duration: 12,
      beforeMood: 2,
      afterMood: 4,
      reminder: true,
      notes: "A quiet sit with one hand on the heart.",
      completed: true,
      createdAt: now.toISOString(),
    },
    {
      id: "seed-skincare",
      title: "Skincare Night",
      category: "Skincare",
      date: today,
      time: "20:30",
      duration: 35,
      beforeMood: 3,
      reminder: true,
      notes: "Cleanse, warm towel, mask, serum, and moisturizer.",
      completed: false,
      createdAt: now.toISOString(),
    },
    {
      id: "seed-journal",
      title: "Journaling",
      category: "Creativity",
      date: today,
      time: "21:15",
      duration: 20,
      beforeMood: 3,
      reminder: true,
      notes: "Write one thing Rita is proud of today.",
      completed: false,
      createdAt: now.toISOString(),
    },
    {
      id: "seed-walk",
      title: "Sunset Walk",
      category: "Movement",
      date: tomorrow,
      time: "18:15",
      duration: 30,
      beforeMood: 2,
      afterMood: 4,
      reminder: true,
      notes: "Slow walk, no headphones for the first five minutes.",
      completed: false,
      createdAt: now.toISOString(),
    },
    {
      id: "seed-rest",
      title: "Rest Day",
      category: "Rest",
      date: later,
      time: "17:00",
      duration: 90,
      beforeMood: 1,
      afterMood: 4,
      reminder: true,
      notes: "Dim lights, soft clothes, and no productivity list.",
      completed: false,
      createdAt: now.toISOString(),
    },
    {
      id: "seed-reading",
      title: "Reading Nook",
      category: "Creativity",
      date: yesterday,
      time: "19:45",
      duration: 25,
      beforeMood: 2,
      afterMood: 3,
      reminder: false,
      notes: "Tea, blanket, and one chapter.",
      completed: true,
      createdAt: now.toISOString(),
    },
  ];

  const moodEntries: MoodEntry[] = [
    ...activities.flatMap(activityMoodEntries),
    {
      id: "seed-mood-1",
      date: toDateKey(addDays(now, -5)),
      mood: 2,
      note: "Needed a slower morning.",
      source: "manual",
      createdAt: addDays(now, -5).toISOString(),
    },
    {
      id: "seed-mood-2",
      date: toDateKey(addDays(now, -4)),
      mood: 3,
      note: "Felt more grounded after a walk.",
      source: "manual",
      createdAt: addDays(now, -4).toISOString(),
    },
    {
      id: "seed-mood-3",
      date: toDateKey(addDays(now, -2)),
      mood: 4,
      note: "A gentle evening helped.",
      source: "manual",
      createdAt: addDays(now, -2).toISOString(),
    },
  ];

  return {
    version: 1,
    onboarded: false,
    theme: "light",
    activities,
    moodEntries,
  };
}

function loadData(): TreatYourselfData {
  const fallback = createDefaultData();
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as TreatYourselfData;
    if (parsed.version !== 1 || !Array.isArray(parsed.activities) || !Array.isArray(parsed.moodEntries)) {
      return fallback;
    }
    return {
      ...fallback,
      ...parsed,
      version: 1,
      theme: parsed.theme === "dark" ? "dark" : "light",
    };
  } catch {
    return fallback;
  }
}

function activityMoodEntries(activity: Activity): MoodEntry[] {
  const createdAt = new Date().toISOString();
  const entries: MoodEntry[] = [];
  if (activity.beforeMood) {
    entries.push({
      id: `${activity.id}-before`,
      date: activity.date,
      mood: activity.beforeMood,
      note: `Before ${activity.title}`,
      source: "before",
      activityId: activity.id,
      label: activity.title,
      createdAt,
    });
  }
  if (activity.afterMood) {
    entries.push({
      id: `${activity.id}-after`,
      date: activity.date,
      mood: activity.afterMood,
      note: `After ${activity.title}`,
      source: "after",
      activityId: activity.id,
      label: activity.title,
      createdAt,
    });
  }
  return entries;
}

function getWellnessStats(data: TreatYourselfData): WellnessStats {
  const today = toDateKey(new Date());
  const plannedTotal = data.activities.length;
  const completedTotal = data.activities.filter((activity) => activity.completed).length;
  const plannedToday = data.activities.filter((activity) => activity.date === today).length;
  const completedToday = data.activities.filter((activity) => activity.date === today && activity.completed).length;
  const lifts = data.activities
    .filter((activity) => activity.beforeMood && activity.afterMood)
    .map((activity) => (activity.afterMood as MoodValue) - (activity.beforeMood as MoodValue));
  const averageLift = lifts.length ? average(lifts) : 0;

  return {
    plannedTotal,
    completedTotal,
    completionRate: plannedTotal ? Math.round((completedTotal / plannedTotal) * 100) : 0,
    plannedToday,
    completedToday,
    streak: getCareStreak(data),
    averageLift,
    reminderCount: getUpcomingReminders(data.activities).length,
  };
}

function getActivityInsights(activities: Activity[]): ActivityInsight[] {
  const grouped = new Map<string, { category: ActivityCategory; lifts: number[] }>();
  activities.forEach((activity) => {
    if (!activity.beforeMood || !activity.afterMood) return;
    const key = activity.title;
    const lift = activity.afterMood - activity.beforeMood;
    const current = grouped.get(key) ?? { category: activity.category, lifts: [] };
    current.lifts.push(lift);
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .map(([label, value]) => ({
      label,
      category: value.category,
      averageLift: average(value.lifts),
      count: value.lifts.length,
    }))
    .filter((item) => item.averageLift > 0)
    .sort((a, b) => b.averageLift - a.averageLift);
}

function getCareStreak(data: TreatYourselfData): number {
  let streak = 0;
  for (let offset = 0; offset < 60; offset += 1) {
    const key = toDateKey(addDays(new Date(), -offset));
    const hasCare =
      data.activities.some((activity) => activity.date === key && activity.completed) ||
      data.moodEntries.some((entry) => entry.date === key);
    if (!hasCare) break;
    streak += 1;
  }
  return streak;
}

function getUpcomingReminders(activities: Activity[]): Activity[] {
  const now = Date.now();
  return sortActivities(activities)
    .filter((activity) => activity.reminder && activityDateTime(activity).getTime() >= now)
    .slice(0, 6);
}

function getLatestMood(entries: MoodEntry[]): MoodEntry | undefined {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function getMoodMeta(value: MoodValue) {
  return MOODS.find((mood) => mood.value === value) ?? MOODS[2];
}

function getAverageMoodLabel(entries: MoodEntry[]) {
  if (!entries.length) return "-";
  const value = Math.round(average(entries.map((entry) => entry.mood))) as MoodValue;
  return getMoodMeta(value).emoji;
}

function filterActivities(activities: Activity[], search: string, category: ActivityCategory | "All") {
  const query = search.trim().toLowerCase();
  return activities.filter((activity) => {
    const matchesSearch =
      !query ||
      activity.title.toLowerCase().includes(query) ||
      activity.notes.toLowerCase().includes(query) ||
      activity.category.toLowerCase().includes(query);
    const matchesCategory = category === "All" || activity.category === category;
    return matchesSearch && matchesCategory;
  });
}

function getActivitiesForView(activities: Activity[], selectedDate: string, view: CalendarView) {
  if (view === "day" || view === "month") {
    return activities.filter((activity) => activity.date === selectedDate);
  }
  const week = new Set(getWeekDays(selectedDate));
  return activities.filter((activity) => week.has(activity.date));
}

function activityToForm(activity?: Activity): ActivityForm {
  if (activity) {
    return {
      title: activity.title,
      category: activity.category,
      date: activity.date,
      time: activity.time,
      duration: activity.duration,
      beforeMood: activity.beforeMood,
      afterMood: activity.afterMood,
      reminder: activity.reminder,
      notes: activity.notes,
    };
  }

  return {
    title: "",
    category: "Mindfulness",
    date: toDateKey(new Date()),
    time: getNextHourTime(),
    duration: 30,
    beforeMood: undefined,
    afterMood: undefined,
    reminder: true,
    notes: "",
  };
}

function sortActivities(activities: Activity[]) {
  return [...activities].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function activityDateTime(activity: Activity) {
  return new Date(`${activity.date}T${activity.time || "09:00"}:00`);
}

function relativeActivityTime(activity: Activity) {
  const date = activityDateTime(activity);
  const dateKey = toDateKey(date);
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));

  if (dateKey === today) return `Today at ${formatTime(activity.time)}`;
  if (dateKey === tomorrow) return `Tomorrow at ${formatTime(activity.time)}`;
  return `${formatDate(dateKey, { month: "short", day: "numeric" })} at ${formatTime(activity.time)}`;
}

function shiftDate(key: string, view: CalendarView, direction: number) {
  const date = fromDateKey(key);
  if (view === "day") return toDateKey(addDays(date, direction));
  if (view === "week") return toDateKey(addDays(date, direction * 7));
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + direction, date.getDate()));
}

function getWeekDays(key: string) {
  const date = fromDateKey(key);
  const start = addDays(date, -date.getDay());
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(start, index)));
}

function getMonthGrid(key: string) {
  const date = fromDateKey(key);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => toDateKey(addDays(start, index)));
}

function toDateKey(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(key: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", options).format(fromDateKey(key));
}

function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(2024, 0, 1, hour, minute)
  );
}

function getNextHourTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}