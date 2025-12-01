import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import {
  User,
  UserResponse,
  LoginRequest,
  GoogleAuthRequest,
  RefreshTokenRequest,
  AuthResponse,
  RefreshResponse,
  JwtPayload,
} from "../types";
import usersData from "../data/users.json";
import gmailService from "../services/gmail";
import tokenStore from "../services/tokenStore";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In-memory store for refresh tokens (in production, use Redis or database)
const refreshTokenStore = new Map<string, string>();

// Helper function to generate tokens
const generateTokens = (userId: string, email: string) => {
  const SECRET = process.env.JWT_SECRET!;
  const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  const ACCESS_EXPIRY = "15m";
  const REFRESH_EXPIRY = "7d";

  const accessToken = jwt.sign({ userId, email }, SECRET, {
    expiresIn: ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign({ userId, email }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  });

  return { accessToken, refreshToken };
};

// Helper function to sanitize user data
const sanitizeUser = (user: User): UserResponse => {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// POST /api/auth/login - Email/Password Login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    // Find user by email
    const users = usersData as User[];
    const user = users.find((u) => u.email === email);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Verify password (mock users have password: "password123")
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    // Store refresh token
    refreshTokenStore.set(refreshToken, user.id);

    const response: AuthResponse = {
      success: true,
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    };

    res.json(response);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// GET /api/auth/google/url - Get Google OAuth URL (OAuth2 Authorization Code Flow)
router.get("/google/url", (req: Request, res: Response): void => {
  try {
    const authUrl = gmailService.getAuthUrl();

    res.json({
      success: true,
      url: authUrl,
    });
  } catch (error) {
    console.error("Error generating OAuth URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate OAuth URL",
    });
  }
});

// GET /api/auth/google/callback - Handle Google OAuth callback (OAuth2 Authorization Code Flow)
router.get(
  "/google/callback",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, error } = req.query;

      // Handle OAuth error
      if (error) {
        res.redirect(`${process.env.FRONTEND_URL}/login?error=${error}`);
        return;
      }

      if (!code || typeof code !== "string") {
        res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
        return;
      }

      // Exchange code for tokens
      const tokens = await gmailService.getTokensFromCode(code);

      if (!tokens.refresh_token || !tokens.access_token) {
        res.redirect(
          `${process.env.FRONTEND_URL}/login?error=no_refresh_token`
        );
        return;
      }

      // Get user's email from OAuth2 userinfo endpoint
      // Use axios directly with Bearer token instead of oauth2Client.request()
      // to avoid credential attachment issues
      const axios = await import("axios");
      const userInfoResponse = await axios.default.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      const email = userInfoResponse.data.email;

      console.log("Google OAuth user email:", email);
      console.log("Google OAuth tokens:", tokens);
      console.log("Google OAuth user info:", userInfoResponse.data);
      if (!email) {
        res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
        return;
      }

      // Find or create user
      const users = usersData as User[];
      let user = users.find((u) => u.email === email);

      if (!user) {
        // Create new user
        user = {
          id: "user-" + Date.now(),
          email,
          password: "", // No password for Google users
          name: email.split("@")[0],
          googleId: email, // Using email as googleId for now
          createdAt: new Date().toISOString(),
        };
        users.push(user);
      }

      // Store Gmail refresh token
      tokenStore.setToken(
        user.id,
        email,
        tokens.refresh_token,
        tokens.access_token,
        tokens.expiry_date ?? undefined
      );

      // Generate app tokens
      const { accessToken, refreshToken } = generateTokens(user.id, user.email);

      // Store app refresh token
      refreshTokenStore.set(refreshToken, user.id);

      // Redirect to frontend with tokens in URL params (frontend will store them)
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  }
);

// POST /api/auth/google - Google OAuth Login (Legacy - client-side token verification)
router.post("/google", async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential }: GoogleAuthRequest = req.body;

    if (!credential) {
      res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
      return;
    }

    // Verify Google token
    let googleUser;

    try {
      // Check if Google Client ID is configured
      if (
        !process.env.GOOGLE_CLIENT_ID ||
        process.env.GOOGLE_CLIENT_ID === "mock_google_client_id"
      ) {
        res.status(500).json({
          success: false,
          message:
            "Google OAuth is not properly configured. Please set GOOGLE_CLIENT_ID in .env file. Get your Client ID from https://console.cloud.google.com/",
        });
        return;
      }

      // Verify with Google
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new Error("No payload received from Google");
      }

      googleUser = {
        sub: payload.sub,
        email: payload.email || "",
        name: payload.name || "Google User",
        picture: payload.picture,
      };
    } catch (error: any) {
      console.error("Google verification error:", error);
      res.status(401).json({
        success: false,
        message: error.message || "Invalid Google credential",
      });
      return;
    }

    // Find or create user
    const users = usersData as User[];
    let user = users.find(
      (u) => u.googleId === googleUser.sub || u.email === googleUser.email
    );

    if (!user) {
      // Create new user
      user = {
        id: "user-" + Date.now(),
        email: googleUser.email,
        password: "", // No password for Google users
        name: googleUser.name,
        googleId: googleUser.sub,
        createdAt: new Date().toISOString(),
      };

      // In production, save to database
      users.push(user);
    } else if (!user.googleId) {
      // Link Google account to existing user
      user.googleId = googleUser.sub;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    // Store refresh token
    refreshTokenStore.set(refreshToken, user.id);

    const response: AuthResponse = {
      success: true,
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    };

    res.json(response);
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/auth/refresh - Refresh Access Token
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken }: RefreshTokenRequest = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    // Verify refresh token exists in store
    const userId = refreshTokenStore.get(refreshToken);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
      return;
    }

    // Verify refresh token signature
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET as string
      ) as JwtPayload;

      // Generate new access token
      const SECRET = process.env.JWT_SECRET!;
      const ACCESS_EXPIRY = "15m";

      const accessToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email },
        SECRET,
        { expiresIn: ACCESS_EXPIRY }
      );

      const response: RefreshResponse = {
        success: true,
        accessToken,
      };

      res.json(response);
    } catch (error) {
      // Remove invalid refresh token
      refreshTokenStore.delete(refreshToken);

      res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/auth/logout - Logout
router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken }: RefreshTokenRequest = req.body;
    const authHeader = req.headers.authorization;

    if (refreshToken) {
      // Remove app refresh token from store
      const userId = refreshTokenStore.get(refreshToken);
      refreshTokenStore.delete(refreshToken);

      // Also remove Gmail tokens
      if (userId) {
        tokenStore.deleteToken(userId);
      }
    }

    // Extract userId from access token if available
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string
        ) as JwtPayload;

        // Remove Gmail tokens for this user
        tokenStore.deleteToken(decoded.userId);
      } catch (error) {
        // Token invalid or expired, ignore
      }
    }

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
