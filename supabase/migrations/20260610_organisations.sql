CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organisation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organisation_id, user_id)
);

CREATE TABLE organisation_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read their organisation"
ON organisations FOR SELECT
USING (
  id IN (
    SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "members can read org members"
ON organisation_members FOR SELECT
USING (
  organisation_id IN (
    SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "owners can insert members"
ON organisation_members FOR INSERT
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM organisation_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "owners can update members"
ON organisation_members FOR UPDATE
USING (
  organisation_id IN (
    SELECT organisation_id FROM organisation_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "owners can delete members"
ON organisation_members FOR DELETE
USING (
  organisation_id IN (
    SELECT organisation_id FROM organisation_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "owners can manage invites"
ON organisation_invites FOR ALL
USING (
  organisation_id IN (
    SELECT organisation_id FROM organisation_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "anyone can read invite by token"
ON organisation_invites FOR SELECT
USING (true);

CREATE INDEX idx_organisation_members_user_id ON organisation_members(user_id);
CREATE INDEX idx_organisation_members_organisation_id ON organisation_members(organisation_id);
CREATE INDEX idx_organisation_invites_token ON organisation_invites(token);
