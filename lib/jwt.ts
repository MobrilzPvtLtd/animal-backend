import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'animal_click_jwt_secret_key_2026';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'animal_click_refresh_secret_key_2026';

export function generateTokens(payload: object) {
  // Add explicit token_type to payload so payload & signatures are completely distinct
  const token = jwt.sign(
    { ...payload, token_type: 'access' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  const refresh_token = jwt.sign(
    { ...payload, token_type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    refresh_token,
    token_type: 'Bearer',
    expires_in: 604800, // 7 days in seconds
  };
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(refreshToken: string) {
  try {
    return jwt.verify(refreshToken, REFRESH_SECRET);
  } catch (error) {
    return null;
  }
}
