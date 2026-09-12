CREATE TABLE IF NOT EXISTS planner_events (
  id uuid PRIMARY KEY,
  title varchar(120) NOT NULL,
  notes varchar(600) NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 1440),
  space varchar(10) NOT NULL CHECK (space IN ('vanya','ksusha','shared')),
  created_by varchar(10) NOT NULL CHECK (created_by IN ('vanya','ksusha')),
  done boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planner_events_updated_idx ON planner_events(updated_at);
