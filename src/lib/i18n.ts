// Central translation dictionary for the MESOB Hawassa app.
// Add new keys here and use t("key") in components via useLanguage().

export type Lang = "en" | "am";

export const translations: Record<string, Record<Lang, string>> = {
  // ── Brand / Nav ──────────────────────────────────────────
  app_name:        { en: "MESOB Hawassa", am: "መሶብ ሀዋሳ" },
  app_tagline:     { en: "Government Service Appointments", am: "የመንግስት አገልግሎት ቀጠሮ" },
  nav_home:        { en: "Home", am: "መነሻ" },
  nav_book:        { en: "Book", am: "ቀጠሮ ይያዙ" },
  nav_lookup:      { en: "Lookup", am: "ቀጠሮ ይፈልጉ" },
  nav_history:     { en: "My Appointments", am: "የእኔ ቀጠሮዎች" },
  nav_sign_in:     { en: "Sign in", am: "ግባ" },
  nav_sign_out:    { en: "Sign out", am: "ውጣ" },
  nav_admin:       { en: "Admin", am: "አስተዳዳሪ" },
  nav_staff:       { en: "Staff", am: "ሰራተኛ" },

  // ── Home page ────────────────────────────────────────────
  home_title:      { en: "Skip the queue. Book online.", am: "ወረፋ ሳይጠብቁ በበይነ-መረብ ቦታ ይያዙ።" },
  home_subtitle:   { en: "Book or check the status of your appointment for government services in Hawassa.", am: "በሀዋሳ የመንግስት አገልግሎት ቀጠሮዎችን ይያዙ ወይም ሁኔታውን ይፈልጉ።" },
  home_book_cta:   { en: "Book an appointment", am: "ቀጠሮ ይያዙ" },
  home_lookup_cta: { en: "Check my reference", am: "ማጣቀሻዬን ይፈልጉ" },

  // ── Booking wizard ───────────────────────────────────────
  book_step1_title:   { en: "Choose a service", am: "አገልግሎት ይምረጡ" },
  book_step2_title:   { en: "Choose date & time", am: "ቀንና ጊዜ ይምረጡ" },
  book_step3_title:   { en: "Your details", am: "የእርስዎ መረጃ" },
  book_step4_title:   { en: "Confirmation", am: "ማረጋገጫ" },
  book_full_name:     { en: "Full name", am: "ሙሉ ስም" },
  book_phone:         { en: "Phone number", am: "ስልክ ቁጥር" },
  book_national_id:   { en: "National ID", am: "የመታወቂያ ቁጥር" },
  book_date:          { en: "Date", am: "ቀን" },
  book_window:        { en: "Time window", am: "ጊዜ" },
  book_morning:       { en: "Morning (AM)", am: "ጥዋት" },
  book_afternoon:     { en: "Afternoon (PM)", am: "ከሰዓት" },
  book_confirm:       { en: "Confirm booking", am: "ቀጠሮ አረጋግጥ" },
  book_back:          { en: "Back", am: "ተመለስ" },
  book_next:          { en: "Next", am: "ቀጣይ" },
  book_success_title: { en: "Booking confirmed!", am: "ቀጠሮ ተረጋግጧል!" },
  book_reference:     { en: "Your reference number", am: "የማጣቀሻ ቁጥርዎ" },
  book_another:       { en: "Book another service", am: "ሌላ አገልግሎት ይያዙ" },

  // ── Lookup ───────────────────────────────────────────────
  lookup_title:       { en: "Look up your appointment", am: "ቀጠሮዎን ይፈልጉ" },
  lookup_subtitle:    { en: "Enter your reference number exactly as it appears on your confirmation.", am: "ማጣቀሻ ቁጥርዎን በማረጋገጫዎ ላይ እንደተጻፈው ያስገቡ።" },
  lookup_placeholder: { en: "Reference number", am: "የማጣቀሻ ቁጥር" },
  lookup_button:      { en: "Look up", am: "ይፈልጉ" },
  lookup_not_found:   { en: "No appointment found with that reference.", am: "በዚህ ማጣቀሻ ቁጥር ምንም ቀጠሮ አልተገኘም።" },

  // ── History (citizen) ────────────────────────────────────
  history_title:      { en: "My Appointments", am: "የእኔ ቀጠሮዎች" },
  history_subtitle:   { en: "All appointments you have booked with this account.", am: "በዚህ መለያ የያዙዋቸው ቀጠሮዎች ሁሉ።" },
  history_empty:      { en: "You haven't booked any appointments yet.", am: "እስካሁን ምንም ቀጠሮ አልያዙም።" },
  history_book_now:   { en: "Book your first appointment", am: "የመጀመሪያ ቀጠሮዎን ይያዙ" },
  history_cancel:     { en: "Cancel appointment", am: "ቀጠሮ ይሰርዙ" },
  history_cancelled:  { en: "Cancelled", am: "ተሰርዟል" },

  // ── Status labels ────────────────────────────────────────
  status_pending:   { en: "Waiting", am: "በመጠባበቅ ላይ" },
  status_served:    { en: "Served", am: "ተጠናቅቋል" },
  status_no_show:   { en: "No-show", am: "አልቀረቡም" },
  status_cancelled: { en: "Cancelled", am: "ተሰርዟል" },

  // ── Common ───────────────────────────────────────────────
  common_loading:   { en: "Loading…", am: "በመጫን ላይ…" },
  common_cancel:    { en: "Cancel", am: "ይቅር" },
  common_save:      { en: "Save", am: "አስቀምጥ" },
  common_close:     { en: "Close", am: "ዝጋ" },
  common_date:      { en: "Date", am: "ቀን" },
  common_service:   { en: "Service", am: "አገልግሎት" },
  common_institution:{ en: "Institution", am: "ተቋም" },
  common_status:    { en: "Status", am: "ሁኔታ" },
};

export function translate(lang: Lang, key: string): string {
  return translations[key]?.[lang] ?? translations[key]?.en ?? key;
}
