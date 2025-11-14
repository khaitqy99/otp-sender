import { supabase } from '@/integrations/supabase/client';

export interface CreateUserRequest {
  email: string;
  password: string;
  role: 'admin' | 'accountant' | 'cs';
  name?: string;
}

export interface User {
  id: number;
  email: string;
  password_hash?: string;
  role: string;
  name?: string;
  is_active: boolean;
  last_login?: string;
  login_attempts: number;
  locked_until?: string;
  created_at: string;
  updated_at: string;
}

export const userService = {
  /**
   * Tạo user mới - insert trực tiếp vào bảng users (giống y99kpinew)
   */
  async create(userData: CreateUserRequest): Promise<User> {
    const { email, password, role = 'accountant', name } = userData;

    // Validation
    if (!email || !email.includes('@')) {
      throw new Error('Email không hợp lệ');
    }

    if (!password || password.length < 6) {
      throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
    }

    // Kiểm tra email đã tồn tại chưa
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (existingUser) {
      throw new Error('Email đã tồn tại');
    }

    // Insert trực tiếp vào bảng users (giống y99kpinew với employees)
    // Dùng plain text password cho demo (như y99kpinew)
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.trim().toLowerCase(),
        password_hash: password, // Plain text cho demo (có thể hash sau)
        role: role,
        name: name || email.split('@')[0],
        is_active: true,
        login_attempts: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Không thể tạo user');
    }

    if (!data) {
      throw new Error('Không thể tạo user');
    }

    return data;
  },

  /**
   * Lấy danh sách tất cả users
   */
  async getAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Không thể tải danh sách users');
    }

    return data || [];
  },

  /**
   * Lấy user theo ID
   */
  async getById(id: number): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message || 'Không thể tải user');
    }

    return data;
  },

  /**
   * Lấy user theo email
   */
  async getByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('is_active', true)
      .single();

    if (error) {
      return null;
    }

    return data;
  },

  /**
   * Cập nhật role của user
   */
  async updateRole(userId: number, role: 'admin' | 'accountant' | 'cs'): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ role: role })
      .eq('id', userId);

    if (error) {
      throw new Error(error.message || 'Không thể cập nhật role');
    }
  },

  /**
   * Cập nhật user
   */
  async update(id: number, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Không thể cập nhật user');
    }

    if (!data) {
      throw new Error('Không thể cập nhật user');
    }

    return data;
  },

  /**
   * Xóa user (soft delete)
   */
  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw new Error(error.message || 'Không thể xóa user');
    }
  },
};

