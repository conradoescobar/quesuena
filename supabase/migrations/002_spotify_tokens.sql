-- =============================================
-- Tabla para almacenar refresh tokens de Spotify
-- =============================================

CREATE TABLE spotify_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index para búsquedas por user_id
CREATE INDEX idx_spotify_tokens_user_id ON spotify_tokens(user_id);

-- Trigger para updated_at
CREATE TRIGGER update_spotify_tokens_updated_at
  BEFORE UPDATE ON spotify_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE spotify_tokens ENABLE ROW LEVEL SECURITY;

-- Solo el usuario puede ver/modificar su propio token
CREATE POLICY "Users can view own tokens"
  ON spotify_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON spotify_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON spotify_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON spotify_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE spotify_tokens IS 'Almacena refresh tokens de Spotify para renovar access tokens';
