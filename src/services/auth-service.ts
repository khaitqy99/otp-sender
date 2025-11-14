import { supabase } from '@/integrations/supabase/client';
import type { User } from './user-service';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export class AuthService {
  /**
   * Đăng nhập với email và password (giống y99kpinew)
   */
  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const { email, password } = credentials;
      const emailLower = email.trim().toLowerCase();

      console.log('Login attempt:', { email: emailLower });

      // Tìm user với email
      const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailLower)
        .eq('is_active', true)
        .single();

      console.log('User query result:', { 
        user: user ? { id: user.id, email: user.email, role: user.role, is_active: user.is_active } : null,
        error: findError 
      });

      if (findError) {
        console.error('Error finding user:', findError);
        return {
          success: false,
          error: findError.message || 'Email hoặc mật khẩu không đúng'
        };
      }

      if (!user) {
        console.log('User not found:', emailLower);
        return {
          success: false,
          error: 'Email hoặc mật khẩu không đúng'
        };
      }

      // Kiểm tra tài khoản có bị khóa không
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return {
          success: false,
          error: 'Tài khoản đã bị khóa. Vui lòng thử lại sau.'
        };
      }

      // Kiểm tra mật khẩu (plain text cho demo, giống y99kpinew)
      console.log('Password check:', { 
        stored: user.password_hash?.substring(0, 3) + '...', 
        input: password.substring(0, 3) + '...',
        match: user.password_hash === password 
      });

      if (user.password_hash !== password) {
        console.log('Password mismatch');
        // Tăng số lần đăng nhập sai
        const newAttempts = (user.login_attempts || 0) + 1;
        const lockedUntil = newAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null; // Khóa 30 phút

        await supabase
          .from('users')
          .update({
            login_attempts: newAttempts,
            locked_until: lockedUntil
          })
          .eq('id', user.id);

        return {
          success: false,
          error: 'Email hoặc mật khẩu không đúng'
        };
      }

      console.log('Password match, login successful');

      // Reset số lần đăng nhập sai và cập nhật lần đăng nhập cuối
      await supabase
        .from('users')
        .update({
          login_attempts: 0,
          locked_until: null,
          last_login: new Date().toISOString()
        })
        .eq('id', user.id);

      return {
        success: true,
        user
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Có lỗi xảy ra khi đăng nhập'
      };
    }
  }

  /**
   * Đăng xuất
   */
  static async logout(): Promise<void> {
    // Xóa session storage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('user');
      localStorage.removeItem('user');
    }
  }

  /**
   * Kiểm tra session hiện tại
   */
  static async getCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined') return null;

    try {
      const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (!storedUser) return null;

      const user = JSON.parse(storedUser);
      
      // Kiểm tra user có còn tồn tại trong DB không
      const { data: dbUser, error } = await supabase
        .from('users')
        .select('id, is_active, role')
        .eq('id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !dbUser) {
        sessionStorage.removeItem('user');
        localStorage.removeItem('user');
        return null;
      }

      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      sessionStorage.removeItem('user');
      localStorage.removeItem('user');
      return null;
    }
  }
}

