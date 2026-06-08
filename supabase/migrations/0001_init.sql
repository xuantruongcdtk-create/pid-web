-- =============================================
-- EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CORE TABLES
-- =============================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'parent' CHECK (role IN ('parent', 'teacher', 'admin')),
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'teacher_pro')),
  plan_expires_at TIMESTAMPTZ,
  credits INTEGER DEFAULT 3,  -- free quiz credits
  stripe_customer_id TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,  -- track onboarding wizard completion
  referral_teacher_id UUID,  -- teacher who referred this parent (for affiliate tracking)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Children profiles
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  grade TEXT NOT NULL,  -- '1','2',...,'12'
  school_name TEXT,
  school_level TEXT CHECK (school_level IN ('tieu_hoc','thcs','thpt')),
  avatar_color TEXT DEFAULT '#0f2554',
  learning_style TEXT,  -- computed: 'visual'|'auditory'|'kinesthetic'|'reading'
  peak_study_hours TEXT,
  burnout_risk TEXT DEFAULT 'low' CHECK (burnout_risk IN ('low','medium','high')),
  dna_profile JSONB DEFAULT '{}',  -- { visual:78, auditory:35, ... }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Score records (điểm số từng môn)
CREATE TABLE score_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,  -- 'Toán','Văn','Anh','Lý','Hóa','Sinh','Sử','Địa','GDCD','Tin'
  score NUMERIC(4,2) CHECK (score >= 0 AND score <= 10),
  exam_type TEXT DEFAULT 'regular',  -- 'regular'|'midterm'|'final'|'quiz'
  exam_date DATE NOT NULL,
  term TEXT,  -- 'HK1'|'HK2'
  school_year TEXT,  -- '2025-2026'
  notes TEXT,
  mood_rating INTEGER CHECK (mood_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly summaries (computed/cached)
CREATE TABLE weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  study_hours NUMERIC(4,1),
  tasks_completed INTEGER,
  avg_score NUMERIC(4,2),
  mood_avg NUMERIC(3,1),
  ai_analysis JSONB,  -- { strengths:[], weaknesses:[], recommendations:[] }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, week_start)
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('warning','success','info')),
  title TEXT NOT NULL,
  description TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- QUIZ SYSTEM
-- =============================================

-- Quiz library
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  source_type TEXT DEFAULT 'ai' CHECK (source_type IN ('ai','pdf','manual')),
  source_content TEXT,   -- original PDF text or manual content
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  gdpt_level_distribution JSONB DEFAULT '{"nhan_biet":30,"thong_hieu":40,"van_dung":20,"van_dung_cao":10}',
  total_questions INTEGER,
  estimated_minutes INTEGER DEFAULT 15,
  share_code TEXT UNIQUE,  -- for teacher sharing
  is_public BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz questions
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice','fill_blank','essay')),
  options JSONB,          -- [{key:'A',text:'...'}, {key:'B',text:'...'}]
  correct_answer TEXT,    -- 'A'|'B'|'C'|'D' or text for fill_blank
  explanation TEXT,       -- giải thích đáp án
  gdpt_level TEXT CHECK (gdpt_level IN ('nhan_biet','thong_hieu','van_dung','van_dung_cao')),
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz attempts (con làm quiz)
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score NUMERIC(5,2),   -- percentage 0-100
  answers JSONB,         -- { question_id: selected_answer }
  time_spent_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AI COACH
-- =============================================

CREATE TABLE coach_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES coach_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PAYMENT & SUBSCRIPTIONS
-- =============================================

CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- nullable: keep transaction record even if user deleted
  provider TEXT NOT NULL CHECK (provider IN ('momo','vnpay','payos','stripe')),
  provider_transaction_id TEXT,
  amount INTEGER NOT NULL,  -- VNĐ (no decimal)
  currency TEXT DEFAULT 'VND',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','success','failed','refunded')),
  plan_purchased TEXT,      -- 'premium_monthly'|'premium_yearly'|'credits_10'|'credits_50'
  credits_added INTEGER DEFAULT 0,
  metadata JSONB,           -- provider-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit packs config
CREATE TABLE credit_packs (
  id TEXT PRIMARY KEY,          -- 'pack_10'|'pack_50'|'pack_unlimited'
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_vnd INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO credit_packs VALUES
  ('pack_10', '10 bộ quiz', 10, 50000, true),
  ('pack_30', '30 bộ quiz', 30, 120000, true),
  ('pack_100', '100 bộ quiz', 100, 350000, true);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: user can only read/update their own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Note: INSERT is handled by handle_new_user() trigger (SECURITY DEFINER bypasses RLS)
-- Add explicit INSERT policy for safety:
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Children: parent can CRUD their own children
CREATE POLICY "Parents manage own children" ON children FOR ALL USING (auth.uid() = parent_id);

-- Score records: access through children
CREATE POLICY "Parents manage scores" ON score_records FOR ALL USING (
  child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
);

-- Weekly summaries
CREATE POLICY "Parents view summaries" ON weekly_summaries FOR SELECT USING (
  child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
);

-- Alerts
CREATE POLICY "Parents manage alerts" ON alerts FOR ALL USING (
  child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
);

-- Quizzes: creator can manage, public quizzes are viewable by all
CREATE POLICY "Creators manage own quizzes" ON quizzes FOR ALL USING (auth.uid() = creator_id);
CREATE POLICY "Anyone can view public quizzes" ON quizzes FOR SELECT USING (is_public = TRUE);

-- Quiz questions: viewable if quiz is accessible
CREATE POLICY "View quiz questions" ON quiz_questions FOR SELECT USING (
  quiz_id IN (SELECT id FROM quizzes WHERE creator_id = auth.uid() OR is_public = TRUE)
);

-- Quiz attempts
CREATE POLICY "Parents view attempts" ON quiz_attempts FOR ALL USING (
  child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
);

-- Coach conversations
CREATE POLICY "Parents manage conversations" ON coach_conversations FOR ALL USING (auth.uid() = parent_id);
CREATE POLICY "Parents view messages" ON coach_messages FOR ALL USING (
  conversation_id IN (SELECT id FROM coach_conversations WHERE parent_id = auth.uid())
);

-- Payments: user sees own transactions
CREATE POLICY "Users view own payments" ON payment_transactions FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_children_parent_id ON children(parent_id);
CREATE INDEX idx_score_records_child_id ON score_records(child_id);
CREATE INDEX idx_score_records_exam_date ON score_records(exam_date DESC);
CREATE INDEX idx_quiz_attempts_child_id ON quiz_attempts(child_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX idx_quizzes_share_code ON quizzes(share_code);
CREATE INDEX idx_alerts_child_id ON alerts(child_id, is_read);
CREATE INDEX idx_coach_conversations_parent ON coach_conversations(parent_id);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Generate unique share_code for quizzes
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.share_code IS NULL THEN
    NEW.share_code = upper(substring(md5(random()::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_share_code
  BEFORE INSERT ON quizzes
  FOR EACH ROW EXECUTE FUNCTION generate_share_code();
