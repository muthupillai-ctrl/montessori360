exports.up = async (pgm) => {
  // Step 1: Create tables in all existing tenant schemas
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- obs_domains
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.obs_domains (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name        VARCHAR(100) NOT NULL,
            code        VARCHAR(50)  NOT NULL UNIQUE,
            is_standard BOOLEAN NOT NULL DEFAULT false,
            description TEXT,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            is_active   BOOLEAN NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        -- obs_milestones
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.obs_milestones (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            domain_id   UUID NOT NULL,
            code        VARCHAR(20)  NOT NULL,
            name        VARCHAR(255) NOT NULL,
            description TEXT,
            age_min     INTEGER,
            age_max     INTEGER,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            is_active   BOOLEAN NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(domain_id, code)
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_milestones_domain ON %I.obs_milestones(domain_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- observations
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.observations (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            student_id   UUID NOT NULL,
            milestone_id UUID NOT NULL,
            domain_id    UUID NOT NULL,
            grade        VARCHAR(20) NOT NULL CHECK (grade IN ('not_started','in_progress','led','mastered')),
            notes        TEXT,
            observed_by  UUID,
            observed_on  DATE NOT NULL DEFAULT CURRENT_DATE,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(student_id, milestone_id)
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_obs_student ON %I.observations(student_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_obs_domain ON %I.observations(domain_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

      END LOOP;
    END;
    $outer$
  `);

  // Step 2: Seed standard Montessori domains + milestones into all tenant schemas
  pgm.sql(`
    DO $outer$
    DECLARE
      t          RECORD;
      d_pl_id    UUID;
      d_lang_id  UUID;
      d_cult_id  UUID;
      d_math_id  UUID;
      d_se_id    UUID;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- Insert domains
        EXECUTE format($$
          INSERT INTO %I.obs_domains (name, code, is_standard, description, sort_order) VALUES
            ('Practical Life',     'practical_life',    true, 'Self-care, classroom care, grace and courtesy', 1),
            ('Language',           'language',          true, 'Spoken, pre-reading, reading, writing', 2),
            ('Cultural / Sensorial','cultural',         true, 'Geography, botany, zoology, music, art, sensorial', 3),
            ('Mathematics',        'mathematics',       true, 'Counting, numerals, decimal system, arithmetic, geometry', 4),
            ('Social & Emotional', 'social_emotional',  true, 'Peer relations, self-regulation, independence', 5)
          ON CONFLICT (code) DO NOTHING
        $$, t.schema_name);

        -- Get domain IDs
        EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', t.schema_name)
          INTO d_pl_id USING 'practical_life';
        EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', t.schema_name)
          INTO d_lang_id USING 'language';
        EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', t.schema_name)
          INTO d_cult_id USING 'cultural';
        EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', t.schema_name)
          INTO d_math_id USING 'mathematics';
        EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', t.schema_name)
          INTO d_se_id USING 'social_emotional';

        -- Practical Life milestones
        EXECUTE format($$
          INSERT INTO %I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
            ($1,'PL-001','Carries objects safely',                  18,36,1),
            ($1,'PL-002','Pours liquid without spilling',           24,42,2),
            ($1,'PL-003','Washes hands independently',              24,42,3),
            ($1,'PL-004','Dresses and undresses independently',     30,54,4),
            ($1,'PL-005','Uses utensils correctly',                 24,48,5),
            ($1,'PL-006','Sweeps and cleans up after work',         30,54,6),
            ($1,'PL-007','Greets others respectfully',              24,60,7),
            ($1,'PL-008','Waits for turn patiently',                30,60,8)
          ON CONFLICT (domain_id, code) DO NOTHING
        $$, t.schema_name) USING d_pl_id;

        -- Language milestones
        EXECUTE format($$
          INSERT INTO %I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
            ($1,'LA-001','Speaks in complete sentences',            24,42,1),
            ($1,'LA-002','Recognises letter sounds (phonics)',      36,54,2),
            ($1,'LA-003','Identifies letters by name',              36,60,3),
            ($1,'LA-004','Blends CVC words',                        42,66,4),
            ($1,'LA-005','Reads simple 3-letter words',             48,72,5),
            ($1,'LA-006','Holds pencil with correct grip',          36,60,6),
            ($1,'LA-007','Traces letters on sandpaper',             36,54,7),
            ($1,'LA-008','Writes own name',                         48,72,8),
            ($1,'LA-009','Listens to and retells a story',          30,54,9)
          ON CONFLICT (domain_id, code) DO NOTHING
        $$, t.schema_name) USING d_lang_id;

        -- Cultural milestones
        EXECUTE format($$
          INSERT INTO %I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
            ($1,'CU-001','Names continents on globe',               42,66,1),
            ($1,'CU-002','Matches continent puzzle pieces',         42,72,2),
            ($1,'CU-003','Names and classifies living vs non-living',36,60,3),
            ($1,'CU-004','Identifies parts of a plant',             42,66,4),
            ($1,'CU-005','Participates in music activities',        24,72,5),
            ($1,'CU-006','Uses art materials purposefully',         24,72,6),
            ($1,'CU-007','Matches sensorial materials by texture',  24,42,7),
            ($1,'CU-008','Orders sensorial materials by size',      30,54,8)
          ON CONFLICT (domain_id, code) DO NOTHING
        $$, t.schema_name) USING d_cult_id;

        -- Mathematics milestones
        EXECUTE format($$
          INSERT INTO %I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
            ($1,'MA-001','Counts objects 1-10 one-to-one',          30,48,1),
            ($1,'MA-002','Recognises numerals 1-10',                36,54,2),
            ($1,'MA-003','Counts with number rods',                 36,54,3),
            ($1,'MA-004','Understands quantity with golden beads',  42,66,4),
            ($1,'MA-005','Recognises numerals 1-100',               48,72,5),
            ($1,'MA-006','Performs simple addition',                54,84,6),
            ($1,'MA-007','Performs simple subtraction',             54,84,7),
            ($1,'MA-008','Identifies basic geometric shapes',       36,60,8)
          ON CONFLICT (domain_id, code) DO NOTHING
        $$, t.schema_name) USING d_math_id;

        -- Social & Emotional milestones
        EXECUTE format($$
          INSERT INTO %I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
            ($1,'SE-001','Works independently for 10+ minutes',     30,54,1),
            ($1,'SE-002','Chooses work from shelf independently',   30,54,2),
            ($1,'SE-003','Returns materials to correct place',      24,48,3),
            ($1,'SE-004','Resolves peer conflicts calmly',          42,72,4),
            ($1,'SE-005','Shows empathy towards others',            36,66,5),
            ($1,'SE-006','Follows classroom ground rules',          24,48,6),
            ($1,'SE-007','Completes a work cycle',                  36,60,7),
            ($1,'SE-008','Expresses emotions with words',           30,60,8)
          ON CONFLICT (domain_id, code) DO NOTHING
        $$, t.schema_name) USING d_se_id;

      END LOOP;
    END;
    $outer$
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I.observations', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.obs_milestones', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.obs_domains', t.schema_name);
      END LOOP;
    END;
    $outer$
  `);
};
