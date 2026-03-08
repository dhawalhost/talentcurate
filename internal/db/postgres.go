package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var Pool *pgxpool.Pool

// Initialize connects to the Postgres database and runs migrations
func Initialize() error {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return fmt.Errorf("failed to parse database config: %w", err)
	}

	// Retry connection a few times if the DB container is still starting
	var pool *pgxpool.Pool
	for i := 0; i < 5; i++ {
		pool, err = pgxpool.NewWithConfig(context.Background(), config)
		if err == nil {
			err = pool.Ping(context.Background())
			if err == nil {
				break
			}
		}
		log.Printf("Waiting for database connection... (attempt %d/5)", i+1)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		return fmt.Errorf("failed to connect to database after retries: %w", err)
	}

	Pool = pool
	log.Println("Successfully connected to PostgreSQL database")

	// Run Schema Migrations
	err = runMigrations()
	if err != nil {
		return fmt.Errorf("failed to run database migrations: %w", err)
	}

	return nil
}

func runMigrations() error {
	// Step 1: Create ENUM types if they don't exist
	enums := `
	DO $$ 
	BEGIN 
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
			CREATE TYPE user_role AS ENUM ('hr', 'interviewer', 'candidate', 'admin', 'observer');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
			CREATE TYPE session_status AS ENUM ('scheduled', 'live', 'completed', 'canceled');
		END IF;
	END $$;
	`
	if _, err := Pool.Exec(context.Background(), enums); err != nil {
		return err
	}

	// Step 2: Add 'admin' to existing user_role ENUM (if upgrading from previous DB schema)
	_, _ = Pool.Exec(context.Background(), "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'")

	// Step 3: Create tables and seed users
	tablesAndSeed := `
	CREATE TABLE IF NOT EXISTS users (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		email VARCHAR(255) UNIQUE NOT NULL,
		name VARCHAR(255) NOT NULL,
		role user_role NOT NULL,
		password_hash VARCHAR(255),
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id VARCHAR(50) PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		interviewer_id UUID REFERENCES users(id),
		candidate_email VARCHAR(255) NOT NULL,
		status session_status DEFAULT 'scheduled',
		scheduled_for TIMESTAMP WITH TIME ZONE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);
	`

	if _, err := Pool.Exec(context.Background(), tablesAndSeed); err != nil {
		return err
	}

	// Seed configurable admin users from environment variables
	if err := seedAdminUsers(); err != nil {
		log.Printf("Warning: failed to seed admin users: %v", err)
	}

	// Ensure the language_preset column exists (added in Phase 8 fix)
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS language_preset VARCHAR(50) DEFAULT 'python3'")

	// Ensure feedback and hire_recommendation columns exist (added in Phase 10)
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS feedback TEXT")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hire_recommendation VARCHAR(50)")

	// Phase 15: AI Interview Analysis & Recording
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ai_summary TEXT")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS recording_url TEXT")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ALTER COLUMN recording_url TYPE TEXT")

	// Phase 18: Enhanced Scheduling
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS candidate_name VARCHAR(255)")

	// Phase 23: Structured HR Evaluation Rubrics
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS score_algorithms INTEGER DEFAULT 0")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS score_code_quality INTEGER DEFAULT 0")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS score_communication INTEGER DEFAULT 0")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS score_system_design INTEGER DEFAULT 0")

	// Phase 11: Question Bank
	questionsSchema := `
	CREATE TABLE IF NOT EXISTS questions (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		title VARCHAR(255) NOT NULL,
		description TEXT NOT NULL,
		default_language VARCHAR(50) DEFAULT 'python3',
		starter_code TEXT,
		test_cases JSONB DEFAULT '[]',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS session_questions (
		session_id VARCHAR(50) REFERENCES sessions(id) ON DELETE CASCADE,
		question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
		active BOOLEAN DEFAULT false,
		PRIMARY KEY (session_id, question_id)
	);
	`
	_, err := Pool.Exec(context.Background(), questionsSchema)
	if err != nil {
		return err
	}

	// Phase 27: Per-Question Submission & AI Analysis
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE session_questions ADD COLUMN IF NOT EXISTS submitted_code TEXT")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE session_questions ADD COLUMN IF NOT EXISTS submitted_language VARCHAR(50)")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE session_questions ADD COLUMN IF NOT EXISTS ai_analysis TEXT")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE session_questions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE")

	// Phase 35: Interview Templates & Tracks
	templateSchema := `
	CREATE TABLE IF NOT EXISTS interview_templates (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		title VARCHAR(255) NOT NULL,
		description TEXT,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS template_questions (
		template_id UUID REFERENCES interview_templates(id) ON DELETE CASCADE,
		question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
		position INTEGER NOT NULL,
		PRIMARY KEY (template_id, question_id)
	);
	`
	if _, err := Pool.Exec(context.Background(), templateSchema); err != nil {
		return err
	}
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES interview_templates(id)")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE session_questions ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0")

	// Fix Foreign Key Constraint for template_id on sessions -> ON DELETE SET NULL
	fixTemplatesFK := `
	ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_template_id_fkey;
	ALTER TABLE sessions ADD CONSTRAINT sessions_template_id_fkey FOREIGN KEY (template_id) REFERENCES interview_templates(id) ON DELETE SET NULL;
	`
	Pool.Exec(context.Background(), fixTemplatesFK)

	// Clean up mock recording URLs from earlier development
	_, _ = Pool.Exec(context.Background(), "UPDATE sessions SET recording_url = '' WHERE recording_url LIKE '%example.com%'")

	// Calendar & Multi-Interviewer Scheduling
	calendarSchema := `
	CREATE TABLE IF NOT EXISTS session_interviewers (
		session_id VARCHAR(50) REFERENCES sessions(id) ON DELETE CASCADE,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		role VARCHAR(20) DEFAULT 'interviewer',
		PRIMARY KEY (session_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS interviewer_availability (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		day_of_week INTEGER NOT NULL,
		start_time TIME NOT NULL,
		end_time TIME NOT NULL,
		UNIQUE(user_id, day_of_week, start_time)
	);
	`
	if _, err := Pool.Exec(context.Background(), calendarSchema); err != nil {
		log.Printf("Warning: calendar schema migration partial failure: %v", err)
	}

	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'interviewer'")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb")

	// Interviewer-Driven Templates
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE interview_templates ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id)")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE interview_templates ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE session_interviewers ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES interview_templates(id)")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE session_interviewers ADD COLUMN IF NOT EXISTS prep_status VARCHAR(20) DEFAULT 'pending'")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS suggested_template_id UUID REFERENCES interview_templates(id)")

	// Non-Technical Interview Support
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) DEFAULT 'coding'")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS interview_notes TEXT")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS score_leadership INTEGER DEFAULT 0")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS score_problem_solving INTEGER DEFAULT 0")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS score_culture_fit INTEGER DEFAULT 0")
	_, _ = Pool.Exec(context.Background(), "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS score_domain_knowledge INTEGER DEFAULT 0")

	return nil
}

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// seedAdminUsers creates or updates the bootstrap admin user from environment variables.
// This is the only user seeded at startup — the admin can create all other users
// (HR, interviewers, additional admins) via the Admin Dashboard.
func seedAdminUsers() error {
	email := getEnvOrDefault("ADMIN_EMAIL", "admin@spinvel.com")
	password := getEnvOrDefault("ADMIN_PASSWORD", "admin123")
	name := getEnvOrDefault("ADMIN_NAME", "System Admin")

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}

	query := `
	INSERT INTO users (id, email, name, role, password_hash)
	VALUES (gen_random_uuid(), $1, $2, 'admin', $3)
	ON CONFLICT (email) DO UPDATE SET
		name = EXCLUDED.name,
		password_hash = EXCLUDED.password_hash
	`
	if _, err := Pool.Exec(context.Background(), query, email, name, string(hash)); err != nil {
		return fmt.Errorf("failed to seed admin user %s: %w", email, err)
	}
	log.Printf("Seeded admin user: %s", email)

	return nil
}
