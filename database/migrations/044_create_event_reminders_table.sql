-- ============================================================
-- MIGRATION 044: CREATE EVENT REMINDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_reminders (
    reminder_id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user/event reminder lookups
CREATE INDEX IF NOT EXISTS idx_event_reminders_user_event ON public.event_reminders(user_id, event_id);

